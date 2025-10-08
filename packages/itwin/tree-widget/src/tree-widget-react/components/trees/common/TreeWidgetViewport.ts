/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Viewport } from "@itwin/core-frontend";

import type { BeEvent, Id64Arg, Id64String } from "@itwin/core-bentley";
import type { IModelConnection, PerModelCategoryVisibility } from "@itwin/core-frontend";

/** @internal */
export function createTreeWidgetViewport(viewport: Viewport | TreeWidgetViewport): TreeWidgetViewport {
  if (!(viewport instanceof Viewport)) {
    return viewport;
  }

  return {
    get viewType() {
      return viewport.view.is2d() ? "2d" : viewport.view.isSpatialView() ? "spatial" : "other";
    },
    get iModel() {
      return viewport.iModel;
    },
    viewsModel: (modelId) => viewport.view.viewsModel(modelId),
    addViewedModels: async (modelIds) => viewport.addViewedModels(modelIds),
    changeModelDisplay: (props) => viewport.changeModelDisplay(props.modelIds, props.display),
    viewsCategory: (categoryId) => viewport.view.viewsCategory(categoryId),
    changeCategoryDisplay: (props) => viewport.changeCategoryDisplay(props.categoryIds, props.display, props.enableAllSubCategories),
    viewsSubCategory: (subCategoryId) => viewport.isSubCategoryVisible(subCategoryId),
    changeSubCategoryDisplay: (props) => viewport.changeSubCategoryDisplay(props.subCategoryId, props.display),
    get perModelCategoryOverrides() {
      return viewport.perModelCategoryVisibility;
    },
    setPerModelCategoryOverride: (props) => viewport.perModelCategoryVisibility.setOverride(props.modelIds, props.categoryIds, props.override),
    getPerModelCategoryOverride: (props) => viewport.perModelCategoryVisibility.getOverride(props.modelId, props.categoryId),
    clearPerModelCategoryOverrides: (modelIds) => viewport.perModelCategoryVisibility.clearOverrides(modelIds),
    get neverDrawn() {
      return viewport.neverDrawn;
    },
    setNeverDrawn: (elementIds) => viewport.setNeverDrawn(elementIds),
    clearNeverDrawn: () => viewport.clearNeverDrawn(),
    get alwaysDrawn() {
      return viewport.alwaysDrawn;
    },
    setAlwaysDrawn: (props) => viewport.setAlwaysDrawn(props.elementIds, props.exclusive),
    clearAlwaysDrawn: () => viewport.clearAlwaysDrawn(),
    get isAlwaysDrawnExclusive() {
      return viewport.isAlwaysDrawnExclusive;
    },
    get onAlwaysDrawnChanged() {
      return viewport.onAlwaysDrawnChanged;
    },
    get onNeverDrawnChanged() {
      return viewport.onNeverDrawnChanged;
    },
    get onDisplayStyleChanged() {
      return viewport.view.onDisplayStyleChanged;
    },
    get onDisplayedModelsChanged() {
      return viewport.onViewedModelsChanged;
    },
    get onDisplayedCategoriesChanged() {
      return viewport.onViewedCategoriesChanged;
    },
    get onPerModelCategoriesOverridesChanged() {
      return viewport.onViewedCategoriesPerModelChanged;
    },
  };
}

/**
 * A simplified interface for a Viewport that is used by the Tree Widget to control and determine visibility.
 *
 * Viewport should only display elements. Since elements have model, category and sub-category assigned to them, each of these can affect element visibility.
 *
 * The order of precedence for visibility is:
 * 1. Model visibility - if model is not visible, elements from that model should never be displayed.
 * 2. `neverDrawn` set - elements in that set should never be displayed.
 * 3. `alwaysDrawn` set - elements in that set should always be displayed.
 * 4. Per-model category visibility overrides:
 * -  if a per-model-category has `Hide` override, elements which have that category and model should not be displayed.
 * -  if a per-model-category has `Show` override, elements which have that category and model should be displayed.
 * 5. Category and sub-category visibility - if element's category or sub-category is turned off, it should not be displayed.
 *
 * Based on this order of precedence, element can only be displayed in these scenarios:
 * - Model is visible *AND* element is in `alwaysDrawn` set.
 * - Model is visible *AND* element is not in `neverDrawn` set *AND* per-model category override is set to show `Show`.
 * - Model is visible *AND* element is not in `neverDrawn` set *AND* per-model category override is not set to `Hide` *AND* category and sub-category are visible.
 * @public
 */
