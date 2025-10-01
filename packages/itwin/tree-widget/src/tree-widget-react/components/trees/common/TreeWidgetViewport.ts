/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { BeEvent, Id64Arg, Id64String } from "@itwin/core-bentley";
import { IModelConnection, PerModelCategoryVisibility, Viewport } from "@itwin/core-frontend";

/** @internal */
export function isTreeWidgetViewport(viewport: Viewport | TreeWidgetViewport): viewport is TreeWidgetViewport {
  return viewport instanceof Viewport ? false : true;
}

/** @internal */
export function createTreeWidgetViewport(viewport: Viewport): TreeWidgetViewport {
  return {
    get viewType() {
      return viewport.view.isSpatialView() ? "spatial" : viewport.view.is2d() ? "2d" : viewport.view.is3d() ? "3d" : "other";
    },
    get iModel() {
      return viewport.iModel;
    },
    viewsModel: (modelId) => viewport.view.viewsModel(modelId),
    addViewedModels: async (modelIds) => viewport.addViewedModels(modelIds),
    changeModelDisplay: (props) => viewport.changeModelDisplay(props.modelIds, props.display),
    viewsCategory: (categoryId) => viewport.view.viewsCategory(categoryId),
    changeCategoryDisplay: (props) => viewport.changeCategoryDisplay(props.categoryIds, props.display, props.enableAllSubCategories),
    viewsSubCategory: (subCategoryId) => viewport.view.isSubCategoryVisible(subCategoryId),
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

/** @alpha */
export interface TreeWidgetViewport {
  /** TODO */
  viewType: "2d" | "3d" | "spatial" | "other";
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
  /** Adds a set of models to the set of those currently displayed in this viewport.
   * @param modelIds The Ids of the models to add or remove.
   * @note If any of the requested models are not yet loaded this function will asynchronously load them before updating the set of displayed models.
   */
  addViewedModels(modelIds: Id64Arg): Promise<void>;
  /** Add or remove a set of models from those models currently displayed in this viewport.
   *
   * **NOTE** When turning model display to:
   * - `true`, model display should be turned on. This does not mean that any elements should be turned on, it only means that
   * model visibility does should not interfere with elements visibility.
   * - `false`, model display should be turned off. This means that all elements that have that model should not be displayed in the viewport.
   * @param modelIds The Ids of the models to add or remove.
   * @param display Whether or not to display the specified models in the viewport.
   * @returns
   * - `false` if change is unsuccessful;
   * - `true` if change is successful;
   */
  changeModelDisplay: (props: { modelIds: Id64Arg; display: boolean }) => boolean;
  /**
   * Should return true if category specified by `categoryId` is visible in the viewport.
   *
   * Category display should not take into account its' child elements or sub-categories display.
   *
   * When category is not displayed, all elements and sub-categories that have that category should not be shown in the viewport.
   */
  viewsCategory: (categoryId: Id64String) => boolean /**
   * Enable or disable display of elements belonging to a set of categories specified by Id.
   *
   * Visibility of individual sub-categories belonging to a category can be controlled separately through the use of [[changeSubCategoryDisplay]].
   *
   * By default, enabling display of a category does not affect display of sub-categories thereof which have been set to be invisible.
   *
   * Changing category visibility should not change per-model category overrides.
   *
   * **NOTE** When turning category display to:
   * - `true`, category display should be turned on. This means that any elements which have specified category should be turned on if model is visible,
   * category does not have per-model `hide` override and element is not in the [[neverDrawn]] list.
   * - `false`, category and its' sub-categories display should be turned off. This means that all elements with the category or sub-category should not be displayed in the viewport,
   * unless element has per-model category `Show` override, or is in the [[alwaysDrawn]] list.
   * @param categoryIds The Ids of the categories to add or remove.
   * @param display Whether or not to display the specified categories in the viewport.
   * @param enableAllSubCategories Whether or not to display the sub-categories in the viewport when display is set to `true`.
   */;
  changeCategoryDisplay: (props: { categoryIds: Id64Arg; display: boolean; enableAllSubCategories?: boolean }) => void;
  /**
   * Should return true if sub-category specified by `subCategoryId` is visible in the viewport.
   *
   * Sub-category display should not take into account its' child elements.
   *
   * When sub-category is not displayed, all elements that have that sub-category should not be shown in the viewport.
   */
  viewsSubCategory: (subCategoryId: Id64String) => boolean;
  /**
   * Enable or disable display of elements belonging to sub-category specified by Id.
   *
   * Changing sub-category display should not change category display.
   *
   * **NOTE** When turning sub-category display to:
   * - `true`, sub-category display should be turned on. This means that any elements which have specified sub-category should be turned on if model and category are visible,
   * category does not have per-model `hide` override and element is not in the [[neverDrawn]] list.
   * - `false`, sub-category display should be turned off. This means that all elements that have that sub-category should not be displayed in the viewport,
   * unless element has per-model category `Show` override, or is in the [[alwaysDrawn]] list.
   * @param subCategoryId The Id of the sub-category to add or remove.
   * @param display Whether or not to display the specified sub-category in the viewport.
   */
  changeSubCategoryDisplay: (props: { subCategoryId: Id64String; display: boolean }) => void;
  /**
   * Returns iterable visibility overrides objects.
   *
   * The returned value can be a custom object that has `Symbol.iterator` defined, or it can be a built in type like `Array` or `Set`.
   */
  perModelCategoryOverrides: Readonly<Iterable<{ modelId: Id64String; categoryId: Id64String; visible: boolean }>>;
  /** Should change the override state of one or more categories for one or more models. */
  setPerModelCategoryOverride: (props: { modelIds: Id64Arg; categoryIds: Id64Arg; override: PerModelCategoryVisibility.Override }) => void;
  /** Should return the per-model category override. */
  getPerModelCategoryOverride: (props: { modelId: Id64String; categoryId: Id64String }) => PerModelCategoryVisibility.Override;
  /** TODO */
  clearPerModelCategoryOverrides: (modelIds?: Id64Arg) => void;
  /**
   * Ids of elements which should not be displayed.
   *
   * This set takes precedence over model, category and sub-category display and per-model category override.
   * @note This set should take precedence over the [[alwaysDrawn]] set - if an element is present in both sets, it is never drawn.
   */
  neverDrawn: ReadonlySet<Id64String> | undefined;
  /**
   * Ids of elements which should not be displayed in the viewport, regardless of category and sub-category visibility.
   *
   * @param elementIds The Ids of the elements that should be displayed.
   */
  setNeverDrawn: (elementIds: Set<Id64String>) => void;
  /**
   * Clear the set of never-drawn elements.
   * @see [[neverDrawn]]
   */
  clearNeverDrawn: () => void;
  /**
   * Ids of elements which should be displayed.
   *
   * Elements in this set should be displayed only when model is displayed as well.
   *
   * This set takes precedence over category and sub-category display and per-model category override.
   * @note The [[neverDrawn]] set takes precedence - if an element is present in both sets, it is never drawn.
   */
  alwaysDrawn: ReadonlySet<Id64String> | undefined;
  /**
   * Ids of elements which should be displayed in the viewport, regardless of category and sub-category visibility.
   *
   * These elements should be displayed only when their models are displayed as well.
   * @param elementIds The Ids of the elements that should be displayed.
   * @param exclusive If true, *only* the specified elements should be drawn.
   */
  setAlwaysDrawn: (props: { elementIds: Set<Id64String>; exclusive?: boolean }) => void;
  /**
   * Clear the set of always-drawn elements.
   * @see [[alwaysDrawn]]
   */
  clearAlwaysDrawn: () => void;
  /** Should return true if elements in the [[alwaysDrawn]] set are the *only* elements that are displayed when their models are visible. */
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
   * It should also be raised when view changes from 2d to 3d and vice versa.
   */
  onDisplayStyleChanged: BeEvent<() => void>;
}
