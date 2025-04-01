/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { filter, from, map, mergeAll, mergeMap, of, reduce, startWith, toArray } from "rxjs";
import { QueryRowFormat } from "@itwin/core-common";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import {
  DRAWING_CATEGORY_CLASS_NAME,
  GEOMETRIC_ELEMENT_2D_CLASS_NAME,
  GEOMETRIC_ELEMENT_3D_CLASS_NAME,
  SPATIAL_CATEGORY_CLASS_NAME,
} from "./ClassNameDefinitions.js";
import { reduceWhile } from "./Rxjs.js";
import { createVisibilityStatus, getTooltipOptions } from "./Tooltip.js";
import { releaseMainThreadOnItemsCount } from "./Utils.js";

import type { Viewport } from "@itwin/core-frontend";
import type { Observable, OperatorFunction } from "rxjs";
import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { NonPartialVisibilityStatus, Visibility } from "./Tooltip.js";
import type { VisibilityStatus } from "../UseHierarchyVisibility.js";
import type { CategoryId, ElementId, ModelId, SubCategoryId, SubModelId } from "./Types.js";
import type { CategoryInfo } from "../CategoriesVisibilityUtils.js";

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
export function mergeVisibilityStatuses(
  tooltipMap: { [key in Visibility]: string | undefined },
  ignoreTooltip?: boolean,
): OperatorFunction<VisibilityStatus, VisibilityStatus> {
  return (obs) => {
    return obs.pipe(
      map((visibilityStatus) => visibilityStatus.state),
      mergeVisibilities,
      map((visibility) => {
        if (visibility === "empty") {
          visibility = "visible";
        }
        return createVisibilityStatus(visibility, getTooltipOptions(tooltipMap[visibility], ignoreTooltip));
      }),
    );
  };
}

/** @internal */
export function getSubModeledElementsVisibilityStatus({
  parentNodeVisibilityStatus,
  tooltips,
  ignoreTooltips,
  getModelVisibilityStatus,
}: {
  parentNodeVisibilityStatus: VisibilityStatus;
  getModelVisibilityStatus: ({ modelId }: { modelId: Id64String }) => Observable<VisibilityStatus>;
  tooltips: { [key in Visibility]: string | undefined };
  ignoreTooltips?: boolean;
}): OperatorFunction<Id64Array, VisibilityStatus> {
  return (obs) => {
    return obs.pipe(
      // combine visibility status of sub-models with visibility status of parent node
      mergeMap((modeledElementIds) => {
        if (modeledElementIds.length === 0) {
          return of(parentNodeVisibilityStatus);
        }
        return from(modeledElementIds).pipe(
          mergeMap((modeledElementId) => getModelVisibilityStatus({ modelId: modeledElementId })),
          startWith<VisibilityStatus>(parentNodeVisibilityStatus),
          mergeVisibilityStatuses(tooltips, ignoreTooltips),
        );
      }),
    );
  };
}

/** @internal */
export function filterSubModeledElementIds({
  doesSubModelExist,
}: {
  doesSubModelExist: (elementId: ElementId) => Promise<boolean>;
}): OperatorFunction<Array<ElementId>, Array<SubModelId>> {
  return (obs) => {
    return obs.pipe(
      mergeAll(),
      mergeMap(async (elementId) => ({ elementId, hasSubModel: await doesSubModelExist(elementId) })),
      filter(({ hasSubModel }) => hasSubModel),
      map(({ elementId }) => elementId),
      toArray(),
    );
  };
}

