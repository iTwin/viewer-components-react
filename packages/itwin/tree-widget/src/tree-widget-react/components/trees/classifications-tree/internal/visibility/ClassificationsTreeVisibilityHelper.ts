/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { merge, mergeMap, of, toArray } from "rxjs";
import { BaseVisibilityHelper } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";

import type { Observable } from "rxjs";
import type { Id64Arg } from "@itwin/core-bentley";
import type { BaseVisibilityHelperProps } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { ClassificationsTreeIdsCache } from "../ClassificationsTreeIdsCache.js";

/** @internal */
export type ClassificationsTreeVisibilityHelperProps = BaseVisibilityHelperProps & {
  idsCache: ClassificationsTreeIdsCache;
};

/**
 * Visibility status helper for classifications tree.
 *
 * It extends base visibility status helper and provides methods to get and change visibility status of classification tables and classifications.
 * @internal
 */
export class ClassificationsTreeVisibilityHelper extends BaseVisibilityHelper {
  #props: ClassificationsTreeVisibilityHelperProps;
  constructor(props: ClassificationsTreeVisibilityHelperProps) {
    super(props);
    this.#props = props;
  }

  /**
   * Gets visibility status of classification tables.
   *
   * Determines visibility status by checking visibility status of related categories.
   */
  public getClassificationTablesVisibilityStatus(props: { classificationTableIds: Id64Arg }): Observable<VisibilityStatus> {
    return this.#props.idsCache.getAllContainedCategories(props.classificationTableIds).pipe(
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
   * Determines visibility status by checking visibility status of related categories.
   */
  public getClassificationsVisibilityStatus(props: { classificationIds: Id64Arg }): Observable<VisibilityStatus> {
    return this.#props.idsCache.getAllContainedCategories(props.classificationIds).pipe(
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
   * Changes visibility status of classification tables.
   *
   * Does this by changing visibility status of related categories.
   */
  public changeClassificationTablesVisibilityStatus(props: { classificationTableIds: Id64Arg; on: boolean }): Observable<void> {
    return this.#props.idsCache.getAllContainedCategories(props.classificationTableIds).pipe(
      mergeMap(({ drawing, spatial }) => merge(drawing, spatial)),
      toArray(),
      mergeMap((categoryIds) => this.changeCategoriesVisibilityStatus({ modelId: undefined, categoryIds, on: props.on })),
    );
  }

  /**
   * Changes visibility status of classifications.
   *
   * Does this by changing visibility status of related categories.
   */
  public changeClassificationsVisibilityStatus(props: { classificationIds: Id64Arg; on: boolean }): Observable<void> {
    return this.#props.idsCache.getAllContainedCategories(props.classificationIds).pipe(
      mergeMap(({ drawing, spatial }) => merge(drawing, spatial)),
      toArray(),
      mergeMap((categoryIds) => this.changeCategoriesVisibilityStatus({ modelId: undefined, categoryIds, on: props.on })),
    );
  }
}