export interface TreeWidgetViewport {
  /** The type of the view. Generally it should be either `spatial` or `2d`. */
  viewType: "2d" | "spatial" | "other";
  /** The iModel of this Viewport. */
  iModel: IModelConnection;
  /**
   * Should return true if model specified by `modelId` is visible in the viewport.
   *
   * Model display should not take into account its' child elements display.
   *
   * When model is not displayed, all elements that have that model should not be shown in the viewport.
   */
  viewsModel: (modelId: Id64String) => boolean;
  /** Should add models to the set of those currently displayed in this viewport. */
  addViewedModels(modelIds: Id64Arg): Promise<void>;
  /**
   * Should add or remove a set of models from those models currently displayed in this viewport.
   *
   * **NOTE** When turning model display to:
   * - `true`, model display should be turned on. This does not mean that any elements should be turned on, it only means that
   * model visibility should not interfere with elements visibility.
   * - `false`, model display should be turned off. All elements which have that model should not be displayed in the viewport.
   */
  changeModelDisplay: (props: { modelIds: Id64Arg; display: boolean }) => boolean;
  /**
   * Should return true if category specified by `categoryId` is visible in the viewport.
   *
   * Category display should not take into account its' child elements or sub-categories display.
   *
   * When category is not displayed, all elements and sub-categories which have that category should not be shown in the viewport.
   *
   * **NOTE** Elements might still be visible if per-model category `Show` override or `alwaysDrawn` set makes them visible.
   */
  viewsCategory: (categoryId: Id64String) => boolean;
  /**
   * Should enable or disable display of elements belonging to a set of categories specified by Id.
   *
   * Visibility of individual sub-categories belonging to a category can be controlled separately through the use of `changeSubCategoryDisplay`.
   *
   * By default, enabling display of a category does not affect display of sub-categories thereof which have been set to be invisible.
   *
   * Changing category visibility should not change per-model category overrides.
   *
   * **NOTE** When turning category display to:
   * - `true`, category display should be turned on. All elements which have specified category should be turned on if model is visible,
   * category does not have per-model `hide` override and element is not in the `neverDrawn` set.
   * - `false`, category and its' sub-categories display should be turned off. All elements which have that category should not be displayed in the viewport,
   * unless element has per-model category `Show` override, or is in the `alwaysDrawn` set.
   */
  changeCategoryDisplay: (props: { categoryIds: Id64Arg; display: boolean; enableAllSubCategories?: boolean }) => void;
  /**
   * Should return true if sub-category specified by `subCategoryId` is visible in the viewport.
   *
   * Sub-category display should not take into account its' child elements.
   *
   * When sub-category is not displayed, all elements that have that sub-category should not be shown in the viewport, unless they have per-model category `Show` override or are in the `alwaysDrawn` list.
   */
  viewsSubCategory: (subCategoryId: Id64String) => boolean;
  /**
   * Should enable or disable display of elements belonging to sub-category specified by Id.
   *
   * Changing sub-category display should not change category display.
   *
   * **NOTE** When turning sub-category display to:
   * - `true`, sub-category display should be turned on. All elements which have specified sub-category should be turned on if model and category are visible,
   * category does not have per-model `hide` override and element is not in the `neverDrawn` set.
   * - `false`, sub-category display should be turned off. All elements that have that sub-category should not be displayed in the viewport,
   * unless element has per-model category `Show` override, or is in the `alwaysDrawn` set.
   */
  changeSubCategoryDisplay: (props: { subCategoryId: Id64String; display: boolean }) => void;
  /** Returns an iterable of per-model-category overrides. */
  perModelCategoryOverrides: Readonly<Iterable<{ modelId: Id64String; categoryId: Id64String; visible: boolean }>>;
  /** Should change the override state of one or more categories for one or more models. */
  setPerModelCategoryOverride: (props: { modelIds: Id64Arg; categoryIds: Id64Arg; override: PerModelCategoryVisibility.Override }) => void;
  /** Should return the per-model category override. */
  getPerModelCategoryOverride: (props: { modelId: Id64String; categoryId: Id64String }) => PerModelCategoryVisibility.Override;
  /** Should remove per-model category override for the specified models. */
  clearPerModelCategoryOverrides: (modelIds?: Id64Arg) => void;
  /**
   * Ids of elements which should not be displayed.
   *
   * This set takes precedence over category and sub-category display and per-model category override.
   *
   * **NOTE** This set should take precedence over the [[alwaysDrawn]] set - if an element is present in both sets, it is never drawn.
   */
  neverDrawn: ReadonlySet<Id64String> | undefined;
  /**
   * Ids of elements which should not be displayed in the viewport, regardless of category and sub-category visibility.
   *
   * @param elementIds The Ids of the elements that should not be displayed.
   */
  setNeverDrawn: (elementIds: Set<Id64String>) => void;
  /** Should clear the set of never-drawn elements. */
  clearNeverDrawn: () => void;
  /**
   * Ids of elements which should be displayed.
   *
   * Elements in this set should be displayed only when model is displayed as well.
   *
   * This set takes precedence over category and sub-category display and per-model category override.
   *
   * **NOTE** The [[neverDrawn]] set takes precedence - if an element is present in both sets, it is never drawn.
   */
  alwaysDrawn: ReadonlySet<Id64String> | undefined;
  /**
   * Ids of elements which should be displayed in the viewport, regardless of category and sub-category visibility.
   *
   * These elements should be displayed only when their models are displayed as well.
   * @param elementIds The Ids of the elements that should be displayed.
   * @param exclusive If true, *only* the specified elements should be drawn. When this is set to true `isAlwaysDrawnExclusive` should return true, otherwise `isAlwaysDrawnExclusive` should return false.
   */
  setAlwaysDrawn: (props: { elementIds: Set<Id64String>; exclusive?: boolean }) => void;
  /** Should clear the set of always-drawn elements. */
  clearAlwaysDrawn: () => void;
  /**
   * Should return true if elements in the [[alwaysDrawn]] set are the *only* elements that are displayed when their models are visible.
   *
   * Should be set to true when `setAlwaysDrawn` is called with `exclusive` flag.
   *
   * Should be set to false when `setAlwaysDrawn` is called with `exclusive` set to false/undefined or when `clearAlwaysDrawn` is called.
   */
  readonly isAlwaysDrawnExclusive: boolean;
  /** Event that should be raised when set of always-drawn elements changes. */
  onAlwaysDrawnChanged: BeEvent<() => void>;
  /** Event that should be raised when set of never-drawn elements changes. */
  onNeverDrawnChanged: BeEvent<() => void>;
  /** Event that should be raised when per-model category overrides changes. */
  onPerModelCategoriesOverridesChanged: BeEvent<() => void>;
  /** Event that should be raised when category display changes. */
  onDisplayedCategoriesChanged: BeEvent<() => void>;
  /** Event that should be raised when model display changes. */
  onDisplayedModelsChanged: BeEvent<() => void>;
  /**
   * Event that should be raised when model, category or sub-category display changes.
   *
   * It should also be raised when view changes between `2d`, `3d`, `spatial` or `other`.
   */
  onDisplayStyleChanged: BeEvent<() => void>;
}