/** @internal */
export function changeElementStateNoChildrenOperator(props: {
  on: boolean;
  isDisplayedByDefault: boolean;
  viewport: Viewport;
}): OperatorFunction<string, void> {
  return (elementIds: Observable<ElementId>) => {
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
    ignoreTooltip?: boolean;
    viewport: Viewport;
  } & GetVisibilityFromAlwaysAndNeverDrawnElementsProps,
): VisibilityStatus {
  const { alwaysDrawn, neverDrawn, totalCount, ignoreTooltip } = props;

  if (neverDrawn?.size === totalCount) {
    return createVisibilityStatus("hidden", getTooltipOptions(props.tooltips.allElementsInNeverDrawnList, ignoreTooltip));
  }

  if (alwaysDrawn?.size === totalCount) {
    return createVisibilityStatus("visible", getTooltipOptions(props.tooltips.allElementsInAlwaysDrawnList, ignoreTooltip));
  }

  const viewport = props.viewport;
  if (viewport.isAlwaysDrawnExclusive && viewport.alwaysDrawn?.size) {
    return alwaysDrawn?.size
      ? createVisibilityStatus("partial", getTooltipOptions(props.tooltips.elementsInBothAlwaysAndNeverDrawn, ignoreTooltip))
      : createVisibilityStatus("hidden", getTooltipOptions(props.tooltips.noElementsInExclusiveAlwaysDrawnList, ignoreTooltip));
  }

  const status = props.defaultStatus();
  if ((status.state === "visible" && neverDrawn?.size) || (status.state === "hidden" && alwaysDrawn?.size)) {
    return createVisibilityStatus("partial", getTooltipOptions(undefined, ignoreTooltip));
  }
  return status;
}

/** @internal */
export function getElementOverriddenVisibility(props: {
  elementId: ElementId;
  ignoreTooltip?: boolean;
  viewport: Viewport;
  tooltips: {
    hiddenThroughNeverDrawn?: string;
    hiddenThroughAlwaysDrawnExclusive?: string;
    visibileThorughAlwaysDrawn?: string;
  };
}): NonPartialVisibilityStatus | undefined {
  const { ignoreTooltip, viewport, elementId, tooltips } = props;
  if (viewport.neverDrawn?.has(elementId)) {
    return createVisibilityStatus("hidden", getTooltipOptions(tooltips.hiddenThroughNeverDrawn, ignoreTooltip));
  }

  if (viewport.alwaysDrawn?.size) {
    if (viewport.alwaysDrawn.has(elementId)) {
      return createVisibilityStatus("visible", getTooltipOptions(tooltips.visibileThorughAlwaysDrawn, ignoreTooltip));
    }

    if (viewport.isAlwaysDrawnExclusive) {
      return createVisibilityStatus("hidden", getTooltipOptions(tooltips.hiddenThroughAlwaysDrawnExclusive, ignoreTooltip));
    }
  }

  return undefined;
}

/** @internal */
export interface GetVisibilityFromAlwaysAndNeverDrawnElementsProps {
  tooltips: {
    allElementsInNeverDrawnList: string;
    allElementsInAlwaysDrawnList: string;
    elementsInBothAlwaysAndNeverDrawn: string;
    noElementsInExclusiveAlwaysDrawnList: string;
  };
  /** Status when always/never lists are empty and exclusive mode is off */
  defaultStatus: () => VisibilityStatus;
}

/** @internal */
export function getElementVisibility(
  ignoreTooltip: boolean | undefined,
  viewsModel: boolean,
  overridenVisibility: NonPartialVisibilityStatus | undefined,
  categoryVisibility: NonPartialVisibilityStatus,
  treeType: "modelsTree" | "categoriesTree",
  subModelVisibilityStatus?: VisibilityStatus,
): VisibilityStatus {
  if (subModelVisibilityStatus === undefined) {
    if (!viewsModel) {
      return createVisibilityStatus("hidden", getTooltipOptions(`${treeType}.element.hiddenThroughModel`, ignoreTooltip));
    }

    if (overridenVisibility) {
      return overridenVisibility;
    }

    return createVisibilityStatus(
      categoryVisibility.state,
      getTooltipOptions(categoryVisibility.state === "visible" ? undefined : `${treeType}.element.hiddenThroughCategory`, ignoreTooltip),
    );
  }

  if (subModelVisibilityStatus.state === "partial") {
    return createVisibilityStatus("partial", getTooltipOptions(`${treeType}.element.someElementsAreHidden`, ignoreTooltip));
  }

  if (subModelVisibilityStatus.state === "visible") {
    if (!viewsModel || overridenVisibility?.state === "hidden" || (categoryVisibility.state === "hidden" && !overridenVisibility)) {
      return createVisibilityStatus("partial", getTooltipOptions(`${treeType}.element.partialThroughSubModel`, ignoreTooltip));
    }
    return createVisibilityStatus("visible", getTooltipOptions(undefined, ignoreTooltip));
  }

  if (!viewsModel) {
    return createVisibilityStatus("hidden", getTooltipOptions(`${treeType}.element.hiddenThroughModel`, ignoreTooltip));
  }

  if (overridenVisibility) {
    if (overridenVisibility.state === "hidden") {
      return overridenVisibility;
    }
    return createVisibilityStatus("partial", getTooltipOptions(`${treeType}.element.partialThroughElement`, ignoreTooltip));
  }

  if (categoryVisibility.state === "visible") {
    return createVisibilityStatus("partial", getTooltipOptions(`${treeType}.element.partialThroughCategory`, ignoreTooltip));
  }
  return createVisibilityStatus("hidden", getTooltipOptions(`${treeType}.element.hiddenThroughCategory`, ignoreTooltip));
}

