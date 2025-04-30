/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Viewport } from "@itwin/core-frontend";
import { showAllCategories } from "./CategoriesVisibilityUtils.js";
import { toggleAllCategories } from "./internal/VisibilityUtils.js";

import type { Id64Array, Id64String } from "@itwin/core-bentley";

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
