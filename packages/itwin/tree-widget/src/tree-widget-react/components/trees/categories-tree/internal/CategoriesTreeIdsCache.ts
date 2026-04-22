/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, forkJoin, from, map, merge, mergeAll, mergeMap, of, reduce, shareReplay, toArray } from "rxjs";
import { Guid, Id64 } from "@itwin/core-bentley";
import { BaseIdsCacheImpl } from "../../common/internal/caches/BaseIdsCache.js";
import { CLASS_NAME_DefinitionContainer, CLASS_NAME_Model, CLASS_NAME_SubCategory } from "../../common/internal/ClassNameDefinitions.js";
import { catchBeSQLiteInterrupts } from "../../common/internal/UseErrorState.js";
import { fromWithRelease, getClassesByView } from "../../common/internal/Utils.js";
import { createGeometricElementInstanceKeyPaths } from "../CategoriesTreeDefinition.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
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
}

interface CategoriesTreeIdsCacheProps extends BaseIdsCacheImplProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  type: "2d" | "3d";
}

/** @internal */
export class CategoriesTreeIdsCache extends BaseIdsCacheImpl {
  #definitionContainersInfo: Observable<Map<DefinitionContainerId, DefinitionContainerInfo>> | undefined;
  #modelsCategoriesInfo: Observable<Map<ModelId, CategoriesInfo>> | undefined;
  #definitionContainerInstanceKeyPaths: Map<DefinitionContainerId, Observable<HierarchyNodeIdentifiersPath>> = new Map();
  #categoryClass: EC.FullClassName;
  #categoryElementClass: EC.FullClassName;
  #modelClass: EC.FullClassName;
  #type: "2d" | "3d";
  #isDefinitionContainerSupported: Observable<boolean> | undefined;
  #filteredElementsModels: Observable<Map<ElementId, ModelId>> | undefined;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  #componentName: string;

