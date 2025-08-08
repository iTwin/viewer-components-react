/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { HierarchyFilteringPath, HierarchyNodeIdentifier } from "@itwin/presentation-hierarchies";
import { showAllCategories } from "./CategoriesVisibilityUtils.js";
import { toggleAllCategories } from "./internal/VisibilityUtils.js";

import type { Viewport } from "@itwin/core-frontend";
import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { HierarchyFilteringPathOptions, HierarchyNodeIdentifiersPath } from "@itwin/presentation-hierarchies";

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
export async function hideAllModels(models: string[], viewport: Viewport) {
  viewport.changeModelDisplay(models, false);
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
  viewport: Viewport;
}) {
  const { models, categories, viewport } = props;
  await viewport.addViewedModels(models);
  viewport.clearNeverDrawn();
  viewport.clearAlwaysDrawn();
  if (categories) {
    await showAllCategories(categories, viewport);
  } else {
    await toggleAllCategories(viewport, true);
  }
}

/**
 * Inverts display of all given models.
 * @public
 */
export async function invertAllModels(models: Id64Array, viewport: Viewport) {
  const notViewedModels = new Array<Id64String>();
  const viewedModels = new Array<Id64String>();
  models.forEach((modelId) => {
    if (viewport.viewsModel(modelId)) {
      viewedModels.push(modelId);
    } else {
      notViewedModels.push(modelId);
    }
  });
  await viewport.addViewedModels(notViewedModels);
  viewport.changeModelDisplay(viewedModels, false);
}

/**
 * Based on the value of `enable` argument, either enables or disables display of given models.
 * @public
 */
export async function toggleModels(models: string[], enable: boolean, viewport: Viewport) {
  if (!models) {
    return;
  }
  if (enable) {
    viewport.changeModelDisplay(models, false);
  } else {
    await viewport.addViewedModels(models);
  }
}

/**
 * Checks if all given models are displayed in given viewport.
 * @public
 */
export function areAllModelsVisible(models: string[], viewport: Viewport) {
  return models.length !== 0 ? models.every((id) => viewport.viewsModel(id)) : false;
}

/** @internal */
export function joinHierarchyFilteringPaths(subTreePaths: HierarchyNodeIdentifiersPath[], filteringPaths: HierarchyFilteringPath[]): HierarchyFilteringPath[] {
  const normalizedFilteringPaths = filteringPaths.map((filteringPath) => HierarchyFilteringPath.normalize(filteringPath));

  const result = new Array<HierarchyFilteringPath>();
  const filteringPathsToIncludeIndexes = new Set<number>();

  subTreePaths.forEach((subTreePath) => {
    let options: HierarchyFilteringPathOptions | undefined;
    let addSubTreePathToResult = false;

    for (let i = 0; i < normalizedFilteringPaths.length; ++i) {
      const normalizedFilteringPath = normalizedFilteringPaths[i];
      if (normalizedFilteringPath.path.length === 0) {
        continue;
      }

      for (let j = 0; j < subTreePath.length; ++j) {
        const identifier = subTreePath[j];
        if (normalizedFilteringPath.path.length <= j || !HierarchyNodeIdentifier.equal(normalizedFilteringPath.path[j], identifier)) {
          break;
        }

        // filtering paths that are shorter or equal than subTree paths length don't need to be added to the result
        if (normalizedFilteringPath.path.length === j + 1) {
          addSubTreePathToResult = true;
          // If filtering path has autoExpand set to true, it means that we should expand only to the targeted filtered node
          // This is done by setting depthInPath
          options =
            normalizedFilteringPath.options?.autoExpand !== true
              ? HierarchyFilteringPath.mergeOptions(options, normalizedFilteringPath.options)
              : { autoExpand: { depthInPath: normalizedFilteringPath.path.length } };
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
    result.push(normalizedFilteringPaths[index]);
  }
  return result;
}
