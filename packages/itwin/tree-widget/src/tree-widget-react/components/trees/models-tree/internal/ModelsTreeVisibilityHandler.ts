/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  concat,
  concatAll,
  defer,
  distinct,
  EMPTY,
  filter,
  firstValueFrom,
  forkJoin,
  from,
  fromEventPattern,
  map,
  merge,
  mergeMap,
  of,
  reduce,
  shareReplay,
  startWith,
  Subject,
  take,
  takeUntil,
  tap,
  toArray,
} from "rxjs";
import { assert } from "@itwin/core-bentley";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { HierarchyNode, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { toggleAllCategories } from "../../common/CategoriesVisibilityUtils.js";
import { reduceWhile, toVoidPromise } from "../../common/Rxjs.js";
import { createVisibilityStatus } from "../../common/Tooltip.js";
import { createVisibilityHandlerResult } from "../../common/UseHierarchyVisibility.js";
import { releaseMainThreadOnItemsCount } from "../Utils.js";
import { AlwaysAndNeverDrawnElementInfo } from "./AlwaysAndNeverDrawnElementInfo.js";
import { createFilteredTree, parseCategoryKey } from "./FilteredTree.js";
import { ModelsTreeNode } from "./ModelsTreeNode.js";
import { createVisibilityChangeEventListener } from "./VisibilityChangeEventListener.js";

import type { Observable, OperatorFunction, Subscription } from "rxjs";
import type { GroupingHierarchyNode, HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { HierarchyVisibilityHandler, HierarchyVisibilityHandlerOverridableMethod, VisibilityStatus } from "../../common/UseHierarchyVisibility.js";
import type { ModelsTreeIdsCache } from "./ModelsTreeIdsCache.js";
import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { AlwaysOrNeverDrawnElementsQueryProps } from "./AlwaysAndNeverDrawnElementInfo.js";
import type { IVisibilityChangeEventListener } from "./VisibilityChangeEventListener.js";
import type { Viewport } from "@itwin/core-frontend";
import type { NonPartialVisibilityStatus, Visibility } from "../../common/Tooltip.js";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { FilteredTree } from "./FilteredTree.js";

/** @beta */
interface GetCategoryVisibilityStatusProps {
  categoryId: Id64String;
  modelId: Id64String;
}

/** @beta */
interface ChangeCategoryVisibilityStateProps extends GetCategoryVisibilityStatusProps {
  on: boolean;
}

/** @beta */
interface GetGeometricElementVisibilityStatusProps {
  elementId: Id64String;
  modelId: Id64String;
  categoryId: Id64String;
}

/** @beta */
interface ChangeGeometricElementsDisplayStateProps {
  elementIds: Id64Set;
  modelId: Id64String;
  categoryId: Id64String;
  on: boolean;
}

/** @beta */
interface ChangeModelVisibilityStateProps {
  ids: Id64Arg;
  on: boolean;
}

/** @beta */
interface GetFilteredNodeVisibilityProps {
  node: HierarchyNode;
}

/** @beta */
interface ChangeFilteredNodeVisibilityProps extends GetFilteredNodeVisibilityProps {
  on: boolean;
}

/**
 * Functionality of Models tree visibility handler that can be overridden.
 * Each callback is provided original implementation and reference to a `HierarchyVisibilityHandler`.
 * @beta
 */
export interface ModelsTreeVisibilityHandlerOverrides {
  getSubjectNodeVisibility?: HierarchyVisibilityHandlerOverridableMethod<(props: { ids: Id64Array }) => Promise<VisibilityStatus>>;
  getModelDisplayStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: { id: Id64String }) => Promise<VisibilityStatus>>;
  getCategoryDisplayStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: GetCategoryVisibilityStatusProps) => Promise<VisibilityStatus>>;
  getElementGroupingNodeDisplayStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: { node: GroupingHierarchyNode }) => Promise<VisibilityStatus>>;
  getElementDisplayStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: GetGeometricElementVisibilityStatusProps) => Promise<VisibilityStatus>>;

  changeSubjectNodeState?: HierarchyVisibilityHandlerOverridableMethod<(props: { ids: Id64Array; on: boolean }) => Promise<void>>;
  changeModelState?: HierarchyVisibilityHandlerOverridableMethod<(props: ChangeModelVisibilityStateProps) => Promise<void>>;
  changeCategoryState?: HierarchyVisibilityHandlerOverridableMethod<(props: ChangeCategoryVisibilityStateProps) => Promise<void>>;
  changeElementGroupingNodeState?: HierarchyVisibilityHandlerOverridableMethod<(props: { node: GroupingHierarchyNode; on: boolean }) => Promise<void>>;
  changeElementsState?: HierarchyVisibilityHandlerOverridableMethod<(props: ChangeGeometricElementsDisplayStateProps) => Promise<void>>;
}

/**
 * Props for `createModelsTreeVisibilityHandler`.
 * @internal
 */
export interface ModelsTreeVisibilityHandlerProps {
  viewport: Viewport;
  idsCache: ModelsTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  overrides?: ModelsTreeVisibilityHandlerOverrides;
  filteredPaths?: HierarchyFilteringPath[];
}

/**
 * Creates an instance if `ModelsTreeVisibilityHandler`.
 * @internal
 */
