/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, bufferTime, filter, firstValueFrom, from, map, mergeAll, mergeMap, reduce, ReplaySubject, Subject } from "rxjs";
import { assert, Id64 } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import { collect } from "../../common/Rxjs.js";
import { pushToMap } from "../../common/Utils.js";

import type { Subscription } from "rxjs";
import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { HierarchyNodeIdentifiersPath, LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { ModelsTreeDefinition } from "../ModelsTreeDefinition.js";
import type { ChildrenTree } from "../Utils.js";

interface SubjectInfo {
  parentSubject: Id64String | undefined;
  hideInHierarchy: boolean;
  childSubjects: Id64Set;
  childModels: Id64Set;
}

interface ModelInfo {
  isModelPrivate: boolean;
  categories: Map<Id64String, { isRootElementCategory: boolean }>;
}

type ModelsTreeHierarchyConfiguration = ConstructorParameters<typeof ModelsTreeDefinition>[0]["hierarchyConfig"];
type ChildrenMap = Map<Id64String, { children: Id64Array | undefined }>;
type ChildrenLoadingMap = Map<Id64String, Promise<void>>;

/** @internal */
export class ModelsTreeIdsCache implements Disposable {
  readonly #categoryElementCounts: ModelCategoryElementsCountCache;
  #subjectInfos: Promise<Map<Id64String, SubjectInfo>> | undefined;
  #parentSubjectIds: Promise<Id64Array> | undefined; // the list should contain a subject id if its node should be shown as having children
  #modelInfos: Promise<Map<Id64String, ModelInfo>> | undefined;
  #modelWithCategoryModeledElements: Promise<Map<string, Id64Set>> | undefined;
  #modelKeyPaths: Map<Id64String, Promise<HierarchyNodeIdentifiersPath[]>>;
  #subjectKeyPaths: Map<Id64String, Promise<HierarchyNodeIdentifiersPath>>;
  #categoryKeyPaths: Map<Id64String, Promise<HierarchyNodeIdentifiersPath[]>>;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #hierarchyConfig: ModelsTreeHierarchyConfiguration;
  #childrenMap: ChildrenMap;
  #childrenLoadingMap: ChildrenLoadingMap;

  constructor(queryExecutor: LimitingECSqlQueryExecutor, hierarchyConfig: ModelsTreeHierarchyConfiguration) {
    this.#hierarchyConfig = hierarchyConfig;
    this.#queryExecutor = queryExecutor;
    this.#categoryElementCounts = new ModelCategoryElementsCountCache(async (input) => this.queryCategoryElementCounts(input));
    this.#modelKeyPaths = new Map();
    this.#subjectKeyPaths = new Map();
    this.#categoryKeyPaths = new Map();
    this.#childrenMap = new Map();
    this.#childrenLoadingMap = new Map();
  }

  public [Symbol.dispose]() {
    this.#categoryElementCounts[Symbol.dispose]();
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
            AND EXISTS (SELECT 1 FROM ${this.#hierarchyConfig.elementClassSpecification} WHERE Model.Id = m.ECInstanceId)
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
    for await (const row of this.#queryExecutor.createQueryReader({ ecsql: subjectsQuery }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
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
        ${this.#hierarchyConfig.showEmptyModels ? "" : `AND EXISTS (SELECT 1 FROM ${this.#hierarchyConfig.elementClassSpecification} WHERE Model.Id = m.ECInstanceId)`}
    `;
    for await (const row of this.#queryExecutor.createQueryReader({ ecsql: modelsQuery }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { id: row.id, parentId: row.parentId };
    }
  }

  private async *queryChildren({ elementIds }: { elementIds: Id64Array }): AsyncIterableIterator<{ id: Id64String; parentId: Id64String }> {
    const ctes = [
      `
        ElementChildren(id, parentId) AS (
          SELECT ECInstanceId id, Parent.Id parentId
          FROM ${this.#hierarchyConfig.elementClassSpecification}
          WHERE Parent.Id IN (${elementIds.join(", ")})

          UNION ALL

          SELECT c.ECInstanceId id, c.Parent.Id
          FROM ${this.#hierarchyConfig.elementClassSpecification} c
          JOIN ElementChildren p ON c.Parent.Id = p.id
        )
      `,
    ];
    const ecsql = `
      SELECT id, parentId
      FROM ElementChildren
    `;
    for await (const row of this.#queryExecutor.createQueryReader({ ecsql, ctes }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { id: row.id, parentId: row.parentId };
    }
  }

  private getChildrenTreeFromMap({ elementIds }: { elementIds: Id64Arg }): ChildrenTree {
    if (Id64.sizeOf(elementIds) === 0 || this.#childrenMap.size === 0) {
      return new Map();
    }
    const result: ChildrenTree = new Map();
    for (const elementId of Id64.iterable(elementIds)) {
      const entry = this.#childrenMap.get(elementId);
      if (!entry?.children) {
        continue;
      }
      const elementChildrenTree: ChildrenTree = new Map();
      result.set(elementId, { children: elementChildrenTree });
      entry.children.forEach((childId) => {
        const childrenTreeOfChild = this.getChildrenTreeFromMap({ elementIds: childId });
        if (childrenTreeOfChild.size > 0) {
          elementChildrenTree.set(childId, { children: childrenTreeOfChild });
          return;
        }
        elementChildrenTree.set(childId, { children: undefined });
      });
    }
    return result;
  }

  private getChildrenCountMap({ elementIds }: { elementIds: Id64Arg }): Map<Id64String, number> {
    if (Id64.sizeOf(elementIds) === 0) {
      return new Map();
    }
    const result = new Map<Id64String, number>();
    for (const elementId of Id64.iterable(elementIds)) {
      const entry = this.#childrenMap.get(elementId);
      if (entry?.children) {
        let allElementChildrenCount = entry.children.length;
        this.getChildrenCountMap({ elementIds: entry.children }).forEach((childrenCount) => (allElementChildrenCount += childrenCount));
        result.set(elementId, allElementChildrenCount);
      }
    }
    return result;
  }

  private createChildrenLoadingMapEntries({ elementsToQuery }: { elementsToQuery: Id64Array }): { promise: Promise<void> } {
    const elementsToQueryPromise = (async ({ childrenMap, childrenLoadingMap }: { childrenMap: ChildrenMap; childrenLoadingMap: ChildrenLoadingMap }) => {
      const result = new Map<Id64String, { children: Id64Array | undefined }>();
      for await (const { id, parentId } of this.queryChildren({ elementIds: elementsToQuery })) {
        let entry = result.get(parentId);
        if (!entry) {
          entry = { children: [] };
          result.set(parentId, entry);
        }
        if (!entry.children) {
          entry.children = [];
        }

        entry.children.push(id);
        if (!result.has(id)) {
          result.set(id, { children: undefined });
        }
      }

      result.forEach((entry, id) => childrenMap.set(id, entry));
      elementsToQuery.forEach((elementId) => childrenLoadingMap.delete(elementId));
      return;
    })({ childrenLoadingMap: this.#childrenLoadingMap, childrenMap: this.#childrenMap });

    elementsToQuery.forEach((elementId) => this.#childrenLoadingMap.set(elementId, elementsToQueryPromise));
    return { promise: elementsToQueryPromise };
  }

  private async createChildrenMapEntries({ elementIds }: { elementIds: Id64Arg }): Promise<void[]> {
    const promises = new Array<Promise<void>>();
    const elementsToQuery = new Array<Id64String>();
    for (const elementId of Id64.iterable(elementIds)) {
      if (this.#childrenMap.has(elementId)) {
        continue;
      }
      const loadingPromise = this.#childrenLoadingMap.get(elementId);
      if (loadingPromise) {
        promises.push(loadingPromise);
        continue;
      }
      elementsToQuery.push(elementId);
    }

    if (elementsToQuery.length > 0) {
      promises.push(this.createChildrenLoadingMapEntries({ elementsToQuery }).promise);
    }
    return Promise.all(promises);
  }

  public async getChildrenTree({ elementIds }: { elementIds: Id64Arg }): Promise<ChildrenTree> {
    await this.createChildrenMapEntries({ elementIds });
    return this.getChildrenTreeFromMap({ elementIds });
  }

  public async getAllChildrenCount({ elementIds }: { elementIds: Id64Arg }): Promise<Map<Id64String, number>> {
    await this.createChildrenMapEntries({ elementIds });
    return this.getChildrenCountMap({ elementIds });
  }

  private async getSubjectInfos() {
    this.#subjectInfos ??= (async () => {
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
    return this.#subjectInfos;
  }

  /** Returns ECInstanceIDs of Subjects that either have direct Model or at least one child Subject with a Model. */
  public async getParentSubjectIds(): Promise<Id64String[]> {
    this.#parentSubjectIds ??= (async () => {
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
    return this.#parentSubjectIds;
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
    let entry = this.#subjectKeyPaths.get(targetSubjectId);
    if (!entry) {
      entry = (async () => {
        const subjectInfos = await this.getSubjectInfos();
        const result = new Array<InstanceKey>();
        let currParentId: Id64String | undefined = targetSubjectId;
        while (currParentId) {
          if (this.#hierarchyConfig.hideRootSubject && currParentId === IModel.rootSubjectId) {
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
      this.#subjectKeyPaths.set(targetSubjectId, entry);
    }
    return entry;
  }

  private async *queryModelCategories(): AsyncIterableIterator<{
    modelId: Id64String;
    categoryId: Id64String;
    isModelPrivate: boolean;
    isRootElementCategory: boolean;
  }> {
    const query = `
      SELECT
        this.Model.Id modelId,
        this.Category.Id categoryId,
        m.IsPrivate isModelPrivate,
        MAX(IIF(this.Parent.Id IS NULL, 1, 0)) isRootElementCategory
      FROM BisCore.Model m
      JOIN ${this.#hierarchyConfig.elementClassSpecification} this ON m.ECInstanceId = this.Model.Id
      GROUP BY modelId, categoryId, isModelPrivate
    `;
    for await (const row of this.#queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { modelId: row.modelId, categoryId: row.categoryId, isModelPrivate: !!row.isModelPrivate, isRootElementCategory: !!row.isRootElementCategory };
    }
  }

  private async *queryModeledElements() {
    const query = `
      SELECT
        pe.ECInstanceId modeledElementId,
        pe.Category.Id categoryId,
        pe.Model.Id modelId
      FROM BisCore.Model m
      JOIN ${this.#hierarchyConfig.elementClassSpecification} pe ON pe.ECInstanceId = m.ModeledElement.Id
      WHERE
        m.IsPrivate = false
        AND m.ECInstanceId IN (SELECT Model.Id FROM ${this.#hierarchyConfig.elementClassSpecification})
    `;
    for await (const row of this.#queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { modelId: row.modelId, categoryId: row.categoryId, modeledElementId: row.modeledElementId };
    }
  }

  private async getModelWithCategoryModeledElements() {
    this.#modelWithCategoryModeledElements ??= (async () => {
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
    return this.#modelWithCategoryModeledElements;
  }

  private async getModelInfos() {
    this.#modelInfos ??= (async () => {
      const modelInfos = new Map<Id64String, { categories: Map<Id64String, { isRootElementCategory: boolean }>; isModelPrivate: boolean }>();
      for await (const { modelId, categoryId, isModelPrivate, isRootElementCategory } of this.queryModelCategories()) {
        const entry = modelInfos.get(modelId);
        if (entry) {
          entry.categories.set(categoryId, { isRootElementCategory });
          entry.isModelPrivate = isModelPrivate;
        } else {
          modelInfos.set(modelId, { categories: new Map([[categoryId, { isRootElementCategory }]]), isModelPrivate });
        }
      }
      return modelInfos;
    })();
    return this.#modelInfos;
  }

  public async getAllCategories(): Promise<Id64Set> {
    const modelInfos = await this.getModelInfos();
    const result = new Set<Id64String>();
    modelInfos.forEach(({ categories }) => {
      categories.forEach((_, categoryId) => result.add(categoryId));
    });
    return result;
  }

  public async getModelCategories(modelId: Id64String): Promise<Id64Array> {
    const modelInfos = await this.getModelInfos();
    const categories = modelInfos.get(modelId)?.categories.keys();
    return categories ? [...categories] : [];
  }

  public async hasSubModel(elementId: Id64String): Promise<boolean> {
    const modelInfos = await this.getModelInfos();
    const modeledElementInfo = modelInfos.get(elementId);
    if (!modeledElementInfo) {
      return false;
    }
    return !modeledElementInfo.isModelPrivate;
  }

  public async getCategoriesModeledElements(modelId: Id64String, categoryIds: Id64Arg): Promise<Id64Array> {
    const modelWithCategoryModeledElements = await this.getModelWithCategoryModeledElements();
    const result = new Array<Id64String>();
    for (const categoryId of Id64.iterable(categoryIds)) {
      const entry = modelWithCategoryModeledElements.get(`${modelId}-${categoryId}`);
      if (entry !== undefined) {
        result.push(...entry);
      }
    }
    return result;
  }

  public async createModelInstanceKeyPaths(modelId: Id64String): Promise<HierarchyNodeIdentifiersPath[]> {
    let entry = this.#modelKeyPaths.get(modelId);
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

      this.#modelKeyPaths.set(modelId, entry);
    }
    return entry;
  }

  private async queryCategoryElementCounts(
    input: Array<{ modelId: Id64String; categoryId: Id64String }>,
  ): Promise<Array<{ modelId: Id64String; categoryId: Id64String; elementsCount: number }>> {
    return collect(
      from(input).pipe(
        reduce((acc, { modelId, categoryId }) => {
          const entry = acc.get(modelId);
          if (!entry) {
            acc.set(modelId, new Set([categoryId]));
          } else {
            entry.add(categoryId);
          }
          return acc;
        }, new Map<Id64String, Id64Set>()),
        mergeMap((modelCategoryMap) => modelCategoryMap.entries()),
        map(([modelId, categoryIds]) => `Model.Id = ${modelId} AND Category.Id IN (${[...categoryIds].join(", ")})`),
        // we may have thousands of where clauses here, and sending a single query with all of them could take a
        // long time - instead, split it into smaller chunks
        bufferCount(100),
        mergeMap(async (whereClauses) => {
          const reader = this.#queryExecutor.createQueryReader(
            {
              ctes: [
                `
                  CategoryElements(id, modelId, categoryId) AS (
                    SELECT ECInstanceId, Model.Id, Category.Id
                    FROM ${this.#hierarchyConfig.elementClassSpecification}
                    WHERE
                      Parent.Id IS NULL
                      AND (
                        ${whereClauses.join(" OR ")}
                      )

                    UNION ALL

                    SELECT c.ECInstanceId, p.modelId, p.categoryId
                    FROM ${this.#hierarchyConfig.elementClassSpecification} c
                    JOIN CategoryElements p ON c.Parent.Id = p.id
                  )
                `,
              ],
              ecsql: `
                SELECT modelId, categoryId, COUNT(id) elementsCount
                FROM CategoryElements
                GROUP BY modelId, categoryId
              `,
            },
            { rowFormat: "ECSqlPropertyNames", limit: "unbounded" },
          );

          const result = new Array<{ modelId: Id64String; categoryId: Id64String; elementsCount: number }>();
          for await (const row of reader) {
            result.push({ modelId: row.modelId, categoryId: row.categoryId, elementsCount: row.elementsCount });
          }

          input.forEach(({ modelId, categoryId }) => {
            if (!result.some((queriedResult) => queriedResult.categoryId === categoryId && queriedResult.modelId === modelId)) {
              result.push({ categoryId, modelId, elementsCount: 0 });
            }
          });

          return result;
        }),
        mergeAll(),
      ),
    );
  }

  public async getCategoryElementsCount(modelId: Id64String, categoryId: Id64String): Promise<number> {
    return this.#categoryElementCounts.getCategoryElementsCount(modelId, categoryId);
  }

  public async createCategoryInstanceKeyPaths(categoryId: Id64String): Promise<HierarchyNodeIdentifiersPath[]> {
    let entry = this.#categoryKeyPaths.get(categoryId);
    if (!entry) {
      entry = (async () => {
        const result = new Set<Id64String>();
        const modelInfos = await this.getModelInfos();
        modelInfos?.forEach((modelInfo, modelId) => {
          const categoryEntry = modelInfo.categories.get(categoryId);
          if (categoryEntry?.isRootElementCategory) {
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
      this.#categoryKeyPaths.set(categoryId, entry);
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

class ModelCategoryElementsCountCache {
  #cache = new Map<string, Subject<number>>();
  #requestsStream = new Subject<{ modelId: Id64String; categoryId: Id64String }>();
  #subscription: Subscription;
  public constructor(
    loader: (
      input: Array<{ modelId: Id64String; categoryId: Id64String }>,
    ) => Promise<Array<{ modelId: Id64String; categoryId: Id64String; elementsCount: number }>>,
  ) {
    this.#subscription = this.#requestsStream
      .pipe(
        bufferTime(20),
        filter((requests) => requests.length > 0),
        mergeMap(async (requests) => loader(requests)),
        mergeAll(),
      )
      .subscribe({
        next: ({ modelId, categoryId, elementsCount }) => {
          const subject = this.#cache.get(`${modelId}${categoryId}`);
          assert(!!subject);
          subject.next(elementsCount);
        },
      });
  }

  public [Symbol.dispose]() {
    this.#subscription.unsubscribe();
  }

  public async getCategoryElementsCount(modelId: Id64String, categoryId: Id64String): Promise<number> {
    const cacheKey = `${modelId}${categoryId}`;
    let result = this.#cache.get(cacheKey);
    if (result !== undefined) {
      return firstValueFrom(result);
    }

    result = new ReplaySubject(1);
    this.#cache.set(cacheKey, result);
    this.#requestsStream.next({ modelId, categoryId });
    return firstValueFrom(result);
  }
}
