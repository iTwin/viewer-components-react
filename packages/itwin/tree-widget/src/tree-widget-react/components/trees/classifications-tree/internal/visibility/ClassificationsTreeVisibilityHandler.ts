/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { TreeVisibilityHandler } from "../../../common/internal/visibility/TreeVisibilityHandler.js";
import { ClassificationsNodesVisibilityStatusHandler } from "./ClassificationsNodesVisibilityStatusHandler.js";
import { createFilteredTree } from "./FilteredTree.js";

import type { ClassificationsTreeFilterTargets } from "./FilteredTree.js";
import type { FilteredTree } from "../../../common/internal/visibility/TreeVisibilityHandler.js";
import type { Viewport } from "@itwin/core-frontend";
import type { HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { HierarchyVisibilityHandler } from "../../../common/UseHierarchyVisibility.js";
import type { ClassificationsTreeIdsCache } from "../ClassificationsTreeIdsCache.js";

/**
 * @internal
 */
export interface ClassificationsTreeVisibilityHandlerProps {
  viewport: Viewport;
  idsCache: ClassificationsTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  filteredPaths?: HierarchyFilteringPath[];
}

/**
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
          return createFilteredTree({
            idsCache: _props.idsCache,
            filteringPaths: _props.filteredPaths,
            imodelAccess: _props.imodelAccess,
          });
        }
        return undefined;
      },
      getNodesVisibilityStatusHandler: (info) => {
        return new ClassificationsNodesVisibilityStatusHandler({
          alwaysAndNeverDrawnElementInfo: info,
          idsCache: _props.idsCache,
          viewport: _props.viewport,
        });
      },
      viewport: _props.viewport,
    });
  }
}
