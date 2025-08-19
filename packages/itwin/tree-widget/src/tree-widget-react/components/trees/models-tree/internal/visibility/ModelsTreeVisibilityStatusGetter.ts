/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, from, mergeMap, of } from "rxjs";
import { createVisibilityStatus } from "../../../common/internal/Tooltip.js";
import { BaseVisibilityStatusGetter } from "../../../common/internal/visibility/BaseVisibilityStatusGetter.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";
import { createVisibilityHandlerResult } from "../../../common/UseHierarchyVisibility.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { BaseVisibilityStatusGetterProps } from "../../../common/internal/visibility/BaseVisibilityStatusGetter.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { ModelsTreeIdsCache } from "../ModelsTreeIdsCache.js";
import type { ModelsTreeVisibilityHandlerOverrides } from "./ModelsTreeVisibilityHandler.js";

/** @internal */
export type ModelsTreeVisibilityStatusGetterProps = BaseVisibilityStatusGetterProps & {
  idsCache: ModelsTreeIdsCache;
  overrides?: ModelsTreeVisibilityHandlerOverrides;
};

/**
 * Visibility status getter for models tree.
 *
 * It extends base visibility status getter and provides methods to get visibility status of subjects and grouped elements.
 * @internal
 */
export class ModelsTreeVisibilityStatusGetter extends BaseVisibilityStatusGetter {
  #props: ModelsTreeVisibilityStatusGetterProps;
  constructor(_props: ModelsTreeVisibilityStatusGetterProps) {
    super(_props);
    this.#props = _props;
  }

  /**
   * Gets visibility status of subjects.
   *
   * Determines visibility status by checking visibility statuses of related models.
   */
  public getSubjectsVisibilityStatus(props: { subjectIds: Id64Arg }): Observable<VisibilityStatus> {
    const result = defer(() => {
      const { subjectIds } = props;
      if (!this.#props.viewport.view.isSpatialView()) {
        return of(createVisibilityStatus("disabled"));
      }

      return from(this.#props.idsCache.getSubjectModelIds(subjectIds)).pipe(
        mergeMap((modelIds) => this.getModelsVisibilityStatus({ modelIds, type: "GeometricModel3d" })),
        mergeVisibilityStatuses,
      );
    });
    return createVisibilityHandlerResult(this.#props.visibilityHandler, props, result, this.#props.overrides?.getSubjectsVisibilityStatus);
  }

  /** Gets visiblity status of grouped elements */
  public getGroupedElementsVisibilityStatus(props: { modelId: Id64String; categoryId: Id64String; elementIds: Id64Arg }): Observable<VisibilityStatus> {
    const { modelId, categoryId, elementIds } = props;
    return this.getElementsVisibilityStatus({ elementIds, modelId, categoryId, type: "GeometricElement3d" });
  }
}
