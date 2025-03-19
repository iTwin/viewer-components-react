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

/** @internal */
export type ModelParentMap = Map<
  ParentId,
  { categoryChildrenMap: Map<CategoryId, Array<{ childElementId: ElementId; hasChildren: boolean }>>; rootElementCategoryId: CategoryId; hasParent: boolean }
>;

/** @internal */
export class ModelsTreeIdsCache {
  private readonly _categoryElementCounts: ModelCategoryElementsCountCache;
  private _subjectInfos: Promise<Map<SubjectId, SubjectInfo>> | undefined;
  private _parentSubjectIds: Promise<Array<SubjectId>> | undefined; // the list should contain a subject id if its node should be shown as having children
  private _modelsCategoriesInfos: Promise<Map<ModelId, Map<CategoryId, boolean>>> | undefined;
  private _modelWithCategoryModeledElements: Promise<Map<ModelCategoryKey, Set<ElementId>>> | undefined;
  private _modelKeyPaths: Map<ModelId, Promise<HierarchyNodeIdentifiersPath[]>>;
  private _subjectKeyPaths: Map<SubjectId, Promise<HierarchyNodeIdentifiersPath>>;
  private _childElementInfos: Map<ModelId, Promise<ModelParentMap>>;

  constructor(
    private _queryExecutor: LimitingECSqlQueryExecutor,
    private _hierarchyConfig: ModelsTreeHierarchyConfiguration,
  ) {
    this._categoryElementCounts = new ModelCategoryElementsCountCache(async (input) => this.queryCategoryElementCounts(input));
    this._modelKeyPaths = new Map();
    this._subjectKeyPaths = new Map();
    this._childElementInfos = new Map();
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

  private async queryCategoryElementCounts(input: Array<{ modelId: ModelId; categoryId: CategoryId }>): Promise<Map<ModelCategoryKey, number>> {
    const result = new Map<ModelCategoryKey, number>();
    if (input.length === 0) {
      return result;
    }

    const reader = this._queryExecutor.createQueryReader(
      {
        ecsql: `
          SELECT COUNT(*) elementsCount, e.Category.Id categoryId, e.Model.Id modelId
          FROM ${this._hierarchyConfig.elementClassSpecification} e
          WHERE
            e.Parent.Id IS NULL AND (
              ${input.map(({ modelId, categoryId }) => `e.Model.Id = ${modelId} AND e.Category.Id = ${categoryId}`).join(" OR ")}
            )
          GROUP BY e.Model.Id, e.Category.Id
        `,
      },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded" },
    );

    for await (const row of reader) {
      const key: ModelCategoryKey = `${row.modelId}-${row.categoryId}`;
      result.set(key, row.elementsCount);
    }
    return result;
  }

  public async getRootCategoryElementsCount(modelId: ModelId, categoryId: CategoryId): Promise<number> {
    return this._categoryElementCounts.getRootCategoryElementsCount(modelId, categoryId);
  }

  private async queryElementsChildrenInfo({ modelId }: { modelId: ModelId }): Promise<ModelParentMap> {
    const reader = this._queryExecutor.createQueryReader(
      {
        ctes: [
          `
          ElementsChildrenInfo(Id, CategoryId, ParentId, RootElementCategoryId, ParentHasParent) AS (
              SELECT ECInstanceId, Category.Id, Parent.Id, Category.Id, false
              FROM ${this._hierarchyConfig.elementClassSpecification}
              WHERE
                Parent.Id IS NULL AND Model.Id = ${modelId}

              UNION ALL

              SELECT c.ECInstanceId, c.Category.Id, c.Parent.Id, p.RootElementCategoryId, IIF(p.ParentId IS NULL, false, true)
              FROM ${this._hierarchyConfig.elementClassSpecification} c
              JOIN ElementsChildrenInfo p ON c.Parent.Id = p.Id
            )
          `,
        ],
        ecsql: `
          SELECT
            this.CategoryId categoryId,
            this.ParentId parentId,
            this.Id id,
            this.RootElementCategoryId rootElementCategoryId,
            IFNULL((
              SELECT 1
              FROM (
                SELECT ParentId FROM ElementsChildrenInfo
              )
              WHERE ParentId = this.Id
              LIMIT 1
            ), 0) hasChildren,
            this.ParentHasParent parentHasParent
          FROM ElementsChildrenInfo this
          WHERE this.ParentId IS NOT NULL
        `,
      },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded" },
    );

    const result: ModelParentMap = new Map();
    for await (const row of reader) {
      const parentKey = row.parentId ?? undefined;
      let parentEntry = result.get(parentKey);
      if (!parentEntry) {
        parentEntry = { categoryChildrenMap: new Map(), rootElementCategoryId: row.rootElementCategoryId, hasParent: row.parentHasParent };
        result.set(parentKey, parentEntry);
      }
      let childInfos = parentEntry.categoryChildrenMap.get(row.categoryId);
      if (!childInfos) {
        childInfos = [];
        parentEntry.categoryChildrenMap.set(row.categoryId, childInfos);
      }
      childInfos.push({
        childElementId: row.id,
        hasChildren: !!row.hasChildren,
      });
    }
    return result;
  }

  private async getChildrenInfo(modelId: ModelId): Promise<ModelParentMap> {
    let parentMap = this._childElementInfos.get(modelId);
    if (!parentMap) {
      parentMap = this.queryElementsChildrenInfo({ modelId });
      this._childElementInfos.set(modelId, parentMap);
    }
    return parentMap;
  }

  public async getAllChildrenInfo(): Promise<Map<ModelId, ModelParentMap>> {
    const result = new Map();
    await Promise.all(
      [...this._childElementInfos.entries()].map(async ([modelId, parentMapPromise]) => {
        result.set(modelId, await parentMapPromise);
      }),
    );
    return result;
  }

  /**
   * Returns elements that are display under the category in models tree.
   *
   * There can be two different cases:
   * 1. If category is directly under model, then it returns only those elements that have children.
   * 2. If category is under element, then it returns all child elements.
   *
   * `boolean` values in map tell if node has children or not.
   */
  public async getCategoryChildrenInfo(props: {
    modelId: ModelId;
    categoryId: CategoryId;
    parentElementIds: Array<ParentId>;
  }): Promise<Map<ElementId, boolean>> {
    const { modelId, categoryId, parentElementIds } = props;
    const parentMap = await this.getChildrenInfo(modelId);

    if (parentElementIds.length === 0) {
      const noParentResult = new Map<ElementId, boolean>();
      for (const [parentId, parentEntry] of parentMap) {
        if (!parentEntry.hasParent && parentEntry.rootElementCategoryId === categoryId) {
          noParentResult.set(parentId, true);
        }
      }
      return noParentResult;
    }

    const result = new Map<ElementId, boolean>();
    for (const parentId of parentElementIds) {
      const childInfos = parentMap.get(parentId)?.categoryChildrenMap.get(categoryId);
      if (childInfos) {
        childInfos.forEach((childInfo) => result.set(childInfo.childElementId, childInfo.hasChildren));
        break;
      }
    }
    return result;
  }

  public async getElementRootCategory({ modelId, childElementId }: { modelId: ModelId; childElementId: ElementId }): Promise<CategoryId | undefined> {
    const parentMap = await this.getChildrenInfo(modelId);

    for (const [, parentEntry] of parentMap) {
      for (const [, childInfos] of parentEntry.categoryChildrenMap) {
        if (childInfos.some((childInfo) => childInfo.childElementId === childElementId)) {
          return parentEntry.rootElementCategoryId;
        }
      }
    }
    return undefined;
  }

  public async getElementsChildrenInfo({
    modelId,
    parentElementIds,
  }: {
    modelId: ModelId;
    parentElementIds: Set<ParentId>;
  }): Promise<Map<CategoryId, Map<ElementId, boolean>>> {
    const parentMap = await this.getChildrenInfo(modelId);

    const result = new Map<CategoryId, Map<ElementId, boolean>>();
    for (const parentId of parentElementIds) {
      const parentEntry = parentMap.get(parentId);
      if (parentEntry) {
        for (const [categoryId, childInfos] of parentEntry.categoryChildrenMap) {
          let categoryEntry = result.get(categoryId);
          if (!categoryEntry) {
            categoryEntry = new Map();
            result.set(categoryId, categoryEntry);
          }
          childInfos.forEach((childInfo) => categoryEntry?.set(childInfo.childElementId, childInfo.hasChildren));
        }
      }
    }
    return result;
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
  private _cache = new Map<ModelCategoryKey, Subject<number>>();
  private _requestsStream = new Subject<{ modelId: Id64String; categoryId: Id64String }>();
  private _subscription: Subscription;

  public constructor(private _loader: (input: Array<{ modelId: ModelId; categoryId: CategoryId }>) => Promise<Map<ModelCategoryKey, number>>) {
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

  public async getRootCategoryElementsCount(modelId: ModelId, categoryId: CategoryId): Promise<number> {
    const cacheKey: ModelCategoryKey = `${modelId}-${categoryId}`;

    let result = this._cache.get(cacheKey);
    if (result !== undefined) {
      return firstValueFrom(result);
    }

    result = new ReplaySubject(1);
    this._cache.set(cacheKey, result);
    this._requestsStream.next({ modelId, categoryId });
    return firstValueFrom(result);
  }
}
