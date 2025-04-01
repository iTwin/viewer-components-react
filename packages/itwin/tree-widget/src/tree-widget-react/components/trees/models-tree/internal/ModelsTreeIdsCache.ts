/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import {
  GEOMETRIC_MODEL_3D_CLASS_NAME,
  INFORMATION_PARTITION_ELEMENT_CLASS_NAME,
  MODEL_CLASS_NAME,
  SPATIAL_CATEGORY_CLASS_NAME,
  SUBJECT_CLASS_NAME,
} from "../../common/internal/ClassNameDefinitions.js";
import { ModelCategoryElementsCountCache } from "../../common/internal/ModelCategoryElementsCountCache.js";
import { pushToMap } from "../../common/internal/Utils.js";

import type { InstanceKey } from "@itwin/presentation-shared";
import type { ModelsTreeDefinition } from "../ModelsTreeDefinition.js";
import type { Id64Set } from "@itwin/core-bentley";
import type { HierarchyNodeIdentifiersPath, LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ElementId, ModelId, SubjectId } from "../../common/internal/Types.js";

interface SubjectInfo {
  parentSubject: SubjectId | undefined;
  hideInHierarchy: boolean;
  childSubjects: Set<SubjectId>;
  childModels: Set<ModelId>;
}

interface ModelInfo {
  isModelPrivate: boolean;
  categories: Set<CategoryId>;
  elementCount: number;
}

type ModelsTreeHierarchyConfiguration = ConstructorParameters<typeof ModelsTreeDefinition>[0]["hierarchyConfig"];

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

/** @internal */
export class ModelsTreeIdsCache {
  private readonly _categoryElementCounts: ModelCategoryElementsCountCache;
  private _subjectInfos: Promise<Map<SubjectId, SubjectInfo>> | undefined;
  private _parentSubjectIds: Promise<Array<SubjectId>> | undefined; // the list should contain a subject id if its node should be shown as having children
  private _modelInfos: Promise<Map<ModelId, ModelInfo>> | undefined;
  private _modelWithCategoryModeledElements: Promise<Map<ModelCategoryKey, Set<ElementId>>> | undefined;
  private _modelKeyPaths: Map<ModelId, Promise<HierarchyNodeIdentifiersPath[]>>;
  private _subjectKeyPaths: Map<SubjectId, Promise<HierarchyNodeIdentifiersPath>>;
  private _categoryKeyPaths: Map<CategoryId, Promise<HierarchyNodeIdentifiersPath[]>>;

  constructor(
    private _queryExecutor: LimitingECSqlQueryExecutor,
    private _hierarchyConfig: ModelsTreeHierarchyConfiguration,
  ) {
    this._categoryElementCounts = new ModelCategoryElementsCountCache(_queryExecutor, this._hierarchyConfig.elementClassSpecification);
    this._modelKeyPaths = new Map();
    this._subjectKeyPaths = new Map();
    this._categoryKeyPaths = new Map();
  }

  public [Symbol.dispose]() {
    this._categoryElementCounts[Symbol.dispose]();
  }

