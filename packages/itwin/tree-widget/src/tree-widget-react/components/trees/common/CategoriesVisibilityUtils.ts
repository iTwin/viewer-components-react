/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, EMPTY, from, merge, mergeMap, of } from "rxjs";
import { Guid, Id64 } from "@itwin/core-bentley";
import { QueryRowFormat } from "@itwin/core-common";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { getOptimalBatchSize, releaseMainThreadOnItemsCount } from "./internal/Utils.js";
import { toVoidPromise } from "./Rxjs.js";

import type { GuidString, Id64Array, Id64String } from "@itwin/core-bentley";
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
 * Changes category display in the viewport.
 * @internal
 */
export async function enableCategoryDisplay(viewport: Viewport, categoryIds: Id64Array, enabled: boolean, enableAllSubCategories = true) {
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
    from(categoryIds).pipe(
      releaseMainThreadOnItemsCount(500),
      bufferCount(getOptimalBatchSize({ totalSize: categoryIds.length, maximumBatchSize: 500 })),
      mergeMap((bufferedCategories) => {
        return merge(
          of(viewport.changeCategoryDisplay(bufferedCategories, enabled, enableAllSubCategories)),
          of(removeOverrides(bufferedCategories)),
          false === enabled ? from(disableSubCategories(bufferedCategories)) : EMPTY,
        );
      }),
    ),
  );
}

/**
 * Changes subcategory display in the viewport
 * @internal
 */
export function enableSubCategoryDisplay(viewport: Viewport, key: string, enabled: boolean) {
  viewport.changeSubCategoryDisplay(key, enabled);
}

/** @internal */
export async function loadCategoriesFromViewport(vp: Viewport, componentId?: GuidString) {
  // Query categories and add them to state
  const selectUsedSpatialCategoryIds =
    "SELECT DISTINCT Category.Id as id from BisCore.GeometricElement3d WHERE Category.Id IN (SELECT ECInstanceId from BisCore.SpatialCategory)";
  const selectUsedDrawingCategoryIds =
    "SELECT DISTINCT Category.Id as id from BisCore.GeometricElement2d WHERE Model.Id=? AND Category.Id IN (SELECT ECInstanceId from BisCore.DrawingCategory)";
  const ecsql = vp.view.is3d() ? selectUsedSpatialCategoryIds : selectUsedDrawingCategoryIds;
  const ecsql2 = `SELECT ECInstanceId as id FROM ${vp.view.is3d() ? "BisCore.SpatialCategory" : "BisCore.DrawingCategory"} WHERE ECInstanceId IN (${ecsql})`;

  const categories: CategoryInfo[] = [];

  const rows = await vp.iModel
    .createQueryReader(ecsql2, undefined, {
      rowFormat: QueryRowFormat.UseJsPropertyNames,
      restartToken: `CategoriesVisibilityUtils/${componentId ?? Guid.createValue()}/categories`,
    })
    .toArray();
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
