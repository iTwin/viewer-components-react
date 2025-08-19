/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { getClassesByView } from "../../../common/internal/Utils.js";
import { TreeVisibilityHandler } from "../../../common/internal/visibility/TreeVisibilityHandler.js";
import { CategoriesTreeNodesVisibilityStatusHandler } from "./CategoriesTreeNodesVisibilityStatusHandler.js";
import { createFilteredCategoriesTree } from "./FilteredTree.js";

import type { Viewport } from "@itwin/core-frontend";
import type { HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { FilteredTree } from "../../../common/internal/visibility/BaseFilteredTree.js";
import type { HierarchyVisibilityHandler } from "../../../common/UseHierarchyVisibility.js";
import type { CategoriesTreeIdsCache } from "../CategoriesTreeIdsCache.js";
import type { CategoriesTreeFilterTargets } from "./FilteredTree.js";

/** @internal */
export interface CategoriesTreeVisibilityHandlerProps {
  viewport: Viewport;
  idsCache: CategoriesTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  filteredPaths?: HierarchyFilteringPath[];
}

/**
 * Creates a hierarchy visibility handler for categories tree.
 * @internal
 */
export function createCategoriesTreeVisibilityHandler(props: CategoriesTreeVisibilityHandlerProps): HierarchyVisibilityHandler & Disposable {
  return new CategoriesTreeVisibilityHandler(props);
}

class CategoriesTreeVisibilityHandler extends TreeVisibilityHandler<CategoriesTreeFilterTargets> {
  constructor(_props: CategoriesTreeVisibilityHandlerProps) {
    super({
      getFilteredTree: (): Promise<FilteredTree<CategoriesTreeFilterTargets>> | undefined => {
        if (_props.filteredPaths) {
          const { categoryClass, elementClass, modelClass } = getClassesByView(_props.viewport.view.is2d() ? "2d" : "3d");
          return createFilteredCategoriesTree({
            idsCache: _props.idsCache,
            filteringPaths: _props.filteredPaths,
            categoryClassName: categoryClass,
            categoryElementClassName: elementClass,
            categoryModelClassName: modelClass,
            imodelAccess: _props.imodelAccess,
          });
        }
        return undefined;
      },
      getTreeNodesVisibilityStatusHandler: (info, visibilityHandler) => {
        return new CategoriesTreeNodesVisibilityStatusHandler({
          alwaysAndNeverDrawnElementInfo: info,
          idsCache: _props.idsCache,
          viewport: _props.viewport,
          visibilityHandler,
        });
      },
      viewport: _props.viewport,
    });
  }
}
