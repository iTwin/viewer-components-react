/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom, from, isObservable, lastValueFrom, mergeAll, mergeMap, toArray } from "rxjs";
import { BeEvent } from "@itwin/core-bentley";
import { IModelApp, PerModelCategoryVisibility } from "@itwin/core-frontend";
import { NodeKey } from "@itwin/presentation-common";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";
import { Presentation } from "@itwin/presentation-frontend";
import { toggleAllCategories } from "../CategoriesVisibilityUtils";
import { ElementIdsCache } from "./internal/ElementIdsCache";
import { SubjectModelIdsCache } from "./internal/SubjectModelIdsCache";
import { VisibilityStateHandler } from "./internal/VisibilityStateHandler";
import * as NodeUtils from "./NodeUtils";

import type { TreeNodeItem } from "@itwin/components-react";
import type { Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { ECClassGroupingNodeKey, GroupingNodeKey } from "@itwin/presentation-common";
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
}

/**
 * Visibility handler used by [[ModelsTree]] to control visibility of the tree items.
 * @public
 */
export class ModelsVisibilityHandler implements IVisibilityHandler {
  private _props: ModelsVisibilityHandlerProps;
  private _pendingVisibilityChange: any | undefined;
  private _subjectModelIdsCache: SubjectModelIdsCache;
  private _visibilityStatusRetriever: VisibilityStateHandler;
  private _filteredDataProvider?: IFilteredPresentationTreeDataProvider;
  private _elementIdsCache: ElementIdsCache;
  private _listeners = new Array<() => void>();

  constructor(props: ModelsVisibilityHandlerProps) {
    this._props = props;
    this._subjectModelIdsCache = props.subjectModelIdsCache ?? new SubjectModelIdsCache(this._props.viewport.iModel);
    this._elementIdsCache = new ElementIdsCache(this._props.viewport.iModel, this._props.rulesetId);
    this._visibilityStatusRetriever = new VisibilityStateHandler({
      viewport: this._props.viewport,
      elementIdsCache: this._elementIdsCache,
      subjectModelIdsCache: this._subjectModelIdsCache,
    });
    this._listeners.push(this._props.viewport.onViewedCategoriesPerModelChanged.addListener(this.onViewChanged));
    this._listeners.push(this._props.viewport.onViewedCategoriesChanged.addListener(this.onViewChanged));
    this._listeners.push(this._props.viewport.onViewedModelsChanged.addListener(this.onViewChanged));
    this._listeners.push(this._props.viewport.onAlwaysDrawnChanged.addListener(this.onElementAlwaysDrawnChanged));
    this._listeners.push(this._props.viewport.onNeverDrawnChanged.addListener(this.onElementNeverDrawnChanged));
    if (this._props.hierarchyAutoUpdateEnabled) {
      this._listeners.push(Presentation.presentation.onIModelHierarchyChanged.addListener(/* istanbul ignore next */ () => this._elementIdsCache.clear())); // eslint-disable-line @itwin/no-internal
    }
  }

  public dispose() {
    this._listeners.forEach((remove) => remove());
    clearTimeout(this._pendingVisibilityChange);
  }

  public onVisibilityChange = new BeEvent<VisibilityChangeListener>();

  /** Sets data provider that is used to get filtered tree hierarchy. */
  public setFilteredDataProvider(provider: IFilteredPresentationTreeDataProvider | undefined) {
    this._filteredDataProvider = provider;
  }

  public static getNodeType(item: TreeNodeItem) {
    return NodeUtils.getNodeType(item);
  }

  /** Returns visibility status of the tree node. */
  public getVisibilityStatus(node: TreeNodeItem): VisibilityStatus | Promise<VisibilityStatus> {
    const result = this._visibilityStatusRetriever.getVisibilityStatus(node);
    if (isObservable(result)) {
      return firstValueFrom(result);
    }
    return result;
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
    return firstValueFrom(this._visibilityStatusRetriever.getSubjectNodeVisibility(node, from(ids)));
  }

  protected getModelDisplayStatus(id: Id64String): VisibilityStatus {
    return this._visibilityStatusRetriever.getModelDisplayStatus(id);
  }

  protected getCategoryDisplayStatus(id: Id64String, parentModelId: Id64String | undefined): VisibilityStatus {
    return this._visibilityStatusRetriever.getCategoryDisplayStatus(id, parentModelId);
  }

  protected async getElementGroupingNodeDisplayStatus(_id: string, key: ECClassGroupingNodeKey): Promise<VisibilityStatus> {
    return firstValueFrom(this._visibilityStatusRetriever.getElementGroupingNodeDisplayStatus(key));
  }

  protected getElementDisplayStatus(elementId: Id64String, modelId: Id64String | undefined, categoryId: Id64String | undefined): VisibilityStatus {
    return this._visibilityStatusRetriever.getElementDisplayStatus(elementId, modelId, categoryId);
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
    const modelIdsObs = from(ids).pipe(this.getSubjectModelIds, toArray());
    const modelIds = await lastValueFrom(modelIdsObs);
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

    const childIdsContainer = this._elementIdsCache.getAssemblyElementIds(id);
    for await (const childId of childIdsContainer.getElementIds()) {
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

  private getCategoryParentModelId(categoryNode: TreeNodeItem): Id64String | undefined {
    return categoryNode.extendedData ? categoryNode.extendedData.modelId : /* istanbul ignore next */ undefined;
  }

  private getElementModelId(elementNode: TreeNodeItem): Id64String | undefined {
    return elementNode.extendedData ? elementNode.extendedData.modelId : /* istanbul ignore next */ undefined;
  }

  private getElementCategoryId(elementNode: TreeNodeItem): Id64String | undefined {
    return elementNode.extendedData ? elementNode.extendedData.categoryId : /* istanbul ignore next */ undefined;
  }

  private getSubjectModelIds(subjectIds: Observable<Id64String>): Observable<Id64String> {
    return subjectIds.pipe(
      mergeMap((id) => this._subjectModelIdsCache.getSubjectModelIdObs(id)),
      mergeAll(),
    );
  }

  // istanbul ignore next
  private getAssemblyElementIds(assemblyId: Id64String) {
    return this._elementIdsCache.getAssemblyElementIds(assemblyId);
  }

  // istanbul ignore next
  private async getGroupedElementIds(groupingNodeKey: GroupingNodeKey) {
    return this._elementIdsCache.getGroupedElementIds(groupingNodeKey);
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
