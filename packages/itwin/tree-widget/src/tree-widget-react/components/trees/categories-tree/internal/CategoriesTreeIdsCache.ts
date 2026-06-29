/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defaultIfEmpty, defer, EMPTY, forkJoin, from, map, merge, mergeMap, of, reduce, shareReplay, toArray } from "rxjs";
import { Guid, Id64 } from "@itwin/core-bentley";
import { BaseIdsCacheImpl } from "../../common/internal/caches/BaseIdsCache.js";
import { CLASS_NAME_DefinitionContainer, CLASS_NAME_Model, CLASS_NAME_SubCategory } from "../../common/internal/ClassNameDefinitions.js";
import { catchBeSQLiteInterrupts } from "../../common/internal/UseErrorState.js";
import { createWhereClause, fromWithRelease, getClassesByView, getOrCreate } from "../../common/internal/Utils.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Arg, Id64Array, Id64String } from "@itwin/core-bentley";
import type { HierarchyNodeIdentifiersPath, LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { EC } from "@itwin/presentation-shared";
import type { BaseIdsCacheImplProps } from "../../common/internal/caches/BaseIdsCache.js";
import type { CategoryId, DefinitionContainerId, ElementId, ModelId } from "../../common/internal/Types.js";

interface DefinitionContainerInfo {
  modelId: Id64String;
  parentDefinitionContainerExists: boolean;
  childCategories: CategoryInfo[];
  childDefinitionContainers: Array<{ id: Id64String; hasElements: boolean }>;
  hasElements: boolean;
}

interface CategoriesInfo {
  childCategories: CategoryInfo[];
  parentDefinitionContainerExists: boolean;
}

/** @internal */
export interface CategoryInfo {
  id: CategoryId;
  subCategoryChildCount: number;
  hasElements: boolean;
  isTopMostElementCategory: boolean;
}

interface CategoriesTreeIdsCacheProps extends BaseIdsCacheImplProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  type: "2d" | "3d";
}

/** @internal */
export class CategoriesTreeIdsCache extends BaseIdsCacheImpl {
  #definitionContainersInfo: Observable<Map<DefinitionContainerId, DefinitionContainerInfo>> | undefined;
  #cachedCategoryData:
    | Observable<{
        categoriesGroupedByModel: Map<ModelId, CategoriesInfo>;
        categoriesWithModel: Map<CategoryId, { modelId: ModelId; isDefinitionContainer: boolean }>;
      }>
    | undefined;
  #definitionContainerInstanceKeyPaths: Map<DefinitionContainerId, Observable<HierarchyNodeIdentifiersPath>> = new Map();
  #categoryClass: EC.FullClassName;
  #categoryElementClass: EC.FullClassName;
  #isDefinitionContainerSupported: Observable<boolean> | undefined;
  #filteredElementsModels: Observable<Map<ElementId, ModelId>> | undefined;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  #componentName: string;

  constructor(props: CategoriesTreeIdsCacheProps) {
    super(props);
    this.#queryExecutor = props.queryExecutor;
    const { categoryClass, elementClass } = getClassesByView(props.type);
    this.#categoryClass = categoryClass;
    this.#categoryElementClass = elementClass;
    this.#componentId = Guid.createValue();
    this.#componentName = "CategoriesTreeIdsCache";
  }

