/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IModelConnection, ViewManager, Viewport } from "@itwin/core-frontend";
import { CategoryVisibilityHandler, loadCategoriesFromViewport } from "./category-tree/CategoryVisibilityHandler";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";

/**
 * Toggles visibility of categories to show or hide.
 * @alpha
 */
export async function toggleAllCategories(viewManager: ViewManager, imodel: IModelConnection, display: boolean, viewport?: Viewport, forAllViewports?: boolean, filteredProvider?: IPresentationTreeDataProvider) {
  // istanbul ignore next
  const activeView = viewport ?? viewManager.getFirstOpenView();
  const ids = await getCategories(imodel, activeView, filteredProvider);

  // istanbul ignore else
  if (ids.length > 0) {
    CategoryVisibilityHandler.enableCategory(viewManager, imodel, ids, display, forAllViewports ?? false);
  }
}

/**
 * Gets ids of all categories or categories from filtered data provider.
 * @alpha
 */
export async function getCategories(imodel: IModelConnection, viewport?: Viewport, filteredProvider?: IPresentationTreeDataProvider) {
  if (filteredProvider) {
    const nodes = await filteredProvider.getNodes();
    return nodes.map((node) => CategoryVisibilityHandler.getInstanceIdFromTreeNodeKey(filteredProvider.getNodeKey(node)));
  }

  const categories = await loadCategoriesFromViewport(imodel, viewport);
  return categories.map((category) => category.key);
}
