/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, forkJoin, from, map, mergeMap, of, reduce, shareReplay, toArray } from "rxjs";
import { Guid, Id64 } from "@itwin/core-bentley";
import { CLASS_NAME_DefinitionContainer, CLASS_NAME_Model, CLASS_NAME_SubCategory } from "../../common/internal/ClassNameDefinitions.js";
import { catchBeSQLiteInterrupts } from "../../common/internal/UseErrorState.js";
import { getClassesByView, joinId64Arg } from "../../common/internal/Utils.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Arg, Id64Set, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { InstanceKey, Props } from "@itwin/presentation-shared";
import type { BaseIdsCache, IBaseIdsCache } from "../../common/internal/caches/BaseIdsCache.js";
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

interface CategoriesTreeIdsCacheProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  type: "2d" | "3d";
  componentId?: GuidString;
  baseIdsCache: BaseIdsCache;
}

/** @internal */
export class CategoriesTreeIdsCache implements IBaseIdsCache, Disposable {
  #definitionContainersInfo: Observable<Map<DefinitionContainerId, DefinitionContainerInfo>> | undefined;
  #modelsCategoriesInfo: Observable<Map<ModelId, CategoriesInfo>> | undefined;
  #categoryClass: string;
  #categoryElementClass: string;
  #isDefinitionContainerSupported: Observable<boolean> | undefined;
  #filteredElementsModels: Observable<Map<ElementId, ModelId>> | undefined;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  #componentName: string;
  #baseIdsCache: BaseIdsCache;

  constructor(props: CategoriesTreeIdsCacheProps) {
    this.#queryExecutor = props.queryExecutor;
    const { categoryClass, elementClass } = getClassesByView(props.type);
    this.#categoryClass = categoryClass;
    this.#categoryElementClass = elementClass;
    this.#componentId = props.componentId ?? Guid.createValue();
    this.#componentName = `CategoriesTreeIdsCache${props.type}`;
    this.#baseIdsCache = props.baseIdsCache;
  }
  public [Symbol.dispose]() {}

  // Implement IBaseIdsCache by re-exporting BaseIdsCache methods

  public getChildElementsTree(props: Props<IBaseIdsCache["getChildElementsTree"]>): ReturnType<IBaseIdsCache["getChildElementsTree"]> {
    return this.#baseIdsCache.getChildElementsTree(props);
  }

  public getAllChildElementsCount(props: Props<IBaseIdsCache["getAllChildElementsCount"]>): ReturnType<IBaseIdsCache["getAllChildElementsCount"]> {
    return this.#baseIdsCache.getAllChildElementsCount(props);
  }

  public getSubCategories(props: Props<IBaseIdsCache["getSubCategories"]>): ReturnType<IBaseIdsCache["getSubCategories"]> {
    return this.#baseIdsCache.getSubCategories(props);
  }

  public getSubModels(props: Props<IBaseIdsCache["getSubModels"]>): ReturnType<IBaseIdsCache["getSubModels"]> {
    return this.#baseIdsCache.getSubModels(props);
  }

  public getSubModelsUnderElement(props: Props<IBaseIdsCache["getSubModelsUnderElement"]>): ReturnType<IBaseIdsCache["getSubModelsUnderElement"]> {
    return this.#baseIdsCache.getSubModelsUnderElement(props);
  }

  public getElementsCount(props: Props<IBaseIdsCache["getElementsCount"]>): ReturnType<IBaseIdsCache["getElementsCount"]> {
    return this.#baseIdsCache.getElementsCount(props);
  }

  public getCategories(props: Props<IBaseIdsCache["getCategories"]>): ReturnType<IBaseIdsCache["getCategories"]> {
    return this.#baseIdsCache.getCategories(props);
  }

  public getModels(props: Props<IBaseIdsCache["getModels"]>): ReturnType<IBaseIdsCache["getModels"]> {
    return this.#baseIdsCache.getModels(props);
  }

  public getAllCategoriesOfElements(): ReturnType<BaseIdsCache["getAllCategoriesOfElements"]> {
    return this.#baseIdsCache.getAllCategoriesOfElements();
  }

  // Re-export BaseIdsCache methods that are needed for models tree specific functionality

  public getCategoriesOfModelsTopMostElements(
    props: Props<BaseIdsCache["getCategoriesOfModelsTopMostElements"]>,
  ): ReturnType<BaseIdsCache["getCategoriesOfModelsTopMostElements"]> {
    return this.#baseIdsCache.getCategoriesOfModelsTopMostElements(props);
  }

  // Implement categories tree specific methods

  private queryFilteredElementsModels(filteredElementIds: Id64Arg): Observable<{
    modelId: Id64String;
    id: ElementId;
  }> {
    return defer(() => {
      const query = `
        SELECT Model.Id modelId, ECInstanceId id
        FROM ${this.#categoryElementClass}
        WHERE ECInstanceId IN (${joinId64Arg(filteredElementIds, ",")})
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: query },
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

  public getFilteredElementsModels(filteredElementIds: Id64Arg) {
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

  public getInstanceKeyPaths(
    props: { categoryId: Id64String } | { definitionContainerId: Id64String } | { subCategoryId: Id64String },
  ): Observable<InstanceKey[]> {
    if ("subCategoryId" in props) {
      return this.#baseIdsCache.getSubCategoriesInfo().pipe(
        mergeMap(({ subCategoryCategories, categorySubCategories }) => {
          const categoryOfSubCategory = subCategoryCategories.get(props.subCategoryId);
          if (categoryOfSubCategory === undefined) {
            return of([]);
          }
          const subCategories = categorySubCategories.get(categoryOfSubCategory);
          if (!subCategories || subCategories.length <= 1) {
            return of([]);
          }
          return this.getInstanceKeyPaths({ categoryId: categoryOfSubCategory }).pipe(
            map((pathToCategory) => [...pathToCategory, { id: props.subCategoryId, className: CLASS_NAME_SubCategory }]),
          );
        }),
      );
    }

    if ("categoryId" in props) {
      return this.getModelsCategoriesInfo().pipe(
        mergeMap((modelsCategoriesInfo) => {
          for (const [modelId, modelCategoriesInfo] of modelsCategoriesInfo) {
            if (modelCategoriesInfo.childCategories.find((childCategory) => childCategory.id === props.categoryId)) {
              const instanceKey = { id: props.categoryId, className: this.#categoryClass };
              if (!modelCategoriesInfo.parentDefinitionContainerExists) {
                return of([instanceKey]);
              }

              return this.getInstanceKeyPaths({ definitionContainerId: modelId }).pipe(
                map((pathToDefinitionContainer) => [...pathToDefinitionContainer, instanceKey]),
              );
            }
          }
          return of([]);
        }),
      );
    }
    return this.getDefinitionContainersInfo().pipe(
      mergeMap((definitionContainersInfo) => {
        const definitionContainerInfo = definitionContainersInfo.get(props.definitionContainerId);
        if (definitionContainerInfo === undefined) {
          return of([]);
        }
        const instanceKey = { id: props.definitionContainerId, className: CLASS_NAME_DefinitionContainer };
        if (!definitionContainerInfo.parentDefinitionContainerExists) {
          return of([instanceKey]);
        }
        return this.getInstanceKeyPaths({ definitionContainerId: definitionContainerInfo.modelId }).pipe(
          map((pathToParentDefinitionContainer) => [...pathToParentDefinitionContainer, instanceKey]),
        );
      }),
    );
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
