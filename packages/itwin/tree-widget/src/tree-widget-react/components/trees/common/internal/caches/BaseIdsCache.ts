/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { EMPTY, filter, forkJoin, map, mergeAll, mergeMap, of } from "rxjs";
import { assert, Guid } from "@itwin/core-bentley";
import { ChildElementsCache } from "./ChildElementsCache.js";
import { DescendantsCountCache } from "./DescendantsCountCache.js";
import { ElementModelCategoriesCache } from "./ElementModelCategoriesCache.js";
import { ModeledElementsCache } from "./ModeledElementsCache.js";
import { SubCategoriesCache } from "./SubCategoriesCache.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Set, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { Props } from "@itwin/presentation-shared";

/** @internal */
export interface BaseIdsCacheProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  elementClassName: string;
  type: "2d" | "3d";
}

/** @internal */
export class BaseIdsCache {
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  readonly #descendantsCountCache: DescendantsCountCache;
  readonly #childElementsCache: ChildElementsCache;
  readonly #subCategoriesCache: SubCategoriesCache;
  readonly #modeledElementsCache: ModeledElementsCache;
  readonly #elementModelCategoriesCache: ElementModelCategoriesCache;

  constructor(props: BaseIdsCacheProps) {
    this.#queryExecutor = props.queryExecutor;
    this.#componentId = Guid.createValue();
    this.#descendantsCountCache = new DescendantsCountCache({
      elementClassName: props.elementClassName,
      componentId: this.#componentId,
      queryExecutor: this.#queryExecutor,
    });
    this.#childElementsCache = new ChildElementsCache({
      queryExecutor: this.#queryExecutor,
      elementClassName: props.elementClassName,
      componentId: this.#componentId,
    });
    this.#subCategoriesCache = new SubCategoriesCache({
      queryExecutor: this.#queryExecutor,
      componentId: this.#componentId,
    });
    this.#modeledElementsCache = new ModeledElementsCache({
      queryExecutor: this.#queryExecutor,
      componentId: this.#componentId,
      elementClassName: props.elementClassName,
    });
    this.#elementModelCategoriesCache = new ElementModelCategoriesCache({
      queryExecutor: this.#queryExecutor,
      componentId: this.#componentId,
      elementClassName: props.elementClassName,
      modeledElementsCache: this.#modeledElementsCache,
    });
  }

  // Implement get sub-models method
  public getSubModels(
    props: { modelId: Id64String; categoryId?: undefined } | { categoryId: Id64String; modelId?: undefined } | { categoryId: Id64String; modelId: Id64String },
  ): Observable<Id64String> {
    const { modelId, categoryId } = props;
    if (modelId) {
      if (categoryId) {
        return this.#modeledElementsCache.getCategoryModeledElements({
          modelId,
          categoryId,
        });
      }
      return this.#modeledElementsCache.hasModeledElements({ modelId }).pipe(
        mergeMap((hasModeledElements) => {
          if (!hasModeledElements) {
            return of([]);
          }
          return this.#elementModelCategoriesCache.getModelCategoryIds({ modelId, includeOnlyIfCategoryOfTopMostElement: true });
        }),
        mergeAll(),
        mergeMap((modelCategoryId) => this.#modeledElementsCache.getCategoryModeledElements({ modelId, categoryId: modelCategoryId })),
      );
    }
    assert(categoryId !== undefined, "Either modelId or categoryId must be provided");

    return this.#elementModelCategoriesCache.getCategoryElementModels({ categoryId }).pipe(
      filter(({ isSubModel, categoryIsOfTopMostElement }) => !isSubModel && categoryIsOfTopMostElement),
      mergeMap(({ id }) => forkJoin({ hasModeledElements: this.#modeledElementsCache.hasModeledElements({ modelId: id }), categoryModelId: of(id) })),
      mergeMap(({ categoryModelId, hasModeledElements }) => {
        if (!hasModeledElements) {
          return EMPTY;
        }
        return this.#modeledElementsCache.getCategoryModeledElements({ modelId: categoryModelId, categoryId });
      }),
    );
  }

  public getAllSubModels(): Observable<Id64Set> {
    return this.#modeledElementsCache.getModeledElementsInfo().pipe(map(({ allSubModels }) => allSubModels));
  }

  public hasSubModels({ modelId }: { modelId: Id64String }): Observable<boolean> {
    return this.#modeledElementsCache.hasModeledElements({ modelId });
  }

  // Re-export cache methods

  // ElementModelCategoriesCache methods

  public getAllModels(): ReturnType<ElementModelCategoriesCache["getAllModels"]> {
    return this.#elementModelCategoriesCache.getAllModels();
  }

  public getCategories(props: Props<ElementModelCategoriesCache["getModelCategoryIds"]>): ReturnType<ElementModelCategoriesCache["getModelCategoryIds"]> {
    return this.#elementModelCategoriesCache.getModelCategoryIds(props);
  }

  public getAllCategoriesOfElements(): ReturnType<ElementModelCategoriesCache["getAllCategoriesOfElements"]> {
    return this.#elementModelCategoriesCache.getAllCategoriesOfElements();
  }

  public getAllTopMostElementCategories(): ReturnType<ElementModelCategoriesCache["getAllTopMostElementCategories"]> {
    return this.#elementModelCategoriesCache.getAllTopMostElementCategories();
  }

  public getModels(props: Props<ElementModelCategoriesCache["getCategoryElementModels"]>): ReturnType<ElementModelCategoriesCache["getCategoryElementModels"]> {
    return this.#elementModelCategoriesCache.getCategoryElementModels(props);
  }

  public getCategoriesOfModelsTopMostElements(
    props: Props<ElementModelCategoriesCache["getCategoriesOfModelsTopMostElements"]>,
  ): ReturnType<ElementModelCategoriesCache["getCategoriesOfModelsTopMostElements"]> {
    return this.#elementModelCategoriesCache.getCategoriesOfModelsTopMostElements(props);
  }

  public categoryHasParentElements(
    props: Parameters<ElementModelCategoriesCache["categoryHasParentElements"]>[0],
  ): ReturnType<ElementModelCategoriesCache["categoryHasParentElements"]> {
    return this.#elementModelCategoriesCache.categoryHasParentElements(props);
  }

  // DescendantsCountCache methods

  public getDescendantsCounts(props: Props<DescendantsCountCache["getDescendantsCounts"]>): ReturnType<DescendantsCountCache["getDescendantsCounts"]> {
    return this.#descendantsCountCache.getDescendantsCounts(props);
  }

  public getElementsCount(props: Props<DescendantsCountCache["getDescendantsCounts"]>): Observable<number> {
    return this.#descendantsCountCache.getDescendantsCounts(props).pipe(map((counts) => counts.reduce((sum, entry) => sum + entry.count, 0)));
  }

  // ChildElementsCache methods

  public getChildElements(props: Props<ChildElementsCache["getChildElements"]>): ReturnType<ChildElementsCache["getChildElements"]> {
    return this.#childElementsCache.getChildElements(props);
  }

  // SubCategoriesCache methods

  public getSubCategories(props: Props<SubCategoriesCache["getSubCategories"]>): ReturnType<SubCategoriesCache["getSubCategories"]> {
    return this.#subCategoriesCache.getSubCategories(props);
  }

  public getSubCategoriesInfo(): ReturnType<SubCategoriesCache["getSubCategoriesInfo"]> {
    return this.#subCategoriesCache.getSubCategoriesInfo();
  }

  // ModeledElementsCache methods

  public getSubModelsUnderElement(
    props: Parameters<ModeledElementsCache["getSubModelsUnderElement"]>[0],
  ): ReturnType<ModeledElementsCache["getSubModelsUnderElement"]> {
    return this.#modeledElementsCache.getSubModelsUnderElement(props);
  }

  public getModeledElementsInfo(): ReturnType<ModeledElementsCache["getModeledElementsInfo"]> {
    return this.#modeledElementsCache.getModeledElementsInfo();
  }
}

