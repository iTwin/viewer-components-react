/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, defer, EMPTY, every, forkJoin, from, iif, map, mergeAll, mergeMap, of, reduce, toArray } from "rxjs";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { NodeKey } from "@itwin/presentation-common";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";
import { TreeWidget } from "../../../../TreeWidget";
import { getCategoryParentModelId, getElementCategoryId, getElementModelId, isCategoryNode, isModelNode, isSubjectNode } from "../NodeUtils";

import type { SubjectModelIdsCache } from "./SubjectModelIdsCache";
import type { ElementIdsCache } from "./ElementIdsCache";
import type { Id64String } from "@itwin/core-bentley";
import type { ECClassGroupingNodeKey } from "@itwin/presentation-common";
import type { Viewport } from "@itwin/core-frontend";
import type { IFilteredPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { VisibilityStatus } from "../../VisibilityTreeEventHandler";
import type { TreeNodeItem } from "@itwin/components-react";
import type { Observable, OperatorFunction } from "rxjs";
/**
 * Props for [[ModelsVisibilityHandler]]
 */
export interface VisibilityStatusRetrieverProps {
  viewport: Viewport;
  elementIdsCache: ElementIdsCache;
  subjectModelIdsCache: SubjectModelIdsCache;
}

/** @internal */
export class VisibilityStateHandler {
  private _filteredDataProvider?: IFilteredPresentationTreeDataProvider;

  constructor(private readonly _props: VisibilityStatusRetrieverProps) {}

  public set filteredDataProvider(provider: IFilteredPresentationTreeDataProvider | undefined) {
    this._filteredDataProvider = provider;
  }

  public getVisibilityStatus(node: TreeNodeItem): VisibilityStatus | Observable<VisibilityStatus> {
    const nodeKey = isPresentationTreeNodeItem(node) ? node.key : undefined;
    if (!nodeKey) {
      return createVisibilityStatus("disabled");
    }

    if (NodeKey.isClassGroupingNodeKey(nodeKey)) {
      return from(this.getElementGroupingNodeDisplayStatus(nodeKey));
    }

    if (!NodeKey.isInstancesNodeKey(nodeKey)) {
      return createVisibilityStatus("disabled");
    }

    if (isSubjectNode(node)) {
      // note: subject nodes may be merged to represent multiple subject instances
      return this.getSubjectNodeVisibility(node, from(nodeKey.instanceKeys).pipe(map((key) => key.id)));
    }

    if (isModelNode(node)) {
      return this.getModelDisplayStatus(nodeKey.instanceKeys[0].id);
    }

    if (isCategoryNode(node)) {
      return this.getCategoryDisplayStatus(nodeKey.instanceKeys[0].id, getCategoryParentModelId(node));
    }

    return this.getElementDisplayStatus(nodeKey.instanceKeys[0].id, getElementModelId(node), getElementCategoryId(node));
  }

  public getSubjectNodeVisibility(node: TreeNodeItem, subjectIds: Observable<Id64String>): Observable<VisibilityStatus> {
    if (!this._props.viewport.view.isSpatialView()) {
      return of(createVisibilityStatus("disabled", "subject.nonSpatialView"));
    }

    const filteredDataProvider = this._filteredDataProvider;
    const result = filteredDataProvider
      ? defer(async () => filteredDataProvider.getNodes(node)).pipe(
          mergeAll(),
          mergeMap((childNode) => {
            const res = this.getVisibilityStatus(childNode);
            return res instanceof Promise ? from(res) : of(res);
          }),
        )
      : subjectIds.pipe(
          this.getSubjectModelIds,
          mergeAll(),
          map((x) => this.getModelDisplayStatus(x)),
        );

    return result.pipe(
      map((x) => x.state),
      reduce(
        (acc, val) => {
          acc.allVisible &&= val === "visible";
          acc.allHidden &&= val === "hidden";
          return acc;
        },
        { allVisible: true, allHidden: true },
      ),
      map(({ allVisible, allHidden }) => {
        if (allVisible) {
          return createVisibilityStatus("visible", "subject.allModelsVisible");
        }

        if (allHidden) {
          return createVisibilityStatus("hidden", "subject.allModelsHidden");
        }

        return createVisibilityStatus("partial", "subject.someModelsHidden");
      }),
    );
  }

  public getModelDisplayStatus(id: Id64String): VisibilityStatus {
    if (!this._props.viewport.view.isSpatialView()) {
      return createVisibilityStatus("disabled", "model.nonSpatialView");
    }
    const isDisplayed = this._props.viewport.view.viewsModel(id);
    return createVisibilityStatus(isDisplayed ? "visible" : "hidden", undefined);
  }

  public getCategoryDisplayStatus(id: Id64String, parentModelId: Id64String | undefined): VisibilityStatus {
    if (parentModelId) {
      if (this.getModelDisplayStatus(parentModelId).state === "hidden") {
        return createVisibilityStatus("hidden", "category.modelNotDisplayed");
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

  public getElementGroupingNodeDisplayStatus(key: ECClassGroupingNodeKey): Observable<VisibilityStatus> {
    return this._props.elementIdsCache.getGroupedElementIds(key).pipe(
      mergeMap(({ modelId, categoryId, elementIds }) => {
        if (!modelId || !this._props.viewport.view.viewsModel(modelId)) {
          return of(createVisibilityStatus("disabled", "element.modelNotDisplayed"));
        }

        if (!this._props.viewport.alwaysDrawn && !this._props.viewport.neverDrawn) {
          if (categoryId && this.getCategoryDisplayStatus(categoryId, modelId).state === "visible") {
            return of(createVisibilityStatus("visible"));
          }
          return of(createVisibilityStatus("hidden", "element.hiddenThroughCategory"));
        }

        return forkJoin({
          hasAlwaysDrawn: this._props.viewport.alwaysDrawn ? elementIds.pipe(map((id) => this._props.viewport.alwaysDrawn!.has(id))) : of(false),
          allNeverDrawn: this._props.viewport.neverDrawn ? elementIds.pipe(every((id) => this._props.viewport.neverDrawn!.has(id))) : of(false),
        }).pipe(
          map(({ hasAlwaysDrawn, allNeverDrawn }) => {
            if (hasAlwaysDrawn) {
              return createVisibilityStatus("visible", "element.displayedThroughAlwaysDrawnList");
            }

            if (allNeverDrawn) {
              return createVisibilityStatus("hidden", "element.hiddenThroughNeverDrawnList");
            }

            if (this._props.viewport.alwaysDrawn?.size) {
              return createVisibilityStatus("hidden", "element.hiddenDueToOtherElementsExclusivelyAlwaysDrawn");
            }

            if (categoryId && this.getCategoryDisplayStatus(categoryId, modelId).state === "visible") {
              return createVisibilityStatus("visible");
            }

            return createVisibilityStatus("hidden", "element.hiddenThroughCategory");
          }),
        );
      }),
    );
  }

  public getElementDisplayStatus(elementId: Id64String, modelId: Id64String | undefined, categoryId: Id64String | undefined): VisibilityStatus {
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

      if (this.hasExclusiveAlwaysDrawnElements()) {
        return createVisibilityStatus("hidden", "element.hiddenDueToOtherElementsExclusivelyAlwaysDrawn");
      }
    }
    if (categoryId && this.getCategoryDisplayStatus(categoryId, modelId).state === "visible") {
      return createVisibilityStatus("visible", "visible");
    }
    return createVisibilityStatus("hidden", "element.hiddenThroughCategory");
  }

  /** Changes visibility of the items represented by the tree node. */
  public changeVisibility(node: TreeNodeItem, on: boolean): Observable<void> {
    if (!isPresentationTreeNodeItem(node)) {
      return EMPTY;
    }
    const nodeKey = node.key;

    if (NodeKey.isClassGroupingNodeKey(nodeKey)) {
      return this.changeElementGroupingNodeState(nodeKey, on);
    }

    if (!NodeKey.isInstancesNodeKey(nodeKey)) {
      return EMPTY;
    }

    if (isSubjectNode(node)) {
      return this.changeSubjectNodeState(from(nodeKey.instanceKeys).pipe(map((key) => key.id)), node, on);
    }

    if (isModelNode(node)) {
      return this.changeModelState(nodeKey.instanceKeys[0].id, on);
    }

    if (isCategoryNode(node)) {
      this.changeCategoryState(nodeKey.instanceKeys[0].id, getCategoryParentModelId(node), on);
      return EMPTY;
    }

    return this.changeElementState(nodeKey.instanceKeys[0].id, getElementModelId(node), getElementCategoryId(node), on, node.hasChildren);
  }

  public changeSubjectNodeState(ids: Observable<Id64String>, node: TreeNodeItem, on: boolean): Observable<void> {
    if (!this._props.viewport.view.isSpatialView()) {
      return EMPTY;
    }

    if (this._filteredDataProvider) {
      return this.changeFilteredSubjectState(this._filteredDataProvider, ids, node, on);
    }

    return this.changeSubjectState(ids, on);
  }

  private changeFilteredSubjectState(
    provider: IFilteredPresentationTreeDataProvider,
    ids: Observable<Id64String>,
    node: TreeNodeItem,
    on: boolean,
  ): Observable<void> {
    if (provider.nodeMatchesFilter(node)) {
      return this.changeSubjectState(ids, on);
    }

    return from(provider.getNodes()).pipe(
      mergeAll(),
      mergeMap((childNode) => this.changeVisibility(childNode, on)),
    );
  }

  private changeSubjectState(ids: Observable<Id64String>, on: boolean): Observable<void> {
    return ids.pipe(
      this.getSubjectModelIds,
      toArray(),
      mergeMap((modelId) => this.changeModelsVisibility(modelId, on)),
    );
  }

  public changeModelState(id: Id64String, on: boolean): Observable<void> {
    if (!this._props.viewport.view.isSpatialView()) {
      return EMPTY;
    }

    return this.changeModelsVisibility([id], on);
  }

  public changeModelsVisibility(ids: Id64String[], visible: boolean): Observable<void> {
    if (visible) {
      return from(this._props.viewport.addViewedModels(ids));
    }

    this._props.viewport.changeModelDisplay(ids, false);
    return EMPTY;
  }

  public changeCategoryState(categoryId: Id64String, parentModelId: Id64String | undefined, on: boolean) {
    if (!parentModelId) {
      return this._props.viewport.changeCategoryDisplay([categoryId], on, on);
    }

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
  }

  public changeElementGroupingNodeState(key: ECClassGroupingNodeKey, on: boolean): Observable<void> {
    return this._props.elementIdsCache.getGroupedElementIds(key).pipe(
      mergeMap(({ modelId, categoryId, elementIds }) => {
        return elementIds.pipe(this.changeElementsState(modelId, categoryId, on));
      }),
    );
  }

  /**
   * Update visibility of an element and all it's child elements
   * by adding them to the always/never drawn list.
   */
  public changeElementState(
    id: Id64String,
    modelId: Id64String | undefined,
    categoryId: Id64String | undefined,
    on: boolean,
    hasChildren?: boolean,
  ): Observable<void> {
    return concat(
      of(id).pipe(this.changeElementsState(modelId, categoryId, on)),
      iif(() => !!hasChildren, this._props.elementIdsCache.getAssemblyElementIds(id).pipe(this.changeElementsState(modelId, categoryId, on)), EMPTY),
    );
  }

  /** Update visibility of a shallow list of elements by adding them to the always/never drawn list. */
  public changeElementsState(modelId: Id64String | undefined, categoryId: Id64String | undefined, on: boolean): OperatorFunction<string, void> {
    const isDisplayedByDefault = this.isElementDisplayedByDefault(modelId, categoryId);
    const isHiddenDueToExclusiveAlwaysDrawnElements = this.hasExclusiveAlwaysDrawnElements();
    return this.updateAlwaysAndNeverDrawnLists({ isDisplayedByDefault, isHiddenDueToExclusiveAlwaysDrawnElements, on });
  }

  private updateAlwaysAndNeverDrawnLists(props: {
    isDisplayedByDefault: boolean;
    isHiddenDueToExclusiveAlwaysDrawnElements: boolean;
    on: boolean;
  }): OperatorFunction<string, void> {
    return (elementIds: Observable<string>) => {
      const { on, isDisplayedByDefault, isHiddenDueToExclusiveAlwaysDrawnElements } = props;
      return elementIds.pipe(
        reduce(
          (acc, elementId) => {
            if (on) {
              acc.changedNeverDrawn ||= acc.neverDrawn.delete(elementId);
              if ((!isDisplayedByDefault || isHiddenDueToExclusiveAlwaysDrawnElements) && !acc.alwaysDrawn.has(elementId)) {
                acc.alwaysDrawn.add(elementId);
                acc.changedAlwaysDrawn = true;
              }
            } else {
              acc.changedAlwaysDrawn ||= acc.alwaysDrawn.delete(elementId);
              if (isDisplayedByDefault && !isHiddenDueToExclusiveAlwaysDrawnElements && !acc.neverDrawn.has(elementId)) {
                acc.neverDrawn.add(elementId);
                acc.changedNeverDrawn = true;
              }
            }
            return acc;
          },
          {
            changedNeverDrawn: false,
            changedAlwaysDrawn: false,
            neverDrawn: new Set(this._props.viewport.neverDrawn || []),
            alwaysDrawn: new Set(this._props.viewport.alwaysDrawn || []),
          },
        ),
        map((state) => {
          state.changedNeverDrawn && this._props.viewport.setNeverDrawn(state.neverDrawn);
          state.changedAlwaysDrawn && this._props.viewport.setAlwaysDrawn(state.alwaysDrawn, this._props.viewport.isAlwaysDrawnExclusive);
        }),
      );
    };
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

  private getSubjectModelIds(subjectIds: Observable<Id64String>): Observable<Id64String> {
    return subjectIds.pipe(
      mergeMap((id) => this._props.subjectModelIdsCache.getSubjectModelIdObs(id)),
      mergeAll(),
    );
  }
}

function createVisibilityStatus(status: "visible" | "hidden" | "partial" | "disabled", tooltipStringId?: string): VisibilityStatus {
  return { state: status === "disabled" ? "hidden" : status, tooltip: createTooltip(status, tooltipStringId) };
}

// istanbul-ignore-next
function createTooltip(status: "visible" | "hidden" | "partial" | "disabled", tooltipStringId: string | undefined): string {
  const statusStringId = `modelTree.status.${status}`;
  const statusString = TreeWidget.translate(statusStringId);
  if (!tooltipStringId) {
    return statusString;
  }

  tooltipStringId = `modelTree.tooltips.${tooltipStringId}`;
  const tooltipString = TreeWidget.translate(tooltipStringId);
  return `${statusString}: ${tooltipString}`;
}
