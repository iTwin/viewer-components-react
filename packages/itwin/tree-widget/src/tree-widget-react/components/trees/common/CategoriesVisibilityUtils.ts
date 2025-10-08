/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { enableCategoryDisplay } from "./internal/VisibilityUtils.js";
import { createTreeWidgetViewport } from "./TreeWidgetViewport.js";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { TreeWidgetViewport } from "./TreeWidgetViewport.js";

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
export async function showAllCategories(categories: Id64Array, viewport: Viewport | TreeWidgetViewport) {
  const treeWidgetViewport = createTreeWidgetViewport(viewport);
  await enableCategoryDisplay(treeWidgetViewport, categories, true, true);
}

/**
 * Disable display of all given categories.
 * @public
 */
export async function hideAllCategories(categories: Id64Array, viewport: Viewport | TreeWidgetViewport) {
  const treeWidgetViewport = createTreeWidgetViewport(viewport);
  await enableCategoryDisplay(treeWidgetViewport, categories, false, true);
}

/**
 * Invert display of all given categories.
 * Categories are inverted like this:
 * - If category is visible, it will be hidden.
 * - If category is hidden, it will be visible.
 * - If category is partially visible, it will be fully visible.
 * @public
 */
export async function invertAllCategories(categories: CategoryInfo[], viewport: Viewport | TreeWidgetViewport) {
  const categoriesToEnable = new Set<Id64String>();
  const categoriesToDisable = new Set<Id64String>();
  const treeWidgetViewport = createTreeWidgetViewport(viewport);

  for (const category of categories) {
    if (!treeWidgetViewport.viewsCategory(category.categoryId)) {
      categoriesToEnable.add(category.categoryId);
      continue;
    }
    // Check if category is in partial state
    if (category.subCategoryIds?.some((subCategory) => !treeWidgetViewport.viewsSubCategory(subCategory))) {
      categoriesToEnable.add(category.categoryId);
    } else {
      categoriesToDisable.add(category.categoryId);
    }
  }

  // collect per model overrides that need to be inverted
  for (const { categoryId, visible } of treeWidgetViewport.perModelCategoryOverrides) {
    if (!visible && categoriesToDisable.has(categoryId)) {
      categoriesToEnable.add(categoryId);
      categoriesToDisable.delete(categoryId);
    }
  }

  await enableCategoryDisplay(treeWidgetViewport, categoriesToDisable, false, true);

  await enableCategoryDisplay(treeWidgetViewport, categoriesToEnable, true, true);
}
