/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useMemo } from "react";
import { useAsyncValue } from "@itwin/components-react";
import { loadCategoriesFromViewport } from "../common/CategoriesVisibilityUtils";

import type { IModelConnection, ViewManager, Viewport } from "@itwin/core-frontend";
import type { CategoryInfo } from "../common/CategoriesVisibilityUtils";

const EMPTY_CATEGORIES_ARRAY: CategoryInfo[] = [];

/**
 * Loads categories from viewport or uses provided list of categories.
 * @internal
 */
export function useCategories(viewManager: ViewManager, imodel: IModelConnection, view?: Viewport) {
  const currentView = view || viewManager.getFirstOpenView();
  const categoriesPromise = useMemo(async () => loadCategoriesFromViewport(imodel, currentView), [imodel, currentView]);
  return useAsyncValue(categoriesPromise) ?? EMPTY_CATEGORIES_ARRAY;
}
