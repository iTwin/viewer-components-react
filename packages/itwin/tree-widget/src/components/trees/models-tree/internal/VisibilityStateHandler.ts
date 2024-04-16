/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, defer, EMPTY, every, forkJoin, from, iif, isObservable, map, mergeAll, mergeMap, of, reduce, toArray } from "rxjs";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { NodeKey } from "@itwin/presentation-common";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";
import { and, reduceWhile, some } from "../../../utils/RxjsOperators";
import { getCategoryParentModelId, getElementCategoryId, getElementModelId, isCategoryNode, isModelNode, isSubjectNode } from "../NodeUtils";
import { createVisibilityStatus } from "./Tooltip";

import type { Visibility } from "./Tooltip";
import type { QueryProvider as QueryProvider } from "./QueryProvider";
import type { Viewport } from "@itwin/core-frontend";
import type { SubjectModelIdsCache } from "./SubjectModelIdsCache";
import type { ElementIdsCache } from "./ElementIdsCache";
import type { Id64String } from "@itwin/core-bentley";
import type { ECClassGroupingNodeKey } from "@itwin/presentation-common";
import type { IFilteredPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { VisibilityStatus } from "../../VisibilityTreeEventHandler";
import type { TreeNodeItem } from "@itwin/components-react";
import type { Observable, OperatorFunction } from "rxjs";
/**
 * Props for [[ModelsVisibilityHandler]]
 * @internal
 */
export interface VisibilityStatusRetrieverProps {
  viewport: Viewport;
  elementIdsCache: ElementIdsCache;
  subjectModelIdsCache: SubjectModelIdsCache;
  queryProvider: QueryProvider;
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
    const result: Observable<VisibilityStatus> = filteredDataProvider
      ? defer(async () => filteredDataProvider.getNodes(node)).pipe(
          mergeAll(),
          mergeMap((childNode) => {
            const res = this.getVisibilityStatus(childNode);
            return isObservable(res) ? res : of(res);
          }),
        )
      : subjectIds.pipe(
          this.subjectModelIds(),
          mergeAll(),
          mergeMap((x) => this.getModelDisplayStatus(x)),
        );

    return result.pipe(
      map((x) => x.state),
      getVisibilityStatusFromChildren({
        visible: "subject.allModelsVisible",
        hidden: "subject.allModelsHidden",
        partial: "subject.someModelsHidden",
      }),
    );
  }

  public getModelDisplayStatus(id: Id64String): Observable<VisibilityStatus> {
    if (!this._props.viewport.view.isSpatialView()) {
      return of(createVisibilityStatus("disabled", "model.nonSpatialView"));
    }
    const isDisplayed = this._props.viewport.view.viewsModel(id);
    if (!isDisplayed) {
      return of(createVisibilityStatus("hidden", undefined));
    }

    return this._props.queryProvider.queryModelElements(id).pipe(
      mergeMap(({ id: elementId, isCategory }) => {
        if (isCategory) {
          return this.getCategoryDisplayStatus(elementId, id);
        }
        return this.getElementDisplayStatus(elementId, id, undefined);
      }),
      map((x) => x.state),
      getVisibilityStatusFromChildren({
        visible: undefined,
        hidden: "model.allChildElementsHidden",
        partial: "model.someChildElementsHidden",
      }),
    );
  }

  private getCategoryViewportVisibility(id: Id64String) {
    const isDisplayed = this._props.viewport.view.viewsCategory(id);
    return isDisplayed
      ? createVisibilityStatus("visible", "category.displayedThroughCategorySelector")
      : createVisibilityStatus("hidden", "category.hiddenThroughCategorySelector");
  }

  public getCategoryDisplayStatus(id: Id64String, parentModelId: Id64String | undefined): Observable<VisibilityStatus> {
    if (!parentModelId) {
      return of(this.getCategoryViewportVisibility(id));
    }

    return this.getModelDisplayStatus(parentModelId).pipe(
      map((modelStatus) => {
        if (modelStatus.state === "hidden") {
          return createVisibilityStatus("hidden", "category.modelNotDisplayed");
        }

        const override = this._props.viewport.perModelCategoryVisibility.getOverride(parentModelId, id);
        switch (override) {
          case PerModelCategoryVisibility.Override.Show:
            return createVisibilityStatus("visible", "category.displayedThroughPerModelOverride");
          case PerModelCategoryVisibility.Override.Hide:
            return createVisibilityStatus("hidden", "category.hiddenThroughPerModelOverride");
        }
        return this.getCategoryViewportVisibility(id);
      }),
    );
  }

  public getElementGroupingNodeDisplayStatus(key: ECClassGroupingNodeKey): Observable<VisibilityStatus> {
    return this._props.elementIdsCache.getGroupedElementIds(key).pipe(
      mergeMap(({ modelId, categoryId, elementIds }) => {
        if (!modelId || !this._props.viewport.view.viewsModel(modelId)) {
          return of(createVisibilityStatus("disabled", "element.modelNotDisplayed"));
        }

        if (!this._props.viewport.alwaysDrawn && !this._props.viewport.neverDrawn) {
          const res = categoryId ? this.getCategoryDisplayStatus(categoryId, modelId).pipe(map((x) => x.state === "visible")) : of(false);
          return res.pipe(map((x) => (x ? createVisibilityStatus("visible") : createVisibilityStatus("hidden", "element.hiddenThroughCategory"))));
        }

        return forkJoin({
          hasAlwaysDrawn: this._props.viewport.alwaysDrawn ? elementIds.pipe(some((id) => this._props.viewport.alwaysDrawn!.has(id))) : of(false),
          allNeverDrawn: this._props.viewport.neverDrawn ? elementIds.pipe(every((id) => this._props.viewport.neverDrawn!.has(id))) : of(false),
        }).pipe(
          mergeMap(({ hasAlwaysDrawn, allNeverDrawn }) => {
            return this.getElementDisplayStatusInternal(hasAlwaysDrawn, allNeverDrawn, modelId, categoryId);
          }),
        );
      }),
    );
  }

  private getElementDisplayStatusInternal(alwaysDrawn: boolean, neverDrawn: boolean, modelId: Id64String | undefined, categoryId: Id64String | undefined) {
    if (neverDrawn) {
      return createVisibilityStatusObs("hidden", "element.hiddenThroughNeverDrawnList");
    }

    if (this._props.viewport.alwaysDrawn) {
      if (alwaysDrawn) {
        return createVisibilityStatusObs("visible", "element.displayedThroughAlwaysDrawnList");
      }

      if (this.hasExclusiveAlwaysDrawnElements()) {
        return createVisibilityStatusObs("hidden", "element.hiddenDueToOtherElementsExclusivelyAlwaysDrawn");
      }
    }

    const res: Observable<VisibilityStatus | undefined> = categoryId ? this.getCategoryDisplayStatus(categoryId, modelId) : of(undefined);
    return res.pipe(
      map((x) => {
        return x?.state === "visible" ? createVisibilityStatus("visible") : createVisibilityStatus("hidden", "element.hiddenThroughCategory");
      }),
    );
  }

  public getElementDisplayStatus(elementId: Id64String, modelId: Id64String | undefined, categoryId: Id64String | undefined): Observable<VisibilityStatus> {
    if (!modelId || !this._props.viewport.view.viewsModel(modelId)) {
      return createVisibilityStatusObs("disabled", "element.modelNotDisplayed");
    }

    if (this._props.viewport.neverDrawn?.has(elementId)) {
      return createVisibilityStatusObs("hidden", "element.hiddenThroughNeverDrawnList");
    }

    if (this._props.viewport.alwaysDrawn) {
      if (this._props.viewport.alwaysDrawn.has(elementId)) {
        return createVisibilityStatusObs("visible", "element.displayedThroughAlwaysDrawnList");
      }

      if (this._props.viewport.alwaysDrawn.size !== 0) {
        return createVisibilityStatusObs("hidden", "element.hiddenDueToOtherElementsExclusivelyAlwaysDrawn");
      }
    }

    const res: Observable<VisibilityStatus | undefined> = categoryId ? this.getCategoryDisplayStatus(categoryId, modelId) : of(undefined);
    return res.pipe(
      map((x) => {
        return x?.state === "visible" ? createVisibilityStatus("visible") : createVisibilityStatus("hidden", "element.hiddenThroughCategory");
      }),
    );
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
      this.subjectModelIds(),
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
    return (obs) => {
      return this.isElementDisplayedByDefault(modelId, categoryId).pipe(
        mergeMap((isDisplayedByDefault) => {
          const isHiddenDueToExclusiveAlwaysDrawnElements = this.hasExclusiveAlwaysDrawnElements();
          return obs.pipe(this.updateAlwaysAndNeverDrawnLists({ isDisplayedByDefault, isHiddenDueToExclusiveAlwaysDrawnElements, on }));
        }),
      );
    };
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

  private isElementDisplayedByDefault(modelId: Id64String | undefined, categoryId: Id64String | undefined): Observable<boolean> {
    return and(
      modelId ? this.getModelDisplayStatus(modelId).pipe(map((x) => x.state === "visible")) : of(false),
      categoryId ? this.getModelDisplayStatus(categoryId).pipe(map((x) => x.state === "visible")) : of(false),
    );
  }

  private hasExclusiveAlwaysDrawnElements() {
    return this._props.viewport.isAlwaysDrawnExclusive && 0 !== this._props.viewport.alwaysDrawn?.size;
  }

  private subjectModelIds(): OperatorFunction<Id64String, Id64String> {
    return (subjectIds) => {
      return subjectIds.pipe(
        mergeMap((id) => this._props.subjectModelIdsCache.getSubjectModelIdObs(id)),
        mergeAll(),
      );
    };
  }
}

const createVisibilityStatusObs = (status: Visibility | "disabled", tooltipStringId?: string) => of(createVisibilityStatus(status, tooltipStringId));

function getVisibilityFromChildren(obs: Observable<Visibility>): Observable<Visibility> {
  return obs.pipe(
    reduceWhile(
      (x) => x.allVisible || x.allHidden,
      (acc, val) => {
        acc.allVisible &&= val === "visible";
        acc.allHidden &&= val === "hidden";
        return acc;
      },
      { allVisible: true, allHidden: true },
    ),
    map((x) => {
      if (!x) {
        // TODO: No children?
        return "visible";
      }
      return x.allVisible ? "visible" : x.allHidden ? "hidden" : "partial";
    }),
  );
}

function getVisibilityStatusFromChildren(tooltipMap: {
  [key in Visibility]: string | undefined;
}): OperatorFunction<Visibility, VisibilityStatus> {
  return (obs) => {
    return getVisibilityFromChildren(obs).pipe(map((visibility) => createVisibilityStatus(visibility, tooltipMap[visibility])));
  };
}
