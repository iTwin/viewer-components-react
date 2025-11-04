/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { assert, BeEvent } from "@itwin/core-bentley";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { enableCategoryDisplay, enableSubCategoryDisplay } from "../../common/CategoriesVisibilityUtils.js";
import { createVisibilityStatus } from "../../common/Tooltip.js";
import { CategoriesTreeNode } from "./CategoriesTreeNode.js";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { Visibility } from "../../common/Tooltip.js";
import type { HierarchyVisibilityHandler, VisibilityStatus } from "../../common/UseHierarchyVisibility.js";
import type { CategoriesTreeHierarchyConfiguration } from "../CategoriesTreeDefinition.js";
import type { CategoriesTreeIdsCache } from "./CategoriesTreeIdsCache.js";

/** @internal */
export interface CategoriesVisibilityHandlerProps {
  viewport: Viewport;
  idsCache: CategoriesTreeIdsCache;
  hierarchyConfig: CategoriesTreeHierarchyConfiguration;
}

/** @internal */
export class CategoriesVisibilityHandler implements HierarchyVisibilityHandler {
  #pendingVisibilityChange: any;
  #viewport: Viewport;
  #idsCache: CategoriesTreeIdsCache;
  #hierarchyConfig: CategoriesTreeHierarchyConfiguration;

  constructor(props: CategoriesVisibilityHandlerProps) {
    this.#idsCache = props.idsCache;
    this.#viewport = props.viewport;
    this.#viewport.onDisplayStyleChanged.addListener(this.onDisplayStyleChanged);
    this.#viewport.onViewedCategoriesChanged.addListener(this.onViewedCategoriesChanged);
    this.#viewport.onViewedCategoriesPerModelChanged.addListener(this.onViewedCategoriesPerModelChanged);
    this.#viewport.onViewedModelsChanged.addListener(this.onViewedModelsChanged);
    this.#hierarchyConfig = props.hierarchyConfig;
  }

  public dispose() {
    this[Symbol.dispose]();
  }

  public [Symbol.dispose]() {
    this.#viewport.onDisplayStyleChanged.removeListener(this.onDisplayStyleChanged);
    this.#viewport.onViewedCategoriesChanged.removeListener(this.onViewedCategoriesChanged);
    this.#viewport.onViewedCategoriesPerModelChanged.removeListener(this.onViewedCategoriesPerModelChanged);
    this.#viewport.onViewedModelsChanged.removeListener(this.onViewedModelsChanged);
    clearTimeout(this.#pendingVisibilityChange);
  }

  public onVisibilityChange = new BeEvent();

  /** Returns visibility status of the tree node. */
  public async getVisibilityStatus(node: HierarchyNode): Promise<VisibilityStatus> {
    if (!HierarchyNode.isInstancesNode(node)) {
      return { state: "hidden", isDisabled: true };
    }

    if (CategoriesTreeNode.isSubCategoryNode(node)) {
      if (!node.extendedData?.categoryId) {
        return { state: "hidden", isDisabled: true };
      }
      return createVisibilityStatus(
        await this.getSubCategoriesVisibility(CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node), node.extendedData.categoryId),
      );
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
      return this.changeCategoryVisibility(CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node), on);
    }

    if (CategoriesTreeNode.isSubCategoryNode(node)) {
      return this.changeSubCategoryVisibility(node, on);
    }

