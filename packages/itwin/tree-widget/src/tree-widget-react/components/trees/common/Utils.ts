/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { HierarchyFilteringPath, HierarchyNodeIdentifier } from "@itwin/presentation-hierarchies";
import { showAllCategories } from "./CategoriesVisibilityUtils.js";
import { enableCategoryDisplay, loadCategoriesFromViewport } from "./internal/VisibilityUtils.js";

import type { GuidString, Id64Array, Id64String } from "@itwin/core-bentley";
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
export function hideAllModels(models: string[], viewport: TreeWidgetViewport) {
  viewport.changeModelDisplay({ modelIds: models, display: false });
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
  viewport: TreeWidgetViewport;
  componentId?: GuidString;
}) {
  const { models, categories, viewport, componentId } = props;
  viewport.changeModelDisplay({ modelIds: models, display: true });
  viewport.clearNeverDrawn();
  viewport.clearAlwaysDrawn();
  if (categories) {
    await showAllCategories(categories, viewport);
  } else {
    const categoryInfos = await loadCategoriesFromViewport(viewport, componentId);
    if (categoryInfos.length === 0) {
      return;
    }
    const ids = categoryInfos.map((categoryInfo) => categoryInfo.categoryId);
    await enableCategoryDisplay(viewport, ids, true);
  }
}

/**
 * Inverts display of all given models.
 * @public
 */
export function invertAllModels(models: Id64Array, viewport: TreeWidgetViewport) {
  const notViewedModels = new Array<Id64String>();
  const viewedModels = new Array<Id64String>();
  models.forEach((modelId) => {
    if (viewport.viewsModel(modelId)) {
      viewedModels.push(modelId);
    } else {
      notViewedModels.push(modelId);
    }
  });
  viewport.changeModelDisplay({ modelIds: notViewedModels, display: true });
  viewport.changeModelDisplay({ modelIds: viewedModels, display: false });
}

/**
 * Based on the value of `enable` argument, either enables or disables display of given models.
 * @public
 */
export function toggleModels(models: string[], enable: boolean, viewport: TreeWidgetViewport) {
  if (!models) {
    return;
  }
  viewport.changeModelDisplay({ modelIds: models, display: enable });
}

/**
 * Checks if all given models are displayed in given viewport.
 * @public
 */
export function areAllModelsVisible(models: string[], viewport: TreeWidgetViewport) {
  return models.length !== 0 ? models.every((id) => viewport.viewsModel(id)) : false;
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
