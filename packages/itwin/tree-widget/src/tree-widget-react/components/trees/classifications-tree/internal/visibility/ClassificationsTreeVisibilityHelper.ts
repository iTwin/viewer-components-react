/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { mergeMap } from "rxjs";
import { createVisibilityStatus } from "../../../common/internal/Tooltip.js";
import { BaseVisibilityHelper } from "../../../common/internal/visibility/BaseVisibilityHelper.js";

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
      mergeMap((categories) =>
        this.getCategoriesVisibilityStatus({
          modelId: undefined,
          categoryIds: categories,
          returnOnEmpty: createVisibilityStatus("disabled"),
        }),
      ),
    );
  }

  /**
   * Gets visibility status of classifications.
   *
   * Determines visibility status by checking visibility status of related categories.
   */
  public getClassificationsVisibilityStatus(props: { classificationIds: Id64Arg }): Observable<VisibilityStatus> {
    return this.#props.idsCache.getAllContainedCategories(props.classificationIds).pipe(
      mergeMap((categories) =>
        this.getCategoriesVisibilityStatus({
          modelId: undefined,
          categoryIds: categories,
          returnOnEmpty: createVisibilityStatus("disabled"),
        }),
      ),
    );
  }

  /**
   * Changes visibility status of classification tables.
   *
   * Does this by changing visibility status of related categories.
   */
  public changeClassificationTablesVisibilityStatus(props: { classificationTableIds: Id64Arg; on: boolean }): Observable<void> {
    return this.#props.idsCache.getAllContainedCategories(props.classificationTableIds).pipe(
      mergeMap((categories) =>
        this.changeCategoriesVisibilityStatus({
          modelId: undefined,
          categoryIds: categories,
          on: props.on,
        }),
      ),
    );
  }

  /**
   * Changes visibility status of classifications.
   *
   * Does this by changing visibility status of related categories.
   */
  public changeClassificationsVisibilityStatus(props: { classificationIds: Id64Arg; on: boolean }): Observable<void> {
    return this.#props.idsCache.getAllContainedCategories(props.classificationIds).pipe(
      mergeMap((categories) =>
        this.changeCategoriesVisibilityStatus({
          modelId: undefined,
          categoryIds: categories,
          on: props.on,
        }),
      ),
    );
  }
}
