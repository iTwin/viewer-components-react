/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, forkJoin, from, map, mergeMap, of, reduce, shareReplay, toArray } from "rxjs";
import { Guid, Id64 } from "@itwin/core-bentley";
import { setIntersection } from "../../common/internal/Utils.js";
import { DEFINITION_CONTAINER_CLASS, SUB_CATEGORY_CLASS } from "./ClassNameDefinitions.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";

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

interface CategoryInfo {
  id: Id64String;
  childCount: number;
  hasElements: boolean;
}

/** @internal */
export class CategoriesTreeIdsCache implements Disposable {
  #definitionContainersInfo: Observable<Map<Id64String, DefinitionContainerInfo>> | undefined;
  #modelsCategoriesInfo: Observable<Map<Id64String, CategoriesInfo>> | undefined;
  #subCategoriesInfo: Observable<Map<Id64String, Id64Set>> | undefined;
  #elementModelsCategories: Observable<Map<Id64String, Id64Set>> | undefined;
  #categoryClass: string;
  #categoryElementClass: string;
  #categoryModelClass: string;
  #isDefinitionContainerSupported: Observable<boolean> | undefined;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  #componentName: string;

  constructor(queryExecutor: LimitingECSqlQueryExecutor, viewType: "3d" | "2d", componentId?: GuidString) {
    this.#queryExecutor = queryExecutor;
    const { categoryClass, categoryElementClass, categoryModelClass } = getClassesByView(viewType);
    this.#categoryClass = categoryClass;
    this.#categoryElementClass = categoryElementClass;
    this.#categoryModelClass = categoryModelClass;
    this.#componentId = componentId ?? Guid.createValue();
    this.#componentName = "CategoriesTreeIdsCache";
  }

  public [Symbol.dispose]() {}

