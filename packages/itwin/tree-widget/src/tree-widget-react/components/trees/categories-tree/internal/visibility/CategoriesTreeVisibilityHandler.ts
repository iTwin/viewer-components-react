/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { getClassesByView } from "../../../common/internal/Utils.js";
import { TreeVisibilityHandler } from "../../../common/internal/visibility/TreeVisibilityHandler.js";
import { CategoriesNodesVisibilityStatusHandler } from "./CategoriesNodesVisibilityStatusHandler.js";
import { createFilteredTree } from "./FilteredTree.js";

import type { FilteredTree } from "../../../common/internal/visibility/TreeVisibilityHandler.js";
import type { Viewport } from "@itwin/core-frontend";
import type { HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { HierarchyVisibilityHandler } from "../../../common/UseHierarchyVisibility.js";
import type { CategoriesTreeHierarchyConfiguration } from "../../CategoriesTreeDefinition.js";
import type { CategoriesTreeIdsCache } from "../CategoriesTreeIdsCache.js";
import type { CategoriesTreeFilterTargets } from "./FilteredTree.js";

/**
 * @internal
 */
export interface CategoriesTreeVisibilityHandlerProps {
  viewport: Viewport;
  idsCache: CategoriesTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  filteredPaths?: HierarchyFilteringPath[];
  hierarchyConfig: CategoriesTreeHierarchyConfiguration;
}

/**
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
          return createFilteredTree({
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
      getNodesVisibilityStatusHandler: (info) => {
        return new CategoriesNodesVisibilityStatusHandler({
          alwaysAndNeverDrawnElementInfo: info,
          idsCache: _props.idsCache,
          viewport: _props.viewport,
        });
      },
      viewport: _props.viewport,
    });
  }
}
