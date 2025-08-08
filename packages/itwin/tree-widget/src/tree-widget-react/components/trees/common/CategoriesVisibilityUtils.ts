/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { enableCategoryDisplay } from "./internal/VisibilityUtils.js";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";

/**
 * Data structure that describes category.
 * @beta
 */
export interface CategoryInfo {
  categoryId: Id64String;
  subCategoryIds?: Id64Array;
}

/**
 * Enable display of all given categories.
 * @public
 */
export async function showAllCategories(categories: Id64Array, viewport: Viewport) {
  await enableCategoryDisplay(viewport, categories, true, true);
}

/**
 * Disable display of all given categories.
 * @public
 */
export async function hideAllCategories(categories: Id64Array, viewport: Viewport) {
  await enableCategoryDisplay(viewport, categories, false, true);
}

/**
 * Invert display of all given categories.
 * Categories are inverted like this:
 * - If category is visible, it will be hidden.
 * - If category is hidden, it will be visible.
 * - If category is partially visible, it will be fully visible.
 * @public
 */
export async function invertAllCategories(categories: CategoryInfo[], viewport: Viewport) {
  const categoriesToEnable = new Set<Id64String>();
  const categoriesToDisable = new Set<Id64String>();

  for (const category of categories) {
    if (!viewport.view.viewsCategory(category.categoryId)) {
      categoriesToEnable.add(category.categoryId);
      continue;
    }
    // Check if category is in partial state
    if (category.subCategoryIds?.some((subCategory) => !viewport.isSubCategoryVisible(subCategory))) {
      categoriesToEnable.add(category.categoryId);
    } else {
      categoriesToDisable.add(category.categoryId);
    }
  }

  // collect per model overrides that need to be inverted
  for (const { categoryId, visible } of viewport.perModelCategoryVisibility) {
    if (!visible && categoriesToDisable.has(categoryId)) {
      categoriesToEnable.add(categoryId);
      categoriesToDisable.delete(categoryId);
    }
  }

  await enableCategoryDisplay(viewport, [...categoriesToDisable], false, true);

  await enableCategoryDisplay(viewport, [...categoriesToEnable], true, true);
}
