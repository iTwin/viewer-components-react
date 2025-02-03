/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { BeEvent } from "@itwin/core-bentley";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { enableCategoryDisplay, enableSubCategoryDisplay } from "../../common/CategoriesVisibilityUtils.js";
import { createVisibilityStatus } from "../../common/Tooltip.js";
import { CategoriesTreeNode } from "./CategoriesTreeNode.js";

import type { Id64Array } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { HierarchyVisibilityHandler, VisibilityStatus } from "../../common/UseHierarchyVisibility.js";
import type { CategoriesTreeIdsCache } from "./CategoriesTreeIdsCache.js";

/** @internal */
export interface CategoriesVisibilityHandlerProps {
  viewport: Viewport;
  idsCache: CategoriesTreeIdsCache;
}

/** @internal */
export class CategoriesVisibilityHandler implements HierarchyVisibilityHandler {
  private _pendingVisibilityChange: any;
  private _viewport: Viewport;
  private _idsCache: CategoriesTreeIdsCache;

  constructor(props: CategoriesVisibilityHandlerProps) {
    this._idsCache = props.idsCache;
    this._viewport = props.viewport;
    this._viewport.onDisplayStyleChanged.addListener(this.onDisplayStyleChanged);
    this._viewport.onViewedCategoriesChanged.addListener(this.onViewedCategoriesChanged);
  }

  public dispose() {
    this[Symbol.dispose]();
  }

  public [Symbol.dispose]() {
    this._viewport.onDisplayStyleChanged.removeListener(this.onDisplayStyleChanged);
    this._viewport.onViewedCategoriesChanged.removeListener(this.onViewedCategoriesChanged);
    clearTimeout(this._pendingVisibilityChange);
  }

  public onVisibilityChange = new BeEvent();

  /** Returns visibility status of the tree node. */
  public async getVisibilityStatus(node: HierarchyNode): Promise<VisibilityStatus> {
    if (!HierarchyNode.isInstancesNode(node)) {
      return { state: "hidden", isDisabled: true };
    }

    if (CategoriesTreeNode.isSubCategoryNode(node)) {
      return createVisibilityStatus(this.getSubCategoryVisibility(node));
    }

    if (CategoriesTreeNode.isCategoryNode(node)) {
      return createVisibilityStatus(await this.getCategoriesVisibility(CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node)));
    }

    if (CategoriesTreeNode.isDefinitionContainerNode(node)) {
      return createVisibilityStatus(await this.getDefinitionContainerVisibility(node));
    }