/** @internal */
export interface BaseIdsCacheImplProps {
  baseIdsCache: BaseIdsCache;
}

/** @internal */
export class BaseIdsCacheImpl {
  #baseIdsCache: BaseIdsCache;
  constructor(props: BaseIdsCacheImplProps) {
    this.#baseIdsCache = props.baseIdsCache;
  }

  // Implement IBaseIdsCache by re-exporting BaseIdsCache methods

  public getChildElements(props: Props<ChildElementsCache["getChildElements"]>): ReturnType<ChildElementsCache["getChildElements"]> {
    return this.#baseIdsCache.getChildElements(props);
  }

  public getSubCategories(props: Props<SubCategoriesCache["getSubCategories"]>): ReturnType<SubCategoriesCache["getSubCategories"]> {
    return this.#baseIdsCache.getSubCategories(props);
  }

  public getSubModels(
    props: { modelId: Id64String; categoryId: Id64String } | { modelId: Id64String; categoryId?: undefined } | { categoryId: Id64String; modelId?: undefined },
  ): Observable<Id64String> {
    return this.#baseIdsCache.getSubModels(props);
  }

  public getAllSubModels(): Observable<Id64Set> {
    return this.#baseIdsCache.getAllSubModels();
  }

  public hasSubModels({ modelId }: { modelId: Id64String }): Observable<boolean> {
    return this.#baseIdsCache.hasSubModels({ modelId });
  }

