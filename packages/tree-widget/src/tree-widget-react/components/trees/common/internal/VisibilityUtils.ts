/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { EMPTY, map, mergeMap, of, reduce } from "rxjs";
import { reduceWhile, releaseMainThreadOnItemsCount } from "./Rxjs.js";
import { createVisibilityStatus } from "./Tooltip.js";

import type { Observable, OperatorFunction } from "rxjs";
import type { Id64Array, Id64String } from "@itwin/core-bentley";
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
 * Turns display of given categories and their sub-categories on or off, clearing any per-model category overrides.
 *
 * Categories are processed in batches, releasing the main thread in between, so the returned observable may emit over multiple frames.
 * @internal
 */
export function changeCategoryDisplay({
  categoryInfos,
  viewport,
  display,
}: {
  viewport: TreeWidgetViewport;
  categoryInfos: CategoryInfosMap;
  display: boolean;
}): void {
  const modelsContainingOverrides = new Set<Id64String>();
  const categoriesArray = [...categoryInfos.keys()];
  for (const ovr of viewport.perModelCategoryOverrides) {
    if (categoryInfos.has(ovr.categoryId)) {
      modelsContainingOverrides.add(ovr.modelId);
    }
  }
  viewport.setPerModelCategoryOverride({ modelIds: modelsContainingOverrides, categoryIds: categoriesArray, override: "none" });
  viewport.changeCategoryDisplay({ categoryIds: categoriesArray, display, enableAllSubCategories: false });
  if (!display) {
    return;
  }
  for (const categoryId of categoriesArray) {
    const subCategoryIds = categoryInfos.get(categoryId);
    for (const subCategoryId of subCategoryIds ?? []) {
      viewport.changeSubCategoryDisplay({ subCategoryId, display });
    }
  }
}

/**
 * Makes everything visible: displays all given models, categories and sub-categories, and clears the always/never drawn element lists.
 * @internal
 */
export function showAll({ viewport, modelIds, categoryInfos }: { viewport: TreeWidgetViewport; modelIds: Id64Array; categoryInfos: CategoryInfosMap }) {
  viewport.clearAlwaysDrawn();
  viewport.clearNeverDrawn();
  viewport.changeModelDisplay({ modelIds, display: true });
  changeCategoryDisplay({
    viewport,
    categoryInfos,
    display: true,
  });
}

/**
 * Hides all given categories and their sub-categories, and clears the always drawn element list.
 * @internal
 */
export function hideAllCategories({ viewport, categoryInfos }: { viewport: TreeWidgetViewport; categoryInfos: CategoryInfosMap }) {
  viewport.clearAlwaysDrawn();
  changeCategoryDisplay({
    viewport,
    categoryInfos,
    display: false,
  });
}

/**
 * Invert display of all given models: visible models are hidden and hidden models are made visible.
 *
 * All given categories and sub-categories are turned on, and always/never drawn element lists and per-model category overrides are cleared,
 * so that model display alone determines what is visible.
 * @internal
 */
export function invertAllModels({ modelIds, viewport, categoryInfos }: { modelIds: Id64Array; viewport: TreeWidgetViewport; categoryInfos: CategoryInfosMap }) {
  viewport.clearNeverDrawn();
  viewport.clearAlwaysDrawn();
  viewport.clearPerModelCategoryOverrides();
  viewport.changeCategoryDisplay({ categoryIds: [...categoryInfos.keys()], display: true });
  for (const subCategoryIds of categoryInfos.values()) {
    for (const subCategoryId of subCategoryIds ?? []) {
      if (!viewport.viewsSubCategory(subCategoryId)) {
        viewport.changeSubCategoryDisplay({ subCategoryId, display: true });
      }
    }
  }
  const notViewedModels = new Array<Id64String>();
  const viewedModels = new Array<Id64String>();
  for (const modelId of modelIds) {
    if (viewport.viewsModel(modelId)) {
      viewedModels.push(modelId);
      continue;
    }
    notViewedModels.push(modelId);
  }
  viewport.changeModelDisplay({ modelIds: notViewedModels, display: true });
  viewport.changeModelDisplay({ modelIds: viewedModels, display: false });
}

/**
 * Invert display of all given categories: visible categories are hidden and hidden categories are made visible.
 *
 * All given models are made visible, and always/never drawn element lists and per-model category overrides are cleared,
 * so that category display alone determines what is visible.
 * @internal
 */
export function invertAllCategories({
  categoryInfos,
  modelIds,
  viewport,
}: {
  categoryInfos: Map<CategoryId, Array<SubCategoryId> | undefined>;
  modelIds: Id64Array;
  viewport: TreeWidgetViewport;
}) {
  viewport.clearNeverDrawn();
  viewport.clearAlwaysDrawn();
  viewport.changeModelDisplay({ modelIds, display: true });

  const categoriesToEnable: CategoryInfosMap = new Map();
  const categoriesToDisable: CategoryInfosMap = new Map();

  for (const [categoryId, subCategoryIds] of categoryInfos) {
    if (!viewport.viewsCategory(categoryId)) {
      categoriesToEnable.set(categoryId, subCategoryIds);
      continue;
    }
    // Check if category is in partial state
    if (subCategoryIds?.some((subCategory) => !viewport.viewsSubCategory(subCategory))) {
      categoriesToEnable.set(categoryId, subCategoryIds);
    } else {
      categoriesToDisable.set(categoryId, subCategoryIds);
    }
  }

  changeCategoryDisplay({ viewport, categoryInfos: categoriesToDisable, display: false });
  changeCategoryDisplay({ viewport, categoryInfos: categoriesToEnable, display: true });
}
