/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { from, merge, mergeMap, toArray } from "rxjs";
import { BaseVisibilityStatusModifier } from "../../../common/internal/visibility/BaseVisibilityStatusModifier.js";

import type { Observable } from "rxjs";
import type { Id64Arg } from "@itwin/core-bentley";
import type { BaseVisibilityStatusModifierProps } from "../../../common/internal/visibility/BaseVisibilityStatusModifier.js";
import type { ClassificationsTreeIdsCache } from "../ClassificationsTreeIdsCache.js";

/** @internal */
export type ClassificationsTreeVisibilityStatusModifierProps = BaseVisibilityStatusModifierProps & {
  idsCache: ClassificationsTreeIdsCache;
};

/**
 * Visibility status modifier for classifications tree.
 *
 * It extends base visibility status modifier and provides methods to change visibility status of classification tables and classifications.
 * @internal
 */
export class ClassificationsTreeVisibilityStatusModifier extends BaseVisibilityStatusModifier {
  #props: ClassificationsTreeVisibilityStatusModifierProps;
  constructor(_props: ClassificationsTreeVisibilityStatusModifierProps) {
    super(_props);
    this.#props = _props;
  }

  /**
   * Changes visibility status of classification tables.
   *
   * Does this by changing visibility status of related categories.
   */
  public changeClassificationTablesVisibilityStatus(props: { classificationTableIds: Id64Arg; on: boolean }): Observable<void> {
    return from(this.#props.idsCache.getAllContainedCategories(props.classificationTableIds)).pipe(
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
    return from(this.#props.idsCache.getAllContainedCategories(props.classificationIds)).pipe(
      mergeMap(({ drawing, spatial }) => merge(drawing, spatial)),
      toArray(),
      mergeMap((categoryIds) => this.changeCategoriesVisibilityStatus({ modelId: undefined, categoryIds, on: props.on })),
    );
  }
}