  constructor(props: CategoriesTreeIdsCacheProps) {
    super(props);
    this.#queryExecutor = props.queryExecutor;
    const { categoryClass, elementClass, modelClass } = getClassesByView(props.type);
    this.#categoryClass = categoryClass;
    this.#categoryElementClass = elementClass;
    this.#modelClass = modelClass;
    this.#type = props.type;
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
              ) hasElements
            FROM
              ${this.#categoryClass} this
              JOIN ${CLASS_NAME_SubCategory} sc ON sc.Parent.Id = this.ECInstanceId
              JOIN ${CLASS_NAME_Model} m ON m.ECInstanceId = this.Model.Id
            WHERE
              NOT this.IsPrivate
              AND (NOT m.IsPrivate OR m.ECClassId IS (BisCore.DictionaryModel))
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
        WHERE
          s.Name = 'BisCore'
          AND c.Name = 'DefinitionContainer'
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

  private getModelsCategoriesInfo() {
    this.#modelsCategoriesInfo ??= this.queryCategories()
      .pipe(
        reduce((acc, queriedCategory) => {
          let modelCategories = acc.get(queriedCategory.modelId);
          if (modelCategories === undefined) {
            modelCategories = { parentDefinitionContainerExists: queriedCategory.parentDefinitionContainerExists, childCategories: [] };
            acc.set(queriedCategory.modelId, modelCategories);
          }
          modelCategories.childCategories.push({
            id: queriedCategory.id,
            subCategoryChildCount: queriedCategory.subCategoryChildCount,
            hasElements: queriedCategory.hasElements,
          });
          return acc;
        }, new Map<ModelId, CategoriesInfo>()),
      )
      .pipe(shareReplay());
    return this.#modelsCategoriesInfo;
  }

  private getDefinitionContainersInfo() {
    this.#definitionContainersInfo ??= forkJoin({
      isDefinitionContainerSupported: this.getIsDefinitionContainerSupported(),
      modelsCategoriesInfo: this.getModelsCategoriesInfo(),
    })
      .pipe(
        mergeMap(({ isDefinitionContainerSupported, modelsCategoriesInfo }) => {
          const definitionContainersInfo = new Map<DefinitionContainerId, DefinitionContainerInfo>();
          if (!isDefinitionContainerSupported || modelsCategoriesInfo.size === 0) {
            return of(definitionContainersInfo);
          }
          return this.queryDefinitionContainers().pipe(
            reduce((acc, queriedDefinitionContainer) => {
              const modelCategoriesInfo = modelsCategoriesInfo.get(queriedDefinitionContainer.id);
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
    includeEmptyCategories,
  }: {
    definitionContainerIds: Id64Arg;
    includeEmptyCategories?: boolean;
  }): Observable<Id64Set> {
    return this.getDefinitionContainersInfo().pipe(
      mergeMap((definitionContainersInfo) =>
        from(Id64.iterable(definitionContainerIds)).pipe(
          mergeMap((definitionContainerId) => {
            const definitionContainerInfo = definitionContainersInfo.get(definitionContainerId);
            if (definitionContainerInfo === undefined) {
              return of({ directCategories: undefined, indirectCategories: undefined });
            }
            const childDefinitionContainerIds = definitionContainerInfo.childDefinitionContainers.map(({ id }) => id);
            return (
              childDefinitionContainerIds.length > 0
                ? this.getAllContainedCategories({
                    definitionContainerIds: childDefinitionContainerIds,
                    includeEmptyCategories,
                  })
                : of(new Set<CategoryId>())
            ).pipe(
              map((indirectCategories) => {
                return {
                  directCategories: applyElementsFilter(definitionContainerInfo.childCategories, includeEmptyCategories).map((category) => category.id),
                  indirectCategories,
                };
              }),
            );
          }),
          reduce((acc, { directCategories, indirectCategories }) => {
            for (const categoryId of directCategories ?? []) {
              acc.add(categoryId);
            }
            for (const categoryId of indirectCategories ?? []) {
              acc.add(categoryId);
            }
            return acc;
          }, new Set<CategoryId>()),
        ),
      ),
    );
  }

  public getSubCategoriesSearchPaths({ subCategoryIds }: { subCategoryIds: Id64Arg }): Observable<HierarchyNodeIdentifiersPath> {
    return this.getSubCategoriesInfo().pipe(
      mergeMap(({ subCategoryCategories, categorySubCategories }) =>
        fromWithRelease({ source: subCategoryIds, releaseOnCount: 200 }).pipe(
          mergeMap((subCategoryId) => {
            const categoryOfSubCategory = subCategoryCategories.get(subCategoryId);
            if (categoryOfSubCategory === undefined) {
              return of([]);
            }
            const subCategories = categorySubCategories.get(categoryOfSubCategory);
            if (!subCategories || subCategories.length <= 1) {
              return of([]);
            }
            return this.getCategoriesSearchPaths({ categoryIds: categoryOfSubCategory, includePathsWithSubModels: false }).pipe(
              map((pathToCategory) => [...pathToCategory, { id: subCategoryId, className: CLASS_NAME_SubCategory }]),
            );
          }),
        ),
      ),
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

  public getCategoriesSearchPaths({
    categoryIds,
    includePathsWithSubModels,
  }: {
    categoryIds: Id64Arg;
    includePathsWithSubModels: boolean;
  }): Observable<HierarchyNodeIdentifiersPath> {
    const pathsWithSubModels = includePathsWithSubModels
      ? fromWithRelease({ source: categoryIds, releaseOnCount: 200 }).pipe(
          mergeMap((id) =>
            forkJoin({ id: of(id), subModels: this.getModels({ subModels: "only", categoryId: id, includeOnlyIfCategoryOfTopMostElement: true }) }),
          ),
          reduce((acc, { id, subModels }) => {
            for (const subModelId of subModels) {
              const entry = acc.get(subModelId);
              if (!entry) {
                acc.set(subModelId, new Set([id]));
                continue;
              }
              entry.add(id);
            }
            return acc;
          }, new Map<ModelId, Set<CategoryId>>()),
          mergeMap((subModelCategoriesMap) => {
            if (subModelCategoriesMap.size === 0) {
              return EMPTY;
            }
            return createGeometricElementInstanceKeyPaths({
              queryExecutor: this.#queryExecutor,
              idsCache: this,
              viewType: this.#type,
              targetItems: [...subModelCategoriesMap.keys()],
              componentId: Guid.createValue(),
              componentName: "CategoriesTreeIdsCache-categoryInstanceKeyPaths",
              chunkIndex: -1,
            }).pipe(
              map(({ path }) => {
                const categories = subModelCategoriesMap.get(path[path.length - 1].id);
                const paths = new Array<HierarchyNodeIdentifiersPath>();
                for (const categoryId of categories ?? []) {
                  // Paths for modeled elements are created, but category is under sub-model, so need to
                  // add sub-model and category to the path.
                  paths.push([...path, { className: this.#modelClass, id: path[path.length - 1].id }, { className: this.#categoryClass, id: categoryId }]);
                }
                return paths;
              }),
              mergeAll(),
            );
          }),
        )
      : EMPTY;

    const pathsWithoutSubModels = this.getModelsCategoriesInfo().pipe(
      mergeMap((modelsCategoriesInfo) =>
        fromWithRelease({ source: categoryIds, releaseOnCount: 200 }).pipe(
          mergeMap((categoryId) => {
            for (const [modelId, modelCategoriesInfo] of modelsCategoriesInfo) {
              if (modelCategoriesInfo.childCategories.find((childCategory) => childCategory.id === categoryId)) {
                const instanceKey = { id: categoryId, className: this.#categoryClass };
                if (!modelCategoriesInfo.parentDefinitionContainerExists) {
                  return of([instanceKey]);
                }

                return this.getDefinitionContainersSearchPaths({ definitionContainerIds: modelId }).pipe(
                  map((pathToDefinitionContainer) => [...pathToDefinitionContainer, instanceKey]),
                );
              }
            }
            return of([]);
          }),
        ),
      ),
    );
    return merge(pathsWithSubModels, pathsWithoutSubModels);
  }

  public getAllDefinitionContainersAndCategories(props?: {
    includeEmpty?: boolean;
  }): Observable<{ categories: Array<CategoryId>; definitionContainers: Array<DefinitionContainerId> }> {
    return forkJoin({
      categories: this.getModelsCategoriesInfo().pipe(
        mergeMap((modelsCategoriesInfo) => modelsCategoriesInfo.values()),
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
      categories: this.getModelsCategoriesInfo().pipe(
        mergeMap((modelsCategoriesInfo) => modelsCategoriesInfo.values()),
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