export function createModelsTreeVisibilityHandler(props: ModelsTreeVisibilityHandlerProps): HierarchyVisibilityHandler {
  return new ModelsTreeVisibilityHandlerImpl(props);
}

class ModelsTreeVisibilityHandlerImpl implements HierarchyVisibilityHandler {
  private readonly _eventListener: IVisibilityChangeEventListener;
  private readonly _alwaysAndNeverDrawnElements: AlwaysAndNeverDrawnElementInfo;
  private readonly _idsCache: ModelsTreeIdsCache;
  private _filteredTree: Promise<FilteredTree> | undefined;
  private _elementChangeQueue = new Subject<Observable<void>>();
  private _subscriptions: Subscription[] = [];
  private _changeRequest = new Subject<{ key: HierarchyNodeKey; depth: number }>();

  constructor(private readonly _props: ModelsTreeVisibilityHandlerProps) {
    this._eventListener = createVisibilityChangeEventListener(_props.viewport);
    this._alwaysAndNeverDrawnElements = new AlwaysAndNeverDrawnElementInfo(_props.viewport);
    this._idsCache = this._props.idsCache;
    this._filteredTree = _props.filteredPaths ? createFilteredTree(this._props.imodelAccess, _props.filteredPaths) : undefined;
    this._subscriptions.push(this._elementChangeQueue.pipe(concatAll()).subscribe());
  }

  public get onVisibilityChange() {
    return this._eventListener.onVisibilityChange;
  }

  public async getVisibilityStatus(node: HierarchyNode): Promise<VisibilityStatus> {
    return firstValueFrom(
      this.getVisibilityStatusObs(node).pipe(
        // unsubscribe from the observable if the change request for this node is received
        takeUntil(this._changeRequest.pipe(filter(({ key, depth }) => depth === node.parentKeys.length && HierarchyNodeKey.equals(node.key, key)))),
        // unsubscribe if visibility changes
        takeUntil(
          fromEventPattern(
            (handler) => {
              this._eventListener.onVisibilityChange.addListener(handler);
            },
            (handler) => {
              this._eventListener.onVisibilityChange.removeListener(handler);
            },
          ),
        ),
      ),
    );
  }

  public async changeVisibility(node: HierarchyNode, shouldDisplay: boolean): Promise<void> {
    // notify about new change request
    this._changeRequest.next({ key: node.key, depth: node.parentKeys.length });

    const changeObservable = this.changeVisibilityObs(node, shouldDisplay).pipe(
      // unsubscribe from the observable if the change request for this node is received
      takeUntil(this._changeRequest.pipe(filter(({ key, depth }) => depth === node.parentKeys.length && HierarchyNodeKey.equals(node.key, key)))),
      tap({
        subscribe: () => {
          this._eventListener.suppressChangeEvents();
          this._alwaysAndNeverDrawnElements.suppressChangeEvents();
        },
        finalize: () => {
          this._eventListener.resumeChangeEvents();
          this._alwaysAndNeverDrawnElements.resumeChangeEvents();
        },
      }),
    );

    return toVoidPromise(changeObservable);
  }

  public dispose(): void {
    this._eventListener.dispose();
    this._alwaysAndNeverDrawnElements.dispose();
    this._subscriptions.forEach((x) => x.unsubscribe());
  }