  public getSubModelsUnderElement(
    props: Parameters<ModeledElementsCache["getSubModelsUnderElement"]>[0],
  ): ReturnType<ModeledElementsCache["getSubModelsUnderElement"]> {
    return this.#baseIdsCache.getSubModelsUnderElement(props);
  }

  public getDescendantsCounts(props: Props<DescendantsCountCache["getDescendantsCounts"]>): ReturnType<DescendantsCountCache["getDescendantsCounts"]> {
    return this.#baseIdsCache.getDescendantsCounts(props);
  }

  public getElementsCount(props: Props<DescendantsCountCache["getDescendantsCounts"]>): Observable<number> {
    return this.#baseIdsCache.getElementsCount(props);
  }

  public getCategories(props: Props<ElementModelCategoriesCache["getModelCategoryIds"]>): ReturnType<ElementModelCategoriesCache["getModelCategoryIds"]> {
    return this.#baseIdsCache.getCategories(props);
  }

  public getModels(props: Props<ElementModelCategoriesCache["getCategoryElementModels"]>): ReturnType<ElementModelCategoriesCache["getCategoryElementModels"]> {
    return this.#baseIdsCache.getModels(props);
  }

  public categoryHasParentElements(
    props: Parameters<ElementModelCategoriesCache["categoryHasParentElements"]>[0],
  ): ReturnType<ElementModelCategoriesCache["categoryHasParentElements"]> {
    return this.#baseIdsCache.categoryHasParentElements(props);
  }

  public getAllCategoriesOfElements(): ReturnType<ElementModelCategoriesCache["getAllCategoriesOfElements"]> {
    return this.#baseIdsCache.getAllCategoriesOfElements();
  }

  public getAllTopMostElementCategories(): ReturnType<ElementModelCategoriesCache["getAllTopMostElementCategories"]> {
    return this.#baseIdsCache.getAllTopMostElementCategories();
  }

  public getCategoriesOfModelsTopMostElements(
    props: Props<BaseIdsCache["getCategoriesOfModelsTopMostElements"]>,
  ): ReturnType<BaseIdsCache["getCategoriesOfModelsTopMostElements"]> {
    return this.#baseIdsCache.getCategoriesOfModelsTopMostElements(props);
  }
  public getSubCategoriesInfo(): ReturnType<SubCategoriesCache["getSubCategoriesInfo"]> {
    return this.#baseIdsCache.getSubCategoriesInfo();
  }
}
