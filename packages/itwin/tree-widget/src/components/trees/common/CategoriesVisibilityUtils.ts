/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { QueryRowFormat } from "@itwin/core-common";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";

import type { Viewport } from "@itwin/core-frontend";

/**
 * Data structure that describes category.
 * @beta
 */
export interface CategoryInfo {
  categoryId: string;
  subCategoryIds?: string[];
}

/**
 * Toggles visibility of categories to show or hide.
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
 */
export async function getCategories(viewport: Viewport) {
  const categories = await loadCategoriesFromViewport(viewport);
  return categories.map((category) => category.categoryId);
}

/**
 * Changes category display in the viewport.
 */
export async function enableCategoryDisplay(viewport: Viewport, ids: string[], enabled: boolean, enableAllSubCategories = true) {
  viewport.changeCategoryDisplay(ids, enabled, enableAllSubCategories);

  // remove category overrides per model
  const modelsContainingOverrides: string[] = [];
  for (const ovr of viewport.perModelCategoryVisibility) {
    // istanbul ignore else
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
 */
export function enableSubCategoryDisplay(viewport: Viewport, key: string, enabled: boolean) {
  viewport.changeSubCategoryDisplay(key, enabled);
}

export async function loadCategoriesFromViewport(vp: Viewport) {
  // Query categories and add them to state
  const selectUsedSpatialCategoryIds =
    "SELECT DISTINCT Category.Id as id from BisCore.GeometricElement3d WHERE Category.Id IN (SELECT ECInstanceId from BisCore.SpatialCategory)";
  const selectUsedDrawingCategoryIds =
    "SELECT DISTINCT Category.Id as id from BisCore.GeometricElement2d WHERE Model.Id=? AND Category.Id IN (SELECT ECInstanceId from BisCore.DrawingCategory)";
  const ecsql = vp.view.is3d() ? selectUsedSpatialCategoryIds : selectUsedDrawingCategoryIds;
  const ecsql2 = `SELECT ECInstanceId as id FROM ${vp.view.is3d() ? "BisCore.SpatialCategory" : "BisCore.DrawingCategory"} WHERE ECInstanceId IN (${ecsql})`;

  const categories: CategoryInfo[] = [];

  const rows = await vp.iModel.createQueryReader(ecsql2, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }).toArray();
  (await vp.iModel.categories.getCategoryInfo(rows.map((row) => row.id))).forEach((val) => {
    categories.push({ categoryId: val.id, subCategoryIds: val.subCategories.size ? [...val.subCategories.keys()] : undefined });
  });
  return categories;
}

/**
 * Enable display of all given categories.
 * @public
 */
export async function showAllCategories(categories: string[], viewport: Viewport) {
  await enableCategoryDisplay(viewport, categories, true, true);
}

/**
 * Disable display of all given categories.
 * @public
 */
export async function hideAllCategories(categories: string[], viewport: Viewport) {
  await enableCategoryDisplay(viewport, categories, false, true);
}

/**
 * Invert display of all given categories.
 * @public
 */
export async function invertAllCategories(categories: CategoryInfo[], viewport: Viewport) {
  const enabled: string[] = [];
  const disabled: string[] = [];
  const enabledSubCategories: string[] = [];
  const disabledSubCategories: string[] = [];

  for (const category of categories) {
    if (!viewport.view.viewsCategory(category.categoryId)) {
      disabled.push(category.categoryId);
      continue;
    }
    // First, we need to check if at least one subcategory is disabled. If it is true, then only subcategories should change display, not categories.
    if (category.subCategoryIds?.some((subCategory) => !viewport.isSubCategoryVisible(subCategory))) {
      for (const subCategory of category.subCategoryIds) {
        viewport.isSubCategoryVisible(subCategory) ? enabledSubCategories.push(subCategory) : disabledSubCategories.push(subCategory);
      }
    } else {
      enabled.push(category.categoryId);
    }
  }

  // Disable enabled
  enabledSubCategories.forEach((subCategory) => enableSubCategoryDisplay(viewport, subCategory, false));

  await enableCategoryDisplay(viewport, enabled, false, true);

  // Enable disabled
  disabledSubCategories.forEach((subCategory) => enableSubCategoryDisplay(viewport, subCategory, true));

  await enableCategoryDisplay(viewport, disabled, true, true);
}