  private getVisibilityStatusObs(node: HierarchyNode): Observable<VisibilityStatus> {
    if (node.filtering?.filteredChildrenIdentifierPaths?.length && !node.filtering.isFilterTarget) {
      return this.getFilteredNodeVisibility({ node });
    }

    if (HierarchyNode.isClassGroupingNode(node)) {
      return this.getClassGroupingNodeDisplayStatus(node);
    }

    if (!HierarchyNode.isInstancesNode(node)) {
      return of(createVisibilityStatus("disabled"));
    }

    if (ModelsTreeNode.isSubjectNode(node)) {
      // note: subject nodes may be merged to represent multiple subject instances
      return this.getSubjectNodeVisibilityStatus({ subjectIds: node.key.instanceKeys.map((key) => key.id) });
    }

    if (ModelsTreeNode.isModelNode(node)) {
      return this.getModelVisibilityStatus({ modelId: node.key.instanceKeys[0].id });
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
    });
  }

  private getFilteredNodeVisibility(props: GetFilteredNodeVisibilityProps) {
    return from(this.getVisibilityChangeTargets(props)).pipe(
      mergeMap(({ subjects, models, categories, elements }) => {
        const observables = new Array<Observable<VisibilityStatus>>();
        if (subjects?.size) {
          observables.push(this.getSubjectNodeVisibilityStatus({ subjectIds: [...subjects], ignoreTooltip: true }));
        }

        if (models?.size) {
          observables.push(from(models).pipe(mergeMap((modelId) => this.getModelVisibilityStatus({ modelId, ignoreTooltip: true }))));
        }

        if (categories?.size) {
          observables.push(
            from(categories).pipe(
              mergeMap((key) => {
                const { modelId, categoryId } = parseCategoryKey(key);
                return this.getCategoryDisplayStatus({ modelId, categoryId, ignoreTooltip: true });
              }),
            ),
          );
        }

        if (elements?.size) {
          observables.push(
            from(elements).pipe(
              releaseMainThreadOnItemsCount(50),
              mergeMap(([categoryKey, elementIds]) => {
                const { modelId, categoryId } = parseCategoryKey(categoryKey);
                return from(elementIds).pipe(
                  releaseMainThreadOnItemsCount(1000),
                  mergeMap((elementId) => this.getElementDisplayStatus({ modelId, categoryId, elementId, ignoreTooltip: true })),
                );
              }),
            ),
          );
        }

        return merge(...observables);
      }),
      map((x) => x.state),
      getVisibilityFromTreeNodeChildren,
      map((x) => {
        assert(x !== "empty");
        return createVisibilityStatus(x);
      }),
    );
  }

  private getSubjectNodeVisibilityStatus({ subjectIds, ignoreTooltip }: { subjectIds: Id64Array; ignoreTooltip?: boolean }): Observable<VisibilityStatus> {
    const result = defer(() => {
      if (!this._props.viewport.view.isSpatialView()) {
        return of(createVisibilityStatus("disabled", getTooltipOptions("modelsTree.subject.nonSpatialView", ignoreTooltip)));
      }

      return from(this._idsCache.getSubjectModelIds(subjectIds)).pipe(
        concatAll(),
        distinct(),
        mergeMap((modelId) => this.getModelVisibilityStatus({ modelId, ignoreTooltip: true })),
        map((x) => x.state),
        getVisibilityStatusFromTreeNodeChildren(
          {
            visible: "modelsTree.subject.allModelsVisible",
            hidden: "modelsTree.subject.allModelsHidden",
            partial: "modelsTree.subject.someModelsHidden",
          },
          ignoreTooltip,
        ),
      );
    });
    return createVisibilityHandlerResult(this, { ids: subjectIds }, result, this._props.overrides?.getSubjectNodeVisibility);
  }

  private getModelVisibilityStatus({ modelId, ignoreTooltip }: { modelId: Id64String; ignoreTooltip?: boolean }): Observable<VisibilityStatus> {
    const result = defer(() => {
      const viewport = this._props.viewport;
      if (!viewport.view.isSpatialView()) {
        return of(createVisibilityStatus("disabled", getTooltipOptions("modelsTree.model.nonSpatialView", ignoreTooltip)));
      }

      if (!viewport.view.viewsModel(modelId)) {
        return from(this._idsCache.getModelCategories(modelId)).pipe(
          mergeMap((categoryIds) =>
            from(this._idsCache.getCategoriesModeledElements(modelId, categoryIds)).pipe(
              mergeMap((modeledElementIds) => {
                if (modeledElementIds.length > 0) {
                  return from(["", ...modeledElementIds]).pipe(
                    mergeMap((modeledElementId, index) =>
                      index !== 0 ? this.getModelVisibilityStatus({ modelId: modeledElementId }) : of(createVisibilityStatus("hidden")),
                    ),
                    map((visibilityStatusOfSubModels) => visibilityStatusOfSubModels.state),
                    getVisibilityStatusFromTreeNodeChildren({
                      visible: undefined,
                      hidden: "modelsTree.model.hiddenThroughModelSelector",
                      partial: "modelsTree.model.someSubModelsVisible",
                    }),
                  );
                }
                return of(createVisibilityStatus("hidden", getTooltipOptions("modelsTree.model.hiddenThroughModelSelector", ignoreTooltip)));
              }),
            ),
          ),
        );
      }

      return from(this._idsCache.getModelCategories(modelId)).pipe(
        concatAll(),
        mergeMap((categoryId) => this.getCategoryDisplayStatus({ modelId, categoryId, ignoreTooltip: true })),
        map((x) => x.state),
        getVisibilityFromTreeNodeChildren,
        map((visibilityByCategories) => {
          const state = visibilityByCategories === "empty" ? "visible" : visibilityByCategories;
          return createVisibilityStatus(
            state,
            getTooltipOptions(
              state === "partial" ? "modelsTree.model.someCategoriesHidden" : `modelsTree.model.allCategories${state ? "Visible" : "Hidden"}`,
              ignoreTooltip,
            ),
          );
        }),
      );
    });
    return createVisibilityHandlerResult(this, { id: modelId }, result, this._props.overrides?.getModelDisplayStatus);
  }

  private getDefaultCategoryVisibilityStatus({
    modelId,
    categoryId,
    ignoreTooltip,
  }: {
    categoryId: Id64String;
    modelId: Id64String;
    ignoreTooltip?: boolean;
  }): NonPartialVisibilityStatus {
    const viewport = this._props.viewport;

    if (!viewport.view.viewsModel(modelId)) {
      return createVisibilityStatus("hidden", getTooltipOptions("modelsTree.category.hiddenThroughModel", ignoreTooltip));
    }

    switch (this._props.viewport.perModelCategoryVisibility.getOverride(modelId, categoryId)) {
      case PerModelCategoryVisibility.Override.Show:
        return createVisibilityStatus("visible", getTooltipOptions("modelsTree.category.displayedThroughPerModelOverride", ignoreTooltip));
      case PerModelCategoryVisibility.Override.Hide:
        return createVisibilityStatus("hidden", getTooltipOptions("modelsTree.category.hiddenThroughPerModelOverride", ignoreTooltip));
    }

    const isVisible = viewport.view.viewsCategory(categoryId);
    return isVisible
      ? createVisibilityStatus("visible", getTooltipOptions("modelsTree.category.displayedThroughCategorySelector", ignoreTooltip))
      : createVisibilityStatus("hidden", getTooltipOptions("modelsTree.category.hiddenThroughCategorySelector", ignoreTooltip));
  }

  private getCategoryDisplayStatus({ ignoreTooltip, ...props }: GetCategoryVisibilityStatusProps & { ignoreTooltip?: boolean }): Observable<VisibilityStatus> {
    const result = defer(() => {
      if (!this._props.viewport.view.viewsModel(props.modelId)) {
        return from(this._idsCache.getCategoriesModeledElements(props.modelId, [props.categoryId])).pipe(
          mergeMap((modeledElementIds) => {
            if (modeledElementIds.length === 0) {
              return of(createVisibilityStatus("hidden", getTooltipOptions("modelsTree.category.hiddenThroughModel", ignoreTooltip)));
            }
            return from(["", ...modeledElementIds]).pipe(
              mergeMap((modeledElementId, index) =>
                index !== 0 ? this.getModelVisibilityStatus({ modelId: modeledElementId }) : of(createVisibilityStatus("hidden")),
              ),
              map((visibilityStatusOfSubModels) => visibilityStatusOfSubModels.state),
              getVisibilityStatusFromTreeNodeChildren({
                visible: undefined,
                hidden: "modelsTree.category.hiddenThroughModel",
                partial: "modelsTree.category.someElementsOrSubModelsHidden",
              }),
            );
          }),
        );
      }

      return this.getVisibilityFromAlwaysAndNeverDrawnElements({
        queryProps: props,
        tooltips: {
          allElementsInAlwaysDrawnList: "modelsTree.category.allElementsVisible",
          allElementsInNeverDrawnList: "modelsTree.category.allElementsHidden",
          elementsInBothAlwaysAndNeverDrawn: "modelsTree.category.someElementsAreHidden",
          noElementsInExclusiveAlwaysDrawnList: "modelsTree.category.allElementsHidden",
        },
        defaultStatus: () => this.getDefaultCategoryVisibilityStatus(props),
        ignoreTooltip,
      }).pipe(
        mergeMap((visibilityStatusAlwaysAndNeverDraw) => {
          return from(this._idsCache.getCategoriesModeledElements(props.modelId, [props.categoryId])).pipe(
            mergeMap((modeledElementIds) => {
              if (modeledElementIds.length === 0) {
                return of(visibilityStatusAlwaysAndNeverDraw);
              }

              return from(["", ...modeledElementIds]).pipe(
                mergeMap((modeledElementId, index) =>
                  index !== 0 ? this.getModelVisibilityStatus({ modelId: modeledElementId }) : of(visibilityStatusAlwaysAndNeverDraw),
                ),
                map((visibilityStatusOfSubModels) => visibilityStatusOfSubModels.state),
                getVisibilityStatusFromTreeNodeChildren({
                  visible: undefined,
                  hidden: "modelsTree.category.allElementsAndSubModelsHidden",
                  partial: "modelsTree.category.someElementsOrSubModelsHidden",
                }),
                map((visibilityStatusFormatted) => {
                  if (visibilityStatusFormatted.state === "visible") {
                    return visibilityStatusAlwaysAndNeverDraw;
                  }
                  return visibilityStatusFormatted;
                }),
              );
            }),
          );
        }),
      );
    });
    return createVisibilityHandlerResult(this, props, result, this._props.overrides?.getCategoryDisplayStatus);
  }

  private getClassGroupingNodeDisplayStatus(node: GroupingHierarchyNode): Observable<VisibilityStatus> {
    const result = defer(() => {
      const info = this.getGroupingNodeInfo(node);

      const { modelId, categoryId, elementIds } = info;
      if (!this._props.viewport.view.viewsModel(modelId)) {
        return from(elementIds).pipe(
          mergeMap((elementId) => from(this._idsCache.hasSubModel(elementId)).pipe(map((hasSubModel) => ({ elementId, hasSubModel })))),
          toArray(),
          mergeMap((elementsDetails) => {
            const elementsWithSubModels = elementsDetails
              .filter((elementDetails) => elementDetails.hasSubModel)
              .map((elementDetails) => elementDetails.elementId);

            if (elementsWithSubModels.length === 0) {
              return of(createVisibilityStatus("hidden"));
            }

            return from(["", ...elementsWithSubModels]).pipe(
              mergeMap((elementId, index) => (index !== 0 ? this.getModelVisibilityStatus({ modelId: elementId }) : of(createVisibilityStatus("hidden")))),
              map((visibilityStatusOfChild) => visibilityStatusOfChild.state),
              getVisibilityStatusFromTreeNodeChildren({
                visible: undefined,
                hidden: undefined,
                partial: "modelsTree.groupingNode.someElementsOrSubModelsHidden",
              }),
            );
          }),
        );
      }

      return this.getVisibilityFromAlwaysAndNeverDrawnElements({
        elements: elementIds,
        defaultStatus: () => {
          const status = this.getDefaultCategoryVisibilityStatus({ categoryId, modelId, ignoreTooltip: true });
          return createVisibilityStatus(status.state, getTooltipOptions(`modelsTree.groupingNode.${status.state}ThroughCategory`));
        },
        tooltips: {
          allElementsInAlwaysDrawnList: "modelsTree.groupingNode.allElementsVisible",
          allElementsInNeverDrawnList: "modelsTree.groupingNode.allElementsHidden",
          elementsInBothAlwaysAndNeverDrawn: "modelsTree.groupingNode.someElementsAreHidden",
          noElementsInExclusiveAlwaysDrawnList: "modelsTree.groupingNode.allElementsHidden",
        },
      }).pipe(
        mergeMap((visibilityStatusAlwaysAndNeverDraw) => {
          return from(elementIds).pipe(
            mergeMap((elementId) => from(this._idsCache.hasSubModel(elementId)).pipe(map((hasSubModel) => ({ elementId, hasSubModel })))),
            toArray(),
            mergeMap((elementsDetails) => {
              const elementsWithSubModels = elementsDetails
                .filter((elementDetails) => elementDetails.hasSubModel)
                .map((elementDetails) => elementDetails.elementId);

              if (elementsWithSubModels.length === 0) {
                return of(visibilityStatusAlwaysAndNeverDraw);
              }

              return from(["", ...elementsWithSubModels]).pipe(
                mergeMap((elementId, index) => (index !== 0 ? this.getModelVisibilityStatus({ modelId: elementId }) : of(visibilityStatusAlwaysAndNeverDraw))),
                map((visibilityStatusOfChild) => visibilityStatusOfChild.state),
                getVisibilityStatusFromTreeNodeChildren({
                  visible: undefined,
                  hidden: "modelsTree.groupingNode.allElementsAndSubModelsHidden",
                  partial: "modelsTree.groupingNode.someElementsOrSubModelsHidden",
                }),
                map((visibilityStatusFormatted) => {
                  if (visibilityStatusFormatted.state === "visible") {
                    return visibilityStatusAlwaysAndNeverDraw;
                  }
                  return visibilityStatusFormatted;
                }),
              );
            }),
          );
        }),
      );
    });
    return createVisibilityHandlerResult(this, { node }, result, this._props.overrides?.getElementGroupingNodeDisplayStatus);
  }

  private getElementOverriddenVisibility(elementId: string, ignoreTooltip?: boolean): NonPartialVisibilityStatus | undefined {
    const viewport = this._props.viewport;
    if (viewport.neverDrawn?.has(elementId)) {
      return createVisibilityStatus("hidden", getTooltipOptions("modelsTree.element.hiddenThroughNeverDrawnList", ignoreTooltip));
    }

    if (viewport.alwaysDrawn?.size) {
      if (viewport.alwaysDrawn.has(elementId)) {
        return createVisibilityStatus("visible", getTooltipOptions("modelsTree.element.displayedThroughAlwaysDrawnList", ignoreTooltip));
      }

      if (viewport.isAlwaysDrawnExclusive) {
        return createVisibilityStatus("hidden", getTooltipOptions("modelsTree.element.hiddenDueToOtherElementsExclusivelyAlwaysDrawn", ignoreTooltip));
      }
    }

    return undefined;
  }

  private getElementVisibility(
    ignoreTooltip: boolean | undefined,
    viewsModel: boolean,
    overridenVisibility: NonPartialVisibilityStatus | undefined,
    categoryVisibility: NonPartialVisibilityStatus,
    subModelVisibilityStatus: VisibilityStatus,
  ): VisibilityStatus {
    if (subModelVisibilityStatus.state === "partial") {
      return createVisibilityStatus("partial", getTooltipOptions("modelsTree.element.someElementsAreHidden", ignoreTooltip));
    }

    if (subModelVisibilityStatus.state === "visible") {
      if (!viewsModel || overridenVisibility?.state === "hidden" || (categoryVisibility.state === "hidden" && !overridenVisibility)) {
        return createVisibilityStatus("partial", getTooltipOptions("modelsTree.element.partialThroughSubModel", ignoreTooltip));
      }
      return createVisibilityStatus("visible", getTooltipOptions(undefined, ignoreTooltip));
    }

    if (!viewsModel) {
      return createVisibilityStatus("hidden", getTooltipOptions("modelsTree.element.hiddenThroughModel", ignoreTooltip));
    }

    if (overridenVisibility) {
      if (overridenVisibility.state === "hidden") {
        return overridenVisibility;
      }
      return createVisibilityStatus("partial", getTooltipOptions("modelsTree.element.partialThroughElement", ignoreTooltip));
    }

    if (categoryVisibility.state === "visible") {
      return createVisibilityStatus("partial", getTooltipOptions("modelsTree.element.partialThroughCategory", ignoreTooltip));
    }
    return createVisibilityStatus("hidden", getTooltipOptions("modelsTree.element.hiddenThroughCategory", ignoreTooltip));
  }

  private getElementDisplayStatus({
    ignoreTooltip,
    ...props
  }: GetGeometricElementVisibilityStatusProps & { ignoreTooltip?: boolean }): Observable<VisibilityStatus> {
    const result: Observable<VisibilityStatus> = defer(() => {
      const viewport = this._props.viewport;
      const { elementId, modelId, categoryId } = props;

      const viewsModel = viewport.view.viewsModel(modelId);
      const elementStatus = this.getElementOverriddenVisibility(elementId, ignoreTooltip);

      return from(this._idsCache.hasSubModel(elementId)).pipe(
        mergeMap((hasSubModel) => {
          const categoryStatus = this.getDefaultCategoryVisibilityStatus({ categoryId, modelId, ignoreTooltip: true });
          if (hasSubModel) {
            return this.getModelVisibilityStatus({ modelId: elementId }).pipe(
              map((visibilityStatus) => {
                return this.getElementVisibility(ignoreTooltip, viewsModel, elementStatus, categoryStatus, visibilityStatus);
              }),
            );
          }

          if (!viewsModel) {
            return of(createVisibilityStatus("hidden", getTooltipOptions("modelsTree.element.hiddenThroughModel", ignoreTooltip)));
          }

          if (elementStatus) {
            return of(elementStatus);
          }

          return of(
            createVisibilityStatus(
              categoryStatus.state,
              getTooltipOptions(categoryStatus.state === "visible" ? undefined : "modelsTree.element.hiddenThroughCategory", ignoreTooltip),
            ),
          );
        }),
      );
    });
    return createVisibilityHandlerResult(this, props, result, this._props.overrides?.getElementDisplayStatus);
  }

  /** Changes visibility of the items represented by the tree node. */
  private changeVisibilityObs(node: HierarchyNode, on: boolean): Observable<void> {
    if (node.filtering?.filteredChildrenIdentifierPaths?.length && !node.filtering.isFilterTarget) {
      return this.changeFilteredNodeVisibility({ node, on });
    }

    if (HierarchyNode.isClassGroupingNode(node)) {
      return this.changeElementGroupingNodeState(node, on);
    }

    if (!HierarchyNode.isInstancesNode(node)) {
      return EMPTY;
    }

    if (ModelsTreeNode.isSubjectNode(node)) {
      return this.changeSubjectNodeState(
        node.key.instanceKeys.map((key) => key.id),
        on,
      );
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
    if (!categoryId) {
      return EMPTY;
    }

    return this.changeElementsState({
      elementIds: new Set([...node.key.instanceKeys.map(({ id }) => id)]),
      modelId,
      categoryId,
      on,
    });
  }

  private async getVisibilityChangeTargets({ node }: GetFilteredNodeVisibilityProps) {
    const filteredTree = await this._filteredTree;
    return filteredTree ? filteredTree.getVisibilityChangeTargets(node) : {};
  }

  private changeFilteredNodeVisibility({ on, ...props }: ChangeFilteredNodeVisibilityProps) {
    return from(this.getVisibilityChangeTargets(props)).pipe(
      mergeMap(({ subjects, models, categories, elements }) => {
        const observables = new Array<Observable<void>>();
        if (subjects?.size) {
          observables.push(this.changeSubjectNodeState([...subjects], on));
        }

        if (models?.size) {
          observables.push(this.changeModelState({ ids: models, on }));
        }

        if (categories?.size) {
          observables.push(
            from(categories).pipe(
              mergeMap((key) => {
                const { modelId, categoryId } = parseCategoryKey(key);
                return this.changeCategoryState({ modelId, categoryId, on });
              }),
            ),
          );
        }

        if (elements?.size) {
          observables.push(
            from(elements).pipe(
              mergeMap(([categoryKey, elementIds]) => {
                const { modelId, categoryId } = parseCategoryKey(categoryKey);
                return this.changeElementsState({ modelId, categoryId, elementIds, on });
              }),
            ),
          );
        }

        return merge(...observables);
      }),
    );
  }

  private changeSubjectNodeState(ids: Id64Array, on: boolean): Observable<void> {
    const result = defer(() => {
      if (!this._props.viewport.view.isSpatialView()) {
        return EMPTY;
      }

      return from(this._idsCache.getSubjectModelIds(ids)).pipe(mergeMap((modelIds) => this.changeModelState({ ids: modelIds, on })));
    });
    return createVisibilityHandlerResult(this, { ids, on }, result, this._props.overrides?.changeSubjectNodeState);
  }

  private changeModelState(props: ChangeModelVisibilityStateProps): Observable<void> {
    const result = defer(() => {
      const viewport = this._props.viewport;
      if (!viewport.view.isSpatialView()) {
        return EMPTY;
      }

      const { ids, on } = props;
      if (!on) {
        viewport.changeModelDisplay(ids, false);
        return (typeof ids === "string" ? of(ids) : from(ids)).pipe(
          mergeMap((modelId) => {
            return from(this._idsCache.getModelCategories(modelId)).pipe(
              mergeMap((categoryIds) =>
                from(this._idsCache.getCategoriesModeledElements(modelId, categoryIds)).pipe(
                  mergeMap((modeledElementIds) => (modeledElementIds.length > 0 ? this.changeModelState({ ids: modeledElementIds, on }) : EMPTY)),
                ),
              ),
            );
          }),
        );
      }

      return concat(
        defer(() => {
          viewport.perModelCategoryVisibility.clearOverrides(ids);
          return from(viewport.addViewedModels(ids));
        }),
        (typeof ids === "string" ? of(ids) : from(ids)).pipe(
          mergeMap((modelId) => {
            return from(this._idsCache.getModelCategories(modelId)).pipe(
              concatAll(),
              mergeMap((categoryId) => this.changeCategoryState({ categoryId, modelId, on: true })),
            );
          }),
        ),
      );
    });
    return createVisibilityHandlerResult(this, props, result, this._props.overrides?.changeModelState);
  }

  private showModelWithoutAnyCategoriesOrElements(modelId: Id64String): Observable<void> {
    const viewport = this._props.viewport;
    return forkJoin({
      categories: this._idsCache.getModelCategories(modelId),
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

        await viewport.addViewedModels(modelId);
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

  private changeCategoryState(props: ChangeCategoryVisibilityStateProps): Observable<void> {
    const result = defer(() => {
      const viewport = this._props.viewport;
      const { modelId, categoryId, on } = props;
      return concat(
        props.on && !viewport.view.viewsModel(modelId) ? this.showModelWithoutAnyCategoriesOrElements(modelId) : EMPTY,
        defer(() => {
          this.changeCategoryStateInViewportAccordingToModelVisibility(modelId, categoryId, on);
          return this.clearAlwaysAndNeverDrawnElements(props);
        }),
        from(this._idsCache.getCategoriesModeledElements(modelId, [categoryId])).pipe(
          mergeMap((modeledElementIds) => (modeledElementIds.length > 0 ? this.changeModelState({ ids: modeledElementIds, on }) : EMPTY)),
        ),
      );
    });
    return createVisibilityHandlerResult(this, props, result, this._props.overrides?.changeCategoryState);
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
          const categoryVisibility = this.getDefaultCategoryVisibilityStatus({ categoryId, modelId, ignoreTooltip: true });
          const isDisplayedByDefault = categoryVisibility.state === "visible";
          return this.queueElementsVisibilityChange(elementIds, on, isDisplayedByDefault);
        }),
        from(elementIds).pipe(
          mergeMap((elementId) =>
            from(this._idsCache.hasSubModel(elementId)).pipe(
              filter((isSubModel) => isSubModel),
              mergeMap(() => this.changeModelState({ ids: elementId, on })),
            ),
          ),
        ),
      );
    });
    return createVisibilityHandlerResult(this, { node, on }, result, this._props.overrides?.changeElementGroupingNodeState);
  }

  /**
   * Updates visibility of an element and all its child elements by adding them to the always/never drawn list.
   * @note If element is to be enabled and model is hidden, it will be enabled.
   */
  private changeElementsState(props: ChangeGeometricElementsDisplayStateProps): Observable<void> {
    const result = defer(() => {
      const { elementIds, on, modelId, categoryId } = props;
      const viewport = this._props.viewport;
      return concat(
        props.on && !viewport.view.viewsModel(modelId) ? this.showModelWithoutAnyCategoriesOrElements(modelId) : EMPTY,
        defer(() => {
          const categoryVisibility = this.getDefaultCategoryVisibilityStatus({ categoryId, modelId, ignoreTooltip: true });
          const isDisplayedByDefault = categoryVisibility.state === "visible";
          return this.queueElementsVisibilityChange(elementIds, on, isDisplayedByDefault);
        }),
        from(elementIds).pipe(
          mergeMap((elementId) =>
            from(this._idsCache.hasSubModel(elementId)).pipe(
              filter((isSubModel) => isSubModel),
              mergeMap(() => this.changeModelState({ ids: elementId, on })),
            ),
          ),
        ),
      );
    });
    return createVisibilityHandlerResult(this, props, result, this._props.overrides?.changeElementsState);
  }

  private queueElementsVisibilityChange(elementIds: Id64Set, on: boolean, visibleByDefault: boolean) {
    const finishedSubject = new Subject<boolean>();
    // observable to track if visibility change is finished/cancelled
    const changeFinished = finishedSubject.pipe(
      startWith(false),
      shareReplay(1),
      filter((finished) => finished),
    );

    const changeObservable = from(elementIds).pipe(
      // check if visibility change is not finished (cancelled) due to change overall change request being cancelled
      takeUntil(changeFinished),
      this.changeElementStateNoChildrenOperator({ on, isDisplayedByDefault: visibleByDefault }),
      tap({
        next: () => {
          // notify that visibility change is finished
          finishedSubject.next(true);
        },
      }),
    );

    // queue visibility change. `changeObservable` will be subscribed to when other queue changes are finished
    this._elementChangeQueue.next(changeObservable);

    // return observable that will emit when visibility change is finished
    return changeFinished.pipe(
      take(1),
      tap({
        unsubscribe: () => {
          // if this observable is unsubscribed before visibility change is finished, we have to notify that it queued change request is cancelled
          finishedSubject.next(true);
        },
      }),
      map(() => undefined),
    );
  }

  private changeElementStateNoChildrenOperator(props: { on: boolean; isDisplayedByDefault: boolean }): OperatorFunction<string, void> {
    return (elementIds: Observable<Id64String>) => {
      const { on, isDisplayedByDefault } = props;
      const isAlwaysDrawnExclusive = this._props.viewport.isAlwaysDrawnExclusive;
      return elementIds.pipe(
        releaseMainThreadOnItemsCount(500),
        reduce<string, { changedNeverDrawn: boolean; changedAlwaysDrawn: boolean; neverDrawn: Id64Set | undefined; alwaysDrawn: Id64Set | undefined }>(
          (acc, elementId) => {
            if (acc.alwaysDrawn === undefined || acc.neverDrawn === undefined) {
              acc.alwaysDrawn = new Set(this._props.viewport.alwaysDrawn || []);
              acc.neverDrawn = new Set(this._props.viewport.neverDrawn || []);
            }
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
            neverDrawn: undefined,
            alwaysDrawn: undefined,
          },
        ),
        map((state) => {
          state.changedNeverDrawn && state.neverDrawn && this._props.viewport.setNeverDrawn(state.neverDrawn);
          state.changedAlwaysDrawn && state.alwaysDrawn && this._props.viewport.setAlwaysDrawn(state.alwaysDrawn, this._props.viewport.isAlwaysDrawnExclusive);
        }),
      );
    };
  }

  private getVisibilityFromAlwaysAndNeverDrawnElementsImpl(
    props: {
      alwaysDrawn: Id64Set | undefined;
      neverDrawn: Id64Set | undefined;
      totalCount: number;
    } & GetVisibilityFromAlwaysAndNeverDrawnElementsProps & { ignoreTooltip?: boolean },
  ): VisibilityStatus {
    const { alwaysDrawn, neverDrawn, totalCount, ignoreTooltip } = props;

    if (neverDrawn?.size === totalCount) {
      return createVisibilityStatus("hidden", getTooltipOptions(props.tooltips.allElementsInNeverDrawnList, ignoreTooltip));
    }

    if (alwaysDrawn?.size === totalCount) {
      return createVisibilityStatus("visible", getTooltipOptions(props.tooltips.allElementsInAlwaysDrawnList, ignoreTooltip));
    }

    const viewport = this._props.viewport;
    if (viewport.isAlwaysDrawnExclusive && viewport.alwaysDrawn?.size) {
      return alwaysDrawn?.size
        ? createVisibilityStatus("partial", getTooltipOptions(props.tooltips.elementsInBothAlwaysAndNeverDrawn, ignoreTooltip))
        : createVisibilityStatus("hidden", getTooltipOptions(props.tooltips.noElementsInExclusiveAlwaysDrawnList, ignoreTooltip));
    }

    const status = props.defaultStatus();
    if ((status.state === "visible" && neverDrawn?.size) || (status.state === "hidden" && alwaysDrawn?.size)) {
      return createVisibilityStatus("partial", getTooltipOptions(undefined, ignoreTooltip));
    }
    return status;
  }

  private getVisibilityFromAlwaysAndNeverDrawnElements({
    ignoreTooltip,
    ...props
  }: GetVisibilityFromAlwaysAndNeverDrawnElementsProps &
    ({ elements: Id64Set } | { queryProps: AlwaysOrNeverDrawnElementsQueryProps }) & { ignoreTooltip?: boolean }): Observable<VisibilityStatus> {
    const viewport = this._props.viewport;
    if (viewport.isAlwaysDrawnExclusive) {
      if (!viewport?.alwaysDrawn?.size) {
        return of(createVisibilityStatus("hidden", getTooltipOptions(props.tooltips.noElementsInExclusiveAlwaysDrawnList, ignoreTooltip)));
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
          ignoreTooltip,
        }),
      );
    }

    const { modelId, categoryId } = props.queryProps;
    const totalCount = categoryId ? this._idsCache.getCategoryElementsCount(modelId, categoryId) : this._idsCache.getModelElementCount(modelId);
    return forkJoin({
      totalCount,
      alwaysDrawn: this.getAlwaysDrawnElements(props.queryProps),
      neverDrawn: this.getNeverDrawnElements(props.queryProps),
    }).pipe(
      map((state) => {
        return this.getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
          ...props,
          ...state,
          ignoreTooltip,
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

  private getGroupingNodeInfo(node: GroupingHierarchyNode) {
    const modelId = ModelsTreeNode.getModelId(node);
    const categoryId = ModelsTreeNode.getCategoryId(node);
    assert(!!modelId && !!categoryId);

    const elementIds = new Set(node.groupedInstanceKeys.map((key) => key.id));
    return { modelId, categoryId, elementIds };
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
  defaultStatus: () => VisibilityStatus;
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

function getVisibilityStatusFromTreeNodeChildren(
  tooltipMap: { [key in Visibility]: string | undefined },
  ignoreTooltip?: boolean,
): OperatorFunction<Visibility, VisibilityStatus> {
  return (obs) => {
    return getVisibilityFromTreeNodeChildren(obs).pipe(
      map((visibility) => {
        if (visibility === "empty") {
          visibility = "visible";
        }

        return createVisibilityStatus(visibility, getTooltipOptions(tooltipMap[visibility], ignoreTooltip));
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

/**
 * Enables display of all given models. Also enables display of all categories and clears always and
 * never drawn lists in the viewport.
 * @public
 */
export async function showAllModels(models: string[], viewport: Viewport) {
  await viewport.addViewedModels(models);
  viewport.clearNeverDrawn();
  viewport.clearAlwaysDrawn();
  await toggleAllCategories(viewport, true);
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

function getTooltipOptions(key: string | undefined, ignoreTooltip?: boolean) {
  return {
    useTooltip: ignoreTooltip ? (false as const) : key,
  };
}
