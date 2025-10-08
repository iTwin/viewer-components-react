/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { HierarchyFilteringPath, HierarchyNodeIdentifier } from "@itwin/presentation-hierarchies";
import { showAllCategories } from "./CategoriesVisibilityUtils.js";
import { toggleAllCategories } from "./internal/VisibilityUtils.js";
import { createTreeWidgetViewport } from "./TreeWidgetViewport.js";

import type { Viewport } from "@itwin/core-frontend";
import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { HierarchyFilteringPathOptions, HierarchyNodeIdentifiersPath } from "@itwin/presentation-hierarchies";
import type { TreeWidgetViewport } from "./TreeWidgetViewport.js";

/**
 * This is a logging namespace for public log messages that may be interesting to consumers.
 * @internal
 */
export const LOGGING_NAMESPACE = "TreeWidget";

/** @beta */
export type FunctionProps<THook extends (props: any) => any> = Parameters<THook>[0];

/**
 * Disables display of all given models.
 * @public
 */
export async function hideAllModels(models: string[], viewport: Viewport | TreeWidgetViewport) {
  createTreeWidgetViewport(viewport).changeModelDisplay({ modelIds: models, display: false });
}

/**
 * Enables display of all given models. Also enables display of all categories and clears always and
 * never drawn lists in the viewport.
 * @public
 */
export async function showAll(props: {
  /** ID's of models to enable */
  models: Id64Array;
  /** ID's of categories to enable, if set to undefined, all categories will be enabled */
  categories?: Id64Array;
  viewport: Viewport | TreeWidgetViewport;
}) {
  const { models, categories, viewport } = props;
  const treeWidgetViewport = createTreeWidgetViewport(viewport);
  await treeWidgetViewport.addViewedModels(models);
  treeWidgetViewport.clearNeverDrawn();
  treeWidgetViewport.clearAlwaysDrawn();
  if (categories) {
    await showAllCategories(categories, treeWidgetViewport);
  } else {
    await toggleAllCategories(treeWidgetViewport, true);
  }
}

/**
 * Inverts display of all given models.
 * @public
 */
export async function invertAllModels(models: Id64Array, viewport: Viewport | TreeWidgetViewport) {
  const treeWidgetViewport = createTreeWidgetViewport(viewport);
  const notViewedModels = new Array<Id64String>();
  const viewedModels = new Array<Id64String>();
  models.forEach((modelId) => {
    if (treeWidgetViewport.viewsModel(modelId)) {
      viewedModels.push(modelId);
    } else {
      notViewedModels.push(modelId);
    }
  });
  await treeWidgetViewport.addViewedModels(notViewedModels);
  treeWidgetViewport.changeModelDisplay({ modelIds: viewedModels, display: false });
}

/**
 * Based on the value of `enable` argument, either enables or disables display of given models.
 * @public
 */
export async function toggleModels(models: string[], enable: boolean, viewport: Viewport | TreeWidgetViewport) {
  const treeWidgetViewport = createTreeWidgetViewport(viewport);
  if (!models) {
    return;
  }
  if (enable) {
    treeWidgetViewport.changeModelDisplay({ modelIds: models, display: false });
  } else {
    await treeWidgetViewport.addViewedModels(models);
  }
}

/**
 * Checks if all given models are displayed in given viewport.
 * @public
 */
export function areAllModelsVisible(models: string[], viewport: Viewport | TreeWidgetViewport) {
  const treeWidgetViewport = createTreeWidgetViewport(viewport);
  return models.length !== 0 ? models.every((id) => treeWidgetViewport.viewsModel(id)) : false;
}

/** @public */
export type NormalizedHierarchyFilteringPath = ReturnType<(typeof HierarchyFilteringPath)["normalize"]>;

/** @internal */
export function joinHierarchyFilteringPaths(
  subTreePaths: HierarchyNodeIdentifiersPath[],
  filteringPaths: NormalizedHierarchyFilteringPath[],
): NormalizedHierarchyFilteringPath[] {
  const result = new Array<NormalizedHierarchyFilteringPath>();
  const filteringPathsToIncludeIndexes = new Set<number>();

  subTreePaths.forEach((subTreePath) => {
    let options: HierarchyFilteringPathOptions | undefined;
    let addSubTreePathToResult = false;

    for (let i = 0; i < filteringPaths.length; ++i) {
      const filteringPath = filteringPaths[i];
      if (filteringPath.path.length === 0) {
        continue;
      }

      for (let j = 0; j < subTreePath.length; ++j) {
        const identifier = subTreePath[j];
        if (filteringPath.path.length <= j || !HierarchyNodeIdentifier.equal(filteringPath.path[j], identifier)) {
          break;
        }

        // filtering paths that are shorter or equal than subTree paths length don't need to be added to the result
        if (filteringPath.path.length === j + 1) {
          addSubTreePathToResult = true;
          // If filtering path has autoExpand set to true, it means that we should expand only to the targeted filtered node
          // This is done by setting depthInPath
          options =
            filteringPath.options?.autoExpand !== true
              ? HierarchyFilteringPath.mergeOptions(options, filteringPath.options)
              : { autoExpand: { depthInPath: filteringPath.path.length } };
          break;
        }

        // filtering paths that are longer than subTree paths need to be added to the result
        if (subTreePath.length === j + 1) {
          addSubTreePathToResult = true;
          filteringPathsToIncludeIndexes.add(i);
        }
      }
    }

    if (addSubTreePathToResult) {
      result.push({
        path: subTreePath,
        options,
      });
    }
  });
  for (const index of filteringPathsToIncludeIndexes) {
    result.push(filteringPaths[index]);
  }
  return result;
}
