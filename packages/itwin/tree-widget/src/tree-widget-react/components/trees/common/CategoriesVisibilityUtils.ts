/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { enableCategoryDisplay, enableSubCategoryDisplay } from "./internal/VisibilityUtils.js";

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
 * @public
 */
export async function invertAllCategories(categories: CategoryInfo[], viewport: Viewport) {
  const enabled = new Array<Id64String>();
  const disabled = new Array<Id64String>();
  const enabledSubCategories = new Array<Id64String>();
  const disabledSubCategories = new Array<Id64String>();

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
