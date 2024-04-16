/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom, from, isObservable } from "rxjs";
import { BeEvent } from "@itwin/core-bentley";
import { IModelApp, PerModelCategoryVisibility } from "@itwin/core-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import { toggleAllCategories } from "../CategoriesVisibilityUtils";
import { createElementIdsCache } from "./internal/ElementIdsCache";
import { createQueryProvider } from "./internal/QueryProvider";
import { createSubjectModelIdsCache } from "./internal/SubjectModelIdsCache";
import { createVisibilityStatus } from "./internal/Tooltip";
import { VisibilityStateHandler } from "./internal/VisibilityStateHandler";
import * as NodeUtils from "./NodeUtils";

import type { SubjectModelIdsCache } from "./internal/SubjectModelIdsCache";
import type { QueryProvider } from "./internal/QueryProvider";
import type { ECClassGroupingNodeKey, NodeKey } from "@itwin/presentation-common";
import type { TreeNodeItem } from "@itwin/components-react";
import type { Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { IFilteredPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { Observable } from "rxjs";
import type { IVisibilityHandler, VisibilityChangeListener, VisibilityStatus } from "../VisibilityTreeEventHandler";
/**
 * Models tree node types.
 * @public
 */
export enum ModelsTreeNodeType {
  Unknown,
  Subject,
  Model,
  Category,
  Element,
  Grouping,
}

/**
 * Type definition of predicate used to decide if node can be selected
 * @public
 */
export type ModelsTreeSelectionPredicate = (key: NodeKey, type: ModelsTreeNodeType) => boolean;

/**
 * Props for [[ModelsVisibilityHandler]]
 * @public
 */
export interface ModelsVisibilityHandlerProps {
  rulesetId: string;
  viewport: Viewport;
  hierarchyAutoUpdateEnabled?: boolean;
  /** @internal */
  subjectModelIdsCache?: SubjectModelIdsCache;
  queryProvider?: QueryProvider;
}

/**
 * Visibility handler used by [[ModelsTree]] to control visibility of the tree items.
 * @public
 */
export class ModelsVisibilityHandler implements IVisibilityHandler {
  private _props: ModelsVisibilityHandlerProps;
  private _pendingVisibilityChange: any | undefined;
  private _visibilityStateHandler: VisibilityStateHandler;
  private _listeners = new Array<() => void>();

  constructor(props: ModelsVisibilityHandlerProps) {
    this._props = props;
    const elementIdsCache = createElementIdsCache(this._props.viewport.iModel, this._props.rulesetId);
    const queryProvider = this._props.queryProvider ?? createQueryProvider(this._props.viewport.iModel);
    const subjectModelIdsCache = props.subjectModelIdsCache ?? createSubjectModelIdsCache(queryProvider);
    this._visibilityStateHandler = new VisibilityStateHandler({
      viewport: this._props.viewport,
      elementIdsCache,
      subjectModelIdsCache,
      queryProvider,
    });
    this._listeners.push(this._props.viewport.onViewedCategoriesPerModelChanged.addListener(this.onViewChanged));
    this._listeners.push(this._props.viewport.onViewedCategoriesChanged.addListener(this.onViewChanged));
    this._listeners.push(this._props.viewport.onViewedModelsChanged.addListener(this.onViewChanged));
    this._listeners.push(this._props.viewport.onAlwaysDrawnChanged.addListener(this.onElementAlwaysDrawnChanged));
    this._listeners.push(this._props.viewport.onNeverDrawnChanged.addListener(this.onElementNeverDrawnChanged));
    if (this._props.hierarchyAutoUpdateEnabled) {
      this._listeners.push(Presentation.presentation.onIModelHierarchyChanged.addListener(/* istanbul ignore next */ () => elementIdsCache.clear())); // eslint-disable-line @itwin/no-internal
    }
  }

  public dispose() {
    this._listeners.forEach((remove) => remove());
    clearTimeout(this._pendingVisibilityChange);
  }

  public onVisibilityChange = new BeEvent<VisibilityChangeListener>();

  /** Sets data provider that is used to get filtered tree hierarchy. */
  public setFilteredDataProvider(provider: IFilteredPresentationTreeDataProvider | undefined) {
    this._visibilityStateHandler.filteredDataProvider = provider;
  }

  public static getNodeType(item: TreeNodeItem) {
    return NodeUtils.getNodeType(item);
  }

  /** Returns visibility status of the tree node. */
  public getVisibilityStatus(node: TreeNodeItem): VisibilityStatus | Promise<VisibilityStatus> {
    const result = this._visibilityStateHandler.getVisibilityStatus(node);
    if (isObservable(result)) {
      return firstValueFrom(result);
    }
    return result;
  }

  /** Changes visibility of the items represented by the tree node. */
  public async changeVisibility(node: TreeNodeItem, on: boolean) {
    return toVoidPromise(this._visibilityStateHandler.changeVisibility(node, on));
  }

  protected async getSubjectNodeVisibility(ids: Id64String[], node: TreeNodeItem): Promise<VisibilityStatus> {
    return firstValueFrom(this._visibilityStateHandler.getSubjectNodeVisibility(node, from(ids)));
  }

  /**
   * @deprecated in 2.1. Use getModelDisplayStatusAsync instead.
   */
  protected getModelDisplayStatus(id: Id64String): VisibilityStatus {
    if (!this._props.viewport.view.isSpatialView()) {
      return createVisibilityStatus("disabled", "model.nonSpatialView");
    }
    const isDisplayed = this._props.viewport.view.viewsModel(id);
    return createVisibilityStatus(isDisplayed ? "visible" : "hidden");
  }

  protected async getModelDisplayStatusAsync(id: Id64String): Promise<VisibilityStatus> {
    return firstValueFrom(this._visibilityStateHandler.getModelDisplayStatus(id));
  }

  /**
   * @deprecated in 2.1. Use getCategoryDisplayStatusAsync instead.
   */
  protected getCategoryDisplayStatus(id: Id64String, parentModelId: Id64String | undefined): VisibilityStatus {
    if (parentModelId) {
      // eslint-disable-next-line deprecation/deprecation
      if (this.getModelDisplayStatus(parentModelId).state === "hidden") {
        return createVisibilityStatus("disabled", "category.modelNotDisplayed");
      }

      const override = this._props.viewport.perModelCategoryVisibility.getOverride(parentModelId, id);
      switch (override) {
        case PerModelCategoryVisibility.Override.Show:
          return createVisibilityStatus("visible", "category.displayedThroughPerModelOverride");
        case PerModelCategoryVisibility.Override.Hide:
          return createVisibilityStatus("hidden", "category.hiddenThroughPerModelOverride");
      }
    }
    const isDisplayed = this._props.viewport.view.viewsCategory(id);
    return isDisplayed
      ? createVisibilityStatus("visible", "category.displayedThroughCategorySelector")
      : createVisibilityStatus("hidden", "category.hiddenThroughCategorySelector");
  }

  protected async getCategoryDisplayStatusAsync(id: Id64String, parentModelId: Id64String | undefined): Promise<VisibilityStatus> {
    return firstValueFrom(this._visibilityStateHandler.getCategoryDisplayStatus(id, parentModelId));
  }

  protected async getElementGroupingNodeDisplayStatus(_id: string, key: ECClassGroupingNodeKey): Promise<VisibilityStatus> {
    return firstValueFrom(this._visibilityStateHandler.getElementGroupingNodeDisplayStatus(key));
  }

  /**
   * @deprecated in 2.1. Use getElementDisplayStatusAsync instead.
   */
  protected getElementDisplayStatus(elementId: Id64String, modelId: Id64String | undefined, categoryId: Id64String | undefined): VisibilityStatus {
    if (!modelId || !this._props.viewport.view.viewsModel(modelId)) {
      return createVisibilityStatus("disabled", "element.modelNotDisplayed");
    }
    if (this._props.viewport.neverDrawn !== undefined && this._props.viewport.neverDrawn.has(elementId)) {
      return createVisibilityStatus("hidden", "element.hiddenThroughNeverDrawnList");
    }
    if (this._props.viewport.alwaysDrawn !== undefined) {
      if (this._props.viewport.alwaysDrawn.has(elementId)) {
        return createVisibilityStatus("visible", "element.displayedThroughAlwaysDrawnList");
      }
      if (this._props.viewport.alwaysDrawn.size !== 0 && this._props.viewport.isAlwaysDrawnExclusive) {
        return createVisibilityStatus("hidden", "element.hiddenDueToOtherElementsExclusivelyAlwaysDrawn");
      }
    }
    // eslint-disable-next-line deprecation/deprecation
    if (categoryId && this.getCategoryDisplayStatus(categoryId, modelId).state === "visible") {
      return createVisibilityStatus("visible", undefined);
    }
    return createVisibilityStatus("hidden", "element.hiddenThroughCategory");
  }

  protected async getElementDisplayStatusAsync(elementId: Id64String): Promise<VisibilityStatus> {
    return firstValueFrom(this._visibilityStateHandler.getElementDisplayStatus(elementId));
  }

  protected async changeSubjectNodeState(ids: Id64String[], node: TreeNodeItem, on: boolean) {
    return toVoidPromise(this._visibilityStateHandler.changeSubjectNodeState(from(ids), node, on));
  }

  protected async changeModelState(id: Id64String, on: boolean) {
    return toVoidPromise(this._visibilityStateHandler.changeModelState(id, on));
  }

  protected async changeModelsVisibility(ids: Id64String[], visible: boolean) {
    return toVoidPromise(this._visibilityStateHandler.changeModelsVisibility(ids, visible));
  }

  protected changeCategoryState(categoryId: Id64String, parentModelId: Id64String | undefined, on: boolean) {
    return this._visibilityStateHandler.changeCategoryState(categoryId, parentModelId, on);
  }

  protected async changeElementGroupingNodeState(key: ECClassGroupingNodeKey, on: boolean) {
    return toVoidPromise(this._visibilityStateHandler.changeElementGroupingNodeState(key, on));
  }

  protected async changeElementState(id: Id64String, modelId: Id64String | undefined, categoryId: Id64String | undefined, on: boolean, hasChildren?: boolean) {
    return toVoidPromise(this._visibilityStateHandler.changeElementState(id, modelId, categoryId, on, hasChildren));
  }

  protected async changeElementsState(
    modelId: Id64String | undefined,
    categoryId: Id64String | undefined,
    elementIds: AsyncGenerator<Id64String>,
    on: boolean,
  ) {
    return toVoidPromise(from(elementIds).pipe(this._visibilityStateHandler.changeElementsState(modelId, categoryId, on)));
  }

  private onVisibilityChangeInternal() {
    if (this._pendingVisibilityChange) {
      return;
    }

    this._pendingVisibilityChange = setTimeout(() => {
      this.onVisibilityChange.raiseEvent();
      this._pendingVisibilityChange = undefined;
    }, 0);
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private onViewChanged = (_vp: Viewport) => {
    this.onVisibilityChangeInternal();
  };

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private onElementAlwaysDrawnChanged = () => {
    this.onVisibilityChangeInternal();
  };

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private onElementNeverDrawnChanged = () => {
    this.onVisibilityChangeInternal();
  };
}

/**
 * Enables display of all given models. Also enables display of all categories and clears always and
 * never drawn lists in the viewport.
 * @public
 */
export async function showAllModels(models: string[], viewport: Viewport) {
  await viewport.addViewedModels(models);
  viewport.clearNeverDrawn();
  viewport.clearAlwaysDrawn();
  await toggleAllCategories(IModelApp.viewManager, viewport.iModel, true, viewport, false);
}

/**
 * Disables display of all given models.
 * @public
 */
export async function hideAllModels(models: string[], viewport: Viewport) {
  viewport.changeModelDisplay(models, false);
}

/**
 * Inverts display of all given models.
 * @public
 */
export async function invertAllModels(models: string[], viewport: Viewport) {
  const notViewedModels: string[] = [];
  const viewedModels: string[] = [];
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
  // istanbul ignore if
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

/** Same as `firstValueFrom` except it won't throw if the observable emits no values. */
async function toVoidPromise(obs: Observable<void> | Observable<undefined>): Promise<void> {
  return new Promise((resolve, reject) => {
    obs.subscribe({
      next: resolve,
      complete: resolve,
      error: reject,
    });
  });
}
