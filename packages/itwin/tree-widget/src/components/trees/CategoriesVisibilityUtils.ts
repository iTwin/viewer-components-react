/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { QueryRowFormat } from "@itwin/core-common";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import type { CategoryInfo } from "./category-tree/CategoriesTreeButtons";

import type { IModelConnection, ViewManager, Viewport } from "@itwin/core-frontend";
const EMPTY_CATEGORIES_ARRAY: CategoryInfo[] = [];

/**
 * Toggles visibility of categories to show or hide.
 * @internal
 */
export async function toggleAllCategories(
  viewManager: ViewManager,
  imodel: IModelConnection,
  display: boolean,
  viewport?: Viewport,
  forAllViewports?: boolean,
) {
  // istanbul ignore next
  const activeView = viewport ?? viewManager.getFirstOpenView();
  const ids = await getCategories(imodel, activeView);

  // istanbul ignore if
  if (ids.length === 0) {
    return;
  }

  await enableCategory(viewManager, imodel, ids, display, forAllViewports ?? false);
}

/**
 * Gets ids of all categories from specified imodel and viewport.
 * @internal
 */
export async function getCategories(imodel: IModelConnection, viewport?: Viewport) {
  const categories = await loadCategoriesFromViewport(imodel, viewport);
  return categories.map((category) => category.categoryId);
}

/**
 * Changes category display in the viewport.
 * @internal
 */
export async function enableCategory(
  viewManager: ViewManager,
  imodel: IModelConnection,
  ids: string[],
  enabled: boolean,
  forAllViewports: boolean,
  enableAllSubCategories = true,
) {
  if (!viewManager.selectedView) {
    return;
  }

  const updateViewport = async (vp: Viewport) => {
    // Only act on viewports that are both 3D or both 2D. Important if we have multiple viewports opened and we
    // are using 'allViewports' property
    if (viewManager.selectedView && viewManager.selectedView.view.is3d() === vp.view.is3d()) {
      vp.changeCategoryDisplay(ids, enabled, enableAllSubCategories);

      // remove category overrides per model
      const modelsContainingOverrides: string[] = [];
      for (const ovr of vp.perModelCategoryVisibility) {
        // istanbul ignore else
        if (ids.findIndex((id) => id === ovr.categoryId) !== -1) {
          modelsContainingOverrides.push(ovr.modelId);
        }
      }
      vp.perModelCategoryVisibility.setOverride(modelsContainingOverrides, ids, PerModelCategoryVisibility.Override.None);

      // changeCategoryDisplay only enables subcategories, it does not disabled them. So we must do that ourselves.
      if (false === enabled) {
        (await imodel.categories.getCategoryInfo(ids)).forEach((categoryInfo) => {
          categoryInfo.subCategories.forEach((value) => enableSubCategory(viewManager, value.id, false, forAllViewports));
        });
      }
    }
  };

  // This property let us act on all viewports or just on the selected one, configurable by the app
  if (forAllViewports) {
    for (const viewport of viewManager) {
      await updateViewport(viewport);
    }
  } else {
    await updateViewport(viewManager.selectedView);
  }
}

/**
 * Changes subcategory display in the viewport
 * @internal
 */
export function enableSubCategory(viewManager: ViewManager, key: string, enabled: boolean, forAllViewports?: boolean) {
  if (!viewManager.selectedView) {
    return;
  }

  const updateViewport = (vp: Viewport) => {
    // Only act on viewports that are both 3D or both 2D. Important if we have multiple viewports opened and we
    // are using 'allViewports' property
    if (viewManager.selectedView && viewManager.selectedView.view.is3d() === vp.view.is3d()) {
      vp.changeSubCategoryDisplay(key, enabled);
    }
  };

  // This property let us act on all viewports or just on the selected one, configurable by the app
  if (forAllViewports) {
    for (const viewport of viewManager) {
      updateViewport(viewport);
    }
  } else {
    updateViewport(viewManager.selectedView);
  }
}

/** @internal */
export async function loadCategoriesFromViewport(iModel?: IModelConnection, vp?: Viewport) {
  if (!vp) {
    return EMPTY_CATEGORIES_ARRAY;
  }

  // Query categories and add them to state
  const selectUsedSpatialCategoryIds =
    "SELECT DISTINCT Category.Id as id from BisCore.GeometricElement3d WHERE Category.Id IN (SELECT ECInstanceId from BisCore.SpatialCategory)";
  const selectUsedDrawingCategoryIds =
    "SELECT DISTINCT Category.Id as id from BisCore.GeometricElement2d WHERE Model.Id=? AND Category.Id IN (SELECT ECInstanceId from BisCore.DrawingCategory)";
  const ecsql = vp.view.is3d() ? selectUsedSpatialCategoryIds : selectUsedDrawingCategoryIds;
  const ecsql2 = `SELECT ECInstanceId as id FROM ${vp.view.is3d() ? "BisCore.SpatialCategory" : "BisCore.DrawingCategory"} WHERE ECInstanceId IN (${ecsql})`;

  const categories: CategoryInfo[] = [];

  // istanbul ignore else
  if (iModel) {
    const rows = await iModel.createQueryReader(ecsql2, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }).toArray();
    (await iModel.categories.getCategoryInfo(rows.map((row) => row.id))).forEach((val) => {
      categories.push({ categoryId: val.id, subCategoryIds: val.subCategories.size ? [...val.subCategories.keys()] : undefined });
    });
  }
  return categories;
}
