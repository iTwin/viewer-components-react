/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { TreeVisibilityHandler } from "../../../common/internal/visibility/TreeVisibilityHandler.js";
import { ClassificationsTreeNodesVisibilityStatusHandler } from "./ClassificationsTreeNodesVisibilityStatusHandler.js";
import { createFilteredClassificationsTree } from "./FilteredTree.js";

import type { Viewport } from "@itwin/core-frontend";
import type { HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { FilteredTree } from "../../../common/internal/visibility/BaseFilteredTree.js";
import type { HierarchyVisibilityHandler } from "../../../common/UseHierarchyVisibility.js";
import type { ClassificationsTreeIdsCache } from "../ClassificationsTreeIdsCache.js";
import type { ClassificationsTreeFilterTargets } from "./FilteredTree.js";

/** @internal */
export interface ClassificationsTreeVisibilityHandlerProps {
  viewport: Viewport;
  idsCache: ClassificationsTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  filteredPaths?: HierarchyFilteringPath[];
}

/**
 * Creates a hierarchy visibility handler for classifications tree.
 * @internal
 */
export function createClassificationsTreeVisibilityHandler(props: ClassificationsTreeVisibilityHandlerProps): HierarchyVisibilityHandler & Disposable {
  return new ClassificationsTreeVisibilityHandler(props);
}

class ClassificationsTreeVisibilityHandler extends TreeVisibilityHandler<ClassificationsTreeFilterTargets> {
  constructor(_props: ClassificationsTreeVisibilityHandlerProps) {
    super({
      getFilteredTree: (): Promise<FilteredTree<ClassificationsTreeFilterTargets>> | undefined => {
        if (_props.filteredPaths) {
          return createFilteredClassificationsTree({
            idsCache: _props.idsCache,
            filteringPaths: _props.filteredPaths,
            imodelAccess: _props.imodelAccess,
          });
        }
        return undefined;
      },
      getTreeNodesVisibilityStatusHandler: (info, visibilityHandler) => {
        return new ClassificationsTreeNodesVisibilityStatusHandler({
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
