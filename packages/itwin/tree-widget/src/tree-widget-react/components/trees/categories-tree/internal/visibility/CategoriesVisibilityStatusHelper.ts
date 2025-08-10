/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, EMPTY, from, map, mergeMap, reduce } from "rxjs";
import { getArrayFromId64Arg } from "../../../common/internal/Utils.js";
import { BaseVisibilityStatusHelper } from "../../../common/internal/visibility/BaseVisibilityStatusHelper.js";
import { enableCategoryDisplay, enableSubCategoryDisplay } from "../../../common/internal/VisibilityUtils.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { BaseVisibilityStatusHelperProps } from "../../../common/internal/visibility/BaseVisibilityStatusHelper.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { CategoriesTreeIdsCache } from "../CategoriesTreeIdsCache.js";

/**
 * Props for `createCategoriesTreeVisibilityHandler`.
 * @internal
 */
export type CategoriesVisibilityStatusHelperProps = BaseVisibilityStatusHelperProps & {
  idsCache: CategoriesTreeIdsCache;
};

export class CategoriesVisibilityStatusHelper extends BaseVisibilityStatusHelper {
  #props: CategoriesVisibilityStatusHelperProps;
  constructor(_props: CategoriesVisibilityStatusHelperProps) {
    super(_props);
    this.#props = _props;
  }

  public getDefinitionContainersVisibilityStatus(props: { definitionContainerIds: Id64Arg }): Observable<VisibilityStatus> {
    const definitionContainerIdsArray = getArrayFromId64Arg(props.definitionContainerIds);
    return from(this.#props.idsCache.getAllContainedCategories(definitionContainerIdsArray)).pipe(
      mergeMap((categoryIds) =>
        this.getCategoriesVisibilityStatus({ categoryIds, modelId: undefined, type: this.#props.viewport.view.is2d() ? "DrawingCategory" : "SpatialCategory" }),
      ),
    );
  }

  public changeDefinitionContainersVisibilityStatus(props: { definitionContainerIds: Id64Arg; on: boolean }): Observable<void> {
    const definitionContainerIdsArray = getArrayFromId64Arg(props.definitionContainerIds);
    return from(this.#props.idsCache.getAllContainedCategories(definitionContainerIdsArray)).pipe(
      mergeMap((categoryIds) => this.changeCategoriesVisibilityStatus({ categoryIds, modelId: undefined, on: props.on })),
    );
  }

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

  private enableCategoriesElementModelsVisibility(categoryIds: Id64Arg): Observable<void> {
    const categoryIdsArray = getArrayFromId64Arg(categoryIds);
    return from(this.#props.idsCache.getCategoriesElementModels(categoryIdsArray, true)).pipe(
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
