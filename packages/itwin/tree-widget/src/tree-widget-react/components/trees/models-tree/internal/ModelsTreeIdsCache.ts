/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert, Id64 } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import {
  ELEMENT_CLASS_NAME,
  GEOMETRIC_MODEL_3D_CLASS_NAME,
  INFORMATION_PARTITION_ELEMENT_CLASS_NAME,
  MODEL_CLASS_NAME,
  SUBJECT_CLASS_NAME,
} from "../../common/internal/ClassNameDefinitions.js";
import { pushToMap } from "../../common/internal/Utils.js";
import { ModelCategoryElementsCountCache } from "../../common/internal/withParents/ModelCategoryElementsCountCache.js";

import type { InstanceKey } from "@itwin/presentation-shared";
import type { ModelsTreeDefinition } from "../ModelsTreeDefinition.js";
import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchyNodeIdentifiersPath, LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ElementId, ModelId, ParentId, SubjectId } from "../../common/internal/Types.js";

interface SubjectInfo {
  parentSubjectId: Id64String | undefined;
  hideInHierarchy: boolean;
  childSubjectIds: Id64Set;
  childModelIds: Id64Set;
}

type ModelsTreeHierarchyConfiguration = ConstructorParameters<typeof ModelsTreeDefinition>[0]["hierarchyConfig"];

/** @internal */
export type ParentElementMap = Map<ParentId | undefined, Map<CategoryId, Set<ElementId>>>;

/** @internal */
export class ModelsTreeIdsCache {
  private readonly _categoryElementCounts: ModelCategoryElementsCountCache;
  private _subjectInfos: Promise<Map<SubjectId, SubjectInfo>> | undefined;
  private _parentSubjectIds: Promise<Id64Array> | undefined; // the list should contain a subject id if its node should be shown as having children
  private _modelsCategoriesInfos: Promise<Map<ModelId, Map<CategoryId, boolean>>> | undefined;
  private _modeledElementsMap: Promise<Map<ModelId, ParentElementMap>> | undefined;
  private _modelKeyPaths: Map<ModelId, Promise<HierarchyNodeIdentifiersPath[]>>;
  private _subjectKeyPaths: Map<SubjectId, Promise<HierarchyNodeIdentifiersPath>>;
  private _modelParentInfoMap: Map<ModelId, Promise<ParentElementMap>>;

