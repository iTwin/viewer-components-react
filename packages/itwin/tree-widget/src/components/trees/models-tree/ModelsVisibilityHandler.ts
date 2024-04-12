/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom, from, isObservable, mergeAll, mergeMap } from "rxjs";
import { BeEvent } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import { toggleAllCategories } from "../CategoriesVisibilityUtils";
import { ElementIdsCache } from "./internal/ElementIdsCache";
import { SubjectModelIdsCache } from "./internal/SubjectModelIdsCache";
import { VisibilityStateHandler } from "./internal/VisibilityStateHandler";
import * as NodeUtils from "./NodeUtils";

import type { ECClassGroupingNodeKey, GroupingNodeKey, NodeKey } from "@itwin/presentation-common";
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
}

/**
 * Visibility handler used by [[ModelsTree]] to control visibility of the tree items.
 * @public
 */
export class ModelsVisibilityHandler implements IVisibilityHandler {
  private _props: ModelsVisibilityHandlerProps;
  private _pendingVisibilityChange: any | undefined;
  private _subjectModelIdsCache: SubjectModelIdsCache;
  private _visibilityStateHandler: VisibilityStateHandler;
  private _elementIdsCache: ElementIdsCache;
  private _listeners = new Array<() => void>();

  constructor(props: ModelsVisibilityHandlerProps) {
    this._props = props;
    this._subjectModelIdsCache = props.subjectModelIdsCache ?? new SubjectModelIdsCache(this._props.viewport.iModel);
    this._elementIdsCache = new ElementIdsCache(this._props.viewport.iModel, this._props.rulesetId);
    this._visibilityStateHandler = new VisibilityStateHandler({
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

  protected getModelDisplayStatus(id: Id64String): VisibilityStatus {
    return this._visibilityStateHandler.getModelDisplayStatus(id);
  }

  protected getCategoryDisplayStatus(id: Id64String, parentModelId: Id64String | undefined): VisibilityStatus {
    return this._visibilityStateHandler.getCategoryDisplayStatus(id, parentModelId);
  }

  protected async getElementGroupingNodeDisplayStatus(_id: string, key: ECClassGroupingNodeKey): Promise<VisibilityStatus> {
    return firstValueFrom(this._visibilityStateHandler.getElementGroupingNodeDisplayStatus(key));
  }

  protected getElementDisplayStatus(elementId: Id64String, modelId: Id64String | undefined, categoryId: Id64String | undefined): VisibilityStatus {
    return this._visibilityStateHandler.getElementDisplayStatus(elementId, modelId, categoryId);
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
