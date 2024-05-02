/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, concatAll, concatWith, defer, EMPTY, filter, firstValueFrom, forkJoin, from, map, mergeMap, of, reduce } from "rxjs";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { NodeKey } from "@itwin/presentation-common";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";
import { Presentation } from "@itwin/presentation-frontend";
import { reduceWhile, toSet, toVoidPromise } from "../common/Rxjs";
import { createQueryHandler } from "./internal/QueryHandler";
import { createVisibilityStatus } from "./internal/Tooltip";
import { createVisibilityChangeEventListener } from "./internal/VisibilityChangeEventListener";
import { NodeUtils } from "./NodeUtils";

import type { IQueryHandler as IQueryHandler } from "./internal/QueryHandler";
import type { IFilteredPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { IVisibilityHandler, VisibilityStatus } from "../VisibilityTreeEventHandler";
import type { IVisibilityChangeEventListener } from "./internal/VisibilityChangeEventListener";
import type { Viewport } from "@itwin/core-frontend";
import type { Visibility } from "./internal/Tooltip";
import type { Id64Arg, Id64Set, Id64String } from "@itwin/core-bentley";
import type { ECClassGroupingNodeKey } from "@itwin/presentation-common";
import type { TreeNodeItem } from "@itwin/components-react";
import type { Observable, OperatorFunction } from "rxjs";
interface GetCategoryStatusProps {
  categoryId: Id64String;
  modelId: Id64String | undefined;
  hasChildren?: boolean;
}

interface ChangeCategoryStateProps {
  categoryId: Id64String;
  modelId: Id64String | undefined;
  on: boolean;
}

interface GetElementStateProps {
  elementId: Id64String;
  modelId: Id64String;
  categoryId: Id64String;
  hasChildren?: boolean;
}

interface ChangeElementStateProps extends GetElementStateProps {
  on: boolean;
}

interface ChangeModelStateProps {
  ids: Id64Arg;
  on: boolean;
}

type OverriddenMethodProps<TFunc> = TFunc extends (props: infer TProps) => infer TResult
  ? TProps & {
      /** A callback that produces the value from the original implementation. */
      readonly originalImplementation: () => TResult;
      /**
       * Reference to the hierarchy based handler.
       * @note Calling `getVisibility` or `changeVisibility` of this object invokes the overridden implementation as well.
       */
      readonly handler: IHierarchyBasedVisibilityHandler;
    }
  : never;

type OverriddenMethod<TFunc> = TFunc extends (...args: any[]) => infer TResult ? (props: OverriddenMethodProps<TFunc>) => TResult : never;

/**
 * @public
 */
export interface VisibilityHandlerOverrides {
  getSubjectNodeVisibility?: OverriddenMethod<(props: { node: TreeNodeItem; ids: Id64Set }) => Promise<VisibilityStatus>>;
  getModelDisplayStatus?: OverriddenMethod<(props: { id: Id64String }) => Promise<VisibilityStatus>>;
  getCategoryDisplayStatus?: OverriddenMethod<(props: GetCategoryStatusProps) => Promise<VisibilityStatus>>;
  getElementGroupingNodeDisplayStatus?: OverriddenMethod<(props: { key: ECClassGroupingNodeKey }) => Promise<VisibilityStatus>>;
  getElementDisplayStatus?: OverriddenMethod<(props: GetElementStateProps) => Promise<VisibilityStatus>>;

  changeSubjectNodeState?: OverriddenMethod<(props: { node: TreeNodeItem; ids: Id64Set; on: boolean }) => Promise<void>>;
  changeModelState?: OverriddenMethod<(props: ChangeModelStateProps) => Promise<void>>;
  changeCategoryState?: OverriddenMethod<(props: ChangeCategoryStateProps) => Promise<void>>;
  changeElementGroupingNodeState?: OverriddenMethod<(props: { key: ECClassGroupingNodeKey; on: boolean }) => Promise<void>>;
  changeElementState?: OverriddenMethod<(props: ChangeElementStateProps) => Promise<void>>;
}

/**
 * @public
 */
export interface HierarchyBasedVisibilityHandlerProps {
  viewport: Viewport;
  rulesetId: string;
  overrides?: VisibilityHandlerOverrides;
  hierarchyAutoUpdateEnabled?: boolean;
}

/**
 * @public
 */
export interface IHierarchyBasedVisibilityHandler extends IVisibilityHandler {
  filteredDataProvider?: IFilteredPresentationTreeDataProvider;
}

/** @public */
export function createHierarchyBasedVisibilityHandler(props: HierarchyBasedVisibilityHandlerProps): IHierarchyBasedVisibilityHandler {
  return new VisibilityHandlerImplementation(props);
}

class VisibilityHandlerImplementation implements IVisibilityHandler {
  public filteredDataProvider?: IFilteredPresentationTreeDataProvider;
  public readonly isHierarchyBased = true;
  private readonly _eventListener: IVisibilityChangeEventListener;
  private readonly _queryHandler: IQueryHandler;
  private _removePresentationHierarchyListener?: () => void;

  constructor(private readonly _props: HierarchyBasedVisibilityHandlerProps) {
    this._eventListener = createVisibilityChangeEventListener(_props.viewport);
    this._queryHandler = createQueryHandler(this._props.viewport.iModel, this._props.rulesetId);
    // istanbul ignore if
    if (this._props.hierarchyAutoUpdateEnabled) {
      // eslint-disable-next-line @itwin/no-internal
      this._removePresentationHierarchyListener = Presentation.presentation.onIModelHierarchyChanged.addListener(() => {
        this._queryHandler.invalidateCache();
      });
    }
  }

  // istanbul ignore next
  public get onVisibilityChange() {
    return this._eventListener.onVisibilityChange;
  }

  public async getVisibilityStatus(node: TreeNodeItem): Promise<VisibilityStatus> {
    return firstValueFrom(this.getVisibilityStatusObs(node));
  }

  public async changeVisibility(node: TreeNodeItem, shouldDisplay: boolean): Promise<void> {
    return toVoidPromise(this.changeVisibilityObs(node, shouldDisplay));
  }

  // istanbul ignore next
  public dispose(): void {
    this._eventListener.dispose();
    this._removePresentationHierarchyListener?.();
  }

  private getVisibilityStatusObs(node: TreeNodeItem): Observable<VisibilityStatus> {
    if (!isPresentationTreeNodeItem(node)) {
      return createVisibilityStatusObs("disabled");
    }

    const nodeKey = node.key;
    if (NodeKey.isClassGroupingNodeKey(nodeKey)) {
      return from(this.getElementGroupingNodeDisplayStatus(nodeKey));
    }

    if (!NodeKey.isInstancesNodeKey(nodeKey)) {
      return createVisibilityStatusObs("disabled");
    }

    if (NodeUtils.isSubjectNode(node)) {
      // note: subject nodes may be merged to represent multiple subject instances
      return this.getSubjectNodeVisibilityStatus(node, from(nodeKey.instanceKeys).pipe(map((key) => key.id)));
    }

    if (NodeUtils.isModelNode(node)) {
      return this.getModelVisibilityStatus(nodeKey.instanceKeys[0].id);
    }

    if (NodeUtils.isCategoryNode(node)) {
      return this.getCategoryDisplayStatus({
        categoryId: nodeKey.instanceKeys[0].id,
        modelId: NodeUtils.getModelId(node),
      });
    }

    const modelId = NodeUtils.getModelId(node);
    const categoryId = NodeUtils.getElementCategoryId(node);
    if (!categoryId || !modelId) {
      return createVisibilityStatusObs("disabled");
    }

    return this.getElementDisplayStatus({
      elementId: nodeKey.instanceKeys[0].id,
      modelId,
      categoryId,
      hasChildren: node.hasChildren,
    });
  }

  private getSubjectNodeVisibilityStatus(node: TreeNodeItem, subjectIds: Observable<Id64String>): Observable<VisibilityStatus> {
    const result = defer(() => {
      if (!this._props.viewport.view.isSpatialView()) {
        return of(createVisibilityStatus("disabled", "subject.nonSpatialView"));
      }

      const provider = this.filteredDataProvider;
      const childStatuses =
        provider && !provider.nodeMatchesFilter(node)
          ? from(provider.getNodes(node)).pipe(
              concatAll(),
              mergeMap((filteredNode) => this.getVisibilityStatusObs(filteredNode)),
            )
          : subjectIds.pipe(
              mergeMap((id) => this._queryHandler.querySubjectModels(id)),
              mergeMap((x) => this.getModelVisibilityStatus(x)),
            );

      return childStatuses.pipe(
        map((x) => x.state),
        getVisibilityStatusFromChildren({
          visible: "subject.allModelsVisible",
          hidden: "subject.allModelsHidden",
          partial: "subject.someModelsHidden",
        }),
      );
    });

    const ovr = this._props.overrides?.getSubjectNodeVisibility;
    return ovr
      ? subjectIds.pipe(
          toSet(),
          mergeMap(async (ids) => ovr(this.createOverrideProps({ node, ids }, result))),
        )
      : result;
  }

  private getModelVisibilityStatus(modelId: Id64String): Observable<VisibilityStatus> {
    const result = defer(() => this.getModelVisibilityStatusImpl(modelId));
    const ovr = this._props.overrides?.getModelDisplayStatus;
    return ovr ? from(ovr(this.createOverrideProps({ id: modelId }, result))) : result;
  }

  private getModelVisibilityStatusImpl(modelId: Id64String): Observable<VisibilityStatus> {
    const viewport = this._props.viewport;
    if (!viewport.view.isSpatialView()) {
      return createVisibilityStatusObs("disabled", "model.nonSpatialView");
    }

    if (!viewport.view.viewsModel(modelId)) {
      return createVisibilityStatusObs("hidden");
    }

    return this._queryHandler.queryModelCategories(modelId).pipe(
      map((categoryId) => this.getDefaultCategoryVisibilityStatus(categoryId, modelId)),
      map((x) => x.state),
      getVisibilityFromChildren,
      mergeMap((visibilityByCategories) => {
        // istanbul ignore if
        if (visibilityByCategories === "empty") {
          // TODO: Is this possible?
          return createVisibilityStatusObs("hidden");
        }

        // If different categories have different visibilities,
        // then there's no need to check for children.
        if (visibilityByCategories === "partial") {
          return createVisibilityStatusObs(visibilityByCategories);
        }

        // We need to check if model's state is partially visible.
        // Instead of recursively checking each element of each category,
        // we only have to look at the always and never drawn lists.

        const alwaysDrawn = viewport.alwaysDrawn;
        const neverDrawn = viewport.neverDrawn;
        if (!alwaysDrawn?.size && !neverDrawn?.size) {
          return createVisibilityStatusObs(visibilityByCategories);
        }

        return forkJoin({
          neverDrawnChildren: neverDrawn?.size ? this.getNeverDrawnChildren({ modelId }) : of(undefined),
          alwaysDrawnChildren: alwaysDrawn?.size ? this.getAlwaysDrawnChildren({ modelId }) : of(undefined),
          totalCount: this._queryHandler.queryModelElementsCount(modelId),
        }).pipe(
          map(({ neverDrawnChildren, alwaysDrawnChildren, totalCount }) => {
            if (neverDrawnChildren?.size === totalCount) {
              return createVisibilityStatus("hidden");
            }

            if (alwaysDrawnChildren?.size === totalCount) {
              return createVisibilityStatus("visible");
            }

            if (viewport.isAlwaysDrawnExclusive && alwaysDrawn?.size) {
              return alwaysDrawnChildren?.size ? createVisibilityStatus("partial") : createVisibilityStatus("hidden");
            }

            if (!neverDrawnChildren?.size && !alwaysDrawnChildren?.size) {
              return createVisibilityStatus(visibilityByCategories);
            }

            return createVisibilityStatus("partial");
          }),
        );
      }),
    );
  }

  private getDefaultCategoryVisibilityStatus(categoryId: Id64String, modelId: Id64String | undefined): VisibilityStatus {
    const getCategoryViewportVisibilityStatus = () => {
      const isVisible = this._props.viewport.view.viewsCategory(categoryId);
      return isVisible
        ? createVisibilityStatus("visible", "category.visibleThroughCategorySelector")
        : createVisibilityStatus("hidden", "category.hiddenThroughCategorySelector");
    };

    if (!modelId) {
      return getCategoryViewportVisibilityStatus();
    }

    switch (this._props.viewport.perModelCategoryVisibility.getOverride(modelId, categoryId)) {
      case PerModelCategoryVisibility.Override.Show:
        return createVisibilityStatus("visible");
      case PerModelCategoryVisibility.Override.Hide:
        return createVisibilityStatus("hidden");
    }

    return getCategoryViewportVisibilityStatus();
  }

  private getCategoryDisplayStatus(props: GetCategoryStatusProps): Observable<VisibilityStatus> {
    const result = defer(() => {
      const defaultStatus = this.getDefaultCategoryVisibilityStatus(props.categoryId, props.modelId);
      if (props.hasChildren === false) {
        return of(defaultStatus);
      }

      return this._queryHandler.queryCategoryElements(props.categoryId, props.modelId).pipe(
        map((id) => this.getElementOverriddenVisibility(id)?.state ?? defaultStatus.state),
        getVisibilityStatusFromChildren({
          visible: undefined,
          hidden: "category.allChildrenAreHidden",
          partial: "category.someChildrenAreHidden",
          empty: () => defaultStatus,
        }),
      );
    });

    const ovr = this._props.overrides?.getCategoryDisplayStatus;
    return ovr ? from(ovr(this.createOverrideProps(props, result))) : result;
  }

  private getElementGroupingNodeDisplayStatus(key: ECClassGroupingNodeKey): Observable<VisibilityStatus> {
    const result = defer(() =>
      this._queryHandler.queryGroupingNodeChildren(key).pipe(
        mergeMap(({ modelId, categoryId, elementIds }) => {
          return elementIds.pipe(mergeMap((elementId) => this.getElementDisplayStatus({ categoryId, modelId, elementId, hasChildren: false })));
        }),
        map((x) => x.state),
        getVisibilityStatusFromChildren({
          visible: undefined,
          hidden: "groupingNode.allChildrenAreHidden",
          partial: "groupingNode.someChildrenAreHidden",
        }),
      ),
    );

    const ovr = this._props.overrides?.getElementGroupingNodeDisplayStatus;
    return ovr ? from(ovr(this.createOverrideProps({ key }, result))) : result;
  }

  private getElementOverriddenVisibility(elementId: string): VisibilityStatus | undefined {
    const viewport = this._props.viewport;
    if (viewport.neverDrawn?.has(elementId)) {
      return createVisibilityStatus("hidden", "element.hiddenThroughNeverDrawnList");
    }

    if (viewport.alwaysDrawn?.size) {
      if (viewport.alwaysDrawn.has(elementId)) {
        return createVisibilityStatus("visible", "element.displayedThroughAlwaysDrawnList");
      }

      if (viewport.isAlwaysDrawnExclusive) {
        return createVisibilityStatus("hidden", "element.hiddenDueToOtherElementsExclusivelyAlwaysDrawn");
      }
    }

    return undefined;
  }

  private getElementDefaultVisibility(props: GetElementStateProps): VisibilityStatus {
    const viewport = this._props.viewport;
    const { elementId, modelId, categoryId } = props;

    let status = this.getElementOverriddenVisibility(elementId);
    if (status) {
      return status;
    }

    if (!viewport.view.viewsModel(modelId)) {
      return createVisibilityStatus("hidden", "element.hiddenModelIsHidden");
    }

    status = this.getDefaultCategoryVisibilityStatus(categoryId, modelId);
    delete status.tooltip;
    return status;
  }

  private getElementDisplayStatus(props: GetElementStateProps): Observable<VisibilityStatus> {
    const result = defer(() => {
      const { hasChildren } = props;
      if (hasChildren === false) {
        return of(this.getElementDefaultVisibility(props));
      }

      return this._queryHandler.queryElementChildren(props.elementId).pipe(
        map((elementId) => this.getElementDefaultVisibility({ ...props, elementId }).state),
        getVisibilityStatusFromChildren({
          visible: undefined,
          hidden: "element.allChildrenAreHidden",
          partial: "element.someChildrenAreHidden",
          empty: () => this.getElementDefaultVisibility(props),
        }),
      );
    });

    const ovr = this._props.overrides?.getElementDisplayStatus;
    return ovr ? from(ovr(this.createOverrideProps(props, result))) : result;
  }

  /** Changes visibility of the items represented by the tree node. */
  private changeVisibilityObs(node: TreeNodeItem, on: boolean): Observable<void> {
    // istanbul ignore if
    if (!isPresentationTreeNodeItem(node)) {
      return EMPTY;
    }
    const nodeKey = node.key;

    if (NodeKey.isClassGroupingNodeKey(nodeKey)) {
      return this.changeElementGroupingNodeState(nodeKey, on);
    }

    // istanbul ignore if
    if (!NodeKey.isInstancesNodeKey(nodeKey)) {
      return EMPTY;
    }

    if (NodeUtils.isSubjectNode(node)) {
      return this.changeSubjectNodeState(from(nodeKey.instanceKeys).pipe(map((key) => key.id)), node, on);
    }

    if (NodeUtils.isModelNode(node)) {
      return this.changeModelState({ ids: nodeKey.instanceKeys[0].id, on });
    }

    if (NodeUtils.isCategoryNode(node)) {
      return this.changeCategoryState({
        categoryId: nodeKey.instanceKeys[0].id,
        modelId: NodeUtils.getModelId(node),
        on,
      });
    }

    const modelId = NodeUtils.getModelId(node);
    const categoryId = NodeUtils.getElementCategoryId(node);
    if (!categoryId || !modelId) {
      return EMPTY;
    }

    return this.changeElementState({
      elementId: nodeKey.instanceKeys[0].id,
      modelId,
      categoryId,
      hasChildren: node.hasChildren,
      on,
    });
  }

  private changeSubjectNodeState(ids: Observable<Id64String>, node: TreeNodeItem, on: boolean): Observable<void> {
    const result = defer(() => {
      // istanbul ignore if
      if (!this._props.viewport.view.isSpatialView()) {
        return EMPTY;
      }

      const provider = this.filteredDataProvider;
      if (provider && !provider.nodeMatchesFilter(node)) {
        return from(provider.getNodes(node)).pipe(
          concatAll(),
          mergeMap((filteredNode) => this.changeVisibilityObs(filteredNode, on)),
        );
      }

      return ids.pipe(
        mergeMap((id) => this._queryHandler.querySubjectModels(id)),
        toSet(),
        mergeMap((modelIds) => this.changeModelState({ ids: modelIds, on })),
      );
    });

    const ovr = this._props.overrides?.changeSubjectNodeState;
    return ovr
      ? ids.pipe(
          toSet(),
          mergeMap(async (idSet) => ovr(this.createVoidOverrideProps({ ids: idSet, node, on }, result))),
        )
      : result;
  }

  private changeModelState(props: ChangeModelStateProps): Observable<void> {
    const result = defer(() => {
      const viewport = this._props.viewport;
      // istanbul ignore if
      if (!viewport.view.isSpatialView()) {
        return EMPTY;
      }

      const { ids, on } = props;
      return concat(
        defer(() => {
          viewport.perModelCategoryVisibility.clearOverrides(ids);
          if (on) {
            return from(viewport.addViewedModels(ids));
          }

          viewport.changeModelDisplay(ids, false);
          return EMPTY;
        }),
        (typeof ids === "string" ? of(ids) : from(ids)).pipe(
          mergeMap((modelId) => {
            return this._queryHandler.queryModelCategories(modelId).pipe(mergeMap((categoryId) => this.changeCategoryState({ categoryId, modelId, on })));
          }),
        ),
      );
    });
    const ovr = this._props.overrides?.changeModelState;
    return ovr ? from(ovr(this.createVoidOverrideProps(props, result))) : result;
  }

  private changeCategoryState(props: ChangeCategoryStateProps): Observable<void> {
    const viewport = this._props.viewport;
    const { modelId, categoryId, on } = props;

    const result = concat(
      defer(() => {
        if (!modelId) {
          viewport.changeCategoryDisplay(categoryId, on, on);
          return EMPTY;
        }

        return concat(
          props.on && !viewport.view.viewsModel(modelId) ? viewport.addViewedModels(modelId) : EMPTY,
          defer(() => {
            const isDisplayedInSelector = viewport.view.viewsCategory(categoryId);
            const override =
              on === isDisplayedInSelector
                ? PerModelCategoryVisibility.Override.None
                : on
                  ? PerModelCategoryVisibility.Override.Show
                  : PerModelCategoryVisibility.Override.Hide;
            viewport.perModelCategoryVisibility.setOverride(modelId, categoryId, override);
            if (override === PerModelCategoryVisibility.Override.None && on) {
              // we took off the override which means the category is displayed in selector, but
              // doesn't mean all its subcategories are displayed - this call ensures that
              viewport.changeCategoryDisplay(categoryId, true, true);
            }
            return EMPTY;
          }),
        );
      }),
      defer(() => this.clearAlwaysAndNeverDrawnChildren(props)),
    );

    const ovr = this._props.overrides?.changeCategoryState;
    return ovr ? from(ovr(this.createVoidOverrideProps(props, result))) : result;
  }

  /**
   * Updates visibility of all grouping node's elements.
   * @see `changeElementState`
   */
  private changeElementGroupingNodeState(key: ECClassGroupingNodeKey, on: boolean): Observable<void> {
    const result = defer(() => {
      return this._queryHandler.queryGroupingNodeChildren(key).pipe(
        mergeMap(({ modelId, categoryId, elementIds }) => {
          return elementIds.pipe(mergeMap((elementId) => this.changeElementState({ elementId, on, modelId, categoryId })));
        }),
      );
    });

    const ovr = this._props.overrides?.changeElementGroupingNodeState;
    return ovr ? from(ovr(this.createVoidOverrideProps({ key, on }, result))) : result;
  }

  /**
   * Updates visibility of an element and all its child elements by adding them to the always/never drawn list.
   * @note If element is to be enabled and model is hidden, it will be enabled.
   */
  private changeElementState(props: ChangeElementStateProps): Observable<void> {
    const result = defer(() => {
      const { elementId, on, hasChildren, modelId, categoryId } = props;
      const viewport = this._props.viewport;
      return concat(
        props.on && !viewport.view.viewsModel(modelId) ? from(viewport.addViewedModels(modelId)) : EMPTY,
        defer(() => {
          const categoryVisibility = this.getDefaultCategoryVisibilityStatus(categoryId, modelId);
          const isDisplayedByDefault = categoryVisibility.state === "visible";
          return of(elementId).pipe(
            concatWith(hasChildren === false ? EMPTY : from(this._queryHandler.queryElementChildren(props.elementId))),
            this.changeElementStateNoChildrenOperator({ on, isDisplayedByDefault }),
          );
        }),
      );
    });

    const ovr = this._props.overrides?.changeElementState;
    return ovr ? from(ovr(this.createVoidOverrideProps(props, result))) : result;
  }

  private changeElementStateNoChildrenOperator(props: { on: boolean; isDisplayedByDefault: boolean }): OperatorFunction<string, void> {
    return (elementIds: Observable<string>) => {
      const { on, isDisplayedByDefault } = props;
      const isAlwaysDrawnExclusive = this._props.viewport.isAlwaysDrawnExclusive;
      return elementIds.pipe(
        reduce(
          (acc, elementId) => {
            if (on) {
              const wasRemoved = acc.neverDrawn.delete(elementId);
              acc.changedNeverDrawn ||= wasRemoved;
              // If exclusive mode is enabled, we must add the element to the always drawn list.
              if ((!isDisplayedByDefault || isAlwaysDrawnExclusive) && !acc.alwaysDrawn.has(elementId)) {
                acc.alwaysDrawn.add(elementId);
                acc.changedAlwaysDrawn = true;
              }
            } else {
              const wasRemoved = acc.alwaysDrawn.delete(elementId);
              acc.changedAlwaysDrawn ||= wasRemoved;
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

  private getAlwaysOrNeverDrawnChildren(props: { modelId?: string; categoryId?: string; always: boolean }): Observable<Id64Set | undefined> {
    const set = props.always ? this._props.viewport.alwaysDrawn : this._props.viewport.neverDrawn;
    if (!set?.size) {
      return of(undefined);
    }

    if (props.categoryId) {
      return from(this._queryHandler.queryCategoryElements(props.categoryId, props.modelId)).pipe(
        filter((id) => set.has(id)),
        toSet(),
      );
    }

    // istanbul ignore if
    if (!props.modelId) {
      return of(undefined);
    }

    return from(this._queryHandler.queryModelElements(props.modelId, set)).pipe(toSet());
  }

  private getAlwaysDrawnChildren(props: { modelId?: string; categoryId?: string }) {
    return this.getAlwaysOrNeverDrawnChildren({ ...props, always: true });
  }

  private getNeverDrawnChildren(props: { modelId?: string; categoryId?: string }) {
    return this.getAlwaysOrNeverDrawnChildren({ ...props, always: false });
  }

  private clearAlwaysAndNeverDrawnChildren(props: { modelId?: string; categoryId?: string }) {
    return forkJoin({
      alwaysDrawn: this.getAlwaysDrawnChildren(props),
      neverDrawn: this.getNeverDrawnChildren(props),
    }).pipe(
      map(({ alwaysDrawn, neverDrawn }) => {
        const viewport = this._props.viewport;
        if (viewport.alwaysDrawn?.size && alwaysDrawn?.size) {
          viewport.setAlwaysDrawn(setDifference(viewport.alwaysDrawn, alwaysDrawn));
        }
        if (viewport.neverDrawn?.size && neverDrawn?.size) {
          viewport.setNeverDrawn(setDifference(viewport.neverDrawn, neverDrawn));
        }
      }),
    );
  }

  private createVoidOverrideProps<TProps>(props: TProps, obs: Observable<void>): OverriddenMethodProps<(props: TProps) => Promise<void>> {
    return {
      ...props,
      originalImplementation: async () => toVoidPromise(obs),
      handler: this,
    };
  }

  private createOverrideProps<TProps, TObservable extends Observable<any>>(
    props: TProps,
    obs: TObservable,
  ): TObservable extends Observable<infer T> ? OverriddenMethodProps<(props: TProps) => Promise<T>> : never;
  private createOverrideProps<TProps, TObservable extends Observable<unknown>>(
    props: TProps,
    obs: TObservable,
  ): OverriddenMethodProps<(props: TProps) => Promise<unknown>> {
    return {
      ...props,
      originalImplementation: async () => firstValueFrom(obs),
      handler: this,
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

function getVisibilityStatusFromChildren<TEmpty = never>(
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

function setDifference<T>(lhs: Set<T>, rhs: Set<T>): Set<T> {
  const result = new Set<T>();
  lhs.forEach((x) => !rhs.has(x) && result.add(x));
  return result;
}
