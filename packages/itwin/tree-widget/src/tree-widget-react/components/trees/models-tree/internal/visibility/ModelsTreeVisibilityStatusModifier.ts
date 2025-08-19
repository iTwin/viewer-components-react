/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, from, mergeMap } from "rxjs";
import { BaseVisibilityStatusModifier } from "../../../common/internal/visibility/BaseVisibilityStatusModifier.js";
import { createVisibilityHandlerResult } from "../../../common/UseHierarchyVisibility.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { BaseVisibilityStatusModifierProps } from "../../../common/internal/visibility/BaseVisibilityStatusModifier.js";
import type { ModelsTreeIdsCache } from "../ModelsTreeIdsCache.js";
import type { ModelsTreeVisibilityHandlerOverrides } from "./ModelsTreeVisibilityHandler.js";

/** @internal */
export type ModelsTreeVisibilityStatusModifierProps = BaseVisibilityStatusModifierProps & {
  idsCache: ModelsTreeIdsCache;
  overrides?: ModelsTreeVisibilityHandlerOverrides;
};

/**
 * Visibility status modifier for models tree.
 *
 * It extends base visibility status modifier and provides methods to change visibility status of subjects and grouped elements.
 * @internal
 */
export class ModelsTreeVisibilityStatusModifier extends BaseVisibilityStatusModifier {
  #props: ModelsTreeVisibilityStatusModifierProps;
  constructor(_props: ModelsTreeVisibilityStatusModifierProps) {
    super(_props);
    this.#props = _props;
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
    return createVisibilityHandlerResult(this.#props.visibilityHandler, props, result, this.#props.overrides?.changeSubjectsVisibilityStatus);
  }

  /** Changes visibility of grouped elements. */
  public changeGroupedElementsVisibilityStatus(props: { modelId: Id64String; categoryId: Id64String; elementIds: Id64Arg; on: boolean }): Observable<void> {
    const { modelId, categoryId, elementIds, on } = props;
    return this.changeElementsVisibilityStatus({ modelId, elementIds, categoryId, on });
  }
}
