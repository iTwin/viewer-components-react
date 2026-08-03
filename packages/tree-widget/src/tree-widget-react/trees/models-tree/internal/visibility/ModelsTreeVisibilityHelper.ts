/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defaultIfEmpty, defer, mergeMap } from "rxjs";
import { createVisibilityStatus } from "../../../../shared/internal/Tooltip.js";
import { BaseVisibilityHelper } from "../../../../shared/internal/visibility/BaseVisibilityHelper.js";
import { mergeVisibilityStatuses } from "../../../../shared/internal/VisibilityUtils.js";

import type { Observable } from "rxjs";
import type { Id64Arg } from "@itwin/core-bentley";
import type { BaseVisibilityHelperProps } from "../../../../shared/internal/visibility/BaseVisibilityHelper.js";
import type { VisibilityStatus } from "../../../../shared/UseHierarchyVisibility.js";
import type { ModelsTreeIdsCache } from "../ModelsTreeIdsCache.js";
import type { ElementClassGroupingNodeProps } from "../ModelsTreeNodeInternal.js";
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
  constructor(props: ModelsTreeVisibilityHelperProps) {
    super(props);
    this.#props = props;
  }

  /**
   * Gets visibility status of subjects.
   *
   * Determines visibility status by checking visibility status of related models.
   */
  public getSubjectsVisibilityStatus(props: { subjectIds: Id64Arg }): Observable<VisibilityStatus> {
    const result = defer(() => {
      const { subjectIds } = props;

      return this.#props.idsCache.getSubjectModelIds(subjectIds).pipe(
        mergeMap((modelIds) => this.getModelsVisibilityStatus({ modelIds })),
        mergeVisibilityStatuses(),
        defaultIfEmpty(createVisibilityStatus("disabled")),
      );
    });
    return this.#props.overrideHandler
      ? this.#props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: props,
          nonOverriddenResult: result,
          override: this.#props.overrides?.getSubjectsVisibilityStatus,
        })
      : result;
  }

  /** Gets visibility status of grouped elements */
  public getGroupedElementsVisibilityStatus(
    props: Pick<ElementClassGroupingNodeProps, "parentElementsPath" | "modelId" | "categoryId" | "childrenWhichAreParents"> & {
      elementIds: Id64Arg;
    },
  ): Observable<VisibilityStatus> {
    const { modelId, categoryId, elementIds, parentElementsPath, childrenWhichAreParents } = props;
    return this.getElementsVisibilityStatus({
      elementIds,
      modelId,
      categoryId,
      parentElementsPath,
      computeOnlyOwnStatus: this.#props.baseIdsCache.canHaveHiddenChildren()
        ? undefined
        : childrenWhichAreParents.size === 0
          ? true
          : (elementId) => !childrenWhichAreParents.has(elementId),
    });
  }

  /**
   * Changes visibility status of subjects.
   *
   * Does this by changing visibility status of related models.
   */
  public changeSubjectsVisibilityStatus(props: { subjectIds: Id64Arg; on: boolean }): Observable<void> {
    const result = defer(() => {
      const { on, subjectIds } = props;
      return this.#props.idsCache.getSubjectModelIds(subjectIds).pipe(mergeMap((modelIds) => this.changeModelsVisibilityStatus({ modelIds, on })));
    });
    return this.#props.overrideHandler
      ? this.#props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: props,
          nonOverriddenResult: result,
          override: this.#props.overrides?.changeSubjectsVisibilityStatus,
        })
      : result;
  }

  /** Changes visibility of grouped elements. */
  public changeGroupedElementsVisibilityStatus(
    props: Pick<ElementClassGroupingNodeProps, "parentElementsPath" | "modelId" | "categoryId"> & {
      elementIds: Id64Arg;
      on: boolean;
    },
  ): Observable<void> {
    const { modelId, categoryId, elementIds, on, parentElementsPath } = props;
    return this.changeElementsVisibilityStatus({ modelId, elementIds, categoryId, on, parentElementsPath });
  }
}
