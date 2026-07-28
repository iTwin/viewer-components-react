/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, defer, EMPTY, from, map, merge, mergeMap, of, reduce, takeLast, takeUntil, tap } from "rxjs";
import { BufferingViewport } from "./BufferingViewport.js";
import { fromWithRelease, reduceWhile, releaseMainThreadOnItemsCount, toVoidPromise } from "./Rxjs.js";
import { createVisibilityStatus } from "./Tooltip.js";
import { getOptimalBatchSize } from "./Utils.js";

import type { Observable, OperatorFunction } from "rxjs";
import type { Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { TreeWidgetViewport } from "../TreeWidgetViewport.js";
import type { VisibilityStatus } from "../UseHierarchyVisibility.js";
import type { NonPartialVisibilityStatus, Visibility } from "./Tooltip.js";
import type { CategoryId, ElementId, SubCategoryId } from "./Types.js";

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

/** @internal */
export type CategoryInfosMap = Map<CategoryId, Array<SubCategoryId> | undefined>;

/**
 * Runs a buffered viewport change and commits it only if it runs to completion.
 *
 * If `cancel` emits before the change completes, the change is aborted and all buffered modifications are discarded,
 * leaving the viewport untouched.
 */
async function commitViewportChange({
  viewport,
  cancel,
  change,
}: {
  viewport: TreeWidgetViewport;
  cancel: Observable<void>;
  change: (bufferingViewport: BufferingViewport) => Observable<void>;
}): Promise<void> {
  const bufferingViewport = new BufferingViewport(viewport);
  return toVoidPromise(
    defer(() => change(bufferingViewport)).pipe(
      tap({
        // Apply all changes that were made at once.
        // This only fires on natural completion: `takeUntil` below does not trigger `complete`.
        complete: () => bufferingViewport.commit(),
      }),
      // abort if all ongoing changes are cancelled
      takeUntil(cancel),
      tap({
        finalize: () => {
          // Discard any changes that were made. If commit was called, then this will have no effect
          bufferingViewport.discard();
        },
      }),
    ),
  );
}

/**
 * Turns display of given categories and their sub-categories on or off, clearing any per-model category overrides.
 *
 * Categories are processed in batches, releasing the main thread in between, so the returned observable may emit over multiple frames.
 * @internal
 */
export function modifyCategoryDisplay({
  categoryInfos,
  viewport,
  display,
}: {
  viewport: TreeWidgetViewport;
  categoryInfos: CategoryInfosMap;
  display: boolean;
}): Observable<void> {
  return defer(() => {
    const removeOverrides = (bufferedCategories: Id64Set) => {
      const modelsContainingOverrides = new Set<Id64String>();
      for (const ovr of viewport.perModelCategoryOverrides) {
        if (bufferedCategories.has(ovr.categoryId)) {
          modelsContainingOverrides.add(ovr.modelId);
        }
      }
      viewport.setPerModelCategoryOverride({ modelIds: modelsContainingOverrides, categoryIds: bufferedCategories, override: "none" });
    };
    return fromWithRelease({ source: categoryInfos.keys(), releaseOnCount: 500, size: categoryInfos.size }).pipe(
      bufferCount(getOptimalBatchSize({ totalSize: categoryInfos.size, maximumBatchSize: 500 })),
      map((bufferedCategories) => {
        viewport.changeCategoryDisplay({ categoryIds: bufferedCategories, display, enableAllSubCategories: false });
        // Category is already turned off, no need to modify sub-categories
        removeOverrides(new Set(bufferedCategories));
        if (!display) {
          return;
        }
        for (const categoryId of bufferedCategories) {
          const subCategoryIds = categoryInfos.get(categoryId);
          for (const subCategoryId of subCategoryIds ?? []) {
            viewport.changeSubCategoryDisplay({ subCategoryId, display });
          }
        }
      }),
      takeLast(1),
    );
  });
}

/**
 * Makes everything visible: displays all given models, categories and sub-categories, and clears the always/never drawn element lists.
 * @internal
 */
export async function showAll({
  viewport,
  modelIds,
  categoryInfos,
  cancel,
}: {
  viewport: TreeWidgetViewport;
  modelIds: Id64Array;
  categoryInfos: CategoryInfosMap;
  cancel: Observable<void>;
}) {
  return commitViewportChange({
    viewport,
    cancel,
    change: (bufferingViewport) => {
      bufferingViewport.clearAlwaysDrawn();
      bufferingViewport.clearNeverDrawn();
      bufferingViewport.changeModelDisplay({ modelIds, display: true });
      return modifyCategoryDisplay({
        viewport: bufferingViewport,
        categoryInfos,
        display: true,
      });
    },
  });
}

/**
 * Hides all given categories and their sub-categories, and clears the always drawn element list.
 * @internal
 */
export async function hideAllCategories({
  viewport,
  categoryInfos,
  cancel,
}: {
  viewport: TreeWidgetViewport;
  categoryInfos: CategoryInfosMap;
  cancel: Observable<void>;
}) {
  return commitViewportChange({
    viewport,
    cancel,
    change: (bufferingViewport) => {
      bufferingViewport.clearAlwaysDrawn();
      return modifyCategoryDisplay({
        viewport: bufferingViewport,
        categoryInfos,
        display: false,
      });
    },
  });
}

/**
 * Invert display of all given models: visible models are hidden and hidden models are made visible.
 *
 * All given categories and sub-categories are turned on, and always/never drawn element lists and per-model category overrides are cleared,
 * so that model display alone determines what is visible.
 * @internal
 */
export async function invertAllModels({
  modelIds,
  viewport,
  categoryInfos,
  cancel,
}: {
  modelIds: Id64Array;
  viewport: TreeWidgetViewport;
  categoryInfos: CategoryInfosMap;
  cancel: Observable<void>;
}) {
  return commitViewportChange({
    viewport,
    cancel,
    change: (bufferingViewport) => {
      bufferingViewport.clearNeverDrawn();
      bufferingViewport.clearAlwaysDrawn();
      bufferingViewport.clearPerModelCategoryOverrides();
      bufferingViewport.changeCategoryDisplay({ categoryIds: [...categoryInfos.keys()], display: true });
      for (const subCategoryIds of categoryInfos.values()) {
        for (const subCategoryId of subCategoryIds ?? []) {
          if (!bufferingViewport.viewsSubCategory(subCategoryId)) {
            bufferingViewport.changeSubCategoryDisplay({ subCategoryId, display: true });
          }
        }
      }
      return from(modelIds).pipe(
        reduce(
          (acc, modelId) => {
            if (bufferingViewport.viewsModel(modelId)) {
              acc.viewedModels.push(modelId);
            } else {
              acc.notViewedModels.push(modelId);
            }
            return acc;
          },
          { notViewedModels: new Array<Id64String>(), viewedModels: new Array<Id64String>() },
        ),
        map(({ notViewedModels, viewedModels }) => {
          bufferingViewport.changeModelDisplay({ modelIds: notViewedModels, display: true });
          bufferingViewport.changeModelDisplay({ modelIds: viewedModels, display: false });
        }),
      );
    },
  });
}

/**
 * Invert display of all given categories: visible categories are hidden and hidden categories are made visible.
 *
 * All given models are made visible, and always/never drawn element lists and per-model category overrides are cleared,
 * so that category display alone determines what is visible.
 * @internal
 */
export async function invertAllCategories({
  categoryInfos,
  modelIds,
  viewport,
  cancel,
}: {
  categoryInfos: Map<CategoryId, Array<SubCategoryId> | undefined>;
  modelIds: Id64Array;
  viewport: TreeWidgetViewport;
  cancel: Observable<void>;
}) {
  return commitViewportChange({
    viewport,
    cancel,
    change: (bufferingViewport) => {
      bufferingViewport.clearNeverDrawn();
      bufferingViewport.clearAlwaysDrawn();
      bufferingViewport.changeModelDisplay({ modelIds, display: true });

      const categoriesToEnable: CategoryInfosMap = new Map();
      const categoriesToDisable: CategoryInfosMap = new Map();

      for (const [categoryId, subCategoryIds] of categoryInfos) {
        if (!bufferingViewport.viewsCategory(categoryId)) {
          categoriesToEnable.set(categoryId, subCategoryIds);
          continue;
        }
        // Check if category is in partial state
        if (subCategoryIds?.some((subCategory) => !bufferingViewport.viewsSubCategory(subCategory))) {
          categoriesToEnable.set(categoryId, subCategoryIds);
        } else {
          categoriesToDisable.set(categoryId, subCategoryIds);
        }
      }

      return merge(
        modifyCategoryDisplay({ viewport: bufferingViewport, categoryInfos: categoriesToDisable, display: false }),
        modifyCategoryDisplay({ viewport: bufferingViewport, categoryInfos: categoriesToEnable, display: true }),
      ).pipe(takeLast(1));
    },
  });
}
