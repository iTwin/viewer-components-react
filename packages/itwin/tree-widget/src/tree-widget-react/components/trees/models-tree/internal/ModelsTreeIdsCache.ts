/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferTime, filter, firstValueFrom, mergeAll, mergeMap, ReplaySubject, Subject } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { pushToMap } from "../../common/Utils.js";

import type { Subscription } from "rxjs";
import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { HierarchyNodeIdentifiersPath, LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId, ParentId, SubjectId } from "../../common/internal/Types.js";
import type { ModelsTreeDefinition } from "../ModelsTreeDefinition.js";

interface SubjectInfo {
  parentSubject: SubjectId | undefined;
  hideInHierarchy: boolean;
  childSubjects: Set<SubjectId>;
  childModels: Set<ModelId>;
}

type ModelsTreeHierarchyConfiguration = ConstructorParameters<typeof ModelsTreeDefinition>[0]["hierarchyConfig"];

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

type ModelParentCategoryKey = `${ModelId}-${ElementId}-${CategoryId}`;

/** @internal */
export type ParentElementMap = Map<ParentId | undefined, Map<CategoryId, Set<ParentId>>>;

/** @internal */
export class ModelsTreeIdsCache {
  private readonly _categoryElementCounts: ModelCategoryElementsCountCache;
  private _subjectInfos: Promise<Map<SubjectId, SubjectInfo>> | undefined;
  private _parentSubjectIds: Promise<Array<SubjectId>> | undefined; // the list should contain a subject id if its node should be shown as having children
  private _modelsCategoriesInfos: Promise<Map<ModelId, Map<CategoryId, boolean>>> | undefined;
  private _modelWithCategoryModeledElements: Promise<Map<ModelCategoryKey, Set<ElementId>>> | undefined;
  private _modelKeyPaths: Map<ModelId, Promise<HierarchyNodeIdentifiersPath[]>>;
  private _subjectKeyPaths: Map<SubjectId, Promise<HierarchyNodeIdentifiersPath>>;
  private _modelParentInfoMap: Map<ModelId, Promise<ParentElementMap>>;

  constructor(
    private _queryExecutor: LimitingECSqlQueryExecutor,
    private _hierarchyConfig: ModelsTreeHierarchyConfiguration,
  ) {
    this._categoryElementCounts = new ModelCategoryElementsCountCache(async (input) => this.queryCategoryElementCounts(input));
    this._modelKeyPaths = new Map();
    this._subjectKeyPaths = new Map();
    this._modelParentInfoMap = new Map();
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

  private async *queryModelsCategories(): AsyncIterableIterator<{ modelId: ModelId; categoryId: CategoryId; isCategoryOfRootElement: boolean }> {
    const query = `
      SELECT Model.Id modelId, Category.Id categoryId, MAX(IIF(Parent.Id IS NULL, 1, 0)) isCategoryOfRootElement
      FROM ${this._hierarchyConfig.elementClassSpecification}
      GROUP BY modelId, categoryId
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { modelId: row.modelId, categoryId: row.categoryId, isCategoryOfRootElement: !!row.isCategoryOfRootElement };
    }
  }

  private async *queryModeledElements(): AsyncIterableIterator<{ modelId: ModelId; categoryId: CategoryId; modeledElementId: ElementId }> {
    const query = `
      SELECT
        pe.ECInstanceId modeledElementId,
        pe.Category.Id categoryId,
        pe.Model.Id modelId
      FROM BisCore.Model m
      JOIN ${this._hierarchyConfig.elementClassSpecification} pe ON pe.ECInstanceId = m.ModeledElement.Id
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { modelId: row.modelId, categoryId: row.categoryId, modeledElementId: row.modeledElementId };
    }
  }

