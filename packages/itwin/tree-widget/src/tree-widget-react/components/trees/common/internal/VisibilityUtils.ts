/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, EMPTY, map, mergeMap, of, reduce } from "rxjs";
import { Id64 } from "@itwin/core-bentley";
import { fromWithRelease, reduceWhile, releaseMainThreadOnItemsCount, toVoidPromise } from "./Rxjs.js";
import { createVisibilityStatus } from "./Tooltip.js";
import { getOptimalBatchSize } from "./Utils.js";

import type { Observable, OperatorFunction } from "rxjs";
import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { CategoryInfo } from "../../categories-tree/CategoriesTreeButtons.js";
import type { TreeWidgetViewport } from "../TreeWidgetViewport.js";
import type { VisibilityStatus } from "../UseHierarchyVisibility.js";
import type { NonPartialVisibilityStatus, Visibility } from "./Tooltip.js";
import type { ElementId } from "./Types.js";

function mergeVisibilities(obs: Observable<Visibility>): Observable<Visibility | "empty"> {
  return obs.pipe(
    reduceWhile(
      (x) => x.allVisible || x.allHidden,
      (acc, val) => {
        acc.allVisible &&= val === "visible";
        acc.allHidden &&= val === "hidden";
        return acc;
      },
      { allVisible: true, allHidden: true },
    ),
    map((x) => {
      if (!x) {
        return "empty";
      }
      return x.allVisible ? "visible" : x.allHidden ? "hidden" : "partial";
    }),
  );
}

/** @internal */
export function mergeVisibilityStatuses(): OperatorFunction<VisibilityStatus, VisibilityStatus> {
  return (obs: Observable<VisibilityStatus>) => {
    return obs.pipe(
      map((visibilityStatus) => visibilityStatus.state),
      mergeVisibilities,
      mergeMap((visibility) => (visibility === "empty" ? EMPTY : of(createVisibilityStatus(visibility)))),
    );
  };
}

/** @internal */
export function changeElementStateNoChildrenOperator(props: {
  on: boolean;
  viewport: TreeWidgetViewport;
}): OperatorFunction<{ elementId: ElementId; matchesDesiredState: boolean }, void> {
  return (elementIds: Observable<{ elementId: ElementId; matchesDesiredState: boolean }>) => {
    const { on } = props;
    const isAlwaysDrawnExclusive = props.viewport.isAlwaysDrawnExclusive;
    return elementIds.pipe(
      releaseMainThreadOnItemsCount(500),
      reduce<
        { elementId: ElementId; matchesDesiredState: boolean },
        { changedNeverDrawn: boolean; changedAlwaysDrawn: boolean; neverDrawn: Set<ElementId> | undefined; alwaysDrawn: Set<ElementId> | undefined }
      >(
        (acc, { elementId, matchesDesiredState }) => {
          if (acc.alwaysDrawn === undefined || acc.neverDrawn === undefined) {
            acc.alwaysDrawn = new Set(props.viewport.alwaysDrawn || []);
            acc.neverDrawn = new Set(props.viewport.neverDrawn || []);
          }
          if (on) {
            const wasRemoved = acc.neverDrawn.delete(elementId);
            acc.changedNeverDrawn ||= wasRemoved;
            // If exclusive mode is enabled, we must add the element to the always drawn list.
            if ((!matchesDesiredState || isAlwaysDrawnExclusive) && !acc.alwaysDrawn.has(elementId)) {
              acc.alwaysDrawn.add(elementId);
              acc.changedAlwaysDrawn = true;
            }
          } else {
            const wasRemoved = acc.alwaysDrawn.delete(elementId);
            acc.changedAlwaysDrawn ||= wasRemoved;
            // If exclusive mode is not enabled, we have to add the element to the never drawn list.
            if (!matchesDesiredState && !isAlwaysDrawnExclusive && !acc.neverDrawn.has(elementId)) {
              acc.neverDrawn.add(elementId);
              acc.changedNeverDrawn = true;
            }
          }
          return acc;
        },
        {
          changedNeverDrawn: false,
          changedAlwaysDrawn: false,
          neverDrawn: undefined,
          alwaysDrawn: undefined,
        },
      ),
      map((state) => {
        state.changedNeverDrawn && state.neverDrawn && props.viewport.setNeverDrawn({ elementIds: state.neverDrawn });
        state.changedAlwaysDrawn &&
          state.alwaysDrawn &&
          props.viewport.setAlwaysDrawn({ elementIds: state.alwaysDrawn, exclusive: props.viewport.isAlwaysDrawnExclusive });
      }),
    );
  };
}

