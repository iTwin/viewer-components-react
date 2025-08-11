/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { from, merge, mergeMap, of, toArray } from "rxjs";
import { BaseVisibilityStatusHelper } from "../../../common/internal/visibility/BaseVisibilityStatusHelper.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";

import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { Observable } from "rxjs";
import type { ClassificationsTreeIdsCache } from "../ClassificationsTreeIdsCache.js";
import type { Id64Arg } from "@itwin/core-bentley";
import type { BaseVisibilityStatusHelperProps } from "../../../common/internal/visibility/BaseVisibilityStatusHelper.js";

/**
 * Props for `createCategoriesTreeVisibilityHandler`.
 * @internal
 */
export type ClassificationsVisibilityStatusHelperProps = BaseVisibilityStatusHelperProps & {
  idsCache: ClassificationsTreeIdsCache;
};

export class ClassificationsVisibilityStatusHelper extends BaseVisibilityStatusHelper {
  #props: ClassificationsVisibilityStatusHelperProps;
  constructor(_props: ClassificationsVisibilityStatusHelperProps) {
    super(_props);
    this.#props = _props;
  }

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

  public changeClassificationTablesVisibilityStatus(props: { classificationTableIds: Id64Arg; on: boolean }): Observable<void> {
    return from(this.#props.idsCache.getAllContainedCategories(props.classificationTableIds)).pipe(
      mergeMap(({ drawing, spatial }) => merge(drawing, spatial)),
      toArray(),
      mergeMap((categoryIds) => this.changeCategoriesVisibilityStatus({ modelId: undefined, categoryIds, on: props.on })),
    );
  }

  public changeClassificationsVisibilityStatus(props: { classificationIds: Id64Arg; on: boolean }): Observable<void> {
    return from(this.#props.idsCache.getAllContainedCategories(props.classificationIds)).pipe(
      mergeMap(({ drawing, spatial }) => merge(drawing, spatial)),
      toArray(),
      mergeMap((categoryIds) => this.changeCategoriesVisibilityStatus({ modelId: undefined, categoryIds, on: props.on })),
    );
  }
}