  private queryFilteredElementsModels(filteredElementIds: Id64Array): Observable<{
    modelId: Id64String;
    id: ElementId;
  }> {
    return defer(() => {
      const query = `
        SELECT Model.Id modelId, ECInstanceId id
        FROM ${this.#categoryElementClass}
        JOIN IdSet(?) filteredElementIdSet ON ECInstanceId = filteredElementIdSet.id
        ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: query, bindings: [{ type: "idset", value: filteredElementIds }] },
        {
          rowFormat: "ECSqlPropertyNames",
          limit: "unbounded",
          restartToken: `${this.#componentName}/${this.#componentId}/filtered-element-models/${Guid.createValue()}`,
        },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row) => {
        return { modelId: row.modelId, id: row.id };
      }),
    );
  }

  public getFilteredElementsModels(filteredElementIds: Id64Array) {
    if (Id64.sizeOf(filteredElementIds) === 0) {
      return of(new Map<ElementId, ModelId>());
    }

    this.#filteredElementsModels ??= this.queryFilteredElementsModels(filteredElementIds).pipe(
      reduce((acc, { modelId, id }) => {
        acc.set(id, modelId);
        return acc;
      }, new Map<ElementId, ModelId>()),
      shareReplay(),
    );
    return this.#filteredElementsModels;
  }

  public clearFilteredElementsModels() {
    this.#filteredElementsModels = undefined;
  }

  private queryCategories(): Observable<{
    id: CategoryId;
    modelId: Id64String;
    parentDefinitionContainerExists: boolean;
    subCategoryChildCount: number;
    hasElements: boolean;
    isTopMostElementCategory: boolean;
  }> {
    return this.getIsDefinitionContainerSupported().pipe(
      mergeMap((isDefinitionContainerSupported) =>
        defer(() => {
          const categoriesQuery = `
            SELECT
              this.ECInstanceId id,
              COUNT(sc.ECInstanceId) subCategoryChildCount,
              this.Model.Id modelId,
              ${
                isDefinitionContainerSupported
                  ? `
                  IIF(this.Model.Id IN (SELECT dc.ECInstanceId FROM ${CLASS_NAME_DefinitionContainer} dc),
                    true,
                    false
                  )`
                  : "false"
              } parentDefinitionContainerExists,
              IFNULL(
                (SELECT 1 FROM ${this.#categoryElementClass} e WHERE e.Category.Id = this.ECInstanceId LIMIT 1),
                0
              ) hasElements,
              IFNULL(
                (SELECT 1 FROM ${this.#categoryElementClass} e WHERE e.Category.Id = this.ECInstanceId AND e.Parent.Id IS NULL LIMIT 1),
                0
              ) isTopMostElementCategory
            FROM
              ${this.#categoryClass} this
              JOIN ${CLASS_NAME_SubCategory} sc ON sc.Parent.Id = this.ECInstanceId
              JOIN ${CLASS_NAME_Model} m ON m.ECInstanceId = this.Model.Id
            ${createWhereClause({ conditions: ["NOT this.IsPrivate", "NOT m.IsPrivate OR m.ECClassId IS (BisCore.DictionaryModel)"] })}
            GROUP BY this.ECInstanceId
          `;
          return this.#queryExecutor.createQueryReader(
            { ecsql: categoriesQuery },
            { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/categories` },
          );
        }).pipe(
          catchBeSQLiteInterrupts,
          map((row) => {
            return {
              id: row.id,
              modelId: row.modelId,
              parentDefinitionContainerExists: row.parentDefinitionContainerExists,
              subCategoryChildCount: row.subCategoryChildCount,
              hasElements: !!row.hasElements,
              isTopMostElementCategory: !!row.isTopMostElementCategory,
            };
          }),
        ),
      ),
    );
  }

  private queryIsDefinitionContainersSupported(): Observable<boolean> {
    return defer(() => {
      const query = `
        SELECT
          1
        FROM
          ECDbMeta.ECSchemaDef s
          JOIN ECDbMeta.ECClassDef c ON c.Schema.Id = s.ECInstanceId
        ${createWhereClause({ conditions: ["s.Name = 'BisCore'", "c.Name = 'DefinitionContainer'"] })}
      `;

      return this.#queryExecutor.createQueryReader(
        { ecsql: query },
        { restartToken: `${this.#componentName}/${this.#componentId}/is-definition-container-supported` },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      toArray(),
      map((rows) => rows.length > 0),
    );
  }

  private queryDefinitionContainers(): Observable<{ id: DefinitionContainerId; modelId: Id64String; hasElements: boolean }> {
    return defer(() => {
      // DefinitionModel ECInstanceId will always be the same as modeled DefinitionContainer ECInstanceId, if this wasn't the case, we would need to do something like:
      //  JOIN BisCore.DefinitionModel dm ON dm.ECInstanceId = ${modelIdAccessor}
      //  JOIN BisCore.DefinitionModelBreaksDownDefinitionContainer dr ON dr.SourceECInstanceId = dm.ECInstanceId
      //  JOIN BisCore.DefinitionContainer dc ON dc.ECInstanceId = dr.TargetECInstanceId
      const DEFINITION_CONTAINERS_CTE = "DefinitionContainers";
      const CATEGORIES_MODELS_CTE = "CategoriesModels";
      const ctes = [
        `${CATEGORIES_MODELS_CTE}(ModelId, HasElements) AS (
          SELECT
            c.Model.Id,
            IFNULL((
              SELECT 1
              FROM ${this.#categoryElementClass} e
              WHERE e.Category.Id = c.ECInstanceId
              LIMIT 1
            ), 0)
          FROM
            ${this.#categoryClass} c
          WHERE
            NOT c.IsPrivate
        )`,
        `
          ${DEFINITION_CONTAINERS_CTE}(ECInstanceId, ModelId, HasElements) AS (
            SELECT
              dc.ECInstanceId,
              dc.Model.Id,
              c.HasElements
            FROM ${CLASS_NAME_DefinitionContainer} dc
            JOIN ${CATEGORIES_MODELS_CTE} c ON dc.ECInstanceId = c.ModelId
            WHERE NOT dc.IsPrivate

            UNION ALL

            SELECT
              pdc.ECInstanceId,
              pdc.Model.Id,
              cdc.HasElements
            FROM
              ${DEFINITION_CONTAINERS_CTE} cdc
              JOIN ${CLASS_NAME_DefinitionContainer} pdc ON pdc.ECInstanceId = cdc.ModelId
            WHERE NOT pdc.IsPrivate
          )
        `,
      ];
      const definitionsQuery = `
        SELECT dc.ECInstanceId id, dc.ModelId modelId, MAX(dc.HasElements) hasElements FROM ${DEFINITION_CONTAINERS_CTE} dc GROUP BY dc.ECInstanceId
      `;
      return this.#queryExecutor.createQueryReader(
        { ctes, ecsql: definitionsQuery },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/definition-containers` },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row) => {
        return { id: row.id, modelId: row.modelId, hasElements: !!row.hasElements };
      }),
    );
  }

  private getCachedCategoryData() {
    this.#cachedCategoryData ??= this.queryCategories()
      .pipe(
        reduce(
          (acc, queriedCategory) => {
            const modelCategories = getOrCreate({
              map: acc.categoriesGroupedByModel,
              key: queriedCategory.modelId,
              createFunc: () => ({
                parentDefinitionContainerExists: queriedCategory.parentDefinitionContainerExists,
                childCategories: new Array<CategoryInfo>(),
              }),
            });
            modelCategories.childCategories.push({
              id: queriedCategory.id,
              subCategoryChildCount: queriedCategory.subCategoryChildCount,
              hasElements: queriedCategory.hasElements,
              isTopMostElementCategory: queriedCategory.isTopMostElementCategory,
            });
            acc.categoriesWithModel.set(queriedCategory.id, {
              modelId: queriedCategory.modelId,
              isDefinitionContainer: queriedCategory.parentDefinitionContainerExists,
            });
            return acc;
          },
          {
            categoriesGroupedByModel: new Map<ModelId, CategoriesInfo>(),
            categoriesWithModel: new Map<CategoryId, { modelId: ModelId; isDefinitionContainer: boolean }>(),
          },
        ),
      )
      .pipe(shareReplay());
    return this.#cachedCategoryData;
  }

  private getDefinitionContainersInfo() {
    this.#definitionContainersInfo ??= forkJoin({
      isDefinitionContainerSupported: this.getIsDefinitionContainerSupported(),
      cachedCategoryData: this.getCachedCategoryData(),
    })
      .pipe(
        mergeMap(({ isDefinitionContainerSupported, cachedCategoryData }) => {
          const definitionContainersInfo = new Map<DefinitionContainerId, DefinitionContainerInfo>();
          const categoriesGroupedByModel = cachedCategoryData.categoriesGroupedByModel;
          if (!isDefinitionContainerSupported || categoriesGroupedByModel.size === 0) {
            return of(definitionContainersInfo);
          }
          return this.queryDefinitionContainers().pipe(
            reduce((acc, queriedDefinitionContainer) => {
              const modelCategoriesInfo = categoriesGroupedByModel.get(queriedDefinitionContainer.id);
              acc.set(queriedDefinitionContainer.id, {
                childCategories: modelCategoriesInfo?.childCategories ?? [],
                modelId: queriedDefinitionContainer.modelId,
                childDefinitionContainers: [],
                parentDefinitionContainerExists: false,
                hasElements: queriedDefinitionContainer.hasElements,
              });
              return acc;
            }, definitionContainersInfo),
            map((result) => {
              for (const [definitionContainerId, definitionContainerInfo] of result) {
                const parentDefinitionContainer = result.get(definitionContainerInfo.modelId);
                if (parentDefinitionContainer !== undefined) {
                  parentDefinitionContainer.childDefinitionContainers.push({ id: definitionContainerId, hasElements: definitionContainerInfo.hasElements });
                  definitionContainerInfo.parentDefinitionContainerExists = true;
                  parentDefinitionContainer.hasElements = parentDefinitionContainer.hasElements || definitionContainerInfo.hasElements;
                }
              }

              return result;
            }),
          );
        }),
      )
      .pipe(shareReplay());
    return this.#definitionContainersInfo;
  }

  public getDirectChildDefinitionContainersAndCategories({
    parentDefinitionContainerIds,
    includeEmpty,
  }: {
    parentDefinitionContainerIds: Id64Arg;
    includeEmpty?: boolean;
  }): Observable<{ categories: CategoryInfo[]; definitionContainers: Array<DefinitionContainerId> }> {
    return this.getDefinitionContainersInfo().pipe(
      mergeMap((definitionContainersInfo) =>
        from(Id64.iterable(parentDefinitionContainerIds)).pipe(
          reduce(
            (acc, parentDefinitionContainerId) => {
              const parentDefinitionContainerInfo = definitionContainersInfo.get(parentDefinitionContainerId);
              if (parentDefinitionContainerInfo !== undefined) {
                applyElementsFilter(parentDefinitionContainerInfo.childDefinitionContainers, includeEmpty).forEach((dc) =>
                  acc.definitionContainers.push(dc.id),
                );
                applyElementsFilter(parentDefinitionContainerInfo.childCategories, includeEmpty).forEach((category) => acc.categories.push(category));
              }
              return acc;
            },
            { definitionContainers: new Array<Id64String>(), categories: new Array<CategoryInfo>() },
          ),
        ),
      ),
    );
  }

  public getAllContainedCategories({
    definitionContainerIds,
  }: {
    definitionContainerIds: Id64Arg;
  }): Observable<{ id: CategoryId; hasElements: boolean; isTopMostElementCategory: boolean }> {
    return this.getDefinitionContainersInfo().pipe(
      mergeMap((definitionContainersInfo) =>
        from(Id64.iterable(definitionContainerIds)).pipe(
          mergeMap((definitionContainerId): Observable<{ id: CategoryId; hasElements: boolean; isTopMostElementCategory: boolean }> => {
            const definitionContainerInfo = definitionContainersInfo.get(definitionContainerId);
            if (definitionContainerInfo === undefined) {
              return EMPTY;
            }
            const childDefinitionContainerIds = definitionContainerInfo.childDefinitionContainers.map(({ id }) => id);
            return merge(
              childDefinitionContainerIds.length > 0
                ? this.getAllContainedCategories({
                    definitionContainerIds: childDefinitionContainerIds,
                  })
                : EMPTY,
              from(definitionContainerInfo.childCategories),
            );
          }),
        ),
      ),
    );
  }

  public getSubCategoriesSearchPaths({ subCategoryIds }: { subCategoryIds: Id64Arg }): Observable<HierarchyNodeIdentifiersPath> {
    if (Id64.sizeOf(subCategoryIds) === 0) {
      return EMPTY;
    }
    return this.getSubCategoryCategories({ subCategoryIds, checkForSubCategoriesSize: true }).pipe(
      mergeMap((categorySubCategories) => categorySubCategories.entries()),
      mergeMap(([categoryId, categorySubCategories]) => {
        return this.getSearchPathsUpToRootCategory({ categoryId }).pipe(
          mergeMap((pathsUpToCategory) =>
            fromWithRelease({ source: categorySubCategories, releaseOnCount: 300 }).pipe(
              map((subCategoryId) => [
                ...pathsUpToCategory,
                { id: categoryId, className: this.#categoryClass },
                { id: subCategoryId, className: CLASS_NAME_SubCategory },
              ]),
            ),
          ),
        );
      }),
      defaultIfEmpty([]),
    );
  }

  public getDefinitionContainersSearchPaths({ definitionContainerIds }: { definitionContainerIds: Id64Arg }): Observable<HierarchyNodeIdentifiersPath> {
    return this.getDefinitionContainersInfo().pipe(
      mergeMap((definitionContainersInfo) =>
        fromWithRelease({ source: definitionContainerIds, releaseOnCount: 200 }).pipe(
          mergeMap((definitionContainerId) => {
            let entry = this.#definitionContainerInstanceKeyPaths.get(definitionContainerId);
            if (!entry) {
              const definitionContainerInfo = definitionContainersInfo.get(definitionContainerId);
              if (definitionContainerInfo === undefined) {
                entry = of([]).pipe(shareReplay());
                this.#definitionContainerInstanceKeyPaths.set(definitionContainerId, entry);
                return entry;
              }
              const instanceKey = { id: definitionContainerId, className: CLASS_NAME_DefinitionContainer };
              if (!definitionContainerInfo.parentDefinitionContainerExists) {
                entry = of([instanceKey]).pipe(shareReplay());
                this.#definitionContainerInstanceKeyPaths.set(definitionContainerId, entry);
                return entry;
              }
              entry = this.getDefinitionContainersSearchPaths({ definitionContainerIds: definitionContainerInfo.modelId }).pipe(
                map((pathToParentDefinitionContainer) => [...pathToParentDefinitionContainer, instanceKey]),
                shareReplay(),
              );
              this.#definitionContainerInstanceKeyPaths.set(definitionContainerId, entry);
            }
            return entry;
          }),
        ),
      ),
    );
  }

  public getSearchPathsUpToRootCategory({ categoryId }: { categoryId: Id64String }): Observable<HierarchyNodeIdentifiersPath> {
    return this.getCachedCategoryData().pipe(
      mergeMap(({ categoriesWithModel, categoriesGroupedByModel }) => {
        if (categoriesGroupedByModel.size === 0) {
          return EMPTY;
        }
        if (categoriesWithModel.size === 0) {
          return EMPTY;
        }
        const entry = categoriesWithModel.get(categoryId);
        if (!entry) {
          return EMPTY;
        }
        if (!entry.isDefinitionContainer) {
          return of([]);
        }
        return this.getDefinitionContainersSearchPaths({ definitionContainerIds: entry.modelId });
      }),
    );
  }

  public getAllDefinitionContainersAndCategories(props?: {
    includeEmpty?: boolean;
  }): Observable<{ categories: Array<CategoryId>; definitionContainers: Array<DefinitionContainerId> }> {
    return forkJoin({
      categories: this.getCachedCategoryData().pipe(
        mergeMap(({ categoriesGroupedByModel }) => categoriesGroupedByModel.values()),
        reduce((acc, modelCategoriesInfo) => {
          applyElementsFilter(modelCategoriesInfo.childCategories, props?.includeEmpty).forEach((categoryInfo) => acc.push(categoryInfo.id));
          return acc;
        }, new Array<Id64String>()),
      ),
      definitionContainers: this.getDefinitionContainersInfo().pipe(
        mergeMap((definitionContainersInfo) => definitionContainersInfo.entries()),
        reduce((acc, [definitionContainerId, definitionContainerInfo]) => {
          if (definitionContainerInfo.hasElements || !!props?.includeEmpty) {
            acc.push(definitionContainerId);
          }
          return acc;
        }, new Array<Id64String>()),
      ),
    });
  }

  public getRootDefinitionContainersAndCategories(props?: {
    includeEmpty?: boolean;
  }): Observable<{ categories: CategoryInfo[]; definitionContainers: Array<DefinitionContainerId> }> {
    return forkJoin({
      categories: this.getCachedCategoryData().pipe(
        mergeMap(({ categoriesGroupedByModel }) => categoriesGroupedByModel.values()),
        reduce((acc, modelCategoriesInfo) => {
          if (!modelCategoriesInfo.parentDefinitionContainerExists) {
            applyElementsFilter(modelCategoriesInfo.childCategories, props?.includeEmpty).forEach((categoryInfo) => acc.push(categoryInfo));
          }
          return acc;
        }, new Array<CategoryInfo>()),
      ),
      definitionContainers: this.getDefinitionContainersInfo().pipe(
        mergeMap((definitionContainersInfo) => definitionContainersInfo.entries()),
        reduce((acc, [definitionContainerId, definitionContainerInfo]) => {
          if (!definitionContainerInfo.parentDefinitionContainerExists && (definitionContainerInfo.hasElements || !!props?.includeEmpty)) {
            acc.push(definitionContainerId);
          }
          return acc;
        }, new Array<Id64String>()),
      ),
    });
  }

  public getIsDefinitionContainerSupported(): Observable<boolean> {
    this.#isDefinitionContainerSupported ??= this.queryIsDefinitionContainersSupported().pipe(shareReplay());
    return this.#isDefinitionContainerSupported;
  }
}

function applyElementsFilter<T extends { hasElements?: boolean }>(list: T[], includeEmpty: boolean | undefined): T[] {
  return includeEmpty ? list : list.filter(({ hasElements }) => !!hasElements);
}
