/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom, from, map, mergeMap, toArray } from "rxjs";
import { IModelApp, PerModelCategoryVisibility } from "@itwin/core-frontend";
import { NodeKey } from "@itwin/presentation-common";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";
import { Presentation } from "@itwin/presentation-frontend";
import { toggleAllCategories } from "../CategoriesVisibilityUtils";
import { eachValueFrom } from "./internal/EachValueFrom";
import { createModelsTreeQueryHandler } from "./internal/ModelsTreeQueryHandler";
import { createTooltip } from "./internal/Tooltip";
import { createVisibilityChangeEventListener } from "./internal/VisibilityChangeEventListener";
import { NodeUtils } from "./NodeUtils";

import type { ModelsTreeQueryHandler } from "./internal/ModelsTreeQueryHandler";
import type { TreeNodeItem } from "@itwin/components-react";
import type { IVisibilityChangeEventListener } from "./internal/VisibilityChangeEventListener";
import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { ECClassGroupingNodeKey, GroupingNodeKey } from "@itwin/presentation-common";
import type { IFilteredPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { IVisibilityHandler, VisibilityStatus } from "../VisibilityTreeEventHandler";

/**
 * Props for [[ModelsVisibilityHandler]]
 * @public
 * @deprecated in 3.x. Use [[createHierarchyBasedVisibilityHandler]] instead.
 */
export interface ModelsVisibilityHandlerProps {
  rulesetId: string;
  viewport: Viewport;
  hierarchyAutoUpdateEnabled?: boolean;
}

/**
 * Visibility handler used by [[ModelsTree]] to control visibility of the tree items.
 * @public
 * @deprecated in 3.x. Use [[createHierarchyBasedVisibilityHandler]] instead.
 */
export class ModelsVisibilityHandler implements IVisibilityHandler {
  // eslint-disable-next-line deprecation/deprecation
  private readonly _props: ModelsVisibilityHandlerProps;
  private readonly _queryHandler: ModelsTreeQueryHandler;
  private readonly _eventListener: IVisibilityChangeEventListener;
  private _filteredDataProvider?: IFilteredPresentationTreeDataProvider;
  private _removePresentationHierarchyListener?: () => void;

  // eslint-disable-next-line deprecation/deprecation
  constructor(props: ModelsVisibilityHandlerProps) {
    this._props = props;
    this._queryHandler = createModelsTreeQueryHandler(this._props.viewport.iModel);
    this._eventListener = createVisibilityChangeEventListener(this._props.viewport);
    if (this._props.hierarchyAutoUpdateEnabled) {
      // eslint-disable-next-line @itwin/no-internal
      this._removePresentationHierarchyListener = Presentation.presentation.onIModelHierarchyChanged.addListener(
        /* istanbul ignore next */ () => this._queryHandler.invalidateCache(),
      );
    }
  }

  public dispose() {
    this._eventListener.dispose();
    this._removePresentationHierarchyListener?.();
  }

  public get onVisibilityChange() {
    return this._eventListener.onVisibilityChange;
  }

  /** Sets data provider that is used to get filtered tree hierarchy. */
  public setFilteredDataProvider(provider: IFilteredPresentationTreeDataProvider | undefined) {
    this._filteredDataProvider = provider;
  }

  // istanbul ignore next
  public static getNodeType(item: TreeNodeItem) {
    return NodeUtils.getNodeType(item);
  }

  // istanbul ignore next
  public static isSubjectNode(node: TreeNodeItem) {
    return NodeUtils.isSubjectNode(node);
  }

  // istanbul ignore next
  public static isModelNode(node: TreeNodeItem) {
    return NodeUtils.isModelNode(node);
  }

  // istanbul ignore next
  public static isCategoryNode(node: TreeNodeItem) {
    return NodeUtils.isCategoryNode(node);
  }

  /** Returns visibility status of the tree node. */
  public getVisibilityStatus(node: TreeNodeItem): VisibilityStatus | Promise<VisibilityStatus> {
    const nodeKey = isPresentationTreeNodeItem(node) ? node.key : undefined;
    if (!nodeKey) {
      return { state: "hidden", isDisabled: true };
    }

    if (NodeKey.isClassGroupingNodeKey(nodeKey)) {
      return this.getElementGroupingNodeDisplayStatus(node.id, nodeKey);
    }

    if (!NodeKey.isInstancesNodeKey(nodeKey)) {
      return { state: "hidden", isDisabled: true };
    }

    if (NodeUtils.isSubjectNode(node)) {
      // note: subject nodes may be merged to represent multiple subject instances
      return this.getSubjectNodeVisibility(
        nodeKey.instanceKeys.map((key) => key.id),
        node,
      );
    }
    if (NodeUtils.isModelNode(node)) {
      return this.getModelDisplayStatus(nodeKey.instanceKeys[0].id);
    }
    if (NodeUtils.isCategoryNode(node)) {
      return this.getCategoryDisplayStatus(nodeKey.instanceKeys[0].id, this.getCategoryParentModelId(node));
    }
    return this.getElementDisplayStatus(nodeKey.instanceKeys[0].id, this.getElementModelId(node), this.getElementCategoryId(node));
  }

  /** Changes visibility of the items represented by the tree node. */
  public async changeVisibility(node: TreeNodeItem, on: boolean) {
    if (!isPresentationTreeNodeItem(node)) {
      return;
    }
    const nodeKey = node.key;

    if (NodeKey.isClassGroupingNodeKey(nodeKey)) {
      await this.changeElementGroupingNodeState(nodeKey, on);
      return;
    }

    if (!NodeKey.isInstancesNodeKey(nodeKey)) {
      return;
    }

    if (NodeUtils.isSubjectNode(node)) {
      await this.changeSubjectNodeState(
        nodeKey.instanceKeys.map((key) => key.id),
        node,
        on,
      );
    } else if (NodeUtils.isModelNode(node)) {
      await this.changeModelState(nodeKey.instanceKeys[0].id, on);
    } else if (NodeUtils.isCategoryNode(node)) {
      this.changeCategoryState(nodeKey.instanceKeys[0].id, this.getCategoryParentModelId(node), on);
    } else {
      await this.changeElementState(nodeKey.instanceKeys[0].id, this.getElementModelId(node), this.getElementCategoryId(node), on, node.hasChildren);
    }
  }

  protected async getSubjectNodeVisibility(ids: Id64String[], node: TreeNodeItem): Promise<VisibilityStatus> {
    if (!this._props.viewport.view.isSpatialView()) {
      return { isDisabled: true, state: "hidden", tooltip: createTooltip("disabled", "subject.nonSpatialView") };
    }

    if (this._filteredDataProvider) {
      return this.getFilteredSubjectDisplayStatus(this._filteredDataProvider, ids, node);
    }

    return this.getSubjectDisplayStatus(ids);
  }

  private async getSubjectDisplayStatus(ids: Id64String[]): Promise<VisibilityStatus> {
    const modelIds = await this.getSubjectModelIds(ids);
    const isDisplayed = modelIds.some((modelId) => this.getModelDisplayStatus(modelId).state === "visible");
    if (isDisplayed) {
      return { state: "visible", tooltip: createTooltip("visible", "subject.atLeastOneModelVisible") };
    }
    return { state: "hidden", tooltip: createTooltip("hidden", "subject.allModelsHidden") };
  }

  private async getFilteredSubjectDisplayStatus(
    provider: IFilteredPresentationTreeDataProvider,
    ids: Id64String[],
    node: TreeNodeItem,
  ): Promise<VisibilityStatus> {
    if (provider.nodeMatchesFilter(node)) {
      return this.getSubjectDisplayStatus(ids);
    }

    const children = await provider.getNodes(node);
    const childrenDisplayStatuses = await Promise.all(children.map(async (childNode) => this.getVisibilityStatus(childNode)));
    if (childrenDisplayStatuses.some((status) => status.state === "visible")) {
      return { state: "visible", tooltip: createTooltip("visible", "subject.atLeastOneModelVisible") };
    }
    return { state: "hidden", tooltip: createTooltip("hidden", "subject.allModelsHidden") };
  }

  protected getModelDisplayStatus(id: Id64String): VisibilityStatus {
    if (!this._props.viewport.view.isSpatialView()) {
      return { isDisabled: true, state: "hidden", tooltip: createTooltip("disabled", "model.nonSpatialView") };
    }
    const isDisplayed = this._props.viewport.view.viewsModel(id);
    return { state: isDisplayed ? "visible" : "hidden", tooltip: createTooltip(isDisplayed ? "visible" : "hidden", undefined) };
  }

  protected getCategoryDisplayStatus(id: Id64String, parentModelId: Id64String | undefined): VisibilityStatus {
    if (parentModelId) {
      if (this.getModelDisplayStatus(parentModelId).state === "hidden") {
        return { state: "hidden", isDisabled: true, tooltip: createTooltip("disabled", "category.modelNotDisplayed") };
      }

      const override = this._props.viewport.perModelCategoryVisibility.getOverride(parentModelId, id);
      switch (override) {
        case PerModelCategoryVisibility.Override.Show:
          return { state: "visible", tooltip: createTooltip("visible", "category.displayedThroughPerModelOverride") };
        case PerModelCategoryVisibility.Override.Hide:
          return { state: "hidden", tooltip: createTooltip("hidden", "category.hiddenThroughPerModelOverride") };
      }
    }
    const isDisplayed = this._props.viewport.view.viewsCategory(id);
    return {
      state: isDisplayed ? "visible" : "hidden",
      tooltip: isDisplayed
        ? createTooltip("visible", "category.displayedThroughCategorySelector")
        : createTooltip("hidden", "category.hiddenThroughCategorySelector"),
    };
  }

  protected async getElementGroupingNodeDisplayStatus(_id: string, key: ECClassGroupingNodeKey): Promise<VisibilityStatus> {
    const { modelId, categoryId, elementIds } = await this.getGroupedElementIds(key);

    if (!modelId || !this._props.viewport.view.viewsModel(modelId)) {
      return { isDisabled: true, state: "hidden", tooltip: createTooltip("disabled", "element.modelNotDisplayed") };
    }

    if (this._props.viewport.alwaysDrawn !== undefined && this._props.viewport.alwaysDrawn.size > 0) {
      let atLeastOneElementForceDisplayed = false;
      for await (const elementId of elementIds.getElementIds()) {
        if (this._props.viewport.alwaysDrawn.has(elementId)) {
          atLeastOneElementForceDisplayed = true;
          break;
        }
      }
      if (atLeastOneElementForceDisplayed) {
        return { state: "visible", tooltip: createTooltip("visible", "element.displayedThroughAlwaysDrawnList") };
      }
    }

    if (this._props.viewport.alwaysDrawn !== undefined && this._props.viewport.alwaysDrawn.size !== 0 && this._props.viewport.isAlwaysDrawnExclusive) {
      return { state: "hidden", tooltip: createTooltip("hidden", "element.hiddenDueToOtherElementsExclusivelyAlwaysDrawn") };
    }

    // istanbul ignore else
    if (this._props.viewport.neverDrawn !== undefined && this._props.viewport.neverDrawn.size > 0) {
      let allElementsForceHidden = true;
      for await (const elementId of elementIds.getElementIds()) {
        if (!this._props.viewport.neverDrawn.has(elementId)) {
          allElementsForceHidden = false;
          break;
        }
      }
      if (allElementsForceHidden) {
        return { state: "hidden", tooltip: createTooltip("visible", "element.hiddenThroughNeverDrawnList") };
      }
    }

    if (categoryId && this.getCategoryDisplayStatus(categoryId, modelId).state === "visible") {
      return { state: "visible", tooltip: createTooltip("visible", undefined) };
    }

    return { state: "hidden", tooltip: createTooltip("hidden", "element.hiddenThroughCategory") };
  }

  protected getElementDisplayStatus(elementId: Id64String, modelId: Id64String | undefined, categoryId: Id64String | undefined): VisibilityStatus {
    if (!modelId || !this._props.viewport.view.viewsModel(modelId)) {
      return { isDisabled: true, state: "hidden", tooltip: createTooltip("disabled", "element.modelNotDisplayed") };
    }
    if (this._props.viewport.neverDrawn !== undefined && this._props.viewport.neverDrawn.has(elementId)) {
      return { state: "hidden", tooltip: createTooltip("hidden", "element.hiddenThroughNeverDrawnList") };
    }
    if (this._props.viewport.alwaysDrawn !== undefined) {
      if (this._props.viewport.alwaysDrawn.has(elementId)) {
        return { state: "visible", tooltip: createTooltip("visible", "element.displayedThroughAlwaysDrawnList") };
      }
      if (this._props.viewport.alwaysDrawn.size !== 0 && this._props.viewport.isAlwaysDrawnExclusive) {
        return { state: "hidden", tooltip: createTooltip("hidden", "element.hiddenDueToOtherElementsExclusivelyAlwaysDrawn") };
      }
    }
    if (categoryId && this.getCategoryDisplayStatus(categoryId, modelId).state === "visible") {
      return { state: "visible", tooltip: createTooltip("visible", undefined) };
    }
    return { state: "hidden", tooltip: createTooltip("hidden", "element.hiddenThroughCategory") };
  }

  protected async changeSubjectNodeState(ids: Id64String[], node: TreeNodeItem, on: boolean) {
    if (!this._props.viewport.view.isSpatialView()) {
      return;
    }

    if (this._filteredDataProvider) {
      return this.changeFilteredSubjectState(this._filteredDataProvider, ids, node, on);
    }

    return this.changeSubjectState(ids, on);
  }

  private async changeFilteredSubjectState(provider: IFilteredPresentationTreeDataProvider, ids: Id64String[], node: TreeNodeItem, on: boolean) {
    if (provider.nodeMatchesFilter(node)) {
      return this.changeSubjectState(ids, on);
    }

    const children = await provider.getNodes(node);
    return Promise.all(children.map(async (childNode) => this.changeVisibility(childNode, on)));
  }

  private async changeSubjectState(ids: Id64String[], on: boolean) {
    const modelIds = await this.getSubjectModelIds(ids);
    return this.changeModelsVisibility(modelIds, on);
  }

  protected async changeModelState(id: Id64String, on: boolean) {
    if (!this._props.viewport.view.isSpatialView()) {
      return;
    }

    return this.changeModelsVisibility([id], on);
  }

  protected async changeModelsVisibility(ids: Id64String[], visible: boolean) {
    if (visible) {
      return this._props.viewport.addViewedModels(ids);
    } else {
      this._props.viewport.changeModelDisplay(ids, false);
    }
  }

  protected changeCategoryState(categoryId: Id64String, parentModelId: Id64String | undefined, on: boolean) {
    if (parentModelId) {
      const isDisplayedInSelector = this._props.viewport.view.viewsCategory(categoryId);
      const ovr =
        on === isDisplayedInSelector
          ? PerModelCategoryVisibility.Override.None
          : on
            ? PerModelCategoryVisibility.Override.Show
            : PerModelCategoryVisibility.Override.Hide;
      this._props.viewport.perModelCategoryVisibility.setOverride(parentModelId, categoryId, ovr);
      if (ovr === PerModelCategoryVisibility.Override.None && on) {
        // we took off the override which means the category is displayed in selector, but
        // doesn't mean all its subcategories are displayed - this call ensures that
        this._props.viewport.changeCategoryDisplay([categoryId], true, true);
      }
      return;
    }
    this._props.viewport.changeCategoryDisplay([categoryId], on, on ? true : false);
  }

  protected async changeElementGroupingNodeState(key: ECClassGroupingNodeKey, on: boolean) {
    const { modelId, categoryId, elementIds } = await this.getGroupedElementIds(key);
    await this.changeElementsState(modelId, categoryId, elementIds.getElementIds(), on);
  }

  protected async changeElementState(id: Id64String, modelId: Id64String | undefined, categoryId: Id64String | undefined, on: boolean, hasChildren?: boolean) {
    const isDisplayedByDefault = this.isElementDisplayedByDefault(modelId, categoryId);
    const isHiddenDueToExclusiveAlwaysDrawnElements = this.hasExclusiveAlwaysDrawnElements();
    this.changeElementStateInternal(id, on, isDisplayedByDefault, isHiddenDueToExclusiveAlwaysDrawnElements);
    if (!hasChildren) {
      return;
    }

    // istanbul ignore if
    if (!modelId || !categoryId) {
      return;
    }
    for await (const childId of this.getAssemblyElementIds(id)) {
      this.changeElementStateInternal(childId, on, isDisplayedByDefault, isHiddenDueToExclusiveAlwaysDrawnElements);
    }
  }

  protected async changeElementsState(
    modelId: Id64String | undefined,
    categoryId: Id64String | undefined,
    elementIds: AsyncGenerator<Id64String>,
    on: boolean,
  ) {
    const isDisplayedByDefault = this.isElementDisplayedByDefault(modelId, categoryId);
    const isHiddenDueToExclusiveAlwaysDrawnElements = this.hasExclusiveAlwaysDrawnElements();
    for await (const elementId of elementIds) {
      this.changeElementStateInternal(elementId, on, isDisplayedByDefault, isHiddenDueToExclusiveAlwaysDrawnElements);
    }
  }

  private changeElementStateInternal(elementId: Id64String, on: boolean, isDisplayedByDefault: boolean, isHiddenDueToExclusiveAlwaysDrawnElements: boolean) {
    let changedNeverDraw = false;
    let changedAlwaysDrawn = false;

    const currNeverDrawn = new Set(this._props.viewport.neverDrawn ? this._props.viewport.neverDrawn : []);
    const currAlwaysDrawn = new Set(this._props.viewport.alwaysDrawn ? this._props.viewport.alwaysDrawn : /* istanbul ignore next */ []);

    if (on) {
      changedNeverDraw = changedNeverDraw || currNeverDrawn.delete(elementId);
      if ((!isDisplayedByDefault || isHiddenDueToExclusiveAlwaysDrawnElements) && !currAlwaysDrawn.has(elementId)) {
        currAlwaysDrawn.add(elementId);
        changedAlwaysDrawn = true;
      }
    } else {
      changedAlwaysDrawn = changedAlwaysDrawn || currAlwaysDrawn.delete(elementId);
      if (isDisplayedByDefault && !isHiddenDueToExclusiveAlwaysDrawnElements && !currNeverDrawn.has(elementId)) {
        currNeverDrawn.add(elementId);
        changedNeverDraw = true;
      }
    }

    changedNeverDraw && this._props.viewport.setNeverDrawn(currNeverDrawn);
    changedAlwaysDrawn && this._props.viewport.setAlwaysDrawn(currAlwaysDrawn, this._props.viewport.isAlwaysDrawnExclusive);
  }

  private isElementDisplayedByDefault(modelId: Id64String | undefined, categoryId: Id64String | undefined) {
    return (
      !!modelId &&
      this.getModelDisplayStatus(modelId).state === "visible" &&
      !!categoryId &&
      this.getCategoryDisplayStatus(categoryId, modelId).state === "visible"
    );
  }

  private hasExclusiveAlwaysDrawnElements() {
    return this._props.viewport.isAlwaysDrawnExclusive && 0 !== this._props.viewport.alwaysDrawn?.size;
  }

  private getCategoryParentModelId(categoryNode: TreeNodeItem): Id64String | undefined {
    return categoryNode.extendedData ? categoryNode.extendedData.modelId : /* istanbul ignore next */ undefined;
  }

  private getElementModelId(elementNode: TreeNodeItem): Id64String | undefined {
    return elementNode.extendedData ? elementNode.extendedData.modelId : /* istanbul ignore next */ undefined;
  }

  private getElementCategoryId(elementNode: TreeNodeItem): Id64String | undefined {
    return elementNode.extendedData ? elementNode.extendedData.categoryId : /* istanbul ignore next */ undefined;
  }

  private async getSubjectModelIds(subjectIds: Id64String[]): Promise<Id64Array> {
    return firstValueFrom(
      from(subjectIds).pipe(
        mergeMap((subjectId) => this._queryHandler.querySubjectModels(subjectId)),
        toArray(),
      ),
    );
  }

  /**
   * Wrapper for element IDs cache access which allows for easier stubbing in tests.
   */
  // istanbul ignore next
  private getAssemblyElementIds(elementId: string) {
    const elementIds = this._queryHandler.queryElementChildren(elementId);
    return eachValueFrom(elementIds);
  }

  /**
   * Wrapper for element IDs cache access which allows for easier stubbing in tests.
   */
  // istanbul ignore next
  private async getGroupedElementIds(groupingNodeKey: GroupingNodeKey) {
    return firstValueFrom(
      this._queryHandler.queryGroupingNodeChildren(groupingNodeKey).pipe(
        map((x) => {
          return {
            ...x,
            elementIds: {
              async *getElementIds() {
                for await (const item of eachValueFrom(x.elementIds)) {
                  yield item;
                }
              },
            },
          };
        }),
      ),
    );
  }
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
