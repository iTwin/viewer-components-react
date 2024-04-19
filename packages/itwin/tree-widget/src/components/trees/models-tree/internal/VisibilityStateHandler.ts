/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, concatWith, defer, EMPTY, filter, from, map, mergeAll, mergeMap, of, reduce, toArray } from "rxjs";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { NodeKey } from "@itwin/presentation-common";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";
import { reduceWhile } from "../../common/Rxjs";
import { getCategoryParentModelId, getElementCategoryId, getElementModelId, isCategoryNode, isModelNode, isSubjectNode } from "./NodeUtils";
import { createVisibilityStatus } from "./Tooltip";

import type { Visibility } from "./Tooltip";
import type { IQueryProvider as IQueryProvider } from "./QueryProvider";
import type { SubjectModelIdsCache } from "./SubjectModelIdsCache";
import type { ElementIdsCache } from "./ElementIdsCache";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { ECClassGroupingNodeKey } from "@itwin/presentation-common";
import type { IFilteredPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { VisibilityStatus } from "../../VisibilityTreeEventHandler";
import type { TreeNodeItem } from "@itwin/components-react";
import type { Observable, OperatorFunction } from "rxjs";
import type { Viewport as CoreViewport, ViewState } from "@itwin/core-frontend";

/**
 * Limited version of core `Viewport` that is easier to instantiate in tests.
 * @internal
 */
export type Viewport = Pick<
  CoreViewport,
  | "alwaysDrawn"
  | "neverDrawn"
  | "setAlwaysDrawn"
  | "setNeverDrawn"
  | "isAlwaysDrawnExclusive"
  | "addViewedModels"
  | "changeModelDisplay"
  | "changeCategoryDisplay"
> & {
  perModelCategoryVisibility: Pick<PerModelCategoryVisibility.Overrides, "setOverride" | "getOverride">;
  view: Pick<ViewState, "isSpatialView" | "viewsCategory" | "viewsModel">;
};

/**
 * Props for [[ModelsVisibilityHandler]]
 * @internal
 */
export interface VisibilityStatusRetrieverProps {
  viewport: Viewport;
  elementIdsCache: ElementIdsCache;
  subjectModelIdsCache: SubjectModelIdsCache;
  queryProvider: IQueryProvider;
}

/** @internal */
export class VisibilityStateHandler {
  private _filteredDataProvider?: IFilteredPresentationTreeDataProvider;

  constructor(private readonly _props: VisibilityStatusRetrieverProps) {}

  public set filteredDataProvider(provider: IFilteredPresentationTreeDataProvider | undefined) {
    this._filteredDataProvider = provider;
  }

  public getVisibilityStatus(node: TreeNodeItem): Observable<VisibilityStatus> {
    const nodeKey = isPresentationTreeNodeItem(node) ? node.key : undefined;
    if (!nodeKey) {
      return createVisibilityStatusObs("disabled");
    }

    if (NodeKey.isClassGroupingNodeKey(nodeKey)) {
      return from(this.getElementGroupingNodeDisplayStatus(nodeKey));
    }

    if (!NodeKey.isInstancesNodeKey(nodeKey)) {
      return createVisibilityStatusObs("disabled");
    }

    if (isSubjectNode(node)) {
      // note: subject nodes may be merged to represent multiple subject instances
      return this.getSubjectNodeVisibilityStatus(node, from(nodeKey.instanceKeys).pipe(map((key) => key.id)));
    }

    if (isModelNode(node)) {
      return this.getModelVisibilityStatus(nodeKey.instanceKeys[0].id);
    }

    if (isCategoryNode(node)) {
      return this.getCategoryDisplayStatus(nodeKey.instanceKeys[0].id, getCategoryParentModelId(node));
    }

    return this.getElementDisplayStatus(nodeKey.instanceKeys[0].id).pipe(map((x) => x ?? createVisibilityStatus("visible")));
  }

  public getSubjectNodeVisibilityStatus(node: TreeNodeItem, subjectIds: Observable<Id64String>): Observable<VisibilityStatus> {
    if (!this._props.viewport.view.isSpatialView()) {
      return of(createVisibilityStatus("disabled", "subject.nonSpatialView"));
    }

    const filteredDataProvider = this._filteredDataProvider;
    const result: Observable<VisibilityStatus> = filteredDataProvider
      ? defer(async () => filteredDataProvider.getNodes(node)).pipe(
          mergeAll(),
          mergeMap((childNode) => this.getVisibilityStatus(childNode)),
        )
      : subjectIds.pipe(
          mergeMap((id) => this._props.subjectModelIdsCache.getSubjectModelIdObs(id)),
          mergeMap((x) => this.getModelVisibilityStatus(x)),
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

  public getModelVisibilityStatus(modelId: Id64String): Observable<VisibilityStatus> {
    if (!this._props.viewport.view.isSpatialView()) {
      return of(createVisibilityStatus("disabled", "model.nonSpatialView"));
    }

    return this._props.queryProvider.queryModelCategories(modelId).pipe(
      mergeMap((categoryId) => this.getCategoryDisplayStatus(categoryId, modelId)),
      map((x) => x.state),
      getVisibilityStatusFromChildren({
        visible: undefined,
        hidden: "model.allChildElementsHidden",
        partial: "model.someChildElementsHidden",
      }),
    );
  }

  private getCategoryViewportVisibilityStatus(categoryId: Id64String) {
    const isVisible = this._props.viewport.view.viewsCategory(categoryId);
    return isVisible
      ? createVisibilityStatus("visible", "category.visibleThroughCategorySelector")
      : createVisibilityStatus("hidden", "category.hiddenThroughCategorySelector");
  }

  private getDefaultCategoryVisibilityStatus(categoryId: Id64String, modelId: Id64String | undefined): VisibilityStatus {
    const viewportVisibility = this.getCategoryViewportVisibilityStatus(categoryId);
    if (!modelId) {
      return viewportVisibility;
    }

    switch (this._props.viewport.perModelCategoryVisibility.getOverride(modelId, categoryId)) {
      case PerModelCategoryVisibility.Override.Show:
        return createVisibilityStatus("visible");
      case PerModelCategoryVisibility.Override.Hide:
        return createVisibilityStatus("hidden");
    }

    return viewportVisibility;
  }

  public getCategoryDisplayStatus(categoryId: Id64String, modelId: Id64String | undefined, hasChildren?: boolean): Observable<VisibilityStatus> {
    return defer(() => {
      const defaultStatus = this.getDefaultCategoryVisibilityStatus(categoryId, modelId);
      if (hasChildren === false) {
        return of(defaultStatus);
      }

      return this._props.queryProvider.queryCategoryElements(categoryId, modelId).pipe(
        mergeMap((x) => this.getElementDisplayStatus(x.id, x.hasChildren)),
        map((x) => x?.state ?? defaultStatus.state),
        getVisibilityStatusFromChildren({
          visible: undefined,
          hidden: "category.allChildrenAreHidden",
          partial: "category.someChildrenAreHidden",
          empty: () => defaultStatus,
        }),
      );
    });
  }

  public getElementGroupingNodeDisplayStatus(key: ECClassGroupingNodeKey): Observable<VisibilityStatus> {
    return this._props.elementIdsCache.getGroupedElementIds(key).pipe(
      mergeMap(({ elementIds }) => elementIds),
      mergeMap((x) => this.getElementDisplayStatus(x)),
      map((x) => x?.state ?? "visible"),
      getVisibilityStatusFromChildren({
        visible: undefined,
        hidden: "element.allChildrenAreHidden",
        partial: "element.someChildrenAreHidden",
      }),
    );
  }

  /**
   * Returns element visibility status if it can affect parent's visibility.
   */
  private getElementOverriddenVisibility(id: Id64String): VisibilityStatus | undefined {
    if (this._props.viewport.neverDrawn?.has(id)) {
      return createVisibilityStatus("hidden", "element.hiddenThroughNeverDrawnList");
    }

    if (this._props.viewport.alwaysDrawn) {
      if (this._props.viewport.alwaysDrawn.has(id)) {
        return createVisibilityStatus("visible", "element.displayedThroughAlwaysDrawnList");
      }

      if (this._props.viewport.alwaysDrawn.size !== 0) {
        return createVisibilityStatus("hidden", "element.hiddenDueToOtherElementsExclusivelyAlwaysDrawn");
      }
    }

    return undefined;
  }

  public getElementDisplayStatus(id: Id64String, hasChildren?: boolean): Observable<VisibilityStatus | undefined> {
    if (hasChildren === false) {
      return of(this.getElementOverriddenVisibility(id));
    }

    return this._props.queryProvider.queryElementChildren(id).pipe(
      mergeMap((x) => this.getElementDisplayStatus(x.id, x.hasChildren)),
      filter((x): x is Exclude<typeof x, undefined> => !!x),
      map((x) => x.state),
      getVisibilityStatusFromChildren({
        visible: undefined,
        hidden: "element.allChildrenAreHidden",
        partial: "element.someChildrenAreHidden",
        empty: () => this.getElementOverriddenVisibility(id),
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

    return this.changeElementState({
      id: nodeKey.instanceKeys[0].id,
      on,
      modelId: getElementModelId(node),
      categoryId: getElementCategoryId(node),
      hasChildren: node.hasChildren,
    });
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

  private changeSubjectState(ids: Observable<Id64String>, on: boolean): Observable<void> {
    return ids.pipe(
      mergeMap((x) => this._props.subjectModelIdsCache.getSubjectModelIdObs(x)),
      toArray(),
      mergeMap((modelId) => this.changeModelState(modelId, on)),
    );
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

  public changeModelState(ids: Id64Arg, visible: boolean): Observable<void> {
    if (!this._props.viewport.view.isSpatialView()) {
      return EMPTY;
    }

    return concat(
      defer(() => {
        if (visible) {
          return from(this._props.viewport.addViewedModels(ids));
        }

        this._props.viewport.changeModelDisplay(ids, false);
        return EMPTY;
      }),
      (typeof ids === "string" ? of(ids) : from(ids)).pipe(
        mergeMap((modelId) => {
          return this._props.queryProvider.queryModelCategories(modelId).pipe(map((categoryId) => this.changeCategoryState(categoryId, modelId, visible)));
        }),
      ),
    );
  }

  public changeCategoryState(categoryId: Id64String, parentModelId: Id64String | undefined, on: boolean) {
    if (!parentModelId) {
      return this._props.viewport.changeCategoryDisplay(categoryId, on, on);
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
      this._props.viewport.changeCategoryDisplay(categoryId, true, true);
    }
  }

  public changeElementGroupingNodeState(key: ECClassGroupingNodeKey, on: boolean): Observable<void> {
    return this._props.elementIdsCache.getGroupedElementIds(key).pipe(
      mergeMap(({ modelId, categoryId, elementIds }) => {
        return elementIds.pipe(mergeMap((id) => this.changeElementState({ id, on, modelId, categoryId })));
      }),
    );
  }

  /**
   * Update visibility of an element and all it's child elements
   * by adding them to the always/never drawn list.
   */
  public changeElementState(props: {
    id: Id64String;
    modelId: Id64String | undefined;
    categoryId: Id64String | undefined;
    on: boolean;
    hasChildren?: boolean;
  }): Observable<void> {
    const isDisplayedByDefault = this.getElementDefaultVisibility(props);
    const { id, on, hasChildren } = props;
    return of(id).pipe(
      concatWith(hasChildren === false ? EMPTY : from(this._props.elementIdsCache.getAssemblyElementIds(id))),
      this.changeElementStateNoChildrenOperator({ on, isDisplayedByDefault }),
    );
  }

  private getElementDefaultVisibility({ modelId, categoryId }: { modelId: string | undefined; categoryId: string | undefined }): boolean {
    return !!modelId && this._props.viewport.view.viewsModel(modelId) && !!categoryId && this._props.viewport.view.viewsCategory(categoryId);
  }

  private changeElementStateNoChildrenOperator(props: { on: boolean; isDisplayedByDefault: boolean }): OperatorFunction<string, void> {
    return (elementIds: Observable<string>) => {
      const { on, isDisplayedByDefault } = props;
      const isAlwaysDrawnExclusive = this._props.viewport.isAlwaysDrawnExclusive;
      return elementIds.pipe(
        reduce(
          (acc, elementId) => {
            if (on) {
              acc.changedNeverDrawn ||= acc.neverDrawn.delete(elementId);
              // If exclusive mode is enabled, we must add the element to the always drawn list.
              if ((!isDisplayedByDefault || isAlwaysDrawnExclusive) && !acc.alwaysDrawn.has(elementId)) {
                acc.alwaysDrawn.add(elementId);
                acc.changedAlwaysDrawn = true;
              }
            } else {
              acc.changedAlwaysDrawn ||= acc.alwaysDrawn.delete(elementId);
              // If exclusive mode is enabled, we don't have to add the element to the never drawn list.
              if (isDisplayedByDefault && !isAlwaysDrawnExclusive && !acc.neverDrawn.has(elementId)) {
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
}

const createVisibilityStatusObs = (status: Visibility | "disabled", tooltipStringId?: string) => of(createVisibilityStatus(status, tooltipStringId));

function getVisibilityFromChildren(obs: Observable<Visibility>): Observable<Visibility | "empty"> {
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
        return "empty";
      }
      return x.allVisible ? "visible" : x.allHidden ? "hidden" : "partial";
    }),
  );
}

function getVisibilityStatusFromChildren<TEmpty>(
  tooltipMap: { [key in Visibility]: string | undefined } & {
    empty?: () => TEmpty;
  },
): OperatorFunction<Visibility, VisibilityStatus | TEmpty> {
  return (obs) => {
    return getVisibilityFromChildren(obs).pipe(
      map((visibility) => {
        if (visibility === "empty") {
          const res = tooltipMap.empty;
          if (res) {
            return res();
          }
          visibility = "visible";
        }

        return createVisibilityStatus(visibility, tooltipMap[visibility]);
      }),
    );
  };
}
