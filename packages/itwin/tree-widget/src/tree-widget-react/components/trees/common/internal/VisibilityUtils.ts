/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, from, map, mergeMap, reduce } from "rxjs";
import { Guid, Id64 } from "@itwin/core-bentley";
import { QueryRowFormat } from "@itwin/core-common";
import { reduceWhile, toVoidPromise } from "./Rxjs.js";
import { createVisibilityStatus } from "./Tooltip.js";
import { getClassesByView, releaseMainThreadOnItemsCount } from "./Utils.js";

import type { Observable, OperatorFunction } from "rxjs";
import type { GuidString, Id64Arg, Id64String } from "@itwin/core-bentley";
import type { CategoryInfo } from "../CategoriesVisibilityUtils.js";
import type { TreeWidgetViewport } from "../TreeWidgetViewport.js";
import type { VisibilityStatus } from "../UseHierarchyVisibility.js";
import type { Visibility } from "./Tooltip.js";
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
  viewport: TreeWidgetViewport;
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
        state.changedNeverDrawn && state.neverDrawn && props.viewport.setNeverDrawn({ elementIds: state.neverDrawn });
        state.changedAlwaysDrawn &&
          state.alwaysDrawn &&
          props.viewport.setAlwaysDrawn({ elementIds: state.alwaysDrawn, exclusive: props.viewport.isAlwaysDrawnExclusive });
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
    viewport: TreeWidgetViewport;
  } & GetVisibilityFromAlwaysAndNeverDrawnElementsProps,
): VisibilityStatus {
  const { alwaysDrawn, neverDrawn, totalCount, viewport } = props;
  if (totalCount === 0) {
    return props.defaultStatus();
  }
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
 * Changes category display in the viewport.
 * @internal
 */
export async function enableCategoryDisplay(viewport: TreeWidgetViewport, categoryIds: Id64Arg, enabled: boolean, enableAllSubCategories = true) {
  const removeOverrides = (bufferedCategories: Id64Array) => {
    const modelsContainingOverrides: string[] = [];
    for (const ovr of viewport.perModelCategoryVisibility) {
      if (Id64.has(bufferedCategories, ovr.categoryId)) {
        modelsContainingOverrides.push(ovr.modelId);
      }
    }
    viewport.perModelCategoryVisibility.setOverride(modelsContainingOverrides, bufferedCategories, PerModelCategoryVisibility.Override.None);
  };
  const disableSubCategories = async (bufferedCategories: Id64Array) => {
    // changeCategoryDisplay only enables subcategories, it does not disabled them. So we must do that ourselves.
    (await viewport.iModel.categories.getCategoryInfo(bufferedCategories)).forEach((categoryInfo) => {
      categoryInfo.subCategories.forEach((value) => enableSubCategoryDisplay(viewport, value.id, false));
    });
  };
  return toVoidPromise(
    from(Id64.iterable(categoryIds)).pipe(
      releaseMainThreadOnItemsCount(500),
      bufferCount(getOptimalBatchSize({ totalSize: Id64.sizeOf(categoryIds), maximumBatchSize: 500 })),
      mergeMap(async (bufferedCategories) => {
        viewport.changeCategoryDisplay({ categoryIds: bufferedCategories, display: enabled, enableAllSubCategories });
        removeOverrides(bufferedCategories);
        if (!enabled) {
          await disableSubCategories(bufferedCategories);
        }
      }),
    ),
  );
}

/**
 * Changes subcategory display in the viewport
 * @internal
 */
export function enableSubCategoryDisplay(viewport: TreeWidgetViewport, subCategoryId: Id64String, enabled: boolean) {
  viewport.changeSubCategoryDisplay({ subCategoryId, display: enabled });
}

/** @internal */
export async function loadCategoriesFromViewport(vp: TreeWidgetViewport, componentId?: GuidString) {
  // Query categories and add them to state
  if (vp.viewType === "other") {
    return [];
  }
  const { categoryClass, elementClass } = getClassesByView(vp.viewType);
  const ecsql = `
    SELECT ECInstanceId as id
    FROM ${categoryClass}
    WHERE
      ECInstanceId IN (
        SELECT DISTINCT Category.Id
        FROM ${elementClass}
        WHERE
          Category.Id IN (SELECT ECInstanceId FROM ${categoryClass})
          ${vp.viewType !== "2d" ? "" : "AND Model.Id=?"}
      )
  `;

  const categories: CategoryInfo[] = [];
  const rows = await (async () => {
    const result = new Array<Id64String>();
    for await (const row of vp.iModel.createQueryReader(ecsql, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames, restartToken: `CategoriesVisibilityUtils/${componentId ?? Guid.createValue()}/categories` })) {
      result.push(row.id);
    }
    return result;
  })();
  (await vp.iModel.categories.getCategoryInfo(rows)).forEach((val) => {
    categories.push({ categoryId: val.id, subCategoryIds: val.subCategories.size ? [...val.subCategories.keys()] : undefined });
  });
  return categories;
}
