/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { TreeVisibilityHandler } from "../../../common/internal/visibility/TreeVisibilityHandler.js";
import { createFilteredModelsTree } from "./FilteredTree.js";
import { ModelsTreeNodesVisibilityStatusHandler } from "./ModelsTreeNodesVisibilityStatusHandler.js";

import type { Id64Arg } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { GroupingHierarchyNode, HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { BaseTreeVisibilityHandlerOverrides } from "../../../common/internal/visibility/TreeVisibilityHandler.js";
import type { FilteredTree } from "../../../common/internal/visibility/BaseFilteredTree.js";
import type { HierarchyVisibilityHandler, HierarchyVisibilityHandlerOverridableMethod, VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { ModelsTreeIdsCache } from "../ModelsTreeIdsCache.js";
import type { ModelsTreeFilterTargets } from "./FilteredTree.js";

/**
 * Functionality of Models tree visibility handler that can be overridden.
 * Each callback is provided original implementation and reference to a `HierarchyVisibilityHandler`.
 * @beta
 */
export interface ModelsTreeVisibilityHandlerOverrides extends BaseTreeVisibilityHandlerOverrides {
  getSubjectsVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: { subjectIds: Id64Arg }) => Promise<VisibilityStatus>>;
  getElementGroupingNodeVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: { node: GroupingHierarchyNode }) => Promise<VisibilityStatus>>;

  changeSubjectsVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: { subjectIds: Id64Arg; on: boolean }) => Promise<void>>;
  changeElementGroupingNodeVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<
    (props: { node: GroupingHierarchyNode; on: boolean }) => Promise<void>
  >;
}

/** @internal */
export interface ModelsTreeVisibilityHandlerProps {
  viewport: Viewport;
  idsCache: ModelsTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  overrides?: ModelsTreeVisibilityHandlerOverrides;
  filteredPaths?: HierarchyFilteringPath[];
}

/**
 * Creates a hierarchy visibility handler for models tree.
 * @internal
 */
export function createModelsTreeVisibilityHandler(props: ModelsTreeVisibilityHandlerProps): HierarchyVisibilityHandler & Disposable {
  return new ModelsTreeVisibilityHandler(props);
}

class ModelsTreeVisibilityHandler extends TreeVisibilityHandler<ModelsTreeFilterTargets> {
  constructor(_props: ModelsTreeVisibilityHandlerProps) {
    super({
      getFilteredTree: (): Promise<FilteredTree<ModelsTreeFilterTargets>> | undefined => {
        if (_props.filteredPaths) {
          return createFilteredModelsTree({
            filteringPaths: _props.filteredPaths,
            imodelAccess: _props.imodelAccess,
          });
        }
        return undefined;
      },
      getTreeNodesVisibilityStatusHandler: (info, visibilityHandler) => {
        return new ModelsTreeNodesVisibilityStatusHandler({
          alwaysAndNeverDrawnElementInfo: info,
          idsCache: _props.idsCache,
          viewport: _props.viewport,
          visibilityHandler,
          overrides: _props.overrides,
        });
      },
      viewport: _props.viewport,
    });
  }
}