  private async getModelWithCategoryModeledElements() {
    this._modelWithCategoryModeledElements ??= (async () => {
      const modelWithCategoryModeledElements = new Map<ModelCategoryKey, Set<ElementId>>();
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

  public async getModelCategories(modelId: ModelId): Promise<Array<CategoryId>> {
    const modelInfos = await this.getModelsCategoriesInfos();
    const categories = modelInfos.get(modelId);
    return categories ? [...categories].filter(([, isCategoryOfRootElement]) => isCategoryOfRootElement).map(([categoryId]) => categoryId) : [];
  }

  public async getAllModelCategories(modelId: ModelId): Promise<Array<CategoryId>> {
    const modelInfos = await this.getModelsCategoriesInfos();
    const categories = modelInfos.get(modelId);
    return categories ? [...categories.keys()] : [];
  }

  public async hasSubModel(elementId: Id64String): Promise<boolean> {
    const modelInfos = await this.getModelsCategoriesInfos();
    return modelInfos.has(elementId);
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

  private async queryCategoryElementCounts(
    input: Array<{ modelId: ModelId; categoryId: CategoryId; parentElementIds?: Id64Array }>,
  ): Promise<Map<ModelParentCategoryKey, number>> {
    const result = new Map<ModelParentCategoryKey, number>();
    if (input.length === 0) {
      return result;
    }

    const reader = this._queryExecutor.createQueryReader(
      {
        ecsql: `
          SELECT COUNT(*) elementsCount, e.Category.Id categoryId, e.Model.Id modelId, e.Parent.Id parentId
          FROM ${this._hierarchyConfig.elementClassSpecification} e
          WHERE
            ${input.map(({ modelId, categoryId, parentElementIds }) => `(e.Parent.Id ${parentElementIds ? `IN (${parentElementIds.join(", ")})` : "IS NULL"} AND e.Model.Id = ${modelId} AND e.Category.Id = ${categoryId})`).join(" OR ")}
          GROUP BY e.Model.Id, e.Category.Id, e.Parent.Id
        `,
      },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded" },
    );

    for await (const row of reader) {
      const key: ModelParentCategoryKey = `${row.modelId}-${row.parentId ?? ""}-${row.categoryId}`;
      result.set(key, row.elementsCount);
    }
    return result;
  }

  public async getCategoryElementsCount(modelId: ModelId, categoryId: CategoryId, parentElementIds?: Array<ElementId>): Promise<number> {
    return this._categoryElementCounts.getCategoryElementsCount(modelId, categoryId, parentElementIds);
  }

  private async queryParentElementMap({ modelId }: { modelId: ModelId }): Promise<ParentElementMap> {
    const reader = this._queryExecutor.createQueryReader(
      {
        ctes: [
          `
            ParentAndChildElements(Id, CategoryId, ParentId, HasChildren) AS (
              SELECT
                this.ECInstanceId,
                this.Category.Id,
                this.Parent.Id,
                IFNULL(
                  (
                    SELECT
                      true
                    FROM
                      ${this._hierarchyConfig.elementClassSpecification} e
                    WHERE
                      e.Parent.Id = this.ECInstanceId
                    LIMIT
                      1
                  ),
                  false
                )
              FROM ${this._hierarchyConfig.elementClassSpecification} this
              WHERE
                this.Parent.Id IS NOT NULL AND this.Model.Id = ${modelId}
            )
          `,
          `
            ParentsWithCategories(ParentId, CategoryId) AS (
              SELECT
                this.ParentId,
                this.CategoryId
                FROM ParentAndChildElements this
              GROUP BY this.ParentId, this.CategoryId
            )
          `,
        ],
        ecsql: `
          SELECT
            pc.CategoryId categoryId,
            this.Id id,
            pc.ParentId parentId
          FROM
            ParentsWithCategories pc
            LEFT JOIN ParentAndChildElements this ON (pc.ParentId = this.ParentId AND pc.CategoryId = this.CategoryId AND this.HasChildren = true)
          UNION ALL
          SELECT
            p.Category.Id categoryId,
            p.ECInstanceId id,
            p.Parent.Id parentId
          FROM
            ${this._hierarchyConfig.elementClassSpecification} p
            JOIN ParentAndChildElements c ON c.ParentId = p.ECInstanceId
          WHERE p.Parent.Id IS NULL
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

  private async getParentElementMap(modelId: ModelId): Promise<ParentElementMap> {
    let parentElementMap = this._modelParentInfoMap.get(modelId);
    if (!parentElementMap) {
      parentElementMap = this.queryParentElementMap({ modelId });
      this._modelParentInfoMap.set(modelId, parentElementMap);
    }
    return parentElementMap;
  }

  public async getCategoryChildCategories(props: {
    modelId: ModelId;
    categoryId: CategoryId;
    parentElementIds?: Array<ParentId>;
  }): Promise<Map<ParentId, Set<CategoryId>>> {
    const { modelId, categoryId, parentElementIds } = props;
    const parentElementMap = await this.getParentElementMap(modelId);
    const result = new Map<ParentId, Set<CategoryId>>();
    for (const parentElementId of parentElementIds ?? [undefined]) {
      const directChildren = parentElementMap.get(parentElementId)?.get(categoryId);
      if (!directChildren) {
        continue;
      }

      for (const childElement of directChildren) {
        const childElementChildCategoriesMap = parentElementMap.get(childElement);
        if (childElementChildCategoriesMap) {
          result.set(childElement, new Set(childElementChildCategoriesMap.keys()));
        }
      }
    }
    return result;
  }

  public async getElementsChildCategories(props: { modelId: ModelId; elementIds: Set<ElementId> }): Promise<Map<ParentId, Set<CategoryId>>> {
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
    modelId: ModelId;
    categoryId: CategoryId;
    parentElementIds?: Array<ParentId>;
  }): Promise<Map<CategoryId, Set<ElementId>>> {
    const reader = this._queryExecutor.createQueryReader(
      {
        ctes: [
          `CategoriesDirectChildren(Id) AS (
            SELECT
                this.ECInstanceId
              FROM ${this._hierarchyConfig.elementClassSpecification} this
              WHERE
                this.Model.Id = ${props.modelId} AND this.CategoryId = ${props.categoryId} AND this.Parent.Id ${props.parentElementIds ? `IN (${props.parentElementIds.join(", ")})` : "IS NULL"}
          )`,
          `ParentsChildrenInfo (Id, CategoryId) AS (
            SELECT
              this.ECInstanceId,
              this.Category.Id
            FROM ${this._hierarchyConfig.elementClassSpecification} this
            WHERE
              this.Parent.Id IN (SELECT Id FROM CategoriesDirectChildren)
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

  public async getCategoryAllIndirectChildren(props: {
    modelId: ModelId;
    categoryId: CategoryId;
    parentElementIds?: Array<ParentId>;
  }): Promise<Map<CategoryId, Set<ElementId>>> {
    return this.queryCategoryAllIndirectChildren(props);
  }

  private async queryElementsAllChildren(props: { modelId: ModelId; elementIds: Array<ElementId> }): Promise<Map<CategoryId, Set<ElementId>>> {
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
              BisCore.${this._hierarchyConfig.elementClassSpecification} c
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

  public async getElementsAllChildren(props: { modelId: ModelId; elementIds: Array<ElementId> }): Promise<Map<CategoryId, Set<ElementId>>> {
    return this.queryElementsAllChildren(props);
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

class ModelCategoryElementsCountCache {
  private _cache = new Map<ModelParentCategoryKey, Subject<number>>();
  private _requestsStream = new Subject<{ modelId: ModelId; categoryId: CategoryId; parentElementIds?: Id64Array }>();
  private _subscription: Subscription;

  public constructor(
    private _loader: (input: Array<{ modelId: ModelId; categoryId: CategoryId; parentElementIds?: Id64Array }>) => Promise<Map<ModelParentCategoryKey, number>>,
  ) {
    this._subscription = this._requestsStream
      .pipe(
        bufferTime(20),
        filter((requests) => requests.length > 0),
        mergeMap(async (requests) => this._loader(requests)),
        mergeAll(),
      )
      .subscribe({
        next: ([key, elementsCount]) => {
          const subject = this._cache.get(key);
          assert(!!subject);
          subject.next(elementsCount);
        },
      });
  }

  public [Symbol.dispose]() {
    this._subscription.unsubscribe();
  }

  public async getCategoryElementsCount(modelId: ModelId, categoryId: CategoryId, parentElementIds?: Id64Array): Promise<number> {
    let cacheKey: ModelParentCategoryKey = `${modelId}--${categoryId}`;
    let result: Subject<number> | undefined;
    for (const parentElementId of parentElementIds ?? [undefined]) {
      cacheKey = `${modelId}-${parentElementId ?? ""}-${categoryId}`;
      result = this._cache.get(cacheKey);
      if (result !== undefined) {
        return firstValueFrom(result);
      }
    }

    result = new ReplaySubject(1);
    this._cache.set(cacheKey, result);
    this._requestsStream.next({ modelId, categoryId });
    return firstValueFrom(result);
  }
}
