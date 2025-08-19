/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, EMPTY, from, map, mergeMap, reduce } from "rxjs";
import { BaseVisibilityStatusModifier } from "../../../common/internal/visibility/BaseVisibilityStatusModifier.js";
import { enableCategoryDisplay, enableSubCategoryDisplay } from "../../../common/internal/VisibilityUtils.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { ElementId, ModelId } from "../../../common/internal/Types.js";
import type { BaseVisibilityStatusModifierProps } from "../../../common/internal/visibility/BaseVisibilityStatusModifier.js";
import type { CategoriesTreeIdsCache } from "../CategoriesTreeIdsCache.js";

/** @internal */
export type CategoriesTreeVisibilityStatusModifierProps = BaseVisibilityStatusModifierProps & {
  idsCache: CategoriesTreeIdsCache;
};

/**
 * Visibility status modifier for categories tree.
 *
 * It extends base visibility status modifier and provides methods to change visibility status of definition containers, sub-categories and grouped elements.
 * @internal
 */
export class CategoriesTreeVisibilityStatusModifier extends BaseVisibilityStatusModifier {
  #props: CategoriesTreeVisibilityStatusModifierProps;
  constructor(_props: CategoriesTreeVisibilityStatusModifierProps) {
    super(_props);
    this.#props = _props;
  }

  /**
   * Changes visibility status of definition containers.
   *
   * Does this by changing visibility status of related categories.
   */
  public changeDefinitionContainersVisibilityStatus(props: { definitionContainerIds: Id64Arg; on: boolean }): Observable<void> {
    return from(this.#props.idsCache.getAllContainedCategories(props.definitionContainerIds)).pipe(
      mergeMap((categoryIds) => this.changeCategoriesVisibilityStatus({ categoryIds, modelId: undefined, on: props.on })),
    );
  }

  /**
   * Changes visibility status of sub-categories.
   *
   * Also, enables parent categories if `on` is true.
   */
  public changeSubCategoriesVisibilityStatus(props: { categoryId: Id64String; subCategoryIds: Id64Arg; on: boolean }): Observable<void> {
    return concat(
      // make sure parent category and models are enabled
      props.on
        ? concat(
            from(enableCategoryDisplay(this.#props.viewport, props.categoryId, props.on, false)),
            this.enableCategoriesElementModelsVisibility(props.categoryId),
          )
        : EMPTY,
      from(props.subCategoryIds).pipe(map((subCategoryId) => enableSubCategoryDisplay(this.#props.viewport, subCategoryId, props.on))),
    );
  }

  /** Changes grouped elements visibility status. */
  public changeGroupedElementsVisibilityStatus(props: {
    modelElementsMap: Map<ModelId, Set<ElementId>>;
    categoryId: Id64String;
    on: boolean;
  }): Observable<void> {
    return from(props.modelElementsMap).pipe(
      mergeMap(([modelId, elementIds]) => {
        return this.changeElementsVisibilityStatus({ modelId, elementIds, categoryId: props.categoryId, on: props.on });
      }),
    );
  }

  /** Turns on visiblity status of models (that are not yet turned on) that are related to categories. */
  private enableCategoriesElementModelsVisibility(categoryIds: Id64Arg): Observable<void> {
    return from(this.#props.idsCache.getCategoriesElementModels(categoryIds, true)).pipe(
      mergeMap((categoriesModelsMap) => categoriesModelsMap.values()),
      reduce((acc, modelIds) => {
        modelIds.forEach((modelId) => {
          if (!this.#props.viewport.view.viewsModel(modelId)) {
            acc.add(modelId);
          }
        });
        return acc;
      }, new Set<Id64String>()),
      map((hiddenModels) => {
        if (hiddenModels.size > 0) {
          this.#props.viewport.changeModelDisplay(hiddenModels, true);
        }
      }),
    );
  }
}
