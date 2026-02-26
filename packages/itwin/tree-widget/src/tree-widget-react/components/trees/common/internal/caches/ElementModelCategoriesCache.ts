/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, forkJoin, from, map, mergeMap, reduce, shareReplay } from "rxjs";
import { Guid } from "@itwin/core-bentley";
import { CLASS_NAME_Model } from "../ClassNameDefinitions.js";
import { catchBeSQLiteInterrupts } from "../UseErrorState.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ModelId } from "../Types.js";
import type { ModeledElementsCache } from "./ModeledElementsCache.js";

interface ElementModelCategoriesCacheProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  componentId?: GuidString;
  elementClassName: string;
  type: "2d" | "3d";
  modeledElementsCache: ModeledElementsCache;
}

/** @internal */
export class ElementModelCategoriesCache {
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  #componentName: string;
  #elementClassName: string;
  #type: "2d" | "3d";
  #modeledElementsCache: ModeledElementsCache;
  #modelsCategoriesInfo:
    | Observable<Map<ModelId, { categoriesOfTopMostElements: Set<CategoryId>; allCategories: Set<CategoryId>; isSubModel: boolean }>>
    | undefined;

  constructor(props: ElementModelCategoriesCacheProps) {
    this.#queryExecutor = props.queryExecutor;
    this.#elementClassName = props.elementClassName;
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
            FROM ${CLASS_NAME_Model} m
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

  private getModelsCategoriesInfo() {
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
        for (const [modelId, { categoriesOfTopMostElements, allCategories }] of modelCategories) {
          const isSubModel = allSubModels.has(modelId);
          result.set(modelId, {
            categoriesOfTopMostElements,
            allCategories,
            isSubModel,
          });
        }
        return result;
      }),
      shareReplay(),
    );
    return this.#modelsCategoriesInfo;
  }

  public getCategoryElementModels(props: {
    categoryId: Id64String;
    includeSubModels?: boolean;
    includeOnlyIfCategoryOfTopMostElement?: boolean;
  }): Observable<Array<ModelId>> {
    const { categoryId, includeSubModels } = props;
    return this.getModelsCategoriesInfo().pipe(
      map((modelCategories) => {
        const categoryModels = new Array<ModelId>();
        for (const [modelId, { allCategories, categoriesOfTopMostElements, isSubModel }] of modelCategories) {
          if (
            (includeSubModels || !isSubModel) &&
            (props.includeOnlyIfCategoryOfTopMostElement ? categoriesOfTopMostElements.has(categoryId) : allCategories.has(categoryId))
          ) {
            categoryModels.push(modelId);
          }
        }
        return categoryModels;
      }),
    );
  }

  public getModelCategoryIds({
    modelId,
    includeOnlyIfCategoryOfTopMostElement,
  }: {
    modelId: Id64String;
    includeOnlyIfCategoryOfTopMostElement?: boolean;
  }): Observable<Id64Set> {
    return this.getModelsCategoriesInfo().pipe(
      map(
        (modelCategories) =>
          (includeOnlyIfCategoryOfTopMostElement ? modelCategories.get(modelId)?.categoriesOfTopMostElements : modelCategories.get(modelId)?.allCategories) ??
          new Set(),
      ),
    );
  }

  public getCategoriesOfModelsTopMostElements(modelIds: Id64Array): Observable<Id64Set> {
    return this.getModelsCategoriesInfo().pipe(
      mergeMap((modelCategories) => from(modelIds).pipe(mergeMap((modelId) => modelCategories.get(modelId)?.categoriesOfTopMostElements ?? []))),
      reduce((acc, categoryId) => {
        acc.add(categoryId);
        return acc;
      }, new Set<Id64String>()),
    );
  }

  public getAllCategoriesOfElements(): Observable<Id64Set> {
    return this.getModelsCategoriesInfo().pipe(
      mergeMap((modelCategories) => modelCategories.values()),
      reduce((acc, { allCategories }) => {
        for (const categoryId of allCategories) {
          acc.add(categoryId);
        }
        return acc;
      }, new Set<CategoryId>()),
    );
  }

  public getAllModels(): Observable<Array<ModelId>> {
    return this.getModelsCategoriesInfo().pipe(map((modelCategories) => [...modelCategories.keys()]));
  }
}
