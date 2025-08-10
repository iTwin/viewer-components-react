/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { FilteredTree } from "../../../common/internal/visibility/TreeVisibilityHandler.js";
import { TreeVisibilityHandler } from "../../../common/internal/visibility/TreeVisibilityHandler.js";
import { createFilteredTree } from "./FilteredTree.js";
import { ModelsNodesVisibilityStatusHandler } from "./ModelsNodesVisibilityStatusHandler.js";

import type { GroupingHierarchyNode, HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { Viewport } from "@itwin/core-frontend";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { ModelsTreeIdsCache } from "../ModelsTreeIdsCache.js";
import type { ModelsTreeFilterTargets } from "./FilteredTree.js";
import type { HierarchyVisibilityHandler, HierarchyVisibilityHandlerOverridableMethod, VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";

/** @beta */
interface GetCategoryVisibilityStatusProps {
  categoryIds: Id64Arg;
  modelId: Id64String;
}

/** @beta */
interface ChangeCategoryVisibilityStateProps extends GetCategoryVisibilityStatusProps {
  on: boolean;
}

/** @beta */
interface GetGeometricElementVisibilityStatusProps {
  elementId: Id64String;
  modelId: Id64String;
  categoryId: Id64String;
}

/** @beta */
interface ChangeGeometricElementsDisplayStateProps {
  elementIds: Id64Set;
  modelId: Id64String;
  categoryId: Id64String;
  on: boolean;
}

/** @beta */
interface ChangeModelVisibilityStateProps {
  ids: Id64Arg;
  on: boolean;
}

/**
 * Functionality of Models tree visibility handler that can be overridden.
 * Each callback is provided original implementation and reference to a `HierarchyVisibilityHandler`.
 * @beta
 */
export interface ModelsTreeVisibilityHandlerOverrides {
  getSubjectNodeVisibility?: HierarchyVisibilityHandlerOverridableMethod<(props: { ids: Id64Array }) => Promise<VisibilityStatus>>;
  getModelDisplayStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: { ids: Id64Arg }) => Promise<VisibilityStatus>>;
  getCategoryDisplayStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: GetCategoryVisibilityStatusProps) => Promise<VisibilityStatus>>;
  getElementGroupingNodeDisplayStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: { node: GroupingHierarchyNode }) => Promise<VisibilityStatus>>;
  getElementDisplayStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: GetGeometricElementVisibilityStatusProps) => Promise<VisibilityStatus>>;

  changeSubjectNodeState?: HierarchyVisibilityHandlerOverridableMethod<(props: { ids: Id64Array; on: boolean }) => Promise<void>>;
  changeModelState?: HierarchyVisibilityHandlerOverridableMethod<(props: ChangeModelVisibilityStateProps) => Promise<void>>;
  changeCategoryState?: HierarchyVisibilityHandlerOverridableMethod<(props: ChangeCategoryVisibilityStateProps) => Promise<void>>;
  changeElementGroupingNodeState?: HierarchyVisibilityHandlerOverridableMethod<(props: { node: GroupingHierarchyNode; on: boolean }) => Promise<void>>;
  changeElementsState?: HierarchyVisibilityHandlerOverridableMethod<(props: ChangeGeometricElementsDisplayStateProps) => Promise<void>>;
}

/**
 * Props for `createModelsTreeVisibilityHandler`.
 * @internal
 */
export interface ModelsTreeVisibilityHandlerProps {
  viewport: Viewport;
  idsCache: ModelsTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  overrides?: ModelsTreeVisibilityHandlerOverrides;
  filteredPaths?: HierarchyFilteringPath[];
}

/**
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
          return createFilteredTree({
            filteringPaths: _props.filteredPaths,
            imodelAccess: _props.imodelAccess,
          });
        }
        return undefined;
      },
      getNodesVisibilityStatusHandler: (info) => {
        return new ModelsNodesVisibilityStatusHandler({
          alwaysAndNeverDrawnElementInfo: info,
          idsCache: _props.idsCache,
          viewport: _props.viewport,
        });
      },
      viewport: _props.viewport,
    });
  }
}
