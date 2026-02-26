/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { mergeAll, mergeMap, toArray } from "rxjs";
import { Guid } from "@itwin/core-bentley";
import { ElementChildrenCache } from "./ElementChildrenCache.js";
import { ElementModelCategoriesCache } from "./ElementModelCategoriesCache.js";
import { ModelCategoryElementsCountCache } from "./ModelCategoryElementsCountCache.js";
import { ModeledElementsCache } from "./ModeledElementsCache.js";
import { SubCategoriesCache } from "./SubCategoriesCache.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Array, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { Props } from "@itwin/presentation-shared";

/** @internal */
export interface BaseIdsCacheProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  elementClassName: string;
  type: "2d" | "3d";
}

/** @internal */
export class BaseIdsCache implements Disposable {
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  readonly #categoryElementCounts: ModelCategoryElementsCountCache;
  readonly #elementChildrenCache: ElementChildrenCache;
  readonly #subCategoriesCache: SubCategoriesCache;
  readonly #modeledElementsCache: ModeledElementsCache;
  readonly #elementModelCategoriesCache: ElementModelCategoriesCache;

  constructor(props: BaseIdsCacheProps) {
    this.#queryExecutor = props.queryExecutor;
    this.#componentId = Guid.createValue();
    this.#categoryElementCounts = new ModelCategoryElementsCountCache({
      elementClassName: props.elementClassName,
      componentId: this.#componentId,
      queryExecutor: this.#queryExecutor,
    });
    this.#elementChildrenCache = new ElementChildrenCache({
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

  public [Symbol.dispose]() {
    this.#categoryElementCounts[Symbol.dispose]();
  }

  // Implement get sub-models method

  public getSubModels(
    props: { modelId: Id64String; categoryId?: Id64String } | { categoryId: Id64String; modelId: Id64String | undefined },
  ): Observable<Id64Array> {
    if (props.modelId) {
      if (props.categoryId) {
        return this.#modeledElementsCache.getCategoryModeledElements({ modelId: props.modelId, categoryId: props.categoryId }).pipe(toArray());
      }

      return this.#elementModelCategoriesCache.getModelCategoryIds({ modelId: props.modelId }).pipe(
        mergeAll(),
        mergeMap((modelCategoryId) => this.#modeledElementsCache.getCategoryModeledElements({ modelId: props.modelId!, categoryId: modelCategoryId })),
        toArray(),
      );
    }

    return this.#elementModelCategoriesCache.getCategoryElementModels({ categoryId: props.categoryId! }).pipe(
      mergeAll(),
      mergeMap((modelId) => this.#modeledElementsCache.getCategoryModeledElements({ modelId, categoryId: props.categoryId! })),
      toArray(),
    );
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

  public getModels(props: Props<ElementModelCategoriesCache["getCategoryElementModels"]>): ReturnType<ElementModelCategoriesCache["getCategoryElementModels"]> {
    return this.#elementModelCategoriesCache.getCategoryElementModels(props);
  }

  public getCategoriesOfModelsTopMostElements(
    props: Props<ElementModelCategoriesCache["getCategoriesOfModelsTopMostElements"]>,
  ): ReturnType<ElementModelCategoriesCache["getCategoriesOfModelsTopMostElements"]> {
    return this.#elementModelCategoriesCache.getCategoriesOfModelsTopMostElements(props);
  }

  // ModelCategoryElementsCountCache methods

  public getElementsCount(
    props: Props<ModelCategoryElementsCountCache["getCategoryElementsCount"]>,
  ): ReturnType<ModelCategoryElementsCountCache["getCategoryElementsCount"]> {
    return this.#categoryElementCounts.getCategoryElementsCount(props);
  }

  // ElementChildrenCache methods

  public getChildElementsTree(props: Props<ElementChildrenCache["getChildElementsTree"]>): ReturnType<ElementChildrenCache["getChildElementsTree"]> {
    return this.#elementChildrenCache.getChildElementsTree(props);
  }

  public getAllChildElementsCount(
    props: Props<ElementChildrenCache["getAllChildElementsCount"]>,
  ): ReturnType<ElementChildrenCache["getAllChildElementsCount"]> {
    return this.#elementChildrenCache.getAllChildElementsCount(props);
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
    props: Props<ModeledElementsCache["getSubModelsUnderElement"]>,
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
export class BaseIdsCacheImpl implements Disposable {
  #baseIdsCache: BaseIdsCache;
  constructor(props: BaseIdsCacheImplProps) {
    this.#baseIdsCache = props.baseIdsCache;
  }

  public [Symbol.dispose]() {}
  // Implement IBaseIdsCache by re-exporting BaseIdsCache methods

  public getChildElementsTree(props: Props<ElementChildrenCache["getChildElementsTree"]>): ReturnType<ElementChildrenCache["getChildElementsTree"]> {
    return this.#baseIdsCache.getChildElementsTree(props);
  }

  public getAllChildElementsCount(
    props: Props<ElementChildrenCache["getAllChildElementsCount"]>,
  ): ReturnType<ElementChildrenCache["getAllChildElementsCount"]> {
    return this.#baseIdsCache.getAllChildElementsCount(props);
  }

  public getSubCategories(props: Props<SubCategoriesCache["getSubCategories"]>): ReturnType<SubCategoriesCache["getSubCategories"]> {
    return this.#baseIdsCache.getSubCategories(props);
  }

  public getSubModels(
    props: { modelId: Id64String; categoryId?: Id64String } | { categoryId: Id64String; modelId: Id64String | undefined },
  ): Observable<Id64Array> {
    return this.#baseIdsCache.getSubModels(props);
  }

  public getSubModelsUnderElement(
    props: Props<ModeledElementsCache["getSubModelsUnderElement"]>,
  ): ReturnType<ModeledElementsCache["getSubModelsUnderElement"]> {
    return this.#baseIdsCache.getSubModelsUnderElement(props);
  }

  public getElementsCount(
    props: Props<ModelCategoryElementsCountCache["getCategoryElementsCount"]>,
  ): ReturnType<ModelCategoryElementsCountCache["getCategoryElementsCount"]> {
    return this.#baseIdsCache.getElementsCount(props);
  }

  public getCategories(props: Props<ElementModelCategoriesCache["getModelCategoryIds"]>): ReturnType<ElementModelCategoriesCache["getModelCategoryIds"]> {
    return this.#baseIdsCache.getCategories(props);
  }

  public getModels(props: Props<ElementModelCategoriesCache["getCategoryElementModels"]>): ReturnType<ElementModelCategoriesCache["getCategoryElementModels"]> {
    return this.#baseIdsCache.getModels(props);
  }

  public getAllCategoriesOfElements(): ReturnType<ElementModelCategoriesCache["getAllCategoriesOfElements"]> {
    return this.#baseIdsCache.getAllCategoriesOfElements();
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