    if (CategoriesTreeNode.isDefinitionContainerNode(node)) {
      return this.changeDefinitionContainerVisibility(node, on);
    }
  }

  private async getSubCategoriesVisibility(subCategoryIds: Id64Array, parentCategoryId: Id64String): Promise<Visibility> {
    let visibility: "visible" | "hidden" | "unknown" = "unknown";
    const categoryModels = [...(await firstValueFrom(this.#idsCache.getCategoriesElementModels([parentCategoryId]))).values()].flat();
    let nonDefaultModelDisplayStatesCount = 0;
    for (const modelId of categoryModels) {
      if (!this.#viewport.view.viewsModel(modelId)) {
        if (visibility === "visible") {
          return "partial";
        }
        visibility = "hidden";
        ++nonDefaultModelDisplayStatesCount;
        continue;
      }
      const override = this.#viewport.perModelCategoryVisibility.getOverride(modelId, parentCategoryId);
      if (override === PerModelCategoryVisibility.Override.Show) {
        if (visibility === "hidden") {
          return "partial";
        }
        visibility = "visible";
        ++nonDefaultModelDisplayStatesCount;
        continue;
      }
      if (override === PerModelCategoryVisibility.Override.Hide) {
        if (visibility === "visible") {
          return "partial";
        }
        visibility = "hidden";
        ++nonDefaultModelDisplayStatesCount;
        continue;
      }
    }
    if (categoryModels.length > 0 && nonDefaultModelDisplayStatesCount === categoryModels.length) {
      assert(visibility === "visible" || visibility === "hidden");
      return visibility;
    }

    if (!this.#viewport.view.viewsCategory(parentCategoryId)) {
      return visibility === "visible" ? "partial" : "hidden";
    }

    if (subCategoryIds.length === 0) {
      if (visibility === "hidden") {
        return "partial";
      }
      return "visible";
    }

    for (const subCategoryId of subCategoryIds) {
      const isSubCategoryVisible = this.#viewport.isSubCategoryVisible(subCategoryId);
      if (isSubCategoryVisible && visibility === "hidden") {
        return "partial";
      }
      if (!isSubCategoryVisible && visibility === "visible") {
        return "partial";
      }
      visibility = isSubCategoryVisible ? "visible" : "hidden";
    }
    assert(visibility === "visible" || visibility === "hidden");
    return visibility;
  }

  private async getDefinitionContainerVisibility(node: HierarchyNode): Promise<Visibility> {
    const categoryIds = await firstValueFrom(
      this.#idsCache.getAllContainedCategories({
        definitionContainerIds: CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node),
        includeEmptyCategories: this.#hierarchyConfig.showEmptyCategories,
      }),
    );
    return this.getCategoriesVisibility([...categoryIds]);
  }

  private async getCategoriesVisibility(categoryIds: Id64Array): Promise<Visibility> {
    const subCategoriesVisibilities = await Promise.all(
      categoryIds.map(async (categoryId) => {
        const subCategories = await firstValueFrom(this.#idsCache.getSubCategories(categoryId));
        return this.getSubCategoriesVisibility(subCategories, categoryId);
      }),
    );
    let visibility: "visible" | "hidden" | "unknown" = "unknown";

    for (const subCategoriesVisibility of subCategoriesVisibilities) {
      if (subCategoriesVisibility === "partial") {
        return "partial";
      }
      if (subCategoriesVisibility === "hidden" && visibility === "visible") {
        return "partial";
      }
      if (subCategoriesVisibility === "visible" && visibility === "hidden") {
        return "partial";
      }
      visibility = subCategoriesVisibility;
    }
    assert(visibility !== "unknown");
    return visibility;
  }

  private async enableCategoriesElementModelsVisibility(categoryIds: Id64Array) {
    const categoriesModelsMap = await firstValueFrom(this.#idsCache.getCategoriesElementModels(categoryIds));
    const modelIds = [...categoriesModelsMap.values()].flat();
    const hiddenModels = modelIds.filter((modelId) => !this.#viewport.view.viewsModel(modelId));
    if (hiddenModels.length > 0) {
      this.#viewport.changeModelDisplay(hiddenModels, true);
    }
  }

  private async changeSubCategoryVisibility(node: HierarchyNode, on: boolean) {
    const parentCategoryId = node.extendedData?.categoryId;

    // make sure parent category and models are enabled
    if (on && parentCategoryId) {
      await Promise.all([this.enableCategoriesElementModelsVisibility([parentCategoryId]), this.changeCategoryState([parentCategoryId], true, false)]);
    }

    const subCategoryIds = CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node);
    subCategoryIds.forEach((id) => {
      this.changeSubCategoryState(id, on);
    });
  }
  private async changeCategoryVisibility(categoryIds: Id64Array, on: boolean) {
    // make sure models are enabled
    if (on) {
      await this.enableCategoriesElementModelsVisibility(categoryIds);
    }
    return this.changeCategoryState(categoryIds, on, on);
  }

  private async changeDefinitionContainerVisibility(node: HierarchyNode, on: boolean) {
    const definitionContainerId = CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node);
    const childCategories = await firstValueFrom(
      this.#idsCache.getAllContainedCategories({
        definitionContainerIds: definitionContainerId,
        includeEmptyCategories: this.#hierarchyConfig.showEmptyCategories,
      }),
    );
    return this.changeCategoryVisibility([...childCategories], on);
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
    if (this.#pendingVisibilityChange) {
      return;
    }

    this.#pendingVisibilityChange = setTimeout(() => {
      this.onVisibilityChange.raiseEvent();
      this.#pendingVisibilityChange = undefined;
    }, 0);
  }

  private static getInstanceIdsFromHierarchyNode(node: HierarchyNode) {
    return HierarchyNode.isInstancesNode(node) ? node.key.instanceKeys.map((instanceKey) => instanceKey.id) : /* istanbul ignore next */ [];
  }

  private async changeCategoryState(ids: string[], enabled: boolean, enableAllSubCategories: boolean) {
    await enableCategoryDisplay(this.#viewport, ids, enabled, enableAllSubCategories);
  }

  private changeSubCategoryState(key: string, enabled: boolean) {
    enableSubCategoryDisplay(this.#viewport, key, enabled);
  }
}
