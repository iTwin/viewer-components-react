/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defaultIfEmpty, defer, forkJoin, from, map, mergeMap, of, reduce } from "rxjs";
import { Id64 } from "@itwin/core-bentley";
import { HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { createVisibilityStatus } from "../../../common/internal/Tooltip.js";
import { getParentElementsIdsPath } from "../../../common/internal/Utils.js";
import { BaseVisibilityHelper } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { CategoryId, ElementId } from "../../../common/internal/Types.js";
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
  public getGroupedElementsVisibilityStatus(props: {
    modelId: Id64String;
    categoryId: Id64String;
    elementIds: Id64Arg;
    parentKeys: HierarchyNodeKey[];
    categoryOfTopMostParentElement: CategoryId;
    topMostParentElementId?: ElementId;
  }): Observable<VisibilityStatus> {
    const { modelId, categoryId, elementIds, parentKeys, categoryOfTopMostParentElement, topMostParentElementId } = props;
    const parentElementsIdsPath = topMostParentElementId
      ? getParentElementsIdsPath({
          parentInstanceKeys: parentKeys.filter((key) => HierarchyNodeKey.isInstances(key)).map((key) => key.instanceKeys),
          topMostParentElementId,
        })
      : [];
    return this.getElementsVisibilityStatus({
      elementIds,
      modelId,
      categoryId,
      parentElementsIdsPath,
      categoryOfTopMostParentElement,
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
  public changeGroupedElementsVisibilityStatus(props: { modelId: Id64String; categoryId: Id64String; elementIds: Id64Arg; on: boolean }): Observable<void> {
    const { modelId, categoryId, elementIds, on } = props;
    return from(Id64.iterable(elementIds)).pipe(
      mergeMap((elementId) =>
        forkJoin({
          elementId: of(elementId),
          childCategoryIds: this.#props.idsCache
            .getDescendantsCounts({ parentElementId: elementId, modelId })
            .pipe(map((counts) => counts.map((entry) => entry.categoryId))),
        }),
      ),
      mergeMap(({ elementId, childCategoryIds }) => this.#props.idsCache.getChildElements({ parentElementId: elementId, modelId, childCategoryIds })),
      reduce((acc, childElements) => {
        acc.push(...childElements);
        return acc;
      }, new Array<ElementId>()),
      mergeMap((children) => this.changeElementsVisibilityStatus({ modelId, elementIds, categoryId, on, children })),
    );
  }
}
