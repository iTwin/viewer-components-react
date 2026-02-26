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

/**
 * Core methods of base ids cache.
 *
 * BaseIdsCache exposes other methods which are not part of this interface, they are needed for other caches.
 * @internal
 */
export interface IBaseIdsCache {
  getSubModelsUnderElement(props: Props<ModeledElementsCache["getSubModelsUnderElement"]>): ReturnType<ModeledElementsCache["getSubModelsUnderElement"]>;
  getElementsCount: (
    props: Props<ModelCategoryElementsCountCache["getCategoryElementsCount"]>,
  ) => ReturnType<ModelCategoryElementsCountCache["getCategoryElementsCount"]>;
  getSubCategories(props: Props<SubCategoriesCache["getSubCategories"]>): ReturnType<SubCategoriesCache["getSubCategories"]>;
  getModels: (props: Props<ElementModelCategoriesCache["getCategoryElementModels"]>) => ReturnType<ElementModelCategoriesCache["getCategoryElementModels"]>;
  getCategories: (props: Props<ElementModelCategoriesCache["getModelCategoryIds"]>) => ReturnType<ElementModelCategoriesCache["getModelCategoryIds"]>;
  getSubModels: (
    props: { modelId: Id64String; categoryId?: Id64String } | { categoryId: Id64String; modelId: Id64String | undefined },
  ) => Observable<Id64Array>;
  getAllCategoriesOfElements: () => ReturnType<ElementModelCategoriesCache["getAllCategoriesOfElements"]>;
  getChildElementsTree: (props: Props<ElementChildrenCache["getChildElementsTree"]>) => ReturnType<ElementChildrenCache["getChildElementsTree"]>;
  getAllChildElementsCount: (props: Props<ElementChildrenCache["getAllChildElementsCount"]>) => ReturnType<ElementChildrenCache["getAllChildElementsCount"]>;
}

/** @internal */
export class BaseIdsCache implements Disposable, IBaseIdsCache {
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
      type: props.type,
    });
    this.#elementChildrenCache = new ElementChildrenCache({
      queryExecutor: this.#queryExecutor,
      elementClassName: props.elementClassName,
      componentId: this.#componentId,
      type: props.type,
    });
    this.#subCategoriesCache = new SubCategoriesCache({
      queryExecutor: this.#queryExecutor,
      componentId: this.#componentId,
    });
    this.#modeledElementsCache = new ModeledElementsCache({
      queryExecutor: this.#queryExecutor,
      componentId: this.#componentId,
      elementClassName: props.elementClassName,
      type: props.type,
    });
    this.#elementModelCategoriesCache = new ElementModelCategoriesCache({
      queryExecutor: this.#queryExecutor,
      componentId: this.#componentId,
      elementClassName: props.elementClassName,
      type: props.type,
      modeledElementsCache: this.#modeledElementsCache,
    });
  }

  public [Symbol.dispose]() {
    this.#categoryElementCounts[Symbol.dispose]();
  }

  // Implement get sub-models method

  public getSubModels(props: Props<IBaseIdsCache["getSubModels"]>): ReturnType<IBaseIdsCache["getSubModels"]> {
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

  public getCategories(props: Props<IBaseIdsCache["getCategories"]>): ReturnType<IBaseIdsCache["getCategories"]> {
    return this.#elementModelCategoriesCache.getModelCategoryIds(props);
  }

  public getAllCategoriesOfElements(): ReturnType<ElementModelCategoriesCache["getAllCategoriesOfElements"]> {
    return this.#elementModelCategoriesCache.getAllCategoriesOfElements();
  }

  public getModels(props: Props<IBaseIdsCache["getModels"]>): ReturnType<IBaseIdsCache["getModels"]> {
    return this.#elementModelCategoriesCache.getCategoryElementModels(props);
  }

  public getCategoriesOfModelsTopMostElements(
    props: Props<ElementModelCategoriesCache["getCategoriesOfModelsTopMostElements"]>,
  ): ReturnType<ElementModelCategoriesCache["getCategoriesOfModelsTopMostElements"]> {
    return this.#elementModelCategoriesCache.getCategoriesOfModelsTopMostElements(props);
  }

  // ModelCategoryElementsCountCache methods

  public getElementsCount(props: Props<IBaseIdsCache["getElementsCount"]>): ReturnType<IBaseIdsCache["getElementsCount"]> {
    return this.#categoryElementCounts.getCategoryElementsCount(props);
  }

  // ElementChildrenCache methods

  public getChildElementsTree(props: Props<IBaseIdsCache["getChildElementsTree"]>): ReturnType<IBaseIdsCache["getChildElementsTree"]> {
    return this.#elementChildrenCache.getChildElementsTree(props);
  }

  public getAllChildElementsCount(props: Props<IBaseIdsCache["getAllChildElementsCount"]>): ReturnType<IBaseIdsCache["getAllChildElementsCount"]> {
    return this.#elementChildrenCache.getAllChildElementsCount(props);
  }

  // SubCategoriesCache methods

  public getSubCategories(props: Props<IBaseIdsCache["getSubCategories"]>): ReturnType<IBaseIdsCache["getSubCategories"]> {
    return this.#subCategoriesCache.getSubCategories(props);
  }

  public getSubCategoriesInfo(): ReturnType<SubCategoriesCache["getSubCategoriesInfo"]> {
    return this.#subCategoriesCache.getSubCategoriesInfo();
  }

  // ModeledElementsCache methods

  public getSubModelsUnderElement(props: Props<IBaseIdsCache["getSubModelsUnderElement"]>): ReturnType<IBaseIdsCache["getSubModelsUnderElement"]> {
    return this.#modeledElementsCache.getSubModelsUnderElement(props);
  }

  public getModeledElementsInfo(): ReturnType<ModeledElementsCache["getModeledElementsInfo"]> {
    return this.#modeledElementsCache.getModeledElementsInfo();
  }
}