  private queryElementModelCategories(): Observable<{
    modelId: Id64String;
    categoryId: Id64String;
  }> {
    return defer(() => {
      const query = `
        SELECT this.Model.Id modelId, this.Category.Id categoryId
        FROM ${this.#categoryModelClass} m
        JOIN ${this.#categoryElementClass} this ON m.ECInstanceId = this.Model.Id
        WHERE m.IsPrivate = false
        GROUP BY modelId, categoryId
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: query },
        {
          rowFormat: "ECSqlPropertyNames",
          limit: "unbounded",
          restartToken: `${this.#componentName}/${this.#componentId}/element-models-and-categories`,
        },
      );
    }).pipe(
      map((row) => {
        return { modelId: row.modelId, categoryId: row.categoryId };
      }),
    );
  }

  private queryCategories(): Observable<{
    id: Id64String;
    modelId: Id64String;
    parentDefinitionContainerExists: boolean;
    childCount: number;
    hasElements: boolean;
  }> {
    return this.getIsDefinitionContainerSupported().pipe(
      mergeMap((isDefinitionContainerSupported) =>
        defer(() => {
          const categoriesQuery = `
            SELECT
              this.ECInstanceId id,
              COUNT(sc.ECInstanceId) childCount,
              this.Model.Id modelId,
              ${
                isDefinitionContainerSupported
                  ? `
                  IIF(this.Model.Id IN (SELECT dc.ECInstanceId FROM ${DEFINITION_CONTAINER_CLASS} dc),
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
              JOIN ${SUB_CATEGORY_CLASS} sc ON sc.Parent.Id = this.ECInstanceId
              JOIN BisCore.Model m ON m.ECInstanceId = this.Model.Id
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
          map((row) => {
            return {
              id: row.id,
              modelId: row.modelId,
              parentDefinitionContainerExists: row.parentDefinitionContainerExists,
              childCount: row.childCount,
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
        LIMIT 1
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: query },
        { restartToken: `${this.#componentName}/${this.#componentId}/is-definition-container-supported` },
      );
    }).pipe(
      toArray(),
      map((rows) => rows.length > 0),
    );
  }

  private queryDefinitionContainers(): Observable<{ id: Id64String; modelId: Id64String; hasElements: boolean }> {
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
            FROM ${DEFINITION_CONTAINER_CLASS} dc
            JOIN ${CATEGORIES_MODELS_CTE} c ON dc.ECInstanceId = c.ModelId
            WHERE NOT dc.IsPrivate

            UNION ALL

            SELECT
              pdc.ECInstanceId,
              pdc.Model.Id,
              cdc.HasElements
            FROM
              ${DEFINITION_CONTAINERS_CTE} cdc
              JOIN ${DEFINITION_CONTAINER_CLASS} pdc ON pdc.ECInstanceId = cdc.ModelId
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
      map((row) => {
        return { id: row.id, modelId: row.modelId, hasElements: !!row.hasElements };
      }),
    );
  }

  private queryVisibleSubCategories(categoriesInfo: Id64Array): Observable<{ id: Id64String; parentId: Id64String }> {
    return defer(() => {
      const definitionsQuery = `
        SELECT
          sc.ECInstanceId id,
          sc.Parent.Id categoryId
        FROM
          ${SUB_CATEGORY_CLASS} sc
        WHERE
          NOT sc.IsPrivate
          AND sc.Parent.Id IN (${categoriesInfo.join(",")})
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: definitionsQuery },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/visible-sub-categories` },
      );
    }).pipe(
      map((row) => {
        return { id: row.id, parentId: row.categoryId };
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
          modelCategories.childCategories.push({ id: queriedCategory.id, childCount: queriedCategory.childCount, hasElements: queriedCategory.hasElements });
          return acc;
        }, new Map<Id64String, CategoriesInfo>()),
      )
      .pipe(shareReplay());
    return this.#modelsCategoriesInfo;
  }

  private getElementModelsCategories() {
    this.#elementModelsCategories ??= this.queryElementModelCategories()
      .pipe(
        reduce((acc, queriedCategory) => {
          let modelEntry = acc.get(queriedCategory.modelId);
          if (modelEntry === undefined) {
            modelEntry = new Set();
            acc.set(queriedCategory.modelId, modelEntry);
          }
          modelEntry.add(queriedCategory.categoryId);
          return acc;
        }, new Map<Id64String, Id64Set>()),
      )
      .pipe(shareReplay());
    return this.#elementModelsCategories;
  }

  private getSubCategoriesInfo() {
    this.#subCategoriesInfo ??= this.getModelsCategoriesInfo()
      .pipe(
        mergeMap((modelsCategoriesInfo) => from(modelsCategoriesInfo.values())),
        reduce((acc, modelCategoriesInfo) => {
          acc.push(...modelCategoriesInfo.childCategories.filter((categoryInfo) => categoryInfo.childCount > 1).map((categoryInfo) => categoryInfo.id));
          return acc;
        }, new Array<Id64String>()),
        mergeMap((categoriesWithMoreThanOneSubCategory) => {
          const allSubCategories = new Map<Id64String, Id64Set>();
          if (categoriesWithMoreThanOneSubCategory.length === 0) {
            return of(allSubCategories);
          }
          return this.queryVisibleSubCategories(categoriesWithMoreThanOneSubCategory).pipe(
            reduce((acc, queriedSubCategory) => {
              const entry = acc.get(queriedSubCategory.parentId);
              if (!entry) {
                acc.set(queriedSubCategory.parentId, new Set([queriedSubCategory.id]));
                return acc;
              }
              entry.add(queriedSubCategory.id);
              return acc;
            }, allSubCategories),
          );
        }),
      )
      .pipe(shareReplay());
    return this.#subCategoriesInfo;
  }

  private getDefinitionContainersInfo() {
    this.#definitionContainersInfo ??= forkJoin({
      isDefinitionContainerSupported: this.getIsDefinitionContainerSupported(),
      modelsCategoriesInfo: this.getModelsCategoriesInfo(),
    })
      .pipe(
        mergeMap(({ isDefinitionContainerSupported, modelsCategoriesInfo }) => {
          const definitionContainersInfo = new Map<Id64String, DefinitionContainerInfo>();
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
    parentDefinitionContainerIds: Id64Array;
    includeEmpty?: boolean;
  }): Observable<{ categories: CategoryInfo[]; definitionContainers: Id64Array }> {
    return this.getDefinitionContainersInfo().pipe(
      mergeMap((definitionContainersInfo) =>
        from(parentDefinitionContainerIds).pipe(
          reduce(
            (acc, parentDefinitionContainerId) => {
              const parentDefinitionContainerInfo = definitionContainersInfo.get(parentDefinitionContainerId);
              if (parentDefinitionContainerInfo !== undefined) {
                acc.definitionContainers.push(...applyElementsFilter(parentDefinitionContainerInfo.childDefinitionContainers, includeEmpty).map((dc) => dc.id));
                acc.categories.push(...applyElementsFilter(parentDefinitionContainerInfo.childCategories, includeEmpty));
              }
              return acc;
            },
            { definitionContainers: new Array<Id64String>(), categories: new Array<CategoryInfo>() },
          ),
        ),
      ),
    );
  }

  public getCategoriesElementModels(categoryIds: Id64Arg): Observable<Map<Id64String, Id64Set>> {
    return this.getElementModelsCategories().pipe(
      mergeMap((elementModelsCategories) => elementModelsCategories.entries()),
      reduce((acc, [modelId, modelCategoryIds]) => {
        const sharedCategories = setIntersection(Id64.iterable(categoryIds), modelCategoryIds);
        if (sharedCategories.size > 0) {
          acc.set(modelId, sharedCategories);
        }
        return acc;
      }, new Map<Id64String, Id64Set>()),
    );
  }

  public getCategoriesOfElementModel(modelId: Id64String): Observable<Id64Set | undefined> {
    return this.getElementModelsCategories().pipe(
      map((elementModelsCategories) => elementModelsCategories.get(modelId)),
    );
  }

  public getAllContainedCategories({
    definitionContainerIds,
    includeEmptyCategories,
  }: {
    definitionContainerIds: Id64Array;
    includeEmptyCategories?: boolean;
  }): Observable<Id64Set> {
    return this.getDefinitionContainersInfo().pipe(
      mergeMap((definitionContainersInfo) =>
        from(definitionContainerIds).pipe(
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
                : of(new Set<string>())
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
            directCategories?.forEach((categoryId) => acc.add(categoryId));
            indirectCategories?.forEach((categoryId) => acc.add(categoryId));
            return acc;
          }, new Set<Id64String>()),
        ),
      ),
    );
  }

  public getInstanceKeyPaths(
    props: { categoryId: Id64String } | { definitionContainerId: Id64String } | { subCategoryId: Id64String },
  ): Observable<InstanceKey[]> {
    if ("subCategoryId" in props) {
      return this.getSubCategoriesInfo().pipe(
        mergeMap((subCategoriesInfo) => {
          let categoryOfSubCategory: Id64String | undefined;
          for (const [categoryId, subCategories] of subCategoriesInfo.entries()) {
            if (subCategories.has(props.subCategoryId)) {
              categoryOfSubCategory = categoryId;
              break;
            }
          }
          if (categoryOfSubCategory === undefined) {
            return of([]);
          }
          return this.getInstanceKeyPaths({ categoryId: categoryOfSubCategory }).pipe(
            map((pathToCategory) => [...pathToCategory, { id: props.subCategoryId, className: SUB_CATEGORY_CLASS }]),
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
        const instanceKey = { id: props.definitionContainerId, className: DEFINITION_CONTAINER_CLASS };
        if (!definitionContainerInfo.parentDefinitionContainerExists) {
          return of([instanceKey]);
        }
        return this.getInstanceKeyPaths({ definitionContainerId: definitionContainerInfo.modelId }).pipe(
          map((pathToParentDefinitionContainer) => [...pathToParentDefinitionContainer, instanceKey]),
        );
      }),
    );
  }

  public getAllDefinitionContainersAndCategories(props?: { includeEmpty?: boolean }): Observable<{
    categories: Id64Array;
    definitionContainers: Id64Array;
  }> {
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

  public getRootDefinitionContainersAndCategories(props?: { includeEmpty?: boolean }): Observable<{
    categories: CategoryInfo[];
    definitionContainers: Id64Array;
  }> {
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

  public getSubCategories(categoryId: Id64String): Observable<Id64Set> {
    return this.getSubCategoriesInfo().pipe(map((subCategoriesInfo) => subCategoriesInfo.get(categoryId) ?? new Set()));
  }

  public getIsDefinitionContainerSupported(): Observable<boolean> {
    this.#isDefinitionContainerSupported ??= this.queryIsDefinitionContainersSupported().pipe(shareReplay());
    return this.#isDefinitionContainerSupported;
  }
}

/** @internal */
export function getClassesByView(viewType: "2d" | "3d") {
  return viewType === "2d"
    ? { categoryClass: "BisCore.DrawingCategory", categoryElementClass: "BisCore.GeometricElement2d", categoryModelClass: "BisCore.GeometricModel2d" }
    : { categoryClass: "BisCore.SpatialCategory", categoryElementClass: "BisCore.GeometricElement3d", categoryModelClass: "BisCore.GeometricModel3d" };
}

function applyElementsFilter<T extends { hasElements?: boolean }>(list: T[], includeEmpty: boolean | undefined): T[] {
  return includeEmpty ? list : list.filter(({ hasElements }) => !!hasElements);
}
