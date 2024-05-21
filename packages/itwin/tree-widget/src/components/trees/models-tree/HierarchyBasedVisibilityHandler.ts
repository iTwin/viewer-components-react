/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, concatAll, concatWith, defer, EMPTY, firstValueFrom, forkJoin, from, map, mergeMap, of, reduce } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { NodeKey } from "@itwin/presentation-common";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";
import { Presentation } from "@itwin/presentation-frontend";
import { reduceWhile, toSet, toVoidPromise } from "../common/Rxjs";
import { createModelsTreeQueryHandler } from "./internal/ModelsTreeQueryHandler";
import { createVisibilityStatus } from "./internal/Tooltip";
import { createVisibilityChangeEventListener } from "./internal/VisibilityChangeEventListener";
import { NodeUtils } from "./NodeUtils";

import type { Id64Arg, Id64Set, Id64String } from "@itwin/core-bentley";
import type { ElementsQueryProps, ModelsTreeQueryHandler as ModelsTreeQueryHandler } from "./internal/ModelsTreeQueryHandler";
import type { IFilteredPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { IVisibilityHandler, VisibilityStatus } from "../VisibilityTreeEventHandler";
import type { IVisibilityChangeEventListener } from "./internal/VisibilityChangeEventListener";
import type { Viewport } from "@itwin/core-frontend";
import type { NonPartialVisibilityStatus, Visibility } from "./internal/Tooltip";
import type { ECClassGroupingNodeKey } from "@itwin/presentation-common";
import type { TreeNodeItem } from "@itwin/components-react";
import type { Observable, OperatorFunction } from "rxjs";

interface GetCategoryStatusProps {
  categoryId: Id64String;
  modelId: Id64String | undefined;
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

/**
 * Properties for a method of [[IHierarchyBasedVisibilityHandler]] that can be overridden.
 */
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

/**
 * Function type for an overridden method of [[IHierarchyBasedVisibilityHandler]].
 */
type OverriddenMethod<TFunc> = TFunc extends (...args: any[]) => infer TResult ? (props: OverriddenMethodProps<TFunc>) => TResult : never;

/**
 * Functionality of [[IHierarchyBasedVisibilityHandler]] that can be overridden.
 * Each callback will be provided original implementation and reference to a [[IHierarchyBasedVisibilityHandler]].
 */
interface VisibilityHandlerOverrides {
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
 * Properties for [[IHierarchyBasedVisibilityHandler]].
 * @public
 */
export interface HierarchyBasedVisibilityHandlerProps {
  viewport: Viewport;
  overrides?: VisibilityHandlerOverrides;
  hierarchyAutoUpdateEnabled?: boolean;
}

/**
 * Hierarchy based visibility handler.
 * When determining visibility for nodes, it should take into account the visibility of their children.
 * @public
 */
export interface IHierarchyBasedVisibilityHandler extends IVisibilityHandler {
  filteredDataProvider?: IFilteredPresentationTreeDataProvider;
}

/**
 * Creates an instance if [[IHierarchyBasedVisibilityHandler]].
 * @public
 */
export function createHierarchyBasedVisibilityHandler(props: HierarchyBasedVisibilityHandlerProps): IHierarchyBasedVisibilityHandler {
  return new VisibilityHandlerImplementation(props);
}

const MAX_PARALLEL_SUBJECT_MODELS_REQUESTS = 1;
const MAX_PARALLEL_MODELS_CATEGORIES_REQUESTS = 1;

class VisibilityHandlerImplementation implements IVisibilityHandler {
  public filteredDataProvider?: IFilteredPresentationTreeDataProvider;
  public readonly isHierarchyBased = true;
  private readonly _eventListener: IVisibilityChangeEventListener;
  private readonly _queryHandler: ModelsTreeQueryHandler;
  private _removePresentationHierarchyListener?: () => void;

  constructor(private readonly _props: HierarchyBasedVisibilityHandlerProps) {
    this._eventListener = createVisibilityChangeEventListener(_props.viewport);
    this._queryHandler = createModelsTreeQueryHandler(this._props.viewport.iModel);
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
              mergeMap((filteredNode) => this.getVisibilityStatusObs(filteredNode), MAX_PARALLEL_MODELS_CATEGORIES_REQUESTS),
            )
          : subjectIds.pipe(
              mergeMap((id) => this._queryHandler.querySubjectModels(id), MAX_PARALLEL_SUBJECT_MODELS_REQUESTS),
              mergeMap((x) => this.getModelVisibilityStatus(x), MAX_PARALLEL_MODELS_CATEGORIES_REQUESTS),
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
      return createVisibilityStatusObs("hidden", "model.hiddenThroughModelSelector");
    }

    return this._queryHandler.queryModelCategories(modelId).pipe(
      map((categoryId) => this.getDefaultCategoryVisibilityStatus(categoryId, modelId)),
      map((x) => x.state),
      getVisibilityFromChildren,
      mergeMap((visibilityByCategories) => {
        // istanbul ignore if
        if (visibilityByCategories === "empty") {
          return createVisibilityStatusObs("visible");
        }

        // If different categories have different visibilities,
        // then there's no need to check for children.
        if (visibilityByCategories === "partial") {
          return createVisibilityStatusObs("partial", "model.someCategoriesHidden");
        }

        const createStatusByCategories = () => {
          return createVisibilityStatus(visibilityByCategories, visibilityByCategories === "visible" ? "model.allCategoriesVisible" : "allCategoriesHidden");
        };

        // We need to check if model's state is partially visible.
        // Instead of recursively checking each element of each category,
        // we only have to look at the always and never drawn lists.

        const alwaysDrawn = viewport.alwaysDrawn;
        const neverDrawn = viewport.neverDrawn;
        if (!alwaysDrawn?.size && !neverDrawn?.size) {
          return of(createStatusByCategories());
        }

        return this.getVisibilityFromAlwaysAndNeverDrawnChildren({
          queryProps: { modelId },
          tooltips: {
            allElementsInAlwaysDrawnList: "model.allChildElementsInAlwaysDrawnList",
            allElementsInNeverDrawnList: "model.allChildElementsHidden",
            elementsInBothAlwaysAndNeverDrawn: "model.childElementsInAlwaysAndNeverDrawnList",
            noElementsInExclusiveAlwaysDrawnList: "model.noChildrenInExclusiveAlwaysDrawnList",
          },
          defaultStatus: createStatusByCategories,
        });
      }),
    );
  }

  private getDefaultCategoryVisibilityStatus(categoryId: Id64String, modelId: Id64String | undefined): NonPartialVisibilityStatus {
    const viewport = this._props.viewport;
    const getCategoryViewportVisibilityStatus = (): NonPartialVisibilityStatus => {
      const isVisible = viewport.view.viewsCategory(categoryId);
      return isVisible
        ? createVisibilityStatus("visible", "category.displayedThroughCategorySelector")
        : createVisibilityStatus("hidden", "category.hiddenThroughCategorySelector");
    };

    if (!modelId) {
      return getCategoryViewportVisibilityStatus();
    }

    if (!viewport.view.viewsModel(modelId)) {
      return createVisibilityStatus("hidden", "category.hiddenThroughModel");
    }

    switch (this._props.viewport.perModelCategoryVisibility.getOverride(modelId, categoryId)) {
      case PerModelCategoryVisibility.Override.Show:
        return createVisibilityStatus("visible", "category.displayedThroughPerModelOverride");
      case PerModelCategoryVisibility.Override.Hide:
        return createVisibilityStatus("hidden", "category.hiddenThroughPerModelOverride");
    }

    return getCategoryViewportVisibilityStatus();
  }

  private getCategoryDisplayStatus(props: GetCategoryStatusProps): Observable<VisibilityStatus> {
    const result = defer(() => {
      return this.getVisibilityFromAlwaysAndNeverDrawnChildren({
        queryProps: { categoryId: props.categoryId },
        tooltips: {
          allElementsInAlwaysDrawnList: "category.allElementsVisible",
          allElementsInNeverDrawnList: "category.allElementsHidden",
          elementsInBothAlwaysAndNeverDrawn: "category.someElementsAreHidden",
          noElementsInExclusiveAlwaysDrawnList: "category.allElementsHidden",
        },
        defaultStatus: () => this.getDefaultCategoryVisibilityStatus(props.categoryId, props.modelId),
      });
    });

    const ovr = this._props.overrides?.getCategoryDisplayStatus;
    return ovr ? from(ovr(this.createOverrideProps(props, result))) : result;
  }

  private getElementGroupingNodeDisplayStatus(key: ECClassGroupingNodeKey): Observable<VisibilityStatus> {
    const result = defer(() =>
      this._queryHandler.queryGroupingNodeChildren(key).pipe(
        mergeMap(({ modelId, categoryId, elementIds }) => {
          const viewport = this._props.viewport;
          if (!viewport.view.viewsModel(modelId)) {
            return createVisibilityStatusObs("hidden");
          }

          return elementIds.pipe(
            toSet(),
            mergeMap((ids) => {
              return this.getVisibilityFromAlwaysAndNeverDrawnChildren({
                children: ids,
                defaultStatus: () => {
                  const status = this.getDefaultCategoryVisibilityStatus(categoryId, modelId);
                  return createVisibilityStatus(status.state, `groupingNode.${status}DueToCategory`);
                },
                tooltips: {
                  allElementsInAlwaysDrawnList: "groupingNode.allElementsVisible",
                  allElementsInNeverDrawnList: "groupingNode.allElementsHidden",
                  elementsInBothAlwaysAndNeverDrawn: "groupingNode.someElementsAreHidden",
                  noElementsInExclusiveAlwaysDrawnList: "groupingNode.allElementsHidden",
                },
              });
            }),
          );
        }),
      ),
    );

    const ovr = this._props.overrides?.getElementGroupingNodeDisplayStatus;
    return ovr ? from(ovr(this.createOverrideProps({ key }, result))) : result;
  }

  private getElementOverriddenVisibility(elementId: string): NonPartialVisibilityStatus | undefined {
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

    if (!viewport.view.viewsModel(modelId)) {
      return createVisibilityStatus("hidden", "element.hiddenThroughModel");
    }

    let status = this.getElementOverriddenVisibility(elementId);
    if (status) {
      return status;
    }

    status = this.getDefaultCategoryVisibilityStatus(categoryId, modelId);
    return createVisibilityStatus(status.state, status.state === "visible" ? "element.visibleThroughCategory" : "hiddenThroughCategory");
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
          visible: "element.allElementsVisible",
          hidden: "element.allElementsHidden",
          partial: "element.someElementsAreHidden",
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
          const viewport = this._props.viewport;
          return concat(
            on && !viewport.view.viewsModel(modelId) ? from(viewport.addViewedModels(modelId)) : EMPTY,
            defer(() => {
              const categoryVisibility = this.getDefaultCategoryVisibilityStatus(categoryId, modelId);
              const isDisplayedByDefault = categoryVisibility.state === "visible";
              return from(elementIds).pipe(this.changeElementStateNoChildrenOperator({ on, isDisplayedByDefault }));
            }),
          );
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
              // If exclusive mode is not enabled, we have to add the element to the never drawn list.
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

  private getVisibilityFromAlwaysAndNeverDrawnChildren(
    props: {
      tooltips: {
        allElementsInNeverDrawnList?: string;
        allElementsInAlwaysDrawnList?: string;
        elementsInBothAlwaysAndNeverDrawn?: string;
        noElementsInExclusiveAlwaysDrawnList?: string;
      };
      defaultStatus: () => VisibilityStatus;
    } & ({ children: Id64Set } | { queryProps: ElementsQueryProps }),
  ): Observable<VisibilityStatus> {
    const viewport = this._props.viewport;
    let alwaysDrawnObs: Observable<Id64Set | undefined>;
    let neverDrawnObs: Observable<Id64Set | undefined>;
    let totalCountObs: Observable<number>;

    if ("children" in props) {
      totalCountObs = of(props.children.size);
      alwaysDrawnObs = of(viewport.alwaysDrawn?.size ? setIntersection(props.children, viewport.alwaysDrawn) : undefined);
      neverDrawnObs = of(viewport.neverDrawn?.size ? setIntersection(props.children, viewport.neverDrawn) : undefined);
    } else {
      alwaysDrawnObs = this.getAlwaysDrawnChildren(props.queryProps);
      neverDrawnObs = this.getNeverDrawnChildren(props.queryProps);
      totalCountObs = this._queryHandler.queryElementsCount(props.queryProps);
    }

    return forkJoin({
      alwaysDrawnChildren: alwaysDrawnObs,
      neverDrawnChildren: neverDrawnObs,
      totalCount: totalCountObs,
    }).pipe(
      map(({ neverDrawnChildren, alwaysDrawnChildren, totalCount }) => {
        assert(totalCount !== 0);

        if (neverDrawnChildren?.size === totalCount) {
          return createVisibilityStatus("hidden", props.tooltips.allElementsInNeverDrawnList);
        }

        if (alwaysDrawnChildren?.size === totalCount) {
          return createVisibilityStatus("visible", props.tooltips.allElementsInAlwaysDrawnList);
        }

        if (viewport.isAlwaysDrawnExclusive && viewport.alwaysDrawn?.size) {
          return alwaysDrawnChildren?.size
            ? createVisibilityStatus("partial", props.tooltips.elementsInBothAlwaysAndNeverDrawn)
            : createVisibilityStatus("hidden", props.tooltips.noElementsInExclusiveAlwaysDrawnList);
        }

        if (!neverDrawnChildren?.size && !alwaysDrawnChildren?.size) {
          return props.defaultStatus();
        }

        return createVisibilityStatus("partial", props.tooltips.elementsInBothAlwaysAndNeverDrawn);
      }),
    );
  }

  private getAlwaysOrNeverDrawnChildren(props: ElementsQueryProps & { setType: "always" | "never" }): Observable<Id64Set | undefined> {
    const set = props.setType === "always" ? this._props.viewport.alwaysDrawn : this._props.viewport.neverDrawn;
    if (!set?.size) {
      return of(undefined);
    }

    return from(this._queryHandler.queryElements({ ...props, elementIds: set })).pipe(toSet());
  }

  private getAlwaysDrawnChildren(props: ElementsQueryProps) {
    return this.getAlwaysOrNeverDrawnChildren({ ...props, setType: "always" });
  }

  private getNeverDrawnChildren(props: ElementsQueryProps) {
    return this.getAlwaysOrNeverDrawnChildren({ ...props, setType: "never" });
  }

  private clearAlwaysAndNeverDrawnChildren(props: ElementsQueryProps) {
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

function setIntersection<T>(lhs: Set<T>, rhs: Set<T>): Set<T> {
  const result = new Set<T>();
  lhs.forEach((x) => rhs.has(x) && result.add(x));
  return result;
}
