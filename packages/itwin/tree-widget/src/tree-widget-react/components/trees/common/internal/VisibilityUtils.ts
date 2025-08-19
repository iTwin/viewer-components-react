/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { map, reduce } from "rxjs";
import { Id64 } from "@itwin/core-bentley";
import { QueryRowFormat } from "@itwin/core-common";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { reduceWhile } from "./Rxjs.js";
import { createVisibilityStatus } from "./Tooltip.js";
import { getClassesByView, releaseMainThreadOnItemsCount } from "./Utils.js";

import type { Observable, OperatorFunction } from "rxjs";
import type { Id64Arg, Id64Array, Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { CategoryInfo } from "../CategoriesVisibilityUtils.js";
import type { VisibilityStatus } from "../UseHierarchyVisibility.js";
import type { Visibility } from "./Tooltip.js";
import type { ElementId, ModelId } from "./Types.js";

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
export function mergeVisibilityStatuses(obs: Observable<VisibilityStatus>): Observable<VisibilityStatus> {
  return obs.pipe(
    map((visibilityStatus) => visibilityStatus.state),
    mergeVisibilities,
    map((visibility) => createVisibilityStatus(visibility === "empty" ? "disabled" : visibility)),
  );
}

/** @internal */
export function changeElementStateNoChildrenOperator(props: {
  on: boolean;
  isDisplayedByDefault: boolean;
  viewport: Viewport;
}): OperatorFunction<string, void> {
  return (elementIds: Observable<Id64String>) => {
    const { on, isDisplayedByDefault } = props;
    const isAlwaysDrawnExclusive = props.viewport.isAlwaysDrawnExclusive;
    return elementIds.pipe(
      releaseMainThreadOnItemsCount(500),
      reduce<
        string,
        { changedNeverDrawn: boolean; changedAlwaysDrawn: boolean; neverDrawn: Set<ElementId> | undefined; alwaysDrawn: Set<ElementId> | undefined }
      >(
        (acc, elementId) => {
          if (acc.alwaysDrawn === undefined || acc.neverDrawn === undefined) {
            acc.alwaysDrawn = new Set(props.viewport.alwaysDrawn || []);
            acc.neverDrawn = new Set(props.viewport.neverDrawn || []);
          }
          if (on) {
            const wasRemoved = acc.neverDrawn.delete(elementId);
            acc.changedNeverDrawn ||= wasRemoved;
            // If exclusive mode is enabled, we must add the element to the always drawn list.
            if ((!isDisplayedByDefault || isAlwaysDrawnExclusive) && !acc.alwaysDrawn.has(elementId)) {
              acc.alwaysDrawn.add(elementId);
              acc.changedAlwaysDrawn = true;
            }
          } else {
            const wasRemoved = acc.alwaysDrawn.delete(elementId);
            acc.changedAlwaysDrawn ||= wasRemoved;
            // If exclusive mode is not enabled, we have to add the element to the never drawn list.
            if (isDisplayedByDefault && !isAlwaysDrawnExclusive && !acc.neverDrawn.has(elementId)) {
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
        state.changedNeverDrawn && state.neverDrawn && props.viewport.setNeverDrawn(state.neverDrawn);
        state.changedAlwaysDrawn && state.alwaysDrawn && props.viewport.setAlwaysDrawn(state.alwaysDrawn, props.viewport.isAlwaysDrawnExclusive);
      }),
    );
  };
}

/** @internal */
export function getVisibilityFromAlwaysAndNeverDrawnElementsImpl(
  props: {
    alwaysDrawn: Set<ElementId> | undefined;
    neverDrawn: Set<ElementId> | undefined;
    totalCount: number;
    viewport: Viewport;
  } & GetVisibilityFromAlwaysAndNeverDrawnElementsProps,
): VisibilityStatus {
  const { alwaysDrawn, neverDrawn, totalCount, viewport } = props;

  if (neverDrawn?.size === totalCount) {
    return createVisibilityStatus("hidden");
  }

  if (alwaysDrawn?.size === totalCount) {
    return createVisibilityStatus("visible");
  }

  if (viewport.isAlwaysDrawnExclusive) {
    return createVisibilityStatus(alwaysDrawn?.size ? "partial" : "hidden");
  }

  const status = props.defaultStatus();
  if ((status.state === "visible" && neverDrawn?.size) || (status.state === "hidden" && alwaysDrawn?.size)) {
    return createVisibilityStatus("partial");
  }
  return status;
}

/** @internal */
export interface GetVisibilityFromAlwaysAndNeverDrawnElementsProps {
  /** Status when always/never lists are empty and exclusive mode is off */
  defaultStatus: (categoryId?: string) => VisibilityStatus;
}

/**
 * Toggles visibility of categories to show or hide.
 * @internal
 */
export async function toggleAllCategories(viewport: Viewport, display: boolean) {
  const categoryIds = await getCategoryIds(viewport);
  if (categoryIds.length === 0) {
    return;
  }

  await enableCategoryDisplay(viewport, categoryIds, display);
}

/**
 * Gets ids of all categories from specified imodel and viewport.
 * @internal
 */
async function getCategoryIds(viewport: Viewport): Promise<Id64Array> {
  const categories = await loadCategoriesFromViewport(viewport);
  return categories.map((category) => category.categoryId);
}

/**
 * Changes category display in the viewport.
 * @internal
 */
export async function enableCategoryDisplay(viewport: Viewport, categoryIds: Id64Arg, enabled: boolean, enableAllSubCategories = true) {
  viewport.changeCategoryDisplay(categoryIds, enabled, enableAllSubCategories);

  // remove category overrides per model
  const modelsContainingOverrides = new Array<ModelId>();
  for (const ovr of viewport.perModelCategoryVisibility) {
    if (Id64.has(categoryIds, ovr.categoryId)) {
      modelsContainingOverrides.push(ovr.modelId);
    }
  }
  viewport.perModelCategoryVisibility.setOverride(modelsContainingOverrides, categoryIds, PerModelCategoryVisibility.Override.None);

  // changeCategoryDisplay only enables subcategories, it does not disabled them. So we must do that ourselves.
  if (false === enabled) {
    (await viewport.iModel.categories.getCategoryInfo(Id64.iterable(categoryIds))).forEach((categoryInfo) => {
      categoryInfo.subCategories.forEach((value) => enableSubCategoryDisplay(viewport, value.id, false));
    });
  }
}

/**
 * Changes subcategory display in the viewport
 * @internal
 */
export function enableSubCategoryDisplay(viewport: Viewport, subCategoryId: Id64String, enabled: boolean) {
  viewport.changeSubCategoryDisplay(subCategoryId, enabled);
}

/** @internal */
export async function loadCategoriesFromViewport(vp: Viewport) {
  // Query categories and add them to state
  const { categoryClass, elementClass } = getClassesByView(vp.view.is3d() ? "3d" : "2d");
  const ecsql = `
    SELECT ECInstanceId as id
    FROM ${categoryClass}
    WHERE
      ECInstanceId IN (
        SELECT DISTINCT Category.Id
        FROM ${elementClass}
        WHERE
          Category.Id IN (SELECT ECInstanceId FROM ${categoryClass})
          ${vp.view.is3d() ? "" : "AND Model.Id=?"}
      )
  `;

  const categories: CategoryInfo[] = [];

  const rows = await vp.iModel.createQueryReader(ecsql, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }).toArray();
  (await vp.iModel.categories.getCategoryInfo(rows.map((row) => row.id))).forEach((val) => {
    categories.push({ categoryId: val.id, subCategoryIds: val.subCategories.size ? [...val.subCategories.keys()] : undefined });
  });
  return categories;
}