/**
 * Toggles visibility of categories to show or hide.
 * @internal
 */
export async function toggleAllCategories(viewport: Viewport, display: boolean) {
  const ids = await getCategories(viewport);
  if (ids.length === 0) {
    return;
  }

  await enableCategoryDisplay(viewport, ids, display);
}

/**
 * Gets ids of all categories from specified imodel and viewport.
 * @internal
 */
async function getCategories(viewport: Viewport): Promise<Array<CategoryId>> {
  const categories = await loadCategoriesFromViewport(viewport);
  return categories.map((category) => category.categoryId);
}

/**
 * Changes category display in the viewport.
 * @internal
 */
export async function enableCategoryDisplay(viewport: Viewport, ids: Array<CategoryId>, enabled: boolean, enableAllSubCategories = true) {
  viewport.changeCategoryDisplay(ids, enabled, enableAllSubCategories);

  // remove category overrides per model
  const modelsContainingOverrides = new Array<ModelId>();
  for (const ovr of viewport.perModelCategoryVisibility) {
    if (ids.findIndex((id) => id === ovr.categoryId) !== -1) {
      modelsContainingOverrides.push(ovr.modelId);
    }
  }
  viewport.perModelCategoryVisibility.setOverride(modelsContainingOverrides, ids, PerModelCategoryVisibility.Override.None);

  // changeCategoryDisplay only enables subcategories, it does not disabled them. So we must do that ourselves.
  if (false === enabled) {
    (await viewport.iModel.categories.getCategoryInfo(ids)).forEach((categoryInfo) => {
      categoryInfo.subCategories.forEach((value) => enableSubCategoryDisplay(viewport, value.id, false));
    });
  }
}

/**
 * Changes subcategory display in the viewport
 * @internal
 */
export function enableSubCategoryDisplay(viewport: Viewport, key: SubCategoryId, enabled: boolean) {
  viewport.changeSubCategoryDisplay(key, enabled);
}

/** @internal */
export async function loadCategoriesFromViewport(vp: Viewport) {
  // Query categories and add them to state
  const selectUsedSpatialCategoryIds = `SELECT DISTINCT Category.Id as id from ${GEOMETRIC_ELEMENT_3D_CLASS_NAME} WHERE Category.Id IN (SELECT ECInstanceId from ${SPATIAL_CATEGORY_CLASS_NAME})`;
  const selectUsedDrawingCategoryIds = `SELECT DISTINCT Category.Id as id from ${GEOMETRIC_ELEMENT_2D_CLASS_NAME} WHERE Model.Id=? AND Category.Id IN (SELECT ECInstanceId from ${DRAWING_CATEGORY_CLASS_NAME})`;
  const ecsql = vp.view.is3d() ? selectUsedSpatialCategoryIds : selectUsedDrawingCategoryIds;
  const ecsql2 = `SELECT ECInstanceId as id FROM ${vp.view.is3d() ? SPATIAL_CATEGORY_CLASS_NAME : DRAWING_CATEGORY_CLASS_NAME} WHERE ECInstanceId IN (${ecsql})`;

  const categories: CategoryInfo[] = [];

  const rows = await vp.iModel.createQueryReader(ecsql2, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }).toArray();
  (await vp.iModel.categories.getCategoryInfo(rows.map((row) => row.id))).forEach((val) => {
    categories.push({ categoryId: val.id, subCategoryIds: val.subCategories.size ? [...val.subCategories.keys()] : undefined });
  });
  return categories;
}
