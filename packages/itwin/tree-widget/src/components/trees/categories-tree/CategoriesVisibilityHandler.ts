/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { BeEvent } from "@itwin/core-bentley";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { enableCategoryDisplay, enableSubCategoryDisplay } from "../common/CategoriesVisibilityUtils";

import type { CategoryInfo } from "../common/CategoriesVisibilityUtils";
import type { IModelConnection, ViewManager, Viewport } from "@itwin/core-frontend";
import type { HierarchyVisibilityHandler, VisibilityStatus } from "../common/UseHierarchyVisibility";

interface CategoriesVisibilityHandlerProps {
  viewManager: ViewManager;
  imodel: IModelConnection;
  categories: CategoryInfo[];
  viewport: Viewport;
  allViewports?: boolean;
}

/** @internal */
export class CategoriesVisibilityHandler implements HierarchyVisibilityHandler {
  private _viewManager: ViewManager;
  private _imodel: IModelConnection;
  private _pendingVisibilityChange: any | undefined;
  private _viewport: Viewport;
  private _useAllViewports: boolean;

  constructor(props: CategoriesVisibilityHandlerProps) {
    this._viewManager = props.viewManager;
    this._imodel = props.imodel;
    this._viewport = props.viewport;
    // istanbul ignore next
    this._useAllViewports = props.allViewports ?? false;
    this._viewport.onDisplayStyleChanged.addListener(this.onDisplayStyleChanged);
    this._viewport.onViewedCategoriesChanged.addListener(this.onViewedCategoriesChanged);
  }

  public dispose() {
    this._viewport.onDisplayStyleChanged.removeListener(this.onDisplayStyleChanged);
    this._viewport.onViewedCategoriesChanged.removeListener(this.onViewedCategoriesChanged);
    clearTimeout(this._pendingVisibilityChange);
  }

  public onVisibilityChange = new BeEvent();

  /** Returns visibility status of the tree node. */
  public getVisibilityStatus(node: HierarchyNode): Promise<VisibilityStatus> | VisibilityStatus {
    if (!HierarchyNode.isInstancesNode(node)) {
      return { state: "hidden", isDisabled: true };
    }
    return { state: node.parentKeys.length ? this.getSubCategoryVisibility(node) : this.getCategoryVisibility(node) };
  }

  public async changeVisibility(node: HierarchyNode, on: boolean) {
    if (!HierarchyNode.isInstancesNode(node)) {
      return;
    }

    // handle subcategory visibility change
    if (node.parentKeys.length) {
      const childId = CategoriesVisibilityHandler.getInstanceIdFromHierarchyNode(node);
      const parentCategoryId = node.extendedData?.categoryId;

      // make sure parent category is enabled
      if (on && parentCategoryId) {
        await this.enableCategory([parentCategoryId], true, false);
      }

      this.enableSubCategory(childId, on);
      return;
    }

    const instanceId = CategoriesVisibilityHandler.getInstanceIdFromHierarchyNode(node);
    await this.enableCategory([instanceId], on, true);
  }

  public getSubCategoryVisibility(node: HierarchyNode) {
    const parentCategoryId = node.extendedData?.categoryId;
    if (!parentCategoryId) {
      return "hidden";
    }

    const subcategoryId = CategoriesVisibilityHandler.getInstanceIdFromHierarchyNode(node);
    const isVisible = this._viewport.view.viewsCategory(parentCategoryId) && this._viewport.isSubCategoryVisible(subcategoryId);
    return isVisible ? "visible" : "hidden";
  }

  public getCategoryVisibility(node: HierarchyNode) {
    const instanceId = CategoriesVisibilityHandler.getInstanceIdFromHierarchyNode(node);
    return this._viewport.view.viewsCategory(instanceId) ? "visible" : "hidden";
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

  public static getInstanceIdFromHierarchyNode(node: HierarchyNode) {
    return HierarchyNode.isInstancesNode(node) && node.key.instanceKeys.length > 0 ? node.key.instanceKeys[0].id : /* istanbul ignore next */ "";
  }

  public async enableCategory(ids: string[], enabled: boolean, enableAllSubCategories = true) {
    await enableCategoryDisplay(this._viewManager, this._imodel, ids, enabled, this._useAllViewports, enableAllSubCategories);
  }

  public enableSubCategory(key: string, enabled: boolean) {
    enableSubCategoryDisplay(this._viewManager, key, enabled, this._useAllViewports);
  }
}
