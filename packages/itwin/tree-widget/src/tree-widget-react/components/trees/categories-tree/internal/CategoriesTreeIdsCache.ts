/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, forkJoin, from, map, mergeMap, of, reduce, shareReplay, toArray } from "rxjs";
import { Guid, Id64 } from "@itwin/core-bentley";
import { CLASS_NAME_DefinitionContainer, CLASS_NAME_Model, CLASS_NAME_SubCategory } from "../../common/internal/ClassNameDefinitions.js";
import { ModelCategoryElementsCountCache } from "../../common/internal/ModelCategoryElementsCountCache.js";
import { getClassesByView, getDistinctMapValues, joinId64Arg } from "../../common/internal/Utils.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { CategoryId, DefinitionContainerId, ElementId, ModelId, SubCategoryId } from "../../common/internal/Types.js";

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

interface SubCategoryInfo {
  categoryId: Id64String;
}

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

/** @internal */
export class CategoriesTreeIdsCache implements Disposable {
  #definitionContainersInfo: Observable<Map<DefinitionContainerId, DefinitionContainerInfo>> | undefined;
  #modelsCategoriesInfo: Observable<Map<ModelId, CategoriesInfo>> | undefined;
  #elementModelsCategories: Observable<Map<ModelId, { categoryIds: Id64Set; isSubModel: boolean }>> | undefined;
  #subCategoriesInfo: Observable<Map<SubCategoryId, SubCategoryInfo>> | undefined;
  readonly #categoryElementCounts: ModelCategoryElementsCountCache;
  #modelWithCategoryModeledElements: Observable<Map<ModelCategoryKey, Set<ElementId>>> | undefined;
  #categoryClass: string;
  #categoryElementClass: string;
  #categoryModelClass: string;
  #isDefinitionContainerSupported: Observable<boolean> | undefined;
  #filteredElementsModels: Observable<Map<ElementId, ModelId>> | undefined;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  #componentName: string;

  constructor(queryExecutor: LimitingECSqlQueryExecutor, viewType: "3d" | "2d", componentId?: GuidString) {
    this.#queryExecutor = queryExecutor;
    const { categoryClass, elementClass, modelClass } = getClassesByView(viewType);
    this.#categoryClass = categoryClass;
    this.#categoryElementClass = elementClass;
    this.#categoryModelClass = modelClass;
    this.#componentId = componentId ?? Guid.createValue();
    this.#componentName = "CategoriesTreeIdsCache";
    this.#categoryElementCounts = new ModelCategoryElementsCountCache(this.#queryExecutor, [elementClass], this.#componentId);
  }

  public [Symbol.dispose]() {
    this.#categoryElementCounts[Symbol.dispose]();
  }

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

