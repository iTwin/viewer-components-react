/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Observable, OperatorFunction } from "rxjs";
import {
  catchError, concat, concatWith, defer, distinct, EMPTY, firstValueFrom, forkJoin, from, map, mergeMap, mergeWith, of, reduce, shareReplay, toArray,
} from "rxjs";
import { assert } from "@itwin/core-bentley";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { reduceWhile, toSet, toVoidPromise } from "../../common/Rxjs";
import { AlwaysAndNeverDrawnElementInfo } from "./internal/AlwaysAndNeverDrawnElementInfo";
import { ModelsTreeNode } from "./internal/ModelsTreeNode";
import { createModelsTreeQueryHandler } from "./internal/ModelsTreeQueryHandler";
import { createVisibilityStatus } from "./internal/Tooltip";
import { createVisibilityChangeEventListener } from "./internal/VisibilityChangeEventListener";

import type { Id64Arg, Id64Set, Id64String } from "@itwin/core-bentley";
import type { GroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { AlwaysOrNeverDrawnElementsQueryProps } from "./internal/AlwaysAndNeverDrawnElementInfo";
import type { ModelsTreeQueryHandler as ModelsTreeQueryHandler } from "./internal/ModelsTreeQueryHandler";
import type { VisibilityStatus } from "../../VisibilityTreeEventHandler";
import type { IVisibilityChangeEventListener } from "./internal/VisibilityChangeEventListener";
import type { Viewport } from "@itwin/core-frontend";
import type { NonPartialVisibilityStatus, Visibility } from "./internal/Tooltip";
import type { HierarchyVisibilityHandler } from "../common/UseHierarchyVisibility";

interface GetCategoryStatusProps {
  categoryId: Id64String;
  modelId: Id64String;
}

interface ChangeCategoryStateProps extends GetCategoryStatusProps {
  on: boolean;
}

interface GetElementStateProps {
  elementId: Id64String;
  modelId: Id64String;
  categoryId: Id64String;
  hasChildren: boolean;
}

interface ChangeElementStateProps extends GetElementStateProps {
  on: boolean;
}

interface ChangeModelStateProps {
  ids: Id64Arg;
  on: boolean;
}

/**
 * Properties for a method of [[HierarchyVisibilityHandler]] that can be overridden.
 */
type OverridableMethodProps<TFunc> = TFunc extends (props: infer TProps) => infer TResult
  ? TProps & {
      /** A callback that produces the value from the original implementation. */
      readonly originalImplementation: () => TResult;
      /**
       * Reference to the hierarchy based handler.
       * @note Calling `getVisibility` or `changeVisibility` of this object invokes the overridden implementation as well.
       */
      readonly handler: ModelsTreeVisibilityHandler;
    }
  : never;

/**
 * Function type for an overridden method of [[HierarchyVisibilityHandler]].
 */
type OverridableMethod<TFunc> = TFunc extends (...args: any[]) => infer TResult ? (props: OverridableMethodProps<TFunc>) => TResult : never;

/**
 * Functionality of [[HierarchyVisibilityHandler]] that can be overridden.
 * Each callback will be provided original implementation and reference to a [[HierarchyVisibilityHandler]].
 */
interface VisibilityHandlerOverrides {
  getSubjectNodeVisibility?: OverridableMethod<(props: { node: HierarchyNode; ids: Id64Set }) => Promise<VisibilityStatus>>;
  getModelDisplayStatus?: OverridableMethod<(props: { id: Id64String }) => Promise<VisibilityStatus>>;
  getCategoryDisplayStatus?: OverridableMethod<(props: GetCategoryStatusProps) => Promise<VisibilityStatus>>;
  getElementGroupingNodeDisplayStatus?: OverridableMethod<(props: { node: GroupingHierarchyNode }) => Promise<VisibilityStatus>>;
  getElementDisplayStatus?: OverridableMethod<(props: GetElementStateProps) => Promise<VisibilityStatus>>;

  changeSubjectNodeState?: OverridableMethod<(props: { node: HierarchyNode; ids: Id64Set; on: boolean }) => Promise<void>>;
  changeModelState?: OverridableMethod<(props: ChangeModelStateProps) => Promise<void>>;
  changeCategoryState?: OverridableMethod<(props: ChangeCategoryStateProps) => Promise<void>>;
  changeElementGroupingNodeState?: OverridableMethod<(props: { node: GroupingHierarchyNode; on: boolean }) => Promise<void>>;
  changeElementState?: OverridableMethod<(props: ChangeElementStateProps) => Promise<void>>;
}

/**
 * Properties for [[HierarchyVisibilityHandler]].
 * @internal
 */
export interface ModelsTreeVisibilityHandlerProps {
  viewport: Viewport;
  overrides?: VisibilityHandlerOverrides;
}

/**
 * Hierarchy based visibility handler.
 * When determining visibility for nodes, it should take into account the visibility of their children.
 * @internal
 */
export type ModelsTreeVisibilityHandler = HierarchyVisibilityHandler;

/**
 * Creates an instance if [[HierarchyVisibilityHandler]].
 * @internal
 */
export function createModelsTreeVisibilityHandler(props: ModelsTreeVisibilityHandlerProps): ModelsTreeVisibilityHandler {
  return new ModelsTreeVisibilityHandlerImpl(props);
}

class ModelsTreeVisibilityHandlerImpl implements ModelsTreeVisibilityHandler {
  private readonly _eventListener: IVisibilityChangeEventListener;
  private readonly _queryHandler: ModelsTreeQueryHandler;
  private readonly _alwaysAndNeverDrawnElements: AlwaysAndNeverDrawnElementInfo;
  private readonly _groupingNodeElementsCache = new Map<string, { modelId: string; categoryId: string; elementIds: Observable<Id64String> }>();
  private _removePresentationHierarchyListener?: () => void;

  constructor(private readonly _props: ModelsTreeVisibilityHandlerProps) {
    this._eventListener = createVisibilityChangeEventListener(_props.viewport);
    this._queryHandler = createModelsTreeQueryHandler(this._props.viewport.iModel);
    this._alwaysAndNeverDrawnElements = new AlwaysAndNeverDrawnElementInfo(_props.viewport, this._queryHandler);
    // eslint-disable-next-line @itwin/no-internal
    this._removePresentationHierarchyListener = Presentation.presentation.onIModelHierarchyChanged.addListener(
      // istanbul ignore next
      () => {
        this._queryHandler.invalidateCache();
        this._alwaysAndNeverDrawnElements.reset();
        this._groupingNodeElementsCache.clear();
      },
    );
  }

  // istanbul ignore next
  public get onVisibilityChange() {
    return this._eventListener.onVisibilityChange;
  }

  public async getVisibilityStatus(node: HierarchyNode): Promise<VisibilityStatus> {
    return firstValueFrom(this.getVisibilityStatusObs(node));
  }

  public async changeVisibility(node: HierarchyNode, shouldDisplay: boolean): Promise<void> {
    return toVoidPromise(this.changeVisibilityObs(node, shouldDisplay));
  }

  // istanbul ignore next
  public dispose(): void {
    this._eventListener.dispose();
    this._alwaysAndNeverDrawnElements.dispose();
    this._removePresentationHierarchyListener?.();
  }

  private getVisibilityStatusObs(node: HierarchyNode): Observable<VisibilityStatus> {
    if (HierarchyNode.isClassGroupingNode(node)) {
      return this.getClassGroupingNodeDisplayStatus(node);
    }

    if (!HierarchyNode.isInstancesNode(node)) {
      return of(createVisibilityStatus("disabled"));
    }

    if (ModelsTreeNode.isSubjectNode(node)) {
      // note: subject nodes may be merged to represent multiple subject instances
      return this.getSubjectNodeVisibilityStatus(node, from(node.key.instanceKeys).pipe(map((key) => key.id)));
    }

    if (ModelsTreeNode.isModelNode(node)) {
      return this.getModelVisibilityStatus(node.key.instanceKeys[0].id);
    }

    const modelId = ModelsTreeNode.getModelId(node);
    if (!modelId) {
      return of(createVisibilityStatus("disabled"));
    }

    if (ModelsTreeNode.isCategoryNode(node)) {
      return this.getCategoryDisplayStatus({
        categoryId: node.key.instanceKeys[0].id,
        modelId,
      });
    }

    const categoryId = ModelsTreeNode.getCategoryId(node);
    if (!categoryId) {
      return of(createVisibilityStatus("disabled"));
    }

    return this.getElementDisplayStatus({
      elementId: node.key.instanceKeys[0].id,
      modelId,
      categoryId,
      hasChildren: node.children,
    });
  }

  private getSubjectNodeVisibilityStatus(node: HierarchyNode, subjectIds: Observable<Id64String>): Observable<VisibilityStatus> {
    const result = defer(() => {
      if (!this._props.viewport.view.isSpatialView()) {
        return of(createVisibilityStatus("disabled", "subject.nonSpatialView"));
      }

      return subjectIds.pipe(
        mergeMap((subjectId) => this._queryHandler.querySubjectModels(subjectId)),
        distinct(),
        mergeMap((modelId) => this.getModelVisibilityStatus(modelId)),
        map((x) => x.state),
        getVisibilityStatusFromTreeNodeChildren({
          visible: "subject.allModelsVisible",
          hidden: "subject.allModelsHidden",
          partial: "subject.someModelsHidden",
        }),
        catchError(() => of(createVisibilityStatus("disabled"))),
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
    const result = defer(() => {
      const viewport = this._props.viewport;
      if (!viewport.view.isSpatialView()) {
        return of(createVisibilityStatus("disabled", "model.nonSpatialView"));
      }

      if (!viewport.view.viewsModel(modelId)) {
        return of(createVisibilityStatus("hidden", "model.hiddenThroughModelSelector"));
      }

      return this._queryHandler.queryModelCategories(modelId).pipe(
        map((categoryId) => this.getDefaultCategoryVisibilityStatus(categoryId, modelId)),
        map((x) => x.state),
        getVisibilityFromTreeNodeChildren,
        mergeMap((visibilityByCategories) => {
          // istanbul ignore if
          if (visibilityByCategories === "empty") {
            return of(createVisibilityStatus("visible"));
          }

          // If different categories have different visibilities,
          // then there's no need to check for their elements.
          if (visibilityByCategories === "partial") {
            return of(createVisibilityStatus("partial", "model.someCategoriesHidden"));
          }

          const createStatusByCategories = () => {
            return createVisibilityStatus(
              visibilityByCategories,
              visibilityByCategories === "visible" ? "model.allCategoriesVisible" : "model.allCategoriesHidden",
            );
          };

          return this.getVisibilityFromAlwaysAndNeverDrawnElements({
            queryProps: { modelId },
            tooltips: {
              allElementsInAlwaysDrawnList: "model.allElementsInAlwaysDrawnList",
              allElementsInNeverDrawnList: "model.allElementsHidden",
              elementsInBothAlwaysAndNeverDrawn: "model.elementsInAlwaysAndNeverDrawnList",
              noElementsInExclusiveAlwaysDrawnList: "model.noElementsInExclusiveAlwaysDrawnList",
            },
            defaultStatus: createStatusByCategories,
          });
        }),
      );
    });

    const ovr = this._props.overrides?.getModelDisplayStatus;
    return ovr ? from(ovr(this.createOverrideProps({ id: modelId }, result))) : result;
  }

  private getDefaultCategoryVisibilityStatus(categoryId: Id64String, modelId: Id64String): NonPartialVisibilityStatus {
    const viewport = this._props.viewport;

    if (!viewport.view.viewsModel(modelId)) {
      return createVisibilityStatus("hidden", "category.hiddenThroughModel");
    }

    switch (this._props.viewport.perModelCategoryVisibility.getOverride(modelId, categoryId)) {
      case PerModelCategoryVisibility.Override.Show:
        return createVisibilityStatus("visible", "category.displayedThroughPerModelOverride");
      case PerModelCategoryVisibility.Override.Hide:
        return createVisibilityStatus("hidden", "category.hiddenThroughPerModelOverride");
    }

    const isVisible = viewport.view.viewsCategory(categoryId);
    return isVisible
      ? createVisibilityStatus("visible", "category.displayedThroughCategorySelector")
      : createVisibilityStatus("hidden", "category.hiddenThroughCategorySelector");
  }

  private getCategoryDisplayStatus(props: GetCategoryStatusProps): Observable<VisibilityStatus> {
    const result = defer(() => {
      if (!this._props.viewport.view.viewsModel(props.modelId)) {
        return of(createVisibilityStatus("hidden", "category.hiddenThroughModel"));
      }

      return this.getVisibilityFromAlwaysAndNeverDrawnElements({
        queryProps: props,
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

  private getClassGroupingNodeDisplayStatus(node: GroupingHierarchyNode): Observable<VisibilityStatus> {
    const result = defer(() => {
      const info = this.getGroupingNodeInfo(node);

      const { modelId, categoryId, elementIds } = info;
      if (!this._props.viewport.view.viewsModel(modelId)) {
        return of(createVisibilityStatus("hidden"));
      }

      return elementIds.pipe(
        toSet(),
        mergeMap((ids) => {
          return this.getVisibilityFromAlwaysAndNeverDrawnElements({
            elements: ids,
            defaultStatus: () => {
              const status = this.getDefaultCategoryVisibilityStatus(categoryId, modelId);
              return createVisibilityStatus(status.state, `groupingNode.${status.state}ThroughCategory`);
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
    });

    const ovr = this._props.overrides?.getElementGroupingNodeDisplayStatus;
    return ovr ? from(ovr(this.createOverrideProps({ node }, result))) : result;
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

  private getElementDisplayStatus(props: GetElementStateProps): Observable<VisibilityStatus> {
    const result = defer(() => {
      const viewport = this._props.viewport;
      const { elementId, modelId, categoryId } = props;

      if (!viewport.view.viewsModel(modelId)) {
        return of(createVisibilityStatus("hidden", "element.hiddenThroughModel"));
      }

      let status = this.getElementOverriddenVisibility(elementId);
      if (status) {
        return of(status);
      }

      status = this.getDefaultCategoryVisibilityStatus(categoryId, modelId);
      return of(createVisibilityStatus(status.state, status.state === "visible" ? "element.visibleThroughCategory" : "element.hiddenThroughCategory"));
    });

    const ovr = this._props.overrides?.getElementDisplayStatus;
    return ovr ? from(ovr(this.createOverrideProps(props, result))) : result;
  }

  /** Changes visibility of the items represented by the tree node. */
  private changeVisibilityObs(node: HierarchyNode, on: boolean): Observable<void> {
    if (HierarchyNode.isClassGroupingNode(node)) {
      return this.changeElementGroupingNodeState(node, on);
    }

    // istanbul ignore if
    if (!HierarchyNode.isInstancesNode(node)) {
      return EMPTY;
    }

    if (ModelsTreeNode.isSubjectNode(node)) {
      return this.changeSubjectNodeState(from(node.key.instanceKeys).pipe(map((key) => key.id)), node, on);
    }

    if (ModelsTreeNode.isModelNode(node)) {
      return this.changeModelState({ ids: node.key.instanceKeys[0].id, on });
    }

    const modelId = ModelsTreeNode.getModelId(node);
    if (!modelId) {
      return EMPTY;
    }

    if (ModelsTreeNode.isCategoryNode(node)) {
      return this.changeCategoryState({
        categoryId: node.key.instanceKeys[0].id,
        modelId,
        on,
      });
    }

    const categoryId = ModelsTreeNode.getCategoryId(node);
    // istanbul ignore if
    if (!categoryId) {
      // istanbul ignore next
      return EMPTY;
    }

    return this.changeElementState({
      elementId: node.key.instanceKeys[0].id,
      modelId,
      categoryId,
      hasChildren: node.children,
      on,
    });
  }

  private changeSubjectNodeState(ids: Observable<Id64String>, node: HierarchyNode, on: boolean): Observable<void> {
    const result = defer(() => {
      // istanbul ignore if
      if (!this._props.viewport.view.isSpatialView()) {
        return EMPTY;
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

  private showModelWithoutAnyCategoriesOrElements(modelId: Id64String) {
    const viewport = this._props.viewport;
    return forkJoin({
      categories: this._queryHandler.queryModelCategories(modelId).pipe(toArray()),
      alwaysDrawnElements: this.getAlwaysDrawnElements({ modelId }),
    }).pipe(
      mergeMap(async ({ categories, alwaysDrawnElements }) => {
        const alwaysDrawn = this._props.viewport.alwaysDrawn;
        if (alwaysDrawn && alwaysDrawnElements) {
          viewport.setAlwaysDrawn(setDifference(alwaysDrawn, alwaysDrawnElements));
        }
        categories.forEach((categoryId) => {
          this.changeCategoryStateInViewportAccordingToModelVisibility(modelId, categoryId, false);
        });
        return viewport.addViewedModels(modelId);
      }),
    );
  }

  private changeCategoryStateInViewportAccordingToModelVisibility(modelId: string, categoryId: string, on: boolean) {
    const viewport = this._props.viewport;
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
  }

  private changeCategoryState(props: ChangeCategoryStateProps): Observable<void> {
    const result = defer(() => {
      const viewport = this._props.viewport;
      const { modelId, categoryId, on } = props;
      return concat(
        props.on && !viewport.view.viewsModel(modelId) ? this.showModelWithoutAnyCategoriesOrElements(modelId) : EMPTY,
        defer(() => {
          this.changeCategoryStateInViewportAccordingToModelVisibility(modelId, categoryId, on);
          return this.clearAlwaysAndNeverDrawnElements(props);
        }),
      );
    });

    const ovr = this._props.overrides?.changeCategoryState;
    return ovr ? from(ovr(this.createVoidOverrideProps(props, result))) : result;
  }

  /**
   * Updates visibility of all grouping node's elements.
   * @see `changeElementState`
   */
  private changeElementGroupingNodeState(node: GroupingHierarchyNode, on: boolean): Observable<void> {
    const result = defer(() => {
      const info = this.getGroupingNodeInfo(node);

      const { modelId, categoryId, elementIds } = info;
      const viewport = this._props.viewport;
      return concat(
        on && !viewport.view.viewsModel(modelId) ? this.showModelWithoutAnyCategoriesOrElements(modelId) : EMPTY,
        defer(() => {
          const categoryVisibility = this.getDefaultCategoryVisibilityStatus(categoryId, modelId);
          const isDisplayedByDefault = categoryVisibility.state === "visible";
          return from(elementIds).pipe(this.changeElementStateNoChildrenOperator({ on, isDisplayedByDefault }));
        }),
      );
    });

    const ovr = this._props.overrides?.changeElementGroupingNodeState;
    return ovr ? from(ovr(this.createVoidOverrideProps({ node, on }, result))) : result;
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
        props.on && !viewport.view.viewsModel(modelId) ? this.showModelWithoutAnyCategoriesOrElements(modelId) : EMPTY,
        defer(() => {
          const categoryVisibility = this.getDefaultCategoryVisibilityStatus(categoryId, modelId);
          const isDisplayedByDefault = categoryVisibility.state === "visible";
          return of(elementId).pipe(
            concatWith(hasChildren ? from(this._queryHandler.queryElements({ rootElementIds: props.elementId })) : EMPTY),
            this.changeElementStateNoChildrenOperator({ on, isDisplayedByDefault }),
          );
        }),
      );
    });

    const ovr = this._props.overrides?.changeElementState;
    return ovr ? from(ovr(this.createVoidOverrideProps(props, result))) : result;
  }

  private changeElementStateNoChildrenOperator(props: { on: boolean; isDisplayedByDefault: boolean }): OperatorFunction<string, void> {
    return (elementIds: Observable<Id64String>) => {
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

  private getVisibilityFromAlwaysAndNeverDrawnElementsImpl(
    props: {
      alwaysDrawn: Id64Set | undefined;
      neverDrawn: Id64Set | undefined;
      totalCount: number;
    } & GetVisibilityFromAlwaysAndNeverDrawnElementsProps,
  ): VisibilityStatus {
    const { alwaysDrawn, neverDrawn, totalCount } = props;

    if (neverDrawn?.size === totalCount) {
      return createVisibilityStatus("hidden", props.tooltips.allElementsInNeverDrawnList);
    }

    if (alwaysDrawn?.size === totalCount) {
      return createVisibilityStatus("visible", props.tooltips.allElementsInAlwaysDrawnList);
    }

    const viewport = this._props.viewport;
    if (viewport.isAlwaysDrawnExclusive && viewport.alwaysDrawn?.size) {
      return alwaysDrawn?.size
        ? createVisibilityStatus("partial", props.tooltips.elementsInBothAlwaysAndNeverDrawn)
        : createVisibilityStatus("hidden", props.tooltips.noElementsInExclusiveAlwaysDrawnList);
    }

    if (!neverDrawn?.size && !alwaysDrawn?.size) {
      return props.defaultStatus();
    }

    return createVisibilityStatus("partial", props.tooltips.elementsInBothAlwaysAndNeverDrawn);
  }

  private getVisibilityFromAlwaysAndNeverDrawnElements(
    props: GetVisibilityFromAlwaysAndNeverDrawnElementsProps & ({ elements: Id64Set } | { queryProps: AlwaysOrNeverDrawnElementsQueryProps }),
  ): Observable<VisibilityStatus> {
    const viewport = this._props.viewport;
    if (viewport.isAlwaysDrawnExclusive) {
      if (!viewport?.alwaysDrawn?.size) {
        return of(createVisibilityStatus("hidden", props.tooltips.noElementsInExclusiveAlwaysDrawnList));
      }
    } else if (!viewport?.neverDrawn?.size && !viewport?.alwaysDrawn?.size) {
      return of(props.defaultStatus());
    }

    if ("elements" in props) {
      return of(
        this.getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
          ...props,
          alwaysDrawn: viewport.alwaysDrawn?.size ? setIntersection(props.elements, viewport.alwaysDrawn) : undefined,
          neverDrawn: viewport.neverDrawn?.size ? setIntersection(props.elements, viewport.neverDrawn) : undefined,
          totalCount: props.elements.size,
        }),
      );
    }

    return forkJoin({
      totalCount: this._queryHandler.queryElementsCount(props.queryProps),
      alwaysDrawn: this.getAlwaysDrawnElements(props.queryProps),
      neverDrawn: this.getNeverDrawnElements(props.queryProps),
    }).pipe(
      map((state) => {
        return this.getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
          ...props,
          ...state,
        });
      }),
    );
  }

  private getAlwaysDrawnElements(props: AlwaysOrNeverDrawnElementsQueryProps) {
    return this._alwaysAndNeverDrawnElements.getElements({ ...props, setType: "always" });
  }

  private getNeverDrawnElements(props: AlwaysOrNeverDrawnElementsQueryProps) {
    return this._alwaysAndNeverDrawnElements.getElements({ ...props, setType: "never" });
  }

  private clearAlwaysAndNeverDrawnElements(props: Omit<AlwaysOrNeverDrawnElementsQueryProps, "setType">) {
    return forkJoin({
      alwaysDrawn: this.getAlwaysDrawnElements(props),
      neverDrawn: this.getNeverDrawnElements(props),
    }).pipe(
      map(({ alwaysDrawn, neverDrawn }) => {
        const viewport = this._props.viewport;
        if (viewport.alwaysDrawn?.size && alwaysDrawn.size) {
          viewport.setAlwaysDrawn(setDifference(viewport.alwaysDrawn, alwaysDrawn));
        }
        if (viewport.neverDrawn?.size && neverDrawn.size) {
          viewport.setNeverDrawn(setDifference(viewport.neverDrawn, neverDrawn));
        }
      }),
    );
  }

  private createVoidOverrideProps<TProps>(props: TProps, obs: Observable<void>): OverridableMethodProps<(props: TProps) => Promise<void>> {
    return {
      ...props,
      originalImplementation: async () => toVoidPromise(obs),
      handler: this,
    };
  }

  private createOverrideProps<TProps, TObservable extends Observable<any>>(
    props: TProps,
    obs: TObservable,
  ): TObservable extends Observable<infer T> ? OverridableMethodProps<(props: TProps) => Promise<T>> : never;
  private createOverrideProps<TProps, TObservable extends Observable<unknown>>(
    props: TProps,
    obs: TObservable,
  ): OverridableMethodProps<(props: TProps) => Promise<unknown>> {
    return {
      ...props,
      originalImplementation: async () => firstValueFrom(obs),
      handler: this,
    };
  }

  private getGroupingNodeInfo(node: GroupingHierarchyNode) {
    const cacheKey = JSON.stringify(node.key);
    let res = this._groupingNodeElementsCache.get(cacheKey);
    if (res) {
      return res;
    }

    const modelId = ModelsTreeNode.getModelId(node);
    const categoryId = ModelsTreeNode.getCategoryId(node);
    assert(!!modelId && !!categoryId);

    const ids = node.groupedInstanceKeys.map((key) => key.id);
    const elementIds = from(ids).pipe(
      mergeWith(
        this._queryHandler.queryElements({
          rootElementIds: new Set(ids),
        }),
      ),
      shareReplay(),
    );
    res = { modelId, categoryId, elementIds };

    this._groupingNodeElementsCache.set(cacheKey, res);
    return res;
  }
}

interface GetVisibilityFromAlwaysAndNeverDrawnElementsProps {
  tooltips: {
    allElementsInNeverDrawnList: string;
    allElementsInAlwaysDrawnList: string;
    elementsInBothAlwaysAndNeverDrawn: string;
    noElementsInExclusiveAlwaysDrawnList: string;
  };
  /** Status when always/never lists are empty and exclusive mode is off */
  defaultStatus: () => NonPartialVisibilityStatus;
}

function getVisibilityFromTreeNodeChildren(obs: Observable<Visibility>): Observable<Visibility | "empty"> {
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

function getVisibilityStatusFromTreeNodeChildren(tooltipMap: { [key in Visibility]: string | undefined }): OperatorFunction<Visibility, VisibilityStatus> {
  return (obs) => {
    return getVisibilityFromTreeNodeChildren(obs).pipe(
      map((visibility) => {
        if (visibility === "empty") {
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
