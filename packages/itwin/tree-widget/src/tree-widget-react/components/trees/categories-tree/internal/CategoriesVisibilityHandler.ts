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

import type { Viewport } from "@itwin/core-frontend";
import type { Visibility } from "../../common/Tooltip.js";
import type { Id64Array, Id64String } from "@itwin/core-bentley";
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
    this._viewport.onViewedCategoriesPerModelChanged.addListener(this.onViewedCategoriesPerModelChanged);
    this._viewport.onViewedModelsChanged.addListener(this.onViewedModelsChanged);
  }

  public dispose() {
    this[Symbol.dispose]();
  }

  public [Symbol.dispose]() {
    this._viewport.onDisplayStyleChanged.removeListener(this.onDisplayStyleChanged);
    this._viewport.onViewedCategoriesChanged.removeListener(this.onViewedCategoriesChanged);
    this._viewport.onViewedCategoriesPerModelChanged.removeListener(this.onViewedCategoriesPerModelChanged);
    this._viewport.onViewedModelsChanged.removeListener(this.onViewedModelsChanged);
    clearTimeout(this._pendingVisibilityChange);
  }

  public onVisibilityChange = new BeEvent();

  /** Returns visibility status of the tree node. */
  public async getVisibilityStatus(node: HierarchyNode): Promise<VisibilityStatus> {
    if (!HierarchyNode.isInstancesNode(node)) {
      return { state: "hidden", isDisabled: true };
    }

    if (CategoriesTreeNode.isSubCategoryNode(node)) {
      return createVisibilityStatus(await this.getSubCategoryVisibility(node));
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

  private async getSubCategoryVisibility(node: HierarchyNode): Promise<Visibility> {
    const parentCategoryId = node.extendedData?.categoryId;
    if (!parentCategoryId) {
      return "hidden";
    }

    const categoryOverrideResult = await this.getCategoryVisibilityWithoutSubCategories(parentCategoryId);
    if (categoryOverrideResult.reason === "all-overrides" || categoryOverrideResult.visibility === "hidden") {
      return categoryOverrideResult.visibility;
    }

    const subCategoryIds = CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node);
    const subCategoryVisibility = this.getSubCategoriesVisibility(subCategoryIds);
    if (subCategoryVisibility === "partial") {
      return "partial";
    }
    if (subCategoryVisibility === "hidden") {
      // This means there were some cateogry overrides set to 'Show'
      if (!this._viewport.view.viewsCategory(parentCategoryId) && categoryOverrideResult.visibility === "partial") {
        return "partial";
      }
      // This means there were some cateogry overrides set to 'Show'
      if (categoryOverrideResult.reason === "some-overrides" && categoryOverrideResult.visibility === "visible") {
        return "partial";
      }
      return "hidden";
    }
    // This means there were some cateogry overrides set to 'hide'
    if (this._viewport.view.viewsCategory(parentCategoryId) && categoryOverrideResult.visibility === "partial") {
      return "partial";
    }
    return "visible";
  }

  private async getDefinitionContainerVisibility(node: HierarchyNode): Promise<Visibility> {
    const categoryIds = await this._idsCache.getAllContainedCategories(CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node));
    return this.getCategoriesVisibility(categoryIds);
  }

  private async getCategoriesVisibility(categoryIds: Id64Array): Promise<Visibility> {
    const categoriesVisibilty = await Promise.all(
      categoryIds.map(async (categoryId) => {
        const { visibility, reason } = await this.getCategoryVisibilityWithoutSubCategories(categoryId);
        return { categoryId, visibility, reason };
      }),
    );

    let visibleCount = 0;
    let hiddenCount = 0;
    for (const { categoryId, visibility, reason } of categoriesVisibilty) {
      if (visibleCount > 0 && hiddenCount > 0) {
        return "partial";
      }
      if (visibility === "partial") {
        return "partial";
      }
      if (visibility === "hidden") {
        ++hiddenCount;
        continue;
      }
      if (reason === "all-overrides") {
        ++visibleCount;
        continue;
      }
      const subCategories = await this._idsCache.getSubCategories(categoryId);
      const subCategoriesVisibility = this.getSubCategoriesVisibility(subCategories);
      if (subCategoriesVisibility === "partial") {
        return "partial";
      }

      if (subCategoriesVisibility === "hidden" && reason === "some-overrides") {
        return "partial";
      }
      if (subCategoriesVisibility === "hidden") {
        ++hiddenCount;
      } else {
        ++visibleCount;
      }
    }
    if (visibleCount > 0 && hiddenCount > 0) {
      return "partial";
    }
    return visibleCount > 0 ? "visible" : "hidden";
  }

  private async getCategoryVisibilityWithoutSubCategories(
    categoryId: Id64String,
  ): Promise<{ visibility: VisibilityStatus["state"]; reason: "all-overrides" | "some-overrides" | "no-overrides" }> {
    const categoryModelsMap = await this._idsCache.getCategoriesElementModels([categoryId]);
    let showOverrides = 0;
    let hideOverrides = 0;
    let noOverrides = 0;
    const modelIds = categoryModelsMap.get(categoryId);
    for (const modelId of modelIds) {
      if (this._viewport.view.viewsModel(modelId)) {
        const override = this._viewport.perModelCategoryVisibility.getOverride(modelId, categoryId);
        if (override === PerModelCategoryVisibility.Override.None) {
          ++noOverrides;
          continue;
        }
        if (override === PerModelCategoryVisibility.Override.Hide) {
          ++hideOverrides;
        } else {
          ++showOverrides;
        }
      } else {
        ++hideOverrides;
      }

      if (showOverrides > 0 && hideOverrides > 0) {
        return { visibility: "partial", reason: "all-overrides" };
      }
    }

    if (showOverrides === 0 && hideOverrides === 0) {
      return { visibility: this._viewport.view.viewsCategory(categoryId) ? "visible" : "hidden", reason: "no-overrides" };
    }
    if (noOverrides > 0) {
      if (this._viewport.view.viewsCategory(categoryId)) {
        return { visibility: showOverrides > 0 ? "visible" : "partial", reason: "some-overrides" };
      }
      return { visibility: showOverrides > 0 ? "partial" : "hidden", reason: "some-overrides" };
    }

    return { visibility: showOverrides > 0 ? "visible" : "hidden", reason: "all-overrides" };
  }

  private getSubCategoriesVisibility(subCategoryIds: Id64Array): Visibility {
    if (subCategoryIds.length === 0) {
      return "visible";
    }
    let visibleSubCategoryCount = 0;
    let hiddenSubCategoryCount = 0;
    for (const subCategoryId of subCategoryIds) {
      const isVisible = this._viewport.isSubCategoryVisible(subCategoryId);
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

  private async enableCategoriesElementModels(categoryIds: Id64Array) {
    const categoriesModelsMap = await this._idsCache.getCategoriesElementModels(categoryIds);
    const modelIds = [...categoriesModelsMap.values()].flat();
    const hiddenModels = modelIds.filter((modelId) => !this._viewport.view.viewsModel(modelId));
    if (hiddenModels.length > 0) {
      this._viewport.changeModelDisplay(hiddenModels, true);
    }
  }

  private async changeSubCategoryVisibility(node: HierarchyNode, on: boolean) {
    const parentCategoryId = node.extendedData?.categoryId;

    // make sure parent category and models are enabled
    if (on && parentCategoryId) {
      await Promise.all([this.enableCategoriesElementModels([parentCategoryId]), this.changeCategoryState([parentCategoryId], true, false)]);
    }

    const subCategoryIds = CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node);
    subCategoryIds.forEach((id) => {
      this.changeSubCategoryState(id, on);
    });
  }
  private async changeCategoryVisibility(node: HierarchyNode, on: boolean) {
    const categoryIds = CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node);
    // make sure models are enabled
    if (on) {
      await this.enableCategoriesElementModels(categoryIds);
    }
    return this.changeCategoryState(categoryIds, on, on);
  }

  private async changeDefinitionContainerVisibility(node: HierarchyNode, on: boolean) {
    const definitionContainerId = CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node);
    const childCategories = await this._idsCache.getAllContainedCategories(definitionContainerId);
    return this.changeCategoryState(childCategories, on, on);
  }

  private onDisplayStyleChanged = () => {
    this.onVisibilityChangeInternal();
  };

  private onViewedCategoriesChanged = () => {
    this.onVisibilityChangeInternal();
  };

  private onViewedCategoriesPerModelChanged = () => {
    this.onVisibilityChangeInternal();
  };

  private onViewedModelsChanged = () => {
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
    return HierarchyNode.isInstancesNode(node) ? node.key.instanceKeys.map((instanceKey) => instanceKey.id) : /* istanbul ignore next */ [];
  }

  private async changeCategoryState(ids: string[], enabled: boolean, enableAllSubCategories: boolean) {
    await enableCategoryDisplay(this._viewport, ids, enabled, enableAllSubCategories);
  }

  private changeSubCategoryState(key: string, enabled: boolean) {
    enableSubCategoryDisplay(this._viewport, key, enabled);
  }
}