  private async *querySubjects(): AsyncIterableIterator<{ id: SubjectId; parentId?: SubjectId; targetPartitionId?: ModelId; hideInHierarchy: boolean }> {
    const subjectsQuery = `
      SELECT
        s.ECInstanceId id,
        s.Parent.Id parentId,
        (
          SELECT m.ECInstanceId
          FROM ${GEOMETRIC_MODEL_3D_CLASS_NAME} m
          WHERE m.ECInstanceId = HexToId(json_extract(s.JsonProperties, '$.Subject.Model.TargetPartition'))
            AND NOT m.IsPrivate
            AND EXISTS (SELECT 1 FROM ${this._hierarchyConfig.elementClassSpecification} WHERE Model.Id = m.ECInstanceId)
        ) targetPartitionId,
        CASE
          WHEN (
            json_extract(s.JsonProperties, '$.Subject.Job.Bridge') IS NOT NULL
            OR json_extract(s.JsonProperties, '$.Subject.Model.Type') = 'Hierarchy'
          ) THEN 1
          ELSE 0
        END hideInHierarchy
      FROM bis.Subject s
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: subjectsQuery }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { id: row.id, parentId: row.parentId, targetPartitionId: row.targetPartitionId, hideInHierarchy: !!row.hideInHierarchy };
    }
  }

  private async *queryModels(): AsyncIterableIterator<{ id: ModelId; parentId: SubjectId }> {
    const modelsQuery = `
      SELECT p.ECInstanceId id, p.Parent.Id parentId
      FROM ${INFORMATION_PARTITION_ELEMENT_CLASS_NAME} p
      INNER JOIN ${GEOMETRIC_MODEL_3D_CLASS_NAME} m ON m.ModeledElement.Id = p.ECInstanceId
      WHERE
        NOT m.IsPrivate
        ${this._hierarchyConfig.showEmptyModels ? "" : `AND EXISTS (SELECT 1 FROM ${this._hierarchyConfig.elementClassSpecification} WHERE Model.Id = m.ECInstanceId)`}
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: modelsQuery }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { id: row.id, parentId: row.parentId };
    }
  }

  private async getSubjectInfos() {
    this._subjectInfos ??= (async () => {
      const [subjectInfos, targetPartitionSubjects] = await Promise.all([
        (async () => {
          const result = new Map<SubjectId, SubjectInfo>();
          for await (const subject of this.querySubjects()) {
            const subjectInfo: SubjectInfo = {
              parentSubject: subject.parentId,
              hideInHierarchy: subject.hideInHierarchy,
              childSubjects: new Set(),
              childModels: new Set(),
            };
            if (subject.targetPartitionId) {
              subjectInfo.childModels.add(subject.targetPartitionId);
            }
            result.set(subject.id, subjectInfo);
          }
          return result;
        })(),
        (async () => {
          const result = new Map<ModelId, Set<SubjectId>>();
          for await (const model of this.queryModels()) {
            pushToMap(result, model.id, model.parentId);
          }
          return result;
        })(),
      ]);

      for (const [subjectId, { parentSubject: parentSubjectId }] of subjectInfos.entries()) {
        if (parentSubjectId) {
          const parentSubjectInfo = subjectInfos.get(parentSubjectId);
          assert(!!parentSubjectInfo);
          parentSubjectInfo.childSubjects.add(subjectId);
        }
      }

      for (const [partitionId, subjectIds] of targetPartitionSubjects) {
        subjectIds.forEach((subjectId) => {
          const subjectInfo = subjectInfos.get(subjectId);
          assert(!!subjectInfo);
          subjectInfo.childModels.add(partitionId);
        });
      }

      return subjectInfos;
    })();
    return this._subjectInfos;
  }

  /** Returns ECInstanceIDs of Subjects that either have direct Model or at least one child Subject with a Model. */
  public async getParentSubjectIds(): Promise<Array<SubjectId>> {
    this._parentSubjectIds ??= (async () => {
      const subjectInfos = await this.getSubjectInfos();
      const parentSubjectIds = new Set<SubjectId>();
      subjectInfos.forEach((subjectInfo, subjectId) => {
        if (subjectInfo.childModels.size > 0) {
          parentSubjectIds.add(subjectId);
          let currParentId = subjectInfo.parentSubject;
          while (currParentId) {
            parentSubjectIds.add(currParentId);
            currParentId = subjectInfos.get(currParentId)?.parentSubject;
          }
        }
      });
      return [...parentSubjectIds];
    })();
    return this._parentSubjectIds;
  }

  /**
   * Returns child subjects of the specified parent subjects as they're displayed in the hierarchy - taking into
   * account `hideInHierarchy` flag.
   */
  public async getChildSubjectIds(parentSubjectIds: Array<SubjectId>): Promise<Array<SubjectId>> {
    const childSubjectIds = new Array<SubjectId>();
    const subjectInfos = await this.getSubjectInfos();
    parentSubjectIds.forEach((subjectId) => {
      forEachChildSubject(subjectInfos, subjectId, (childSubjectId, childSubjectInfo) => {
        if (!childSubjectInfo.hideInHierarchy) {
          childSubjectIds.push(childSubjectId);
          return "break";
        }
        return "continue";
      });
    });
    return childSubjectIds;
  }

  /** Returns ECInstanceIDs of all Models under specific parent Subjects, including their child Subjects, etc. */
  public async getSubjectModelIds(subjectIds: Array<SubjectId>): Promise<Array<ModelId>> {
    const subjectInfos = await this.getSubjectInfos();
    const subjectStack = [...subjectIds];
    const result = new Array<ModelId>();
    while (true) {
      const subjectId = subjectStack.pop();
      if (subjectId === undefined) {
        break;
      }
      const subjectInfo = subjectInfos.get(subjectId);
      if (!subjectInfo) {
        continue;
      }
      result.push(...subjectInfo.childModels);
      subjectStack.push(...subjectInfo.childSubjects);
    }
    return result;
  }

  /** Returns ECInstanceIDs of Models under specific parent Subjects as they are displayed in the hierarchy. */
  public async getChildSubjectModelIds(parentSubjectIds: Array<SubjectId>): Promise<Array<ModelId>> {
    const subjectInfos = await this.getSubjectInfos();

    const hiddenSubjectIds = new Array<SubjectId>();
    parentSubjectIds.forEach((subjectId) => {
      forEachChildSubject(subjectInfos, subjectId, (childSubjectId, childSubjectInfo) => {
        if (childSubjectInfo.hideInHierarchy) {
          hiddenSubjectIds.push(childSubjectId);
          return "continue";
        }
        return "break";
      });
    });

    const modelIds = new Array<ModelId>();
    [...parentSubjectIds, ...hiddenSubjectIds].forEach((subjectId) => {
      const subjectInfo = subjectInfos.get(subjectId);
      subjectInfo && modelIds.push(...subjectInfo.childModels);
    });
    return modelIds;
  }

  public async createSubjectInstanceKeysPath(targetSubjectId: SubjectId): Promise<HierarchyNodeIdentifiersPath> {
    let entry = this._subjectKeyPaths.get(targetSubjectId);
    if (!entry) {
      entry = (async () => {
        const subjectInfos = await this.getSubjectInfos();
        const result = new Array<InstanceKey>();
        let currParentId: SubjectId | undefined = targetSubjectId;
        while (currParentId) {
          if (this._hierarchyConfig.hideRootSubject && currParentId === IModel.rootSubjectId) {
            break;
          }
          const parentInfo = subjectInfos.get(currParentId);
          if (!parentInfo?.hideInHierarchy) {
            result.push({ className: SUBJECT_CLASS_NAME, id: currParentId });
          }
          currParentId = parentInfo?.parentSubject;
        }
        return result.reverse();
      })();
      this._subjectKeyPaths.set(targetSubjectId, entry);
    }
    return entry;
  }

  private async *queryModelElementCounts(): AsyncIterableIterator<{ modelId: ModelId; elementCount: number }> {
    const query = `
      SELECT Model.Id modelId, COUNT(*) elementCount
      FROM ${this._hierarchyConfig.elementClassSpecification}
      GROUP BY Model.Id
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { modelId: row.modelId, elementCount: row.elementCount };
    }
  }

  private async *queryModelCategories(): AsyncIterableIterator<{ modelId: ModelId; categoryId: CategoryId; isModelPrivate: boolean }> {
    const query = `
      SELECT this.Model.Id modelId, this.Category.Id categoryId, m.IsPrivate isModelPrivate
      FROM ${MODEL_CLASS_NAME} m
      JOIN ${this._hierarchyConfig.elementClassSpecification} this ON m.ECInstanceId = this.Model.Id
      WHERE this.Parent.Id IS NULL
      GROUP BY modelId, categoryId, isModelPrivate
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { modelId: row.modelId, categoryId: row.categoryId, isModelPrivate: !!row.isModelPrivate };
    }
  }

  private async *queryModeledElements(): AsyncIterableIterator<{ modelId: ModelId; categoryId: CategoryId; modeledElementId: ElementId }> {
    const query = `
      SELECT
        pe.ECInstanceId modeledElementId,
        pe.Category.Id categoryId,
        pe.Model.Id modelId
      FROM ${MODEL_CLASS_NAME} m
      JOIN ${this._hierarchyConfig.elementClassSpecification} pe ON pe.ECInstanceId = m.ModeledElement.Id
      WHERE
        m.IsPrivate = false
        AND m.ECInstanceId IN (SELECT Model.Id FROM ${this._hierarchyConfig.elementClassSpecification})
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { modelId: row.modelId, categoryId: row.categoryId, modeledElementId: row.modeledElementId };
    }
  }

  private async getModelWithCategoryModeledElements() {
    this._modelWithCategoryModeledElements ??= (async () => {
      const modelWithCategoryModeledElements = new Map<ModelCategoryKey, Id64Set>();
      for await (const { modelId, categoryId, modeledElementId } of this.queryModeledElements()) {
        const key: ModelCategoryKey = `${modelId}-${categoryId}`;
        const entry = modelWithCategoryModeledElements.get(key);
        if (entry === undefined) {
          modelWithCategoryModeledElements.set(key, new Set([modeledElementId]));
        } else {
          entry.add(modeledElementId);
        }
      }
      return modelWithCategoryModeledElements;
    })();
    return this._modelWithCategoryModeledElements;
  }

  private async getModelInfos() {
    this._modelInfos ??= (async () => {
      const modelInfos = new Map<ModelId, { categories: Set<CategoryId>; elementCount: number; isModelPrivate: boolean }>();
      await Promise.all([
        (async () => {
          for await (const { modelId, categoryId, isModelPrivate } of this.queryModelCategories()) {
            const entry = modelInfos.get(modelId);
            if (entry) {
              entry.categories.add(categoryId);
              entry.isModelPrivate = isModelPrivate;
            } else {
              modelInfos.set(modelId, { categories: new Set([categoryId]), elementCount: 0, isModelPrivate });
            }
          }
        })(),
        (async () => {
          for await (const { modelId, elementCount } of this.queryModelElementCounts()) {
            const entry = modelInfos.get(modelId);
            if (entry) {
              entry.elementCount = elementCount;
            } else {
              modelInfos.set(modelId, { categories: new Set(), elementCount, isModelPrivate: false });
            }
          }
        })(),
      ]);
      return modelInfos;
    })();
    return this._modelInfos;
  }

  public async getModelCategories(modelId: ModelId): Promise<Array<CategoryId>> {
    const modelInfos = await this.getModelInfos();
    const categories = modelInfos.get(modelId)?.categories;
    return categories ? [...categories] : [];
  }

  public async getModelElementCount(modelId: ModelId): Promise<number> {
    const modelInfos = await this.getModelInfos();
    return modelInfos.get(modelId)?.elementCount ?? 0;
  }

  public async hasSubModel(elementId: ElementId): Promise<boolean> {
    const modelInfos = await this.getModelInfos();
    const modeledElementInfo = modelInfos.get(elementId);
    if (!modeledElementInfo) {
      return false;
    }
    return !modeledElementInfo.isModelPrivate;
  }

  public async getCategoriesModeledElements(modelId: ModelId, categoryIds: Array<CategoryId>): Promise<Array<ElementId>> {
    const modelWithCategoryModeledElements = await this.getModelWithCategoryModeledElements();
    const result = new Array<ElementId>();
    for (const categoryId of categoryIds) {
      const entry = modelWithCategoryModeledElements.get(`${modelId}-${categoryId}`);
      if (entry !== undefined) {
        result.push(...entry);
      }
    }
    return result;
  }

  public async createModelInstanceKeyPaths(modelId: ModelId): Promise<HierarchyNodeIdentifiersPath[]> {
    let entry = this._modelKeyPaths.get(modelId);
    if (!entry) {
      entry = (async () => {
        const result = new Array<HierarchyNodeIdentifiersPath>();
        const subjectInfos = (await this.getSubjectInfos()).entries();
        for (const [modelSubjectId, subjectInfo] of subjectInfos) {
          if (subjectInfo.childModels.has(modelId)) {
            const subjectPath = await this.createSubjectInstanceKeysPath(modelSubjectId);
            result.push([...subjectPath, { className: "BisCore.GeometricModel3d", id: modelId }]);
          }
        }
        return result;
      })();

      this._modelKeyPaths.set(modelId, entry);
    }
    return entry;
  }

  public async getCategoryElementsCount(modelId: ModelId, categoryId: CategoryId): Promise<number> {
    return this._categoryElementCounts.getCategoryElementsCount(modelId, categoryId);
  }

  public async createCategoryInstanceKeyPaths(categoryId: CategoryId): Promise<HierarchyNodeIdentifiersPath[]> {
    let entry = this._categoryKeyPaths.get(categoryId);
    if (!entry) {
      entry = (async () => {
        const result = new Set<ModelId>();
        const modelInfos = await this.getModelInfos();
        modelInfos?.forEach((modelInfo, modelId) => {
          if (modelInfo.categories.has(categoryId)) {
            result.add(modelId);
          }
        });

        const categoryPaths = new Array<HierarchyNodeIdentifiersPath>();
        for (const categoryModelId of [...result]) {
          const modelPaths = await this.createModelInstanceKeyPaths(categoryModelId);
          for (const modelPath of modelPaths) {
            categoryPaths.push([...modelPath, { className: SPATIAL_CATEGORY_CLASS_NAME, id: categoryId }]);
          }
        }
        return categoryPaths;
      })();
      this._categoryKeyPaths.set(categoryId, entry);
    }
    return entry;
  }
}

function forEachChildSubject(
  subjectInfos: Map<SubjectId, SubjectInfo>,
  parentSubject: SubjectId | SubjectInfo,
  cb: (childSubjectId: SubjectId, childSubjectInfo: SubjectInfo) => "break" | "continue",
) {
  const parentSubjectInfo = typeof parentSubject === "string" ? subjectInfos.get(parentSubject) : parentSubject;
  parentSubjectInfo &&
    parentSubjectInfo.childSubjects.forEach((childSubjectId) => {
      const childSubjectInfo = subjectInfos.get(childSubjectId)!;
      if (cb(childSubjectId, childSubjectInfo) === "break") {
        return;
      }
      forEachChildSubject(subjectInfos, childSubjectInfo, cb);
    });
}
