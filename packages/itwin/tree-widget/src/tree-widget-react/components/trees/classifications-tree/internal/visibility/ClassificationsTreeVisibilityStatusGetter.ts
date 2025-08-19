/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { from, merge, mergeMap, of } from "rxjs";
import { BaseVisibilityStatusGetter } from "../../../common/internal/visibility/BaseVisibilityStatusGetter.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";

import type { Observable } from "rxjs";
import type { Id64Arg } from "@itwin/core-bentley";
import type { BaseVisibilityStatusGetterProps } from "../../../common/internal/visibility/BaseVisibilityStatusGetter.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { ClassificationsTreeIdsCache } from "../ClassificationsTreeIdsCache.js";

/** @internal */
export type ClassificationsTreeVisibilityStatusGetterProps = BaseVisibilityStatusGetterProps & {
  idsCache: ClassificationsTreeIdsCache;
};

/**
 * Visibility status getter for classifications tree.
 *
 * It extends base visibility status getter and provides methods to get visibility status of classification tables and classifications.
 * @internal
 */
export class ClassificationsTreeVisibilityStatusGetter extends BaseVisibilityStatusGetter {
  #props: ClassificationsTreeVisibilityStatusGetterProps;
  constructor(_props: ClassificationsTreeVisibilityStatusGetterProps) {
    super(_props);
    this.#props = _props;
  }

  /**
   * Gets visibility status of classification tables.
   *
   * Determines visibility status by checking visibility statuses of related categories.
   */
  public getClassificationTablesVisibilityStatus(props: { classificationTableIds: Id64Arg }): Observable<VisibilityStatus> {
    return from(this.#props.idsCache.getAllContainedCategories(props.classificationTableIds)).pipe(
      mergeMap(({ drawing, spatial }) =>
        merge(
          of(drawing).pipe(mergeMap((categoryIds) => this.getCategoriesVisibilityStatus({ modelId: undefined, categoryIds, type: "DrawingCategory" }))),
          of(spatial).pipe(mergeMap((categoryIds) => this.getCategoriesVisibilityStatus({ modelId: undefined, categoryIds, type: "SpatialCategory" }))),
        ),
      ),
      mergeVisibilityStatuses,
    );
  }

  /**
   * Gets visibility status of classifications.
   *
   * Determines visibility status by checking visibility statuses of related categories.
   */
  public getClassificationsVisibilityStatus(props: { classificationIds: Id64Arg }): Observable<VisibilityStatus> {
    return from(this.#props.idsCache.getAllContainedCategories(props.classificationIds)).pipe(
      mergeMap(({ drawing, spatial }) =>
        merge(
          of(drawing).pipe(mergeMap((categoryIds) => this.getCategoriesVisibilityStatus({ modelId: undefined, categoryIds, type: "DrawingCategory" }))),
          of(spatial).pipe(mergeMap((categoryIds) => this.getCategoriesVisibilityStatus({ modelId: undefined, categoryIds, type: "SpatialCategory" }))),
        ),
      ),
      mergeVisibilityStatuses,
    );
  }
}
