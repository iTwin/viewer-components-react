/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { from, mergeMap } from "rxjs";
import { BaseVisibilityStatusGetter } from "../../../common/internal/visibility/BaseVisibilityStatusGetter.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { ElementId, ModelId } from "../../../common/internal/Types.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { BaseVisibilityStatusGetterProps } from "../../../common/internal/visibility/BaseVisibilityStatusGetter.js";
import type { CategoriesTreeIdsCache } from "../CategoriesTreeIdsCache.js";

/** @internal */
export type CategoriesTreeVisibilityStatusGetterProps = BaseVisibilityStatusGetterProps & {
  idsCache: CategoriesTreeIdsCache;
};

/**
 * Visibility status getter for categories tree.
 *
 * It extends base visibility status getter and provides methods to get visibility status of definition containers and grouped elements.
 * @internal
 */
export class CategoriesTreeVisibilityStatusGetter extends BaseVisibilityStatusGetter {
  #props: CategoriesTreeVisibilityStatusGetterProps;
  constructor(_props: CategoriesTreeVisibilityStatusGetterProps) {
    super(_props);
    this.#props = _props;
  }

  /**
   * Gets visibility status of definition containers.
   *
   * Determines visibility status by checking visibility statuses of related categories .
   */
  public getDefinitionContainersVisibilityStatus(props: { definitionContainerIds: Id64Arg }): Observable<VisibilityStatus> {
    return from(this.#props.idsCache.getAllContainedCategories(props.definitionContainerIds)).pipe(
      mergeMap((categoryIds) =>
        this.getCategoriesVisibilityStatus({
          categoryIds,
          modelId: undefined,
          type: this.#props.viewport.view.is2d() ? "DrawingCategory" : "SpatialCategory",
        }),
      ),
    );
  }

  /** Gets grouped elements visibility status. */
  public getGroupedElementsVisibilityStatus(props: { modelElementsMap: Map<ModelId, Set<ElementId>>; categoryId: Id64String }): Observable<VisibilityStatus> {
    const { modelElementsMap, categoryId } = props;
    return from(modelElementsMap).pipe(
      mergeMap(([modelId, elementIds]) =>
        this.getElementsVisibilityStatus({
          elementIds,
          modelId,
          categoryId,
          type: this.#props.viewport.view.is2d() ? "GeometricElement2d" : "GeometricElement3d",
        }),
      ),
      mergeVisibilityStatuses,
    );
  }
}
