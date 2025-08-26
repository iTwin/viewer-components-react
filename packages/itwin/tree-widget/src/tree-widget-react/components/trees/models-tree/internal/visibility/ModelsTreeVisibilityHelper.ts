/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, from, mergeMap, of } from "rxjs";
import { createVisibilityStatus } from "../../../common/internal/Tooltip.js";
import { BaseVisibilityHelper } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { BaseVisibilityHelperProps } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { ModelsTreeIdsCache } from "../ModelsTreeIdsCache.js";
import type { ModelsTreeVisibilityHandlerOverrides } from "./ModelsTreeVisibilityHandler.js";

/** @internal */
export type ModelsTreeVisibilityHelperProps = BaseVisibilityHelperProps & {
  idsCache: ModelsTreeIdsCache;
  overrides?: ModelsTreeVisibilityHandlerOverrides;
};

/**
 * Visibility status helper for models tree.
 *
 * It extends base visibility status helper and provides methods to get and change visibility status of subjects and grouped elements.
 * @internal
 */
export class ModelsTreeVisibilityHelper extends BaseVisibilityHelper {
  #props: ModelsTreeVisibilityHelperProps;
  constructor(_props: ModelsTreeVisibilityHelperProps) {
    super(_props);
    this.#props = _props;
  }

  /**
   * Gets visibility status of subjects.
   *
   * Determines visibility status by checking visibility status of related models.
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
    return this.#props.overrideHandler
      ? this.#props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: props,
          nonOverridenResult: result,
          override: this.#props.overrides?.getSubjectsVisibilityStatus,
        })
      : result;
  }

  /** Gets visiblity status of grouped elements */
  public getGroupedElementsVisibilityStatus(props: { modelId: Id64String; categoryId: Id64String; elementIds: Id64Arg }): Observable<VisibilityStatus> {
    const { modelId, categoryId, elementIds } = props;
    return this.getElementsVisibilityStatus({ elementIds, modelId, categoryId, type: "GeometricElement3d" });
  }

  /**
   * Changes visibility status of subjects.
   *
   * Does this by changing visibility status of related models.
   */
  public changeSubjectsVisibilityStatus(props: { subjectIds: Id64Arg; on: boolean }): Observable<void> {
    const result = defer(() => {
      const { on, subjectIds } = props;
      return from(this.#props.idsCache.getSubjectModelIds(subjectIds)).pipe(mergeMap((modelIds) => this.changeModelsVisibilityStatus({ modelIds, on })));
    });
    return this.#props.overrideHandler
      ? this.#props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: props,
          nonOverridenResult: result,
          override: this.#props.overrides?.changeSubjectsVisibilityStatus,
        })
      : result;
  }

  /** Changes visibility of grouped elements. */
  public changeGroupedElementsVisibilityStatus(props: { modelId: Id64String; categoryId: Id64String; elementIds: Id64Arg; on: boolean }): Observable<void> {
    const { modelId, categoryId, elementIds, on } = props;
    return this.changeElementsVisibilityStatus({ modelId, elementIds, categoryId, on });
  }
}
