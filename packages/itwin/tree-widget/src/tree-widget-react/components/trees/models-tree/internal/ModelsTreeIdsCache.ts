/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import { ModelCategoryElementsCountCache } from "../../common/internal/ModelCategoryElementsCountCache.js";
import { pushToMap } from "../../common/internal/Utils.js";

import type { InstanceKey } from "@itwin/presentation-shared";
import type { ModelsTreeDefinition } from "../ModelsTreeDefinition.js";
import type { Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchyNodeIdentifiersPath, LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";

interface SubjectInfo {
  parentSubject: Id64String | undefined;
  hideInHierarchy: boolean;
  childSubjects: Id64Set;
  childModels: Id64Set;
}

interface ModelInfo {
  isModelPrivate: boolean;
  categories: Id64Set;
  elementCount: number;
}

type ModelsTreeHierarchyConfiguration = ConstructorParameters<typeof ModelsTreeDefinition>[0]["hierarchyConfig"];

/** @internal */
export class ModelsTreeIdsCache {
  private readonly _categoryElementCounts: ModelCategoryElementsCountCache;
  private _subjectInfos: Promise<Map<Id64String, SubjectInfo>> | undefined;
  private _parentSubjectIds: Promise<Id64Array> | undefined; // the list should contain a subject id if its node should be shown as having children
  private _modelInfos: Promise<Map<Id64String, ModelInfo>> | undefined;
  private _modelWithCategoryModeledElements: Promise<Map<string, Id64Set>> | undefined;
  private _modelKeyPaths: Map<Id64String, Promise<HierarchyNodeIdentifiersPath[]>>;
  private _subjectKeyPaths: Map<Id64String, Promise<HierarchyNodeIdentifiersPath>>;
  private _categoryKeyPaths: Map<Id64String, Promise<HierarchyNodeIdentifiersPath[]>>;

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

  private async *querySubjects(): AsyncIterableIterator<{ id: Id64String; parentId?: Id64String; targetPartitionId?: Id64String; hideInHierarchy: boolean }> {
    const subjectsQuery = `
      SELECT
        s.ECInstanceId id,
        s.Parent.Id parentId,
        (
          SELECT m.ECInstanceId
          FROM bis.GeometricModel3d m
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

  private async *queryModels(): AsyncIterableIterator<{ id: Id64String; parentId: Id64String }> {
    const modelsQuery = `
      SELECT p.ECInstanceId id, p.Parent.Id parentId
      FROM bis.InformationPartitionElement p
      INNER JOIN bis.GeometricModel3d m ON m.ModeledElement.Id = p.ECInstanceId
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
          const result = new Map<Id64String, SubjectInfo>();
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
          const result = new Map<Id64String, Set<Id64String>>();
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
  public async getParentSubjectIds(): Promise<Id64String[]> {
    this._parentSubjectIds ??= (async () => {
      const subjectInfos = await this.getSubjectInfos();
      const parentSubjectIds = new Set<Id64String>();
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
  public async getChildSubjectIds(parentSubjectIds: Id64String[]): Promise<Id64String[]> {
    const childSubjectIds = new Array<Id64String>();
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
  public async getSubjectModelIds(subjectIds: Id64Array): Promise<Id64Array> {
    const subjectInfos = await this.getSubjectInfos();
    const subjectStack = [...subjectIds];
    const result = new Array<Id64String>();
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
  public async getChildSubjectModelIds(parentSubjectIds: Id64String[]): Promise<Id64String[]> {
    const subjectInfos = await this.getSubjectInfos();

    const hiddenSubjectIds = new Array<Id64String>();
    parentSubjectIds.forEach((subjectId) => {
      forEachChildSubject(subjectInfos, subjectId, (childSubjectId, childSubjectInfo) => {
        if (childSubjectInfo.hideInHierarchy) {
          hiddenSubjectIds.push(childSubjectId);
          return "continue";
        }
        return "break";
      });
    });

    const modelIds = new Array<Id64String>();
    [...parentSubjectIds, ...hiddenSubjectIds].forEach((subjectId) => {
      const subjectInfo = subjectInfos.get(subjectId);
      subjectInfo && modelIds.push(...subjectInfo.childModels);
    });
    return modelIds;
  }

  public async createSubjectInstanceKeysPath(targetSubjectId: Id64String): Promise<HierarchyNodeIdentifiersPath> {
    let entry = this._subjectKeyPaths.get(targetSubjectId);
    if (!entry) {
      entry = (async () => {
        const subjectInfos = await this.getSubjectInfos();
        const result = new Array<InstanceKey>();
        let currParentId: Id64String | undefined = targetSubjectId;
        while (currParentId) {
          if (this._hierarchyConfig.hideRootSubject && currParentId === IModel.rootSubjectId) {
            break;
          }
          const parentInfo = subjectInfos.get(currParentId);
          if (!parentInfo?.hideInHierarchy) {
            result.push({ className: "BisCore.Subject", id: currParentId });
          }
          currParentId = parentInfo?.parentSubject;
        }
        return result.reverse();
      })();
      this._subjectKeyPaths.set(targetSubjectId, entry);
    }
    return entry;
  }

  private async *queryModelElementCounts() {
    const query = /* sql */ `
      SELECT Model.Id modelId, COUNT(*) elementCount
      FROM ${this._hierarchyConfig.elementClassSpecification}
      GROUP BY Model.Id
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { modelId: row.modelId, elementCount: row.elementCount };
    }
  }

  private async *queryModelCategories() {
    const query = /* sql */ `
      SELECT this.Model.Id modelId, this.Category.Id categoryId, m.IsPrivate isModelPrivate
      FROM BisCore.Model m
      JOIN ${this._hierarchyConfig.elementClassSpecification} this ON m.ECInstanceId = this.Model.Id
      WHERE this.Parent.Id IS NULL
      GROUP BY modelId, categoryId, isModelPrivate
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { modelId: row.modelId, categoryId: row.categoryId, isModelPrivate: !!row.isModelPrivate };
    }
  }

  private async *queryModeledElements() {
    const query = `
      SELECT
        pe.ECInstanceId modeledElementId,
        pe.Category.Id categoryId,
        pe.Model.Id modelId
      FROM BisCore.Model m
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
      const modelWithCategoryModeledElements = new Map<Id64String, Id64Set>();
      for await (const { modelId, categoryId, modeledElementId } of this.queryModeledElements()) {
        const key = `${modelId}-${categoryId}`;
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
      const modelInfos = new Map<Id64String, { categories: Id64Set; elementCount: number; isModelPrivate: boolean }>();
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

  public async getModelCategories(modelId: Id64String): Promise<Id64Array> {
    const modelInfos = await this.getModelInfos();
    const categories = modelInfos.get(modelId)?.categories;
    return categories ? [...categories] : [];
  }

  public async getModelElementCount(modelId: Id64String): Promise<number> {
    const modelInfos = await this.getModelInfos();
    return modelInfos.get(modelId)?.elementCount ?? 0;
  }

  public async hasSubModel(elementId: Id64String): Promise<boolean> {
    const modelInfos = await this.getModelInfos();
    const modeledElementInfo = modelInfos.get(elementId);
    if (!modeledElementInfo) {
      return false;
    }
    return !modeledElementInfo.isModelPrivate;
  }

  public async getCategoriesModeledElements(modelId: Id64String, categoryIds: Id64Array): Promise<Id64Array> {
    const modelWithCategoryModeledElements = await this.getModelWithCategoryModeledElements();
    const result = new Array<Id64String>();
    for (const categoryId of categoryIds) {
      const entry = modelWithCategoryModeledElements.get(`${modelId}-${categoryId}`);
      if (entry !== undefined) {
        result.push(...entry);
      }
    }
    return result;
  }

  public async createModelInstanceKeyPaths(modelId: Id64String): Promise<HierarchyNodeIdentifiersPath[]> {
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

  public async getCategoryElementsCount(modelId: Id64String, categoryId: Id64String): Promise<number> {
    return this._categoryElementCounts.getCategoryElementsCount(modelId, categoryId);
  }

  public async createCategoryInstanceKeyPaths(categoryId: Id64String): Promise<HierarchyNodeIdentifiersPath[]> {
    let entry = this._categoryKeyPaths.get(categoryId);
    if (!entry) {
      entry = (async () => {
        const result = new Set<Id64String>();
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
            categoryPaths.push([...modelPath, { className: "BisCore.SpatialCategory", id: categoryId }]);
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
  subjectInfos: Map<Id64String, SubjectInfo>,
  parentSubject: Id64String | SubjectInfo,
  cb: (childSubjectId: Id64String, childSubjectInfo: SubjectInfo) => "break" | "continue",
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