/** @internal */
export function getCategoryVisibilityFromAlwaysAndNeverDrawnElementsImpl(props: {
  numberOfElementsInOppositeSet: number;
  totalCount: number;
  defaultStatus: NonPartialVisibilityStatus;
}): VisibilityStatus {
  const { numberOfElementsInOppositeSet, totalCount, defaultStatus } = props;
  if (totalCount === 0 || numberOfElementsInOppositeSet === 0) {
    return defaultStatus;
  }
  if (numberOfElementsInOppositeSet === totalCount) {
    return defaultStatus.state === "hidden" ? createVisibilityStatus("visible") : createVisibilityStatus("hidden");
  }

  return createVisibilityStatus("partial");
}

/**
 * Changes category display in the viewport.
 * @internal
 */
export async function enableCategoryDisplay(viewport: TreeWidgetViewport, categoryIds: Id64Arg, enabled: boolean, enableAllSubCategories = true) {
  const removeOverrides = (bufferedCategories: Id64Set) => {
    const modelsContainingOverrides = new Set<Id64String>();
    for (const ovr of viewport.perModelCategoryOverrides) {
      if (bufferedCategories.has(ovr.categoryId)) {
        modelsContainingOverrides.add(ovr.modelId);
      }
    }
    viewport.setPerModelCategoryOverride({ modelIds: modelsContainingOverrides, categoryIds: bufferedCategories, override: "none" });
  };
  const disableSubCategories = async (bufferedCategories: Id64Array) => {
    // changeCategoryDisplay only enables subcategories, it does not disabled them. So we must do that ourselves.
    const categoryInfo = await viewport.iModel.categories.getCategoryInfo(bufferedCategories);
    for (const info of categoryInfo.values()) {
      for (const value of info.subCategories.values()) {
        viewport.changeSubCategoryDisplay({ subCategoryId: value.id, display: false });
      }
    }
  };
  return toVoidPromise(
    fromWithRelease({ source: categoryIds, releaseOnCount: 500 }).pipe(
      bufferCount(getOptimalBatchSize({ totalSize: Id64.sizeOf(categoryIds), maximumBatchSize: 500 })),
      mergeMap(async (bufferedCategories) => {
        viewport.changeCategoryDisplay({ categoryIds: bufferedCategories, display: enabled, enableAllSubCategories });
        removeOverrides(new Set(bufferedCategories));
        if (!enabled) {
          await disableSubCategories(bufferedCategories);
        }
      }),
    ),
  );
}

/**
 * Invert display of all given categories.
 * Categories are inverted like this:
 * - If category is visible, it will be hidden.
 * - If category is hidden, it will be visible.
 * - If category is partially visible, it will be fully visible.
 * @internal
 */
export async function invertAllCategories(categories: CategoryInfo[], viewport: TreeWidgetViewport) {
  const categoriesToEnable = new Set<Id64String>();
  const categoriesToDisable = new Set<Id64String>();

  for (const category of categories) {
    if (!viewport.viewsCategory(category.categoryId)) {
      categoriesToEnable.add(category.categoryId);
      continue;
    }
    // Check if category is in partial state
    if (category.subCategoryIds?.some((subCategory) => !viewport.viewsSubCategory(subCategory))) {
      categoriesToEnable.add(category.categoryId);
    } else {
      categoriesToDisable.add(category.categoryId);
    }
  }

  // collect per model overrides that need to be inverted
  for (const { categoryId, visible } of viewport.perModelCategoryOverrides) {
    if (!visible && categoriesToDisable.has(categoryId)) {
      categoriesToEnable.add(categoryId);
      categoriesToDisable.delete(categoryId);
    }
  }

  await enableCategoryDisplay(viewport, categoriesToDisable, false, true);

  await enableCategoryDisplay(viewport, categoriesToEnable, true, true);
}
