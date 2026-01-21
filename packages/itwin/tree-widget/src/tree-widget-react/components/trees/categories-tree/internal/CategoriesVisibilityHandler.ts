/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { EMPTY, firstValueFrom, forkJoin, from, map, merge, mergeMap, of, toArray } from "rxjs";
import { BeEvent, Id64 } from "@itwin/core-bentley";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { enableCategoryDisplay, enableSubCategoryDisplay } from "../../common/CategoriesVisibilityUtils.js";
import { mergeVisibilities, releaseMainThreadOnItemsCount } from "../../common/internal/Utils.js";
import { toVoidPromise } from "../../common/Rxjs.js";
import { createVisibilityStatus } from "../../common/Tooltip.js";
import { CategoriesTreeNode } from "./CategoriesTreeNode.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64Array, Id64String } from "@itwin/core-bentley";
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
        await firstValueFrom(this.getSubCategoriesVisibility(CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node), node.extendedData.categoryId)),
      );
    }

    if (CategoriesTreeNode.isCategoryNode(node)) {
      return createVisibilityStatus(await firstValueFrom(this.getCategoriesVisibility(CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node))));
    }

    if (CategoriesTreeNode.isDefinitionContainerNode(node)) {
      return createVisibilityStatus(await firstValueFrom(this.getDefinitionContainerVisibility(node)));
    }

    return { state: "hidden", isDisabled: true };
  }

  public async changeVisibility(node: HierarchyNode, on: boolean) {
    if (!HierarchyNode.isInstancesNode(node)) {
      return;
    }

    if (CategoriesTreeNode.isCategoryNode(node)) {
      return toVoidPromise(this.changeCategoryVisibility(CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node), on));
    }

    if (CategoriesTreeNode.isSubCategoryNode(node)) {
      return toVoidPromise(this.changeSubCategoryVisibility(node, on));
    }

    if (CategoriesTreeNode.isDefinitionContainerNode(node)) {
      return toVoidPromise(this.changeDefinitionContainerVisibility(node, on));
    }
  }

  private getSubCategoriesVisibility(subCategoryIds: Id64Arg, parentCategoryId: Id64String): Observable<Visibility> {
    return this.#idsCache.getCategoriesElementModels(parentCategoryId).pipe(
      mergeMap((modelMap): Observable<{ visibility: "visible" | "hidden"; isDefault: boolean }> => {
        if (modelMap.size === 0) {
          return of({ visibility: this.#viewport.view.viewsCategory(parentCategoryId) ? "visible" : "hidden", isDefault: true });
        }
        return from(modelMap.keys()).pipe(
          map((modelId) => {
            if (!this.#viewport.view.viewsModel(modelId)) {
              return { visibility: "hidden", isDefault: false };
            }
            const override = this.#viewport.perModelCategoryVisibility.getOverride(modelId, parentCategoryId);
            return override === PerModelCategoryVisibility.Override.Show
              ? { visibility: "visible", isDefault: false }
              : override === PerModelCategoryVisibility.Override.Hide
                ? { visibility: "hidden", isDefault: false }
                : { visibility: this.#viewport.view.viewsCategory(parentCategoryId) ? "visible" : "hidden", isDefault: true };
          }),
        );
      }),
      mergeMap(({ visibility, isDefault }) => {
        if (!isDefault || visibility === "hidden" || Id64.sizeOf(subCategoryIds) === 0) {
          return of(visibility);
        }
        return from(Id64.iterable(subCategoryIds)).pipe(
          releaseMainThreadOnItemsCount(200),
          map((subCategoryId) => (this.#viewport.isSubCategoryVisible(subCategoryId) ? "visible" : "hidden")),
        );
      }),
      mergeVisibilities,
      map((visibility) => (visibility === "empty" ? "hidden" : visibility)),
    );
  }

  private getDefinitionContainerVisibility(node: HierarchyNode): Observable<Visibility> {
    return this.#idsCache
      .getAllContainedCategories({
        definitionContainerIds: CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node),
        includeEmptyCategories: this.#hierarchyConfig.showEmptyCategories,
      })
      .pipe(mergeMap((categoryIds) => this.getCategoriesVisibility(categoryIds)));
  }

  private getCategoriesVisibility(categoryIds: Id64Arg): Observable<Visibility> {
    return from(categoryIds).pipe(
      releaseMainThreadOnItemsCount(50),
      mergeMap((categoryId) => forkJoin({ subCategoryIds: this.#idsCache.getSubCategories(categoryId), categoryId: of(categoryId) })),
      mergeMap(({ subCategoryIds, categoryId }) => this.getSubCategoriesVisibility(subCategoryIds, categoryId)),
      mergeVisibilities,
      map((visibility) => {
        return visibility === "empty" ? "hidden" : visibility;
      }),
    );
  }

  private enableCategoriesElementModelsVisibility(categoryIds: Id64Array) {
    return this.#idsCache.getCategoriesElementModels(categoryIds).pipe(
      mergeMap((categoriesModelsMap) => categoriesModelsMap.entries()),
      mergeMap(([modelId, categoriesFromPropsInModel]) =>
        this.#viewport.view.viewsModel(modelId)
          ? EMPTY
          : this.#idsCache.getCategoriesOfElementModel(modelId).pipe(
              map((allModelCategories) => {
                // Add 'Hide' override to categories that were hidden before model is turned on
                allModelCategories?.forEach((categoryId) => {
                  if (
                    !categoriesFromPropsInModel.has(categoryId) &&
                    this.#viewport.perModelCategoryVisibility.getOverride(modelId, categoryId) === PerModelCategoryVisibility.Override.None
                  ) {
                    this.#viewport.perModelCategoryVisibility.setOverride(modelId, categoryId, PerModelCategoryVisibility.Override.Hide);
                  }
                });
                return modelId;
              }),
            ),
      ),
      toArray(),
      mergeMap(async (hiddenModels) => {
        if (hiddenModels.length > 0) {
          await this.#viewport.addViewedModels(hiddenModels);
        }
      }),
    );
  }

  private changeSubCategoryVisibility(node: HierarchyNode, on: boolean) {
    const parentCategoryId = node.extendedData?.categoryId;
    return merge(
      // make sure parent category and models are enabled
      on && parentCategoryId ? this.enableCategoriesElementModelsVisibility([parentCategoryId]) : EMPTY,
      on && parentCategoryId ? this.changeCategoryState([parentCategoryId], true, false) : EMPTY,
      of(
        (() =>
          CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node).forEach((id) => {
            this.changeSubCategoryState(id, on);
          }))(),
      ),
    );
  }

  private changeCategoryVisibility(categoryIds: Id64Array, on: boolean) {
    return merge(
      // make sure models are enabled
      on ? this.enableCategoriesElementModelsVisibility(categoryIds) : EMPTY,
      from(categoryIds).pipe(
        mergeMap((categoryId) => this.#idsCache.getSubCategories(categoryId)),
        mergeMap((subCategorySet) => subCategorySet),
        toArray(),
        mergeMap((subCategories) =>
          subCategories.length > 0 ? this.changeCategoryState(categoryIds, on, false, subCategories) : this.changeCategoryState(categoryIds, on, on),
        ),
      ),
    );
  }

  private changeDefinitionContainerVisibility(node: HierarchyNode, on: boolean) {
    const definitionContainerId = CategoriesVisibilityHandler.getInstanceIdsFromHierarchyNode(node);
    return this.#idsCache
      .getAllContainedCategories({
        definitionContainerIds: definitionContainerId,
        includeEmptyCategories: this.#hierarchyConfig.showEmptyCategories,
      })
      .pipe(mergeMap((childCategories) => this.changeCategoryVisibility([...childCategories], on)));
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

  private changeCategoryState(ids: Id64Array, enabled: boolean, enableAllSubCategories: boolean, subCategories?: Id64Arg) {
    return merge(
      from(enableCategoryDisplay(this.#viewport, ids, enabled, enableAllSubCategories)),
      enabled && subCategories
        ? from(Id64.iterable(subCategories)).pipe(
            releaseMainThreadOnItemsCount(100),
            map((subCategoryId) => this.changeSubCategoryState(subCategoryId, true)),
          )
        : EMPTY,
    );
  }

  private changeSubCategoryState(key: string, enabled: boolean) {
    enableSubCategoryDisplay(this.#viewport, key, enabled);
  }
}
