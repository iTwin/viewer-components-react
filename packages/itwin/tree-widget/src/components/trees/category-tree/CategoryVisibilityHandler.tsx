/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useMemo } from "react";
import { useAsyncValue } from "@itwin/components-react";
import { BeEvent } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import { NodeKey } from "@itwin/presentation-common";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";
import { enableCategory, enableSubCategory, loadCategoriesFromViewport } from "../CategoriesVisibilityUtils";
import type { CategoryInfo } from "./CategoriesTreeButtons";

import type { TreeNodeItem } from "@itwin/components-react";
import type { IModelConnection, ViewManager, Viewport } from "@itwin/core-frontend";
import type { IVisibilityHandler, VisibilityChangeListener, VisibilityStatus } from "../VisibilityTreeEventHandler";
const EMPTY_CATEGORIES_ARRAY: CategoryInfo[] = [];

/**
 * Loads categories from viewport or uses provided list of categories.
 * @internal
 */
export function useCategories(viewManager: ViewManager, imodel: IModelConnection, view?: Viewport) {
  const currentView = view || viewManager.getFirstOpenView();
  const categoriesPromise = useMemo(async () => loadCategoriesFromViewport(imodel, currentView), [imodel, currentView]);
  return useAsyncValue(categoriesPromise) ?? EMPTY_CATEGORIES_ARRAY;
}

/**
 * Params for creating a [[CategoryVisibilityHandler]].
 * @public
 */
export interface CategoryVisibilityHandlerParams {
  viewManager: ViewManager;
  imodel: IModelConnection;
  categories: CategoryInfo[];
  activeView: Viewport;
  allViewports?: boolean;
}

/**
 * An [[IVisibilityHandler]] implementation that knows how to determine and change visibility of categories
 * and subcategories.
 * @public
 */
export class CategoryVisibilityHandler implements IVisibilityHandler {
  private _viewManager: ViewManager;
  private _imodel: IModelConnection;
  private _pendingVisibilityChange: any | undefined;
  private _activeView: Viewport;
  private _useAllViewports: boolean;
  private _categories: CategoryInfo[];

  constructor(params: CategoryVisibilityHandlerParams) {
    this._viewManager = params.viewManager;
    this._imodel = params.imodel;
    this._activeView = params.activeView;
    // istanbul ignore next
    this._useAllViewports = params.allViewports ?? false;
    this._categories = params.categories;
    this._activeView.onDisplayStyleChanged.addListener(this.onDisplayStyleChanged);
    this._activeView.onViewedCategoriesChanged.addListener(this.onViewedCategoriesChanged);
  }

  public dispose() {
    this._activeView.onDisplayStyleChanged.removeListener(this.onDisplayStyleChanged);
    this._activeView.onViewedCategoriesChanged.removeListener(this.onViewedCategoriesChanged);
    clearTimeout(this._pendingVisibilityChange);
  }

  public onVisibilityChange = new BeEvent<VisibilityChangeListener>();

  public getVisibilityStatus(node: TreeNodeItem): VisibilityStatus {
    const nodeKey = isPresentationTreeNodeItem(node) ? node.key : undefined;
    if (!nodeKey) {
      return { state: "hidden", isDisabled: true };
    }

    const instanceId = CategoryVisibilityHandler.getInstanceIdFromTreeNodeKey(nodeKey);
    return { state: node.parentId ? this.getSubCategoryVisibility(instanceId) : this.getCategoryVisibility(instanceId) };
  }

  public async changeVisibility(node: TreeNodeItem, shouldDisplay: boolean): Promise<void> {
    const nodeKey = isPresentationTreeNodeItem(node) ? node.key : undefined;
    if (!nodeKey) {
      return;
    }

    // handle subcategory visibility change
    if (node.parentId) {
      const childId = CategoryVisibilityHandler.getInstanceIdFromTreeNodeKey(nodeKey);
      // istanbul ignore next
      const parentId = this.getParent(childId)?.categoryId;

      // make sure parent category is enabled
      if (shouldDisplay && parentId) {
        await this.enableCategory([parentId], true, false);
      }

      this.enableSubCategory(childId, shouldDisplay);
      return;
    }

    const instanceId = CategoryVisibilityHandler.getInstanceIdFromTreeNodeKey(nodeKey);
    await this.enableCategory([instanceId], shouldDisplay, true);
  }