  constructor(
    private _queryExecutor: LimitingECSqlQueryExecutor,
    private _hierarchyConfig: ModelsTreeHierarchyConfiguration,
  ) {
    this._categoryElementCounts = new ModelCategoryElementsCountCache(_queryExecutor, this._hierarchyConfig.elementClassSpecification);
    this._modelKeyPaths = new Map();
    this._subjectKeyPaths = new Map();
    this._modelParentInfoMap = new Map();
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
              parentSubjectId: subject.parentId,
              hideInHierarchy: subject.hideInHierarchy,
              childSubjectIds: new Set(),
              childModelIds: new Set(),
            };
            if (subject.targetPartitionId) {
              subjectInfo.childModelIds.add(subject.targetPartitionId);
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

      for (const [subjectId, { parentSubjectId }] of subjectInfos.entries()) {
        if (parentSubjectId) {
          const parentSubjectInfo = subjectInfos.get(parentSubjectId);
          assert(!!parentSubjectInfo);
          parentSubjectInfo.childSubjectIds.add(subjectId);
        }
      }

      for (const [partitionId, subjectIds] of targetPartitionSubjects) {
        subjectIds.forEach((subjectId) => {
          const subjectInfo = subjectInfos.get(subjectId);
          assert(!!subjectInfo);
          subjectInfo.childModelIds.add(partitionId);
        });
      }

      return subjectInfos;
    })();
    return this._subjectInfos;
  }

  /** Returns ECInstanceIDs of Subjects that either have direct Model or at least one child Subject with a Model. */
  public async getParentSubjectIds(): Promise<Id64Array> {
    this._parentSubjectIds ??= (async () => {
      const subjectInfos = await this.getSubjectInfos();
      const parentSubjectIds = new Set<SubjectId>();
      subjectInfos.forEach((subjectInfo, subjectId) => {
        if (subjectInfo.childModelIds.size > 0) {
          parentSubjectIds.add(subjectId);
          let currParentId = subjectInfo.parentSubjectId;
          while (currParentId) {
            parentSubjectIds.add(currParentId);
            currParentId = subjectInfos.get(currParentId)?.parentSubjectId;
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
  public async getChildSubjectIds(parentSubjectIds: Id64Array): Promise<Id64Array> {
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
  public async getSubjectModelIds(subjectIds: Id64Array): Promise<Id64Array> {
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
      result.push(...subjectInfo.childModelIds);
      subjectStack.push(...subjectInfo.childSubjectIds);
    }
    return result;
  }

  /** Returns ECInstanceIDs of Models under specific parent Subjects as they are displayed in the hierarchy. */
  public async getChildSubjectModelIds(parentSubjectIds: Id64Array): Promise<Id64Array> {
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
      subjectInfo && modelIds.push(...subjectInfo.childModelIds);
    });
    return modelIds;
  }

  public async createSubjectInstanceKeysPath(targetSubjectId: Id64String): Promise<HierarchyNodeIdentifiersPath> {
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
          currParentId = parentInfo?.parentSubjectId;
        }
        return result.reverse();
      })();
      this._subjectKeyPaths.set(targetSubjectId, entry);
    }
    return entry;
  }

  private async *queryModelsCategories(): AsyncIterableIterator<{ modelId: Id64String; categoryId: Id64String; isCategoryOfRootElement: boolean }> {
    const query = `
      SELECT
        this.Model.Id modelId,
        this.Category.Id categoryId,
        MAX(IIF(this.Parent.Id IS NULL, 1, 0)) isCategoryOfRootElement
      FROM ${MODEL_CLASS_NAME} m
      JOIN ${this._hierarchyConfig.elementClassSpecification} this ON m.ECInstanceId = this.Model.Id
      WHERE m.IsPrivate = false
      GROUP BY modelId, categoryId
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { modelId: row.modelId, categoryId: row.categoryId, isCategoryOfRootElement: !!row.isCategoryOfRootElement };
    }
  }

  private async *queryModeledElements(): AsyncIterableIterator<{
    modelId: Id64String;
    categoryId: Id64String;
    modeledElementId: Id64String;
    parentId?: Id64String;
  }> {
    const query = `
      SELECT
        pe.ECInstanceId modeledElementId,
        pe.Category.Id categoryId,
        pe.Model.Id modelId,
        pe.Parent.Id parentId
      FROM ${MODEL_CLASS_NAME} m
      JOIN ${this._hierarchyConfig.elementClassSpecification} pe ON pe.ECInstanceId = m.ModeledElement.Id
      WHERE
        m.IsPrivate = false
        AND m.ECInstanceId IN (SELECT Model.Id FROM ${this._hierarchyConfig.elementClassSpecification})
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { modelId: row.modelId, categoryId: row.categoryId, modeledElementId: row.modeledElementId, parentId: row.parentId };
    }
  }

  private async getModeledElementsMap() {
    this._modeledElementsMap ??= (async () => {
      const modeledElementsMap = new Map<ModelId, ParentElementMap>();
      for await (const { modelId, categoryId, modeledElementId, parentId } of this.queryModeledElements()) {
        let modelEntry = modeledElementsMap.get(modelId);
        if (!modelEntry) {
          modelEntry = new Map();
          modeledElementsMap.set(modelId, modelEntry);
        }
        let parentEntry = modelEntry.get(parentId);
        if (!parentEntry) {
          parentEntry = new Map();
          modelEntry.set(parentId, parentEntry);
        }
        let categoryEntry = parentEntry.get(categoryId);
        if (!categoryEntry) {
          categoryEntry = new Set<Id64String>();
          parentEntry.set(categoryId, categoryEntry);
        }
        categoryEntry.add(modeledElementId);
      }
      return modeledElementsMap;
    })();
    return this._modeledElementsMap;
  }

  private async getModelsCategoriesInfos() {
    this._modelsCategoriesInfos ??= (async () => {
      const modelInfos = new Map<ModelId, Map<CategoryId, boolean>>();
      for await (const { modelId, categoryId, isCategoryOfRootElement } of this.queryModelsCategories()) {
        const entry = modelInfos.get(modelId);
        if (entry) {
          entry.set(categoryId, isCategoryOfRootElement);
        } else {
          modelInfos.set(modelId, new Map([[categoryId, isCategoryOfRootElement]]));
        }
      }
      return modelInfos;
    })();
    return this._modelsCategoriesInfos;
  }

  public async getModelCategoryIds(modelId: Id64String): Promise<Id64Array> {
    const modelInfos = await this.getModelsCategoriesInfos();
    const categories = modelInfos.get(modelId);
    return categories ? [...categories].filter(([, isCategoryOfRootElement]) => isCategoryOfRootElement).map(([categoryId]) => categoryId) : [];
  }

  public async getAllModelCategoryIds(modelId: Id64String): Promise<Id64Array> {
    const modelInfos = await this.getModelsCategoriesInfos();
    const categories = modelInfos.get(modelId);
    return categories ? [...categories.keys()] : [];
  }

  public async hasSubModel(elementId: Id64String): Promise<boolean> {
    const modelInfos = await this.getModelsCategoriesInfos();
    return modelInfos.has(elementId);
  }

  public async getCategoriesModeledElements(props: {
    modelId: Id64String;
    categoryIds: Id64Arg;
    parentIds?: Id64Arg;
    includeNested: boolean;
  }): Promise<Id64Array> {
    const modelWithCategoryModeledElements = await this.getModeledElementsMap();
    const { modelId, categoryIds, parentIds, includeNested } = props;
    const result = new Array<ElementId>();
    for (const parentId of parentIds ? Id64.iterable(parentIds) : [undefined]) {
      for (const categoryId of Id64.iterable(categoryIds)) {
        const entry = modelWithCategoryModeledElements.get(modelId)?.get(parentId)?.get(categoryId);
        if (entry !== undefined) {
          result.push(...entry);
        }
      }
    }
    if (!includeNested) {
      return result;
    }
    const childCategoriesMap = await this.getCategoryChildCategories({ modelId, categoryIds, parentElementIds: parentIds });
    await Promise.all(
      [...childCategoriesMap.entries()].map(async ([childParent, childCategories]) => {
        const childModeledElements = await this.getCategoriesModeledElements({
          modelId,
          categoryIds: childCategories,
          parentIds: childParent,
          includeNested: true,
        });
        result.push(...childModeledElements);
      }),
    );
    return result;
  }

  public async createModelInstanceKeyPaths(modelId: Id64String): Promise<HierarchyNodeIdentifiersPath[]> {
    let entry = this._modelKeyPaths.get(modelId);
    if (!entry) {
      entry = (async () => {
        const result = new Array<HierarchyNodeIdentifiersPath>();
        const subjectInfos = (await this.getSubjectInfos()).entries();
        for (const [modelSubjectId, subjectInfo] of subjectInfos) {
          if (subjectInfo.childModelIds.has(modelId)) {
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

  public async getCategoryElementsCount(modelId: Id64String, categoryId: Id64String, parentElementIds?: Id64Arg): Promise<number> {
    const parentIdsForCount = !parentElementIds ? undefined : typeof parentElementIds === "string" ? [parentElementIds] : [...parentElementIds];
    return this._categoryElementCounts.getCategoryElementsCount(modelId, categoryId, parentIdsForCount);
  }

  private async queryParentElementMap({ modelId }: { modelId: ModelId }): Promise<ParentElementMap> {
    const reader = this._queryExecutor.createQueryReader(
      {
        ecsql: `
          SELECT
            *
          FROM
            (
              SELECT
                childElement.Parent.Id parentId,
                childElement.Category.Id categoryId,
                IIF(
                  EXISTS (
                    SELECT
                      1
                    FROM
                      ${ELEMENT_CLASS_NAME} childOfChild
                    WHERE
                      childOfChild.Parent.Id = childElement.ECInstanceId
                      AND childOfChild.ECClassId IS (${this._hierarchyConfig.elementClassSpecification})
                  ),
                  IdToHex(childElement.ECInstanceId),
                  CAST(NULL AS TEXT)
                ) AS id
              FROM
                ${this._hierarchyConfig.elementClassSpecification} childElement
              WHERE
                childElement.Parent.Id IS NOT NULL
                AND childElement.Model.Id = ${modelId}
            )
          GROUP BY
            parentId,
            categoryId,
            id

          UNION ALL

          SELECT
            rootParentElement.Parent.Id parentId,
            rootParentElement.Category.Id categoryId,
            IdToHex(rootParentElement.ECInstanceId) id
          FROM
            ${this._hierarchyConfig.elementClassSpecification} rootParentElement
          WHERE
            rootParentElement.Parent.Id IS NULL
            AND rootParentElement.Model.Id = ${modelId}
            AND EXISTS (
              SELECT
                1
              FROM
                ${ELEMENT_CLASS_NAME} childElement
              WHERE
                childElement.Parent.Id = rootParentElement.ECInstanceId
                AND childElement.ECClassId IS (${this._hierarchyConfig.elementClassSpecification})
            )
        `,
      },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded" },
    );

    const result: ParentElementMap = new Map();
    for await (const row of reader) {
      const parentElementId = row.parentId ?? undefined;
      let categoryMap = result.get(parentElementId);
      if (!categoryMap) {
        categoryMap = new Map();
        result.set(parentElementId, categoryMap);
      }
      let childElements = categoryMap.get(row.categoryId);
      if (!childElements) {
        childElements = new Set();
        categoryMap.set(row.categoryId, childElements);
      }
      if (row.id) {
        childElements.add(row.id);
      }
    }
    return result;
  }

  private async getParentElementMap(modelId: Id64String): Promise<ParentElementMap> {
    let parentElementMap = this._modelParentInfoMap.get(modelId);
    if (!parentElementMap) {
      parentElementMap = this.queryParentElementMap({ modelId });
      this._modelParentInfoMap.set(modelId, parentElementMap);
    }
    return parentElementMap;
  }

  public async getCategoryChildCategories(props: {
    modelId: Id64String;
    categoryIds: Id64Arg;
    parentElementIds?: Id64Arg;
  }): Promise<Map<ParentId, Set<CategoryId>>> {
    const { modelId, categoryIds, parentElementIds } = props;
    const parentElementMap = await this.getParentElementMap(modelId);
    const result = new Map<ParentId, Set<CategoryId>>();
    for (const parentElementId of parentElementIds ? Id64.iterable(parentElementIds) : [undefined]) {
      const allDirectChildren = new Set<Id64String>();
      for (const categoryId of Id64.iterable(categoryIds)) {
        const directChildren = parentElementMap.get(parentElementId)?.get(categoryId);
        directChildren?.forEach((directChild) => allDirectChildren.add(directChild));
      }

      for (const childElement of allDirectChildren) {
        const childElementChildCategoriesMap = parentElementMap.get(childElement);
        if (childElementChildCategoriesMap) {
          result.set(childElement, new Set(childElementChildCategoriesMap.keys()));
        }
      }
    }
    return result;
  }

  public async getElementsChildCategories(props: { modelId: Id64String; elementIds: Id64Set }): Promise<Map<ParentId, Set<CategoryId>>> {
    const { modelId, elementIds } = props;
    const parentElementMap = await this.getParentElementMap(modelId);
    const result = new Map<ParentId, Set<CategoryId>>();
    for (const elementId of elementIds) {
      const childCategories = parentElementMap.get(elementId);
      if (childCategories) {
        result.set(elementId, new Set(childCategories.keys()));
      }
    }
    return result;
  }

  private async queryCategoryAllIndirectChildren(props: {
    modelId: Id64String;
    categoryId: Id64String;
    parentElementIds?: Id64Array;
  }): Promise<Map<CategoryId, Set<ElementId>>> {
    const reader = this._queryExecutor.createQueryReader(
      {
        ctes: [
          `ParentsChildrenInfo (Id, CategoryId, IsDirectChild) AS (
            SELECT
              this.ECInstanceId,
              this.Category.Id,
              true
            FROM ${this._hierarchyConfig.elementClassSpecification} this
            WHERE
              this.Model.Id = ${props.modelId} AND this.Category.Id = ${props.categoryId} AND this.Parent.Id ${props.parentElementIds && props.parentElementIds.length > 0 ? `IN (${props.parentElementIds.join(", ")})` : "IS NULL"}
            UNION ALL
            SELECT
              c.ECInstanceId,
              c.Category.Id,
              false
            FROM
              ${this._hierarchyConfig.elementClassSpecification} c
              JOIN ParentsChildrenInfo p ON c.Parent.Id = p.Id
          )`,
        ],
        ecsql: `
          SELECT
            this.CategoryId categoryId,
            this.Id id
          FROM ParentsChildrenInfo this
          WHERE this.IsDirectChild = false
        `,
      },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded" },
    );

    const result = new Map<CategoryId, Set<ElementId>>();
    for await (const row of reader) {
      let elements = result.get(row.categoryId);
      if (!elements) {
        elements = new Set();
        result.set(row.categoryId, elements);
      }
      elements.add(row.id);
    }
    return result;
  }

  public async getCategoryAllIndirectChildren(props: {
    modelId: Id64String;
    categoryId: Id64String;
    parentElementIds?: Id64Arg;
  }): Promise<Map<CategoryId, Set<ElementId>>> {
    const parentIdsForQuery = !props.parentElementIds
      ? undefined
      : typeof props.parentElementIds === "string"
        ? [props.parentElementIds]
        : [...props.parentElementIds];
    return this.queryCategoryAllIndirectChildren({ ...props, parentElementIds: parentIdsForQuery });
  }

  private async queryElementsAllChildren(props: { modelId: Id64String; elementIds: Id64Array }): Promise<Map<CategoryId, Set<ElementId>>> {
    const reader = this._queryExecutor.createQueryReader(
      {
        ctes: [
          `ParentsChildrenInfo (Id, CategoryId) AS (
            SELECT
              this.ECInstanceId,
              this.Category.Id
            FROM ${this._hierarchyConfig.elementClassSpecification} this
            WHERE
              this.Model.Id = ${props.modelId} AND this.Parent.Id IN (${props.elementIds.join(", ")})
            UNION ALL
            SELECT
              c.ECInstanceId,
              c.Category.Id
            FROM
              ${this._hierarchyConfig.elementClassSpecification} c
              JOIN ParentsChildrenInfo p ON c.Parent.Id = p.Id
          )`,
        ],
        ecsql: `
          SELECT
            this.CategoryId categoryId,
            this.Id id
          FROM ParentsChildrenInfo this
        `,
      },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded" },
    );

    const result = new Map<CategoryId, Set<ElementId>>();
    for await (const row of reader) {
      let elements = result.get(row.categoryId);
      if (!elements) {
        elements = new Set();
        result.set(row.categoryId, elements);
      }
      elements.add(row.id);
    }
    return result;
  }

  public async getElementsAllChildren(props: { modelId: Id64String; elementIds: Id64Array }): Promise<Map<CategoryId, Set<ElementId>>> {
    return this.queryElementsAllChildren(props);
  }
}

function forEachChildSubject(
  subjectInfos: Map<SubjectId, SubjectInfo>,
  parentSubject: SubjectId | SubjectInfo,
  cb: (childSubjectId: SubjectId, childSubjectInfo: SubjectInfo) => "break" | "continue",
) {
  const parentSubjectInfo = typeof parentSubject === "string" ? subjectInfos.get(parentSubject) : parentSubject;
  parentSubjectInfo &&
    parentSubjectInfo.childSubjectIds.forEach((childSubjectId) => {
      const childSubjectInfo = subjectInfos.get(childSubjectId)!;
      if (cb(childSubjectId, childSubjectInfo) === "break") {
        return;
      }
      forEachChildSubject(subjectInfos, childSubjectInfo, cb);
    });
}