  private queryElementModelCategories(): Observable<{
    modelId: Id64String;
    categoryId: Id64String;
  }> {
    return defer(() => {
      const query = `
        SELECT this.Model.Id modelId, this.Category.Id categoryId
        FROM ${this.#categoryModelClass} m
        JOIN ${this.#categoryElementClass} this ON m.ECInstanceId = this.Model.Id
        WHERE this.Parent.Id IS NULL AND m.IsPrivate = false
        GROUP BY modelId, categoryId
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: query },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/element-models-and-categories` },
      );
    }).pipe(
      map((row) => {
        return { modelId: row.modelId, categoryId: row.categoryId };
      }),
    );
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
      map((row) => {
        return { id: row.id, modelId: row.modelId, hasElements: !!row.hasElements };
      }),
    );
  }

  private queryVisibleSubCategories(categoryIds: Id64Array): Observable<{ id: SubCategoryId; parentId: CategoryId }> {
    return defer(() => {
      const definitionsQuery = `
      SELECT
          sc.ECInstanceId id,
          sc.Parent.Id categoryId
        FROM
          ${CLASS_NAME_SubCategory} sc
        WHERE
          NOT sc.IsPrivate
          AND sc.Parent.Id IN (${categoryIds.join(",")})
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

  private getElementModelsCategories() {
    this.#elementModelsCategories ??= forkJoin({
      modelCategories: this.queryElementModelCategories().pipe(
        reduce((acc, queriedCategory) => {
          let modelEntry = acc.get(queriedCategory.modelId);
          if (modelEntry === undefined) {
            modelEntry = { categoryIds: new Set() };
            acc.set(queriedCategory.modelId, modelEntry);
          }
          modelEntry.categoryIds.add(queriedCategory.categoryId);
          return acc;
        }, new Map<ModelId, { categoryIds: Id64Set }>()),
      ),
      modelWithCategoryModeledElements: this.getModelWithCategoryModeledElements(),
    }).pipe(
      map(({ modelCategories, modelWithCategoryModeledElements }) => {
        const result = new Map<ModelId, { categoryIds: Set<CategoryId>; isSubModel: boolean }>();
        const subModels = getDistinctMapValues(modelWithCategoryModeledElements);
        for (const [modelId, modelEntry] of modelCategories) {
          const isSubModel = subModels.has(modelId);
          result.set(modelId, { categoryIds: modelEntry.categoryIds, isSubModel });
        }
        return result;
      }),
      shareReplay(),
    );
    return this.#elementModelsCategories;
  }

  private queryModeledElements(): Observable<{
    modelId: Id64String;
    modeledElementId: Id64String;
    categoryId: Id64String;
    rootCategoryId: Id64String;
  }> {
    return defer(() => {
      const query = `
          SELECT
            pe.ECInstanceId modeledElementId,
            pe.Category.Id categoryId,
            pe.Model.Id modelId
          FROM ${this.#categoryModelClass} m
          JOIN ${this.#categoryElementClass} pe ON pe.ECInstanceId = m.ModeledElement.Id
          WHERE
            m.IsPrivate = false
            AND m.ECInstanceId IN (SELECT Model.Id FROM ${this.#categoryElementClass})
        `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: query },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/modeled-elements` },
      );
    }).pipe(
      map((row) => {
        return { modelId: row.modelId, categoryId: row.categoryId, modeledElementId: row.modeledElementId, rootCategoryId: row.rootCategoryId };
      }),
    );
  }

  private getModelWithCategoryModeledElements() {
    this.#modelWithCategoryModeledElements ??= this.queryModeledElements().pipe(
      reduce((acc, { modelId, categoryId, modeledElementId }) => {
        const key: ModelCategoryKey = `${modelId}-${categoryId}`;
        const entry = acc.get(key);
        if (entry === undefined) {
          acc.set(key, new Set([modeledElementId]));
        } else {
          entry.add(modeledElementId);
        }
        return acc;
      }, new Map<ModelCategoryKey, Set<ElementId>>()),
      shareReplay(),
    );
    return this.#modelWithCategoryModeledElements;
  }

  public getCategoriesModeledElements(modelId: Id64String, categoryIds: Id64Arg): Observable<Id64Array> {
    return this.getModelWithCategoryModeledElements().pipe(
      map((modelWithCategoryModeledElements) => {
        const result = new Array<ElementId>();
        for (const categoryId of Id64.iterable(categoryIds)) {
          const entry = modelWithCategoryModeledElements.get(`${modelId}-${categoryId}`);
          if (entry !== undefined) {
            result.push(...entry);
          }
        }
        return result;
      }),
    );
  }

  private getSubCategoriesInfo() {
    this.#subCategoriesInfo ??= this.getModelsCategoriesInfo()
      .pipe(
        mergeMap((modelsCategoriesInfo) => from(modelsCategoriesInfo.values())),
        reduce((acc, modelCategoriesInfo) => {
          acc.push(
            ...modelCategoriesInfo.childCategories.filter((categoryInfo) => categoryInfo.subCategoryChildCount > 1).map((categoryInfo) => categoryInfo.id),
          );
          return acc;
        }, new Array<CategoryId>()),
        mergeMap((categoriesWithMoreThanOneSubCategory) => {
          const allSubCategories = new Map<Id64String, SubCategoryInfo>();
          if (categoriesWithMoreThanOneSubCategory.length === 0) {
            return of(allSubCategories);
          }
          return this.queryVisibleSubCategories(categoriesWithMoreThanOneSubCategory).pipe(
            reduce((acc, queriedSubCategory) => {
              acc.set(queriedSubCategory.id, { categoryId: queriedSubCategory.parentId });
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

  public getCategoriesElementModels(categoryIds: Id64Arg, includeSubModels?: boolean): Observable<Map<CategoryId, Set<ModelId>>> {
    return this.getElementModelsCategories().pipe(
      mergeMap((elementModelsCategories) =>
        from(Id64.iterable(categoryIds)).pipe(
          reduce((acc, categoryId) => {
            for (const [modelId, { categoryIds: categories, isSubModel }] of elementModelsCategories) {
              if ((includeSubModels || !isSubModel) && categories.has(categoryId)) {
                let categoryModels = acc.get(categoryId);
                if (!categoryModels) {
                  categoryModels = new Set<ModelId>();
                  acc.set(categoryId, categoryModels);
                }
                categoryModels.add(modelId);
              }
            }
            return acc;
          }, new Map<CategoryId, Set<ModelId>>()),
        ),
      ),
    );
  }

  public getModelCategoryIds(modelId: Id64String): Observable<Id64Array> {
    return this.getElementModelsCategories().pipe(
      map((elementModelsCategories) => {
        return [...(elementModelsCategories.get(modelId)?.categoryIds ?? [])];
      }),
    );
  }

  public getAllCategories(): Observable<Id64Set> {
    return this.getModelsCategoriesInfo().pipe(
      mergeMap((modelsCategoriesInfo) => modelsCategoriesInfo.values()),
      reduce((acc, { childCategories }) => {
        childCategories.forEach(({ id }) => acc.add(id));
        return acc;
      }, new Set<Id64String>()),
    );
  }

  public hasSubModel(elementId: Id64String): Observable<boolean> {
    return this.getElementModelsCategories().pipe(map((elementModelsCategories) => elementModelsCategories.has(elementId)));
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
            directCategories?.forEach((categoryId) => acc.add(categoryId));
            indirectCategories?.forEach((categoryId) => acc.add(categoryId));
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
      return this.getSubCategoriesInfo().pipe(
        mergeMap((subCategoriesInfo) => {
          const subCategoryInfo = subCategoriesInfo.get(props.subCategoryId);
          if (subCategoryInfo === undefined) {
            return of([]);
          }
          return this.getInstanceKeyPaths({ categoryId: subCategoryInfo.categoryId }).pipe(
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

  public getCategoryElementsCount(modelId: Id64String, categoryId: Id64String): Observable<number> {
    return this.#categoryElementCounts.getCategoryElementsCount(modelId, categoryId);
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

  public getSubCategories(categoryIds: Id64Arg): Observable<Map<CategoryId, Array<SubCategoryId>>> {
    return this.getSubCategoriesInfo().pipe(
      mergeMap((subCategoriesInfo) => subCategoriesInfo.entries()),
      reduce((acc, [subCategoryId, subCategoryInfo]) => {
        let entry = acc.get(subCategoryInfo.categoryId);
        if (!entry) {
          entry = [];
          acc.set(subCategoryInfo.categoryId, entry);
        }
        entry.push(subCategoryId);
        return acc;
      }, new Map<CategoryId, Array<Id64String>>()),
      map((subCategoriesMap) => {
        const result = new Map<CategoryId, Array<Id64String>>();
        for (const categoryId of Id64.iterable(categoryIds)) {
          const entry = subCategoriesMap.get(categoryId);
          if (entry) {
            result.set(categoryId, entry);
          }
        }
        return result;
      }),
    );
  }

  public getIsDefinitionContainerSupported(): Observable<boolean> {
    this.#isDefinitionContainerSupported ??= this.queryIsDefinitionContainersSupported().pipe(shareReplay());
    return this.#isDefinitionContainerSupported;
  }
}

function applyElementsFilter<T extends { hasElements?: boolean }>(list: T[], includeEmpty: boolean | undefined): T[] {
  return includeEmpty ? list : list.filter(({ hasElements }) => !!hasElements);
}