    return { state: "hidden", isDisabled: true };
  }

  public async changeVisibility(node: HierarchyNode, on: boolean) {
    if (!HierarchyNode.isInstancesNode(node)) {
      return;
    }

    if (CategoriesTreeNode.isCategoryNode(node)) {
      return this.changeCategoryVisibility(node, on);
    }

    if (CategoriesTreeNode.isSubCategoryNode(node)) {
      return this.changeSubCategoryVisibility(node, on);
    }

    if (CategoriesTreeNode.isDefinitionContainerNode(node)) {
      return this.changeDefinitionContainerVisibility(node, on);
    }
  }

  private getSubCategoryVisibility(node: HierarchyNode): VisibilityStatus["state"] {
    const parentCategoryId = node.extendedData?.categoryId;
    if (!parentCategoryId) {
      return "hidden";
    }

    const categoryOverrideResult = this.getCategoryVisibilityFromOverrides(parentCategoryId);
    if (categoryOverrideResult === "hidden" || categoryOverrideResult === "visible") {
      return categoryOverrideResult;
    }

    const subcategoryIds = CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node);
    const isVisible = subcategoryIds.every((id) => this._viewport.isSubCategoryVisible(id)) && this._viewport.view.viewsCategory(parentCategoryId);
    return isVisible ? "visible" : "hidden";
  }

  private async getDefinitionContainerVisibility(node: HierarchyNode): Promise<VisibilityStatus["state"]> {
    const childrenResult = this._idsCache.getAllContainedCategories(CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node));
    let hiddenCount = 0;
    let visibleCount = 0;
    for (const categoryId of await childrenResult) {
      const categoryVisibility = await this.getCategoriesVisibility([categoryId]);
      if (categoryVisibility === "partial") {
        return "partial";
      }

      if (categoryVisibility === "hidden") {
        ++hiddenCount;
      } else {
        ++visibleCount;
      }

      if (hiddenCount > 0 && visibleCount > 0) {
        return "partial";
      }
    }

    return hiddenCount > 0 ? "hidden" : "visible";
  }

  private async getCategoriesVisibility(categoryIds: Id64Array): Promise<VisibilityStatus["state"]> {
    const overrideResult = this.getCategoryVisibilityFromOverrides(categoryIds);
    if (overrideResult !== "none") {
      return overrideResult;
    }

    if (!categoryIds.every((id) => this._viewport.view.viewsCategory(id))) {
      return "hidden";
    }

    const subCategories = (await Promise.all(categoryIds.map(async (id) => this._idsCache.getSubCategories(id)))).reduce((acc, val) => acc.concat(val), []);
    let visibleSubCategoryCount = 0;
    let hiddenSubCategoryCount = 0;

    for (const subCategory of subCategories) {
      const isVisible = this._viewport.isSubCategoryVisible(subCategory);
      if (isVisible) {
        ++visibleSubCategoryCount;
      } else {
        ++hiddenSubCategoryCount;
      }
      if (hiddenSubCategoryCount > 0 && visibleSubCategoryCount > 0) {
        return "partial";
      }
    }

    return hiddenSubCategoryCount > 0 ? "hidden" : "visible";
  }

  private getCategoryVisibilityFromOverrides(categoryIds: Id64Array): VisibilityStatus["state"] | "none" {
    let showOverrides = 0;
    let hideOverrides = 0;

    for (const currentOverride of this._viewport.perModelCategoryVisibility) {
      if (categoryIds.includes(currentOverride.categoryId)) {
        const currentVisibilityOverride = this._viewport.perModelCategoryVisibility.getOverride(currentOverride.modelId, currentOverride.categoryId);

        if (currentVisibilityOverride === PerModelCategoryVisibility.Override.Hide) {
          ++hideOverrides;
        } else if (currentVisibilityOverride === PerModelCategoryVisibility.Override.Show) {
          ++showOverrides;
        }

        if (showOverrides > 0 && hideOverrides > 0) {
          return "partial";
        }
      }
    }

    if (showOverrides === 0 && hideOverrides === 0) {
      return "none";
    }

    return showOverrides > 0 ? "visible" : "hidden";
  }

  private async changeSubCategoryVisibility(node: HierarchyNode, on: boolean) {
    const parentCategoryId = node.extendedData?.categoryId;

    // make sure parent category is enabled
    if (on && parentCategoryId) {
      await this.changeCategoryState([parentCategoryId], true, false);
    }

    const subCategoryIds = CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node);
    subCategoryIds.forEach((id) => {
      this.changeSubCategoryState(id, on);
    });
  }

  private async changeCategoryVisibility(node: HierarchyNode, on: boolean) {
    const categoryIds = CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node);
    return this.changeCategoryState(categoryIds, on, on);
  }

  private async changeDefinitionContainerVisibility(node: HierarchyNode, on: boolean) {
    const definitionContainerId = CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node);
    const childCategories = await this._idsCache.getAllContainedCategories(definitionContainerId);
    return this.changeCategoryState(childCategories, on, on);
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

  private static getInstanceIdsFromHierarchyNode(node: HierarchyNode) {
    return HierarchyNode.isInstancesNode(node) && node.key.instanceKeys.length > 0
      ? node.key.instanceKeys.map((instanceKey) => instanceKey.id)
      : /* istanbul ignore next */ [];
  }

  private async changeCategoryState(ids: string[], enabled: boolean, enableAllSubCategories: boolean) {
    await enableCategoryDisplay(this._viewport, ids, enabled, enableAllSubCategories);
  }

  private changeSubCategoryState(key: string, enabled: boolean) {
    enableSubCategoryDisplay(this._viewport, key, enabled);
  }
}
