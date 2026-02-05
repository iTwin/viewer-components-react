/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, forkJoin, from, map, mergeMap, reduce, shareReplay } from "rxjs";
import { Guid, Id64 } from "@itwin/core-bentley";
import { catchBeSQLiteInterrupts } from "../UseErrorState.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ModelId } from "../Types.js";
import type { ModeledElementsCache } from "./ModeledElementsCache.js";

interface ElementModelCategoriesCacheProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  componentId?: GuidString;
  elementClassName: string;
  type: "2d" | "3d";
  modelClassName: string;
  modeledElementsCache: ModeledElementsCache;
}

/** @internal */
export class ElementModelCategoriesCache {
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  #componentName: string;
  #elementClassName: string;
  #type: "2d" | "3d";
  #modelClassName: string;
  #modeledElementsCache: ModeledElementsCache;
  #modelsCategoriesInfo:
    | Observable<Map<ModelId, { categoriesOfTopMostElements: Set<CategoryId>; allCategories: Set<CategoryId>; isSubModel: boolean }>>
    | undefined;

  constructor(props: ElementModelCategoriesCacheProps) {
    this.#queryExecutor = props.queryExecutor;
    this.#elementClassName = props.elementClassName;
    this.#modelClassName = props.modelClassName;
    this.#modeledElementsCache = props.modeledElementsCache;
    this.#type = props.type;
    this.#componentId = props.componentId ?? Guid.createValue();
    this.#componentName = `ElementModelCategoriesCache${this.#type}`;
  }

  private queryElementModelCategories(): Observable<{
    modelId: Id64String;
    categoryId: Id64String;
    isTopMostElementCategory: boolean;
  }> {
    return defer(() => {
      const query = `
          SELECT * FROM (
            SELECT
              this.Model.Id modelId,
              this.Category.Id categoryId,
              MAX(IIF(this.Parent.Id IS NULL, 1, 0)) isTopMostElementCategory
            FROM ${this.#modelClassName} m
            JOIN ${this.#elementClassName} this ON m.ECInstanceId = this.Model.Id
            WHERE m.IsPrivate = false
            GROUP BY modelId, categoryId
          )
        `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: query },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/element-models-and-categories` },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row) => {
        return { modelId: row.modelId, categoryId: row.categoryId, isTopMostElementCategory: !!row.isTopMostElementCategory };
      }),
    );
  }

  private getElementModelCategories() {
    this.#modelsCategoriesInfo ??= forkJoin({
      modelCategories: this.queryElementModelCategories().pipe(
        reduce((acc, queriedCategory) => {
          let modelEntry = acc.get(queriedCategory.modelId);
          if (modelEntry === undefined) {
            modelEntry = { categoriesOfTopMostElements: new Set(), allCategories: new Set() };
            acc.set(queriedCategory.modelId, modelEntry);
          }
          modelEntry.allCategories.add(queriedCategory.categoryId);
          if (queriedCategory.isTopMostElementCategory) {
            modelEntry.categoriesOfTopMostElements.add(queriedCategory.categoryId);
          }
          return acc;
        }, new Map<ModelId, { categoriesOfTopMostElements: Set<CategoryId>; allCategories: Set<CategoryId> }>()),
      ),
      allSubModels: this.#modeledElementsCache.getModeledElementsInfo().pipe(map(({ allSubModels }) => allSubModels)),
    }).pipe(
      map(({ modelCategories, allSubModels }) => {
        const result = new Map<ModelId, { categoriesOfTopMostElements: Set<CategoryId>; allCategories: Set<CategoryId>; isSubModel: boolean }>();
        modelCategories.forEach(({ categoriesOfTopMostElements, allCategories }, modelId) => {
          const isSubModel = allSubModels.has(modelId);
          result.set(modelId, {
            categoriesOfTopMostElements,
            allCategories,
            isSubModel,
          });
        });
        return result;
      }),
      shareReplay(),
    );
    return this.#modelsCategoriesInfo;
  }

  public getCategoriesElementModels(props: {
    categoryIds: Id64Arg;
    includeSubModels?: boolean;
  }): Observable<{ id: CategoryId; models: Array<ModelId> | undefined }> {
    const { categoryIds, includeSubModels } = props;
    return this.getElementModelCategories().pipe(
      mergeMap((modelCategories) =>
        from(Id64.iterable(categoryIds)).pipe(
          map((categoryId) => {
            const categoryModels = new Array<ModelId>();
            modelCategories.forEach(({ allCategories, isSubModel }, modelId) => {
              if ((includeSubModels || !isSubModel) && allCategories.has(categoryId)) {
                categoryModels.push(modelId);
              }
            });
            return { id: categoryId, models: categoryModels.length > 0 ? categoryModels : undefined };
          }),
        ),
      ),
    );
  }

  public getModelCategoryIds(modelId: Id64String): Observable<Id64Set> {
    return this.getElementModelCategories().pipe(map((modelCategories) => modelCategories.get(modelId)?.allCategories ?? new Set()));
  }

  public getModelsOfTopMostElementCategory(categoryId: Id64String): Observable<Id64Array> {
    return this.getElementModelCategories().pipe(
      mergeMap((modelCategories) => modelCategories.entries()),
      reduce((acc, [modelId, { categoriesOfTopMostElements, isSubModel }]) => {
        if (!isSubModel && categoriesOfTopMostElements.has(categoryId)) {
          acc.push(modelId);
        }
        return acc;
      }, new Array<ModelId>()),
    );
  }

  public getAllCategoriesOfElements(): Observable<Id64Set> {
    return this.getElementModelCategories().pipe(
      mergeMap((modelCategories) => modelCategories.values()),
      reduce((acc, { allCategories }) => {
        allCategories.forEach((categoryId) => acc.add(categoryId));
        return acc;
      }, new Set<CategoryId>()),
    );
  }
}