  public getSubCategoryVisibility(id: string) {
    const parentItem = this.getParent(id);
    if (!parentItem) {
      return "hidden";
    }

    const isVisible = this._activeView.view.viewsCategory(parentItem.categoryId) && this._activeView.isSubCategoryVisible(id);
    return isVisible ? "visible" : "hidden";
  }

  public getCategoryVisibility(id: string) {
    return this._activeView.view.viewsCategory(id) ? "visible" : "hidden";
  }

  public getParent(key: string): CategoryInfo | undefined {
    for (const category of this._categories) {
      // istanbul ignore else
      if (category.subCategoryIds && category.subCategoryIds.indexOf(key) !== -1) {
        return category;
      }
    }

    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private onDisplayStyleChanged = () => {
    this.onVisibilityChangeInternal();
  };

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private onViewedCategoriesChanged = () => {
    this.onVisibilityChangeInternal();
  };

  private onVisibilityChangeInternal() {
    if (this._pendingVisibilityChange) {
      return;
    }

    this._pendingVisibilityChange = setTimeout(() => {
      this.onVisibilityChange.raiseEvent();
      this._pendingVisibilityChange = undefined;
    }, 0);
  }

  public static getInstanceIdFromTreeNodeKey(nodeKey: NodeKey) {
    return NodeKey.isInstancesNodeKey(nodeKey) && nodeKey.instanceKeys.length > 0 ? nodeKey.instanceKeys[0].id : /* istanbul ignore next */ "";
  }

  public async enableCategory(ids: string[], enabled: boolean, enableAllSubCategories = true) {
    await enableCategory(this._viewManager, this._imodel, ids, enabled, this._useAllViewports, enableAllSubCategories);
  }

  public enableSubCategory(key: string, enabled: boolean) {
    enableSubCategory(this._viewManager, key, enabled, this._useAllViewports);
  }
}

/**
 * Enable display of all given categories.
 * @public
 */
export async function showAllCategories(categories: string[], viewport: Viewport) {
  await enableCategory(IModelApp.viewManager, viewport.iModel, categories, true, true);
}

/**
 * Disable display of all given categories.
 * @public
 */
export async function hideAllCategories(categories: string[], viewport: Viewport) {
  await enableCategory(IModelApp.viewManager, viewport.iModel, categories, false, true);
}

/**
 * Invert display of all given categories.
 * @public
 */
export async function invertAllCategories(categories: CategoryInfo[], viewport: Viewport) {
  const enabled: string[] = [];
  const disabled: string[] = [];
  const enabledSubCategories: string[] = [];
  const disabledSubCategories: string[] = [];

  for (const category of categories) {
    if (!viewport.view.viewsCategory(category.categoryId)) {
      disabled.push(category.categoryId);
      continue;
    }
    // First, we need to check if at least one subcategory is disabled. If it is true, then only subcategories should change display, not categories.
    if (category.subCategoryIds?.some((subCategory) => !viewport.isSubCategoryVisible(subCategory))) {
      for (const subCategory of category.subCategoryIds) {
        viewport.isSubCategoryVisible(subCategory) ? enabledSubCategories.push(subCategory) : disabledSubCategories.push(subCategory);
      }
    } else {
      enabled.push(category.categoryId);
    }
  }

  // Disable enabled
  enabledSubCategories.forEach((subCategory) => enableSubCategory(IModelApp.viewManager, subCategory, false, true));

  await enableCategory(IModelApp.viewManager, viewport.iModel, enabled, false, true);

  // Enable disabled
  disabledSubCategories.forEach((subCategory) => enableSubCategory(IModelApp.viewManager, subCategory, true, true));

  await enableCategory(IModelApp.viewManager, viewport.iModel, disabled, true, true);
}
