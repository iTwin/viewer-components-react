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
import { assert, Id64 } from "@itwin/core-bentley";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { HierarchyNode, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { toggleAllCategories } from "../../common/CategoriesVisibilityUtils.js";
import { reduceWhile, toVoidPromise } from "../../common/Rxjs.js";
import { createVisibilityStatus } from "../../common/Tooltip.js";
import { createVisibilityHandlerResult } from "../../common/UseHierarchyVisibility.js";
import { getChildIdsFromChildrenTree, getIdsFromChildrenTree, releaseMainThreadOnItemsCount } from "../Utils.js";
import { AlwaysAndNeverDrawnElementInfo } from "./AlwaysAndNeverDrawnElementInfo.js";
import { createFilteredTree, parseCategoryKey } from "./FilteredTree.js";
import { ModelsTreeNode } from "./ModelsTreeNode.js";
import { createVisibilityChangeEventListener } from "./VisibilityChangeEventListener.js";

import type { Observable, OperatorFunction, Subscription } from "rxjs";
import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { GroupingHierarchyNode, HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { Visibility } from "../../common/Tooltip.js";
import type { HierarchyVisibilityHandler, HierarchyVisibilityHandlerOverridableMethod, VisibilityStatus } from "../../common/UseHierarchyVisibility.js";
import type { ChildrenTree } from "../Utils.js";
import type { FilteredTree, VisibilityChangeTargets } from "./FilteredTree.js";
import type { ModelsTreeIdsCache } from "./ModelsTreeIdsCache.js";
import type { IVisibilityChangeEventListener } from "./VisibilityChangeEventListener.js";

/** @beta */
interface GetCategoryVisibilityStatusProps {
  categoryIds: Id64Arg;
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
  getModelDisplayStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: { ids: Id64Arg }) => Promise<VisibilityStatus>>;
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
export function createModelsTreeVisibilityHandler(props: ModelsTreeVisibilityHandlerProps): HierarchyVisibilityHandler & Disposable {
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

  public dispose() {
    this[Symbol.dispose]();
  }

  public [Symbol.dispose]() {
    this._eventListener[Symbol.dispose]();
    this._alwaysAndNeverDrawnElements[Symbol.dispose]();
    this._subscriptions.forEach((x) => x.unsubscribe());
  }

  private getVisibilityStatusObs(node: HierarchyNode): Observable<VisibilityStatus> {
    if (node.filtering?.filteredChildrenIdentifierPaths?.length && !node.filtering.isFilterTarget) {
      return this.getFilteredNodeVisibility({ node });
    }

    if (HierarchyNode.isClassGroupingNode(node)) {
      if (node.extendedData?.isFiltered) {
        return this.getFilteredNodeVisibility({ node });
      }
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
      return this.getModelVisibilityStatus({ modelIds: node.key.instanceKeys.map(({ id }) => id) });
    }

    const modelId = ModelsTreeNode.getModelId(node);
    if (!modelId) {
      return of(createVisibilityStatus("disabled"));
    }

    if (ModelsTreeNode.isCategoryNode(node)) {
      return this.getCategoryDisplayStatus({
        categoryIds: node.key.instanceKeys.map(({ id }) => id),
        modelId,
      });
    }

    const categoryId = ModelsTreeNode.getCategoryId(node);
    if (!categoryId) {
      return of(createVisibilityStatus("disabled"));
    }
    return this.getElementDisplayStatus({
      elementId: node.key.instanceKeys[0].id,
      parentKeys: node.parentKeys,
      modelId,
      categoryId,
      totalChildrenCount: node.extendedData?.childrenCount ?? 0,
    });
  }

  private getFilteredNodeVisibility(props: GetFilteredNodeVisibilityProps) {
    return from(this._filteredTree ?? [undefined]).pipe(
      map((filteredTree) => {
        if (!filteredTree) {
          return {};
        }

        if (HierarchyNodeKey.isInstances(props.node.key)) {
          return filteredTree.getVisibilityChangeTargets({ parentKeys: props.node.parentKeys, ids: props.node.key.instanceKeys.map((key) => key.id) });
        }
        if (HierarchyNode.isClassGroupingNode(props.node)) {
          // Class grouping nodes will add their filter targets later
          const filterTargets: Map<Id64String, { childrenCount: number }> = props.node.extendedData?.filterTargets;
          const ids = props.node.groupedInstanceKeys.filter((key) => !filterTargets.has(key.id)).map((key) => key.id);
          return ids.length > 0
            ? filteredTree.getVisibilityChangeTargets({
                parentKeys: props.node.parentKeys,
                ids,
              })
            : {};
        }
        return {};
      }),
      mergeMap(({ subjects, models, categories, elements }) => {
        const observables = new Array<Observable<VisibilityStatus>>();
        if (subjects?.size) {
          observables.push(this.getSubjectNodeVisibilityStatus({ subjectIds: [...subjects], ignoreTooltip: true }));
        }

        if (models?.size) {
          observables.push(this.getModelVisibilityStatus({ modelIds: models, ignoreTooltip: true }));
        }

        if (categories?.size) {
          observables.push(
            from(categories).pipe(
              mergeMap((key) => {
                const { modelId, categoryId } = parseCategoryKey(key);
                return this.getCategoryDisplayStatus({ modelId, categoryIds: categoryId, ignoreTooltip: true });
              }),
            ),
          );
        }

        if (elements?.size) {
          const filterTargetElements = new Array<Id64String>();
          elements.forEach((elementsMap) =>
            elementsMap.forEach(({ isFilterTarget }, elementId) => {
              if (isFilterTarget) {
                filterTargetElements.push(elementId);
              }
            }),
          );

          observables.push(
            from(this._idsCache.getAllChildrenCount({ elementIds: filterTargetElements })).pipe(
              mergeMap((elementCountMap) =>
                from(elements).pipe(
                  releaseMainThreadOnItemsCount(50),
                  mergeMap(([categoryKey, elementsMap]) => {
                    const { modelId, categoryId } = parseCategoryKey(categoryKey);
                    let totalChildrenCount = 0;
                    elementsMap.forEach((_, elementId) => {
                      const childCount = elementCountMap.get(elementId);
                      if (childCount) {
                        totalChildrenCount += childCount;
                      }
                    });
                    const parentInstanceNodesIds = getParentInstanceNodeIds({ parentKeys: props.node.parentKeys, modelId });
                    return this.getElementsDisplayStatus({
                      elementIds: [...elementsMap.keys()],
                      parentInstanceNodesIds: parentInstanceNodesIds.length > 1 ? parentInstanceNodesIds : [modelId, categoryId],
                      modelId,
                      categoryId,
                      childrenCount: totalChildrenCount,
                    });
                  }),
                ),
              ),
            ),
          );
        }
        if (HierarchyNode.isClassGroupingNode(props.node)) {
          const filterTargets: Map<Id64String, { childrenCount: number }> | undefined = props.node.extendedData?.filterTargets;
          if (filterTargets?.size) {
            const categoryId: Id64String = props.node.extendedData?.categoryId;
            const modelId: Id64String = props.node.extendedData?.modelId;
            observables.push(
              from(filterTargets).pipe(
                releaseMainThreadOnItemsCount(1000),
                mergeMap(([elementId, { childrenCount }]) =>
                  this.getElementDisplayStatus({
                    modelId,
                    categoryId,
                    elementId,
                    ignoreTooltip: true,
                    parentKeys: props.node.parentKeys,
                    totalChildrenCount: childrenCount,
                  }),
                ),
              ),
            );
          }
        }

        return merge(...observables);
      }),
      mergeVisibilityStatuses(),
    );
  }

  private getSubjectNodeVisibilityStatus({ subjectIds, ignoreTooltip }: { subjectIds: Id64Array; ignoreTooltip?: boolean }): Observable<VisibilityStatus> {
    const result = defer(() => {
      if (!this._props.viewport.view.isSpatialView()) {
        return of(createVisibilityStatus("disabled", getTooltipOptions("modelsTree.subject.nonSpatialView", ignoreTooltip)));
      }

      return from(this._idsCache.getSubjectModelIds(subjectIds)).pipe(
        mergeMap((modelIds) => this.getModelVisibilityStatus({ modelIds, ignoreTooltip: true })),
        mergeVisibilityStatuses(
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

  private getModelVisibilityStatus({ modelIds, ignoreTooltip }: { modelIds: Id64Set | Id64Array; ignoreTooltip?: boolean }): Observable<VisibilityStatus> {
    const result = defer(() => {
      const viewport = this._props.viewport;
      if (!viewport.view.isSpatialView()) {
        return of(createVisibilityStatus("disabled", getTooltipOptions("modelsTree.model.nonSpatialView", ignoreTooltip)));
      }

      return from(modelIds).pipe(
        distinct(),
        mergeMap((modelId) => {
          if (!viewport.view.viewsModel(modelId)) {
            return from(this._idsCache.getModelCategories(modelId)).pipe(
              mergeMap((categoryIds) => from(this._idsCache.getCategoriesModeledElements(modelId, categoryIds))),
              this.getSubModeledElementsVisibilityStatus({
                ignoreTooltips: ignoreTooltip,
                haveSubModel: "yes",
                tooltips: { visible: undefined, hidden: "modelsTree.model.hiddenThroughModelSelector", partial: "modelsTree.model.someSubModelsVisible" },
                parentNodeVisibilityStatus: createVisibilityStatus("hidden"),
              }),
            );
          }

          return from(this._idsCache.getModelCategories(modelId)).pipe(
            mergeMap((categoryIds) =>
              categoryIds.length === 0 ? of(createVisibilityStatus("visible")) : this.getCategoryDisplayStatus({ modelId, categoryIds, ignoreTooltip: true }),
            ),
            mergeVisibilityStatuses({
              visible: "modelsTree.model.allCategoriesVisible",
              partial: "modelsTree.model.someCategoriesHidden",
              hidden: "modelsTree.model.allCategoriesHidden",
            }),
          );
        }),
        mergeVisibilityStatuses(),
      );
    });
    return createVisibilityHandlerResult(this, { ids: modelIds }, result, this._props.overrides?.getModelDisplayStatus);
  }

  private getDefaultCategoryVisibilityStatus({
    modelId,
    categoryIds,
    ignoreTooltip,
  }: {
    categoryIds: Id64Arg;
    modelId: Id64String;
    ignoreTooltip?: boolean;
  }): VisibilityStatus {
    const viewport = this._props.viewport;

    if (!viewport.view.viewsModel(modelId) || Id64.sizeOf(categoryIds) === 0) {
      return createVisibilityStatus("hidden", getTooltipOptions("modelsTree.category.hiddenThroughModel", ignoreTooltip));
    }

    let visibility: "visible" | "hidden" | "unknown" = "unknown";
    for (const categoryId of Id64.iterable(categoryIds)) {
      const override = this._props.viewport.perModelCategoryVisibility.getOverride(modelId, categoryId);
      if (override === PerModelCategoryVisibility.Override.Show) {
        if (visibility === "hidden") {
          return createVisibilityStatus("partial");
        }
        visibility = "visible";
        continue;
      }
      if (override === PerModelCategoryVisibility.Override.Hide) {
        if (visibility === "visible") {
          return createVisibilityStatus("partial");
        }
        visibility = "hidden";
        continue;
      }
      const isVisible = viewport.view.viewsCategory(categoryId);
      if (isVisible && visibility === "hidden") {
        return createVisibilityStatus("partial");
      }
      if (!isVisible && visibility === "visible") {
        return createVisibilityStatus("partial");
      }
      visibility = isVisible ? "visible" : "hidden";
    }
    assert(visibility !== "unknown");

    return createVisibilityStatus(visibility);
  }

  private getCategoryDisplayStatus({ ignoreTooltip, ...props }: GetCategoryVisibilityStatusProps & { ignoreTooltip?: boolean }): Observable<VisibilityStatus> {
    const result = defer(() => {
      if (!this._props.viewport.view.viewsModel(props.modelId)) {
        return from(this._idsCache.getCategoriesModeledElements(props.modelId, props.categoryIds)).pipe(
          this.getSubModeledElementsVisibilityStatus({
            ignoreTooltips: ignoreTooltip,
            parentNodeVisibilityStatus: createVisibilityStatus("hidden"),
            tooltips: {
              visible: undefined,
              hidden: "modelsTree.category.hiddenThroughModel",
              partial: "modelsTree.category.someElementsOrSubModelsHidden",
            },
            haveSubModel: "yes",
          }),
        );
      }

      return this.getVisibilityFromAlwaysAndNeverDrawnElements({
        categoryProps: { categoryIds: props.categoryIds, modelId: props.modelId },
        tooltips: {
          allElementsInAlwaysDrawnList: "modelsTree.category.allElementsVisible",
          allElementsInNeverDrawnList: "modelsTree.category.allElementsHidden",
          elementsInBothAlwaysAndNeverDrawn: "modelsTree.category.someElementsAreHidden",
          noElementsInExclusiveAlwaysDrawnList: "modelsTree.category.allElementsHidden",
        },
        defaultStatus: (categoryId) =>
          categoryId
            ? this.getDefaultCategoryVisibilityStatus({ modelId: props.modelId, categoryIds: categoryId })
            : this.getDefaultCategoryVisibilityStatus({ modelId: props.modelId, categoryIds: props.categoryIds }),
        ignoreTooltip,
      }).pipe(
        mergeMap((visibilityStatusAlwaysAndNeverDraw) => {
          return from(this._idsCache.getCategoriesModeledElements(props.modelId, props.categoryIds)).pipe(
            this.getSubModeledElementsVisibilityStatus({
              tooltips: {
                visible: undefined,
                hidden: "modelsTree.category.allElementsAndSubModelsHidden",
                partial: "modelsTree.category.someElementsOrSubModelsHidden",
              },
              haveSubModel: "yes",
              parentNodeVisibilityStatus: visibilityStatusAlwaysAndNeverDraw,
              ignoreTooltips: ignoreTooltip,
            }),
          );
        }),
      );
    });
    return createVisibilityHandlerResult(this, props, result, this._props.overrides?.getCategoryDisplayStatus);
  }

  private getClassGroupingNodeDisplayStatus(node: GroupingHierarchyNode): Observable<VisibilityStatus> {
    const { elementIds, modelId, categoryId, childrenCount } = this.getGroupingNodeInfo(node);
    const result = this.getElementsDisplayStatus({
      elementIds,
      modelId,
      categoryId,
      parentInstanceNodesIds: getParentInstanceNodeIds({ parentKeys: node.parentKeys, modelId }),
      childrenCount: childrenCount ?? 0,
    });
    return createVisibilityHandlerResult(this, { node }, result, this._props.overrides?.getElementGroupingNodeDisplayStatus);
  }

  private getElementsDisplayStatus(props: {
    elementIds: Id64Array | Id64Set;
    modelId: Id64String;
    categoryId: Id64String;
    parentInstanceNodesIds: Array<Id64Arg>;
    childrenCount: number;
  }): Observable<VisibilityStatus> {
    return defer(() => {
      const { modelId, categoryId, elementIds, parentInstanceNodesIds, childrenCount } = props;
      if (!this._props.viewport.view.viewsModel(modelId)) {
        return of(elementIds).pipe(
          this.getSubModeledElementsVisibilityStatus({
            tooltips: {
              visible: undefined,
              hidden: undefined,
              partial: "modelsTree.groupingNode.someElementsOrSubModelsHidden",
            },
            parentNodeVisibilityStatus: createVisibilityStatus("hidden"),
            haveSubModel: "unknown",
          }),
        );
      }

      return this.getVisibilityFromAlwaysAndNeverDrawnElements({
        elements: elementIds,
        parentInstanceNodesIds,
        childrenCount,
        defaultStatus: () => {
          const status = this.getDefaultCategoryVisibilityStatus({ categoryIds: categoryId, modelId, ignoreTooltip: true });
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
          return of([...elementIds]).pipe(
            this.getSubModeledElementsVisibilityStatus({
              tooltips: {
                visible: undefined,
                hidden: "modelsTree.groupingNode.allElementsAndSubModelsHidden",
                partial: "modelsTree.groupingNode.someElementsOrSubModelsHidden",
              },
              parentNodeVisibilityStatus: visibilityStatusAlwaysAndNeverDraw,
              haveSubModel: "unknown",
            }),
          );
        }),
      );
    });
  }

  private getElementDisplayStatus({
    ...props
  }: GetGeometricElementVisibilityStatusProps & {
    ignoreTooltip?: boolean;
    parentKeys: HierarchyNodeKey[];
    totalChildrenCount: number;
  }): Observable<VisibilityStatus> {
    const result = this.getElementsDisplayStatus({
      elementIds: [props.elementId],
      modelId: props.modelId,
      categoryId: props.categoryId,
      parentInstanceNodesIds: getParentInstanceNodeIds({ parentKeys: props.parentKeys, modelId: props.modelId }),
      childrenCount: props.totalChildrenCount,
    });
    return createVisibilityHandlerResult(this, props, result, this._props.overrides?.getElementDisplayStatus);
  }

  /** Changes visibility of the items represented by the tree node. */
  private changeVisibilityObs(node: HierarchyNode, on: boolean): Observable<void> {
    if (node.filtering?.filteredChildrenIdentifierPaths?.length && !node.filtering.isFilterTarget) {
      return this.changeFilteredNodeVisibility({ node, on });
    }

    if (HierarchyNode.isClassGroupingNode(node)) {
      if (node.extendedData?.isFiltered) {
        return this.changeFilteredNodeVisibility({ node, on });
      }
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
      return this.changeModelState({ ids: node.key.instanceKeys.map(({ id }) => id), on });
    }

    const modelId = ModelsTreeNode.getModelId(node);
    if (!modelId) {
      return EMPTY;
    }

    if (ModelsTreeNode.isCategoryNode(node)) {
      return this.changeCategoryState({
        categoryIds: node.key.instanceKeys.map(({ id }) => id),
        modelId,
        on,
      });
    }

    const categoryId = ModelsTreeNode.getCategoryId(node);
    if (!categoryId) {
      return EMPTY;
    }
    const elementIds = new Set(node.key.instanceKeys.map(({ id }) => id));
    return from(this._idsCache.getChildrenTree({ elementIds })).pipe(
      map((childrenTree): Id64Set => {
        // Children tree contains provided elementIds, they are at the root of this tree.
        // We want to skip them and only get ids of children.
        return getChildIdsFromChildrenTree({ tree: childrenTree });
      }),
      mergeMap((children) =>
        this.changeElementsState({
          elementIds,
          modelId,
          children: children.size > 0 ? children : undefined,
          categoryId,
          on,
        }),
      ),
    );
  }

  private changeFilteredNodeVisibility({ on, ...props }: ChangeFilteredNodeVisibilityProps) {
    const filteredDataObs: Observable<{ filteredTree?: FilteredTree; unfilteredChildrenTree: ChildrenTree<undefined> }> = this._filteredTree
      ? forkJoin({
          filteredTree: this._filteredTree,
          unfilteredChildrenTree:
            HierarchyNode.isInstancesNode(props.node) && ModelsTreeNode.getType(props.node) === "element"
              ? this._idsCache.getChildrenTree({ elementIds: props.node.key.instanceKeys.map(({ id }) => id) })
              : HierarchyNode.isClassGroupingNode(props.node)
                ? this._idsCache.getChildrenTree({ elementIds: props.node.groupedInstanceKeys.map(({ id }) => id) })
                : of(new Map()),
        })
      : of({ filteredTree: undefined, unfilteredChildrenTree: new Map() });
    return filteredDataObs.pipe(
      map(({ filteredTree, unfilteredChildrenTree }): { targets: VisibilityChangeTargets; childElements?: Id64Set } => {
        if (!filteredTree) {
          return { targets: {} };
        }
        const targets = HierarchyNode.isClassGroupingNode(props.node)
          ? filteredTree.getVisibilityChangeTargets({ parentKeys: props.node.parentKeys, ids: props.node.groupedInstanceKeys.map((key) => key.id) })
          : HierarchyNodeKey.isInstances(props.node.key)
            ? filteredTree.getVisibilityChangeTargets({ parentKeys: props.node.parentKeys, ids: props.node.key.instanceKeys.map((key) => key.id) })
            : {};

        if (unfilteredChildrenTree.size === 0) {
          return { targets };
        }

        const allElementsFromChildrenTree = filteredTree.getElementsFromUnfilteredChildrenTree({
          parentIdsArray: props.node.parentKeys
            .filter((key) => HierarchyNodeKey.isInstances(key))
            .map((key) => key.instanceKeys.map((instanceKey) => instanceKey.id)),
          childrenTree: unfilteredChildrenTree,
        });
        // Root nodes in children tree are not child elements, no need to add them.
        const childElements = allElementsFromChildrenTree ? setDifference(allElementsFromChildrenTree, new Set([...unfilteredChildrenTree.keys()])) : undefined;

        return { targets, childElements };
      }),
      mergeMap(({ targets, childElements }) => {
        const { subjects, categories, elements, models } = targets;
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
                return this.changeCategoryState({ modelId, categoryIds: categoryId, on });
              }),
            ),
          );
        }

        if (elements?.size) {
          const filteredElements = new Array<Id64String>();
          for (const elementsMap of elements.values()) {
            filteredElements.push(...elementsMap.keys());
          }
          const otherChildElements = childElements?.size ? setDifference(childElements, new Set(filteredElements)) : new Set<Id64String>();
          observables.push(
            from(elements).pipe(
              mergeMap(([categoryKey, elementsMap]) => {
                const { modelId, categoryId } = parseCategoryKey(categoryKey);
                return this.changeElementsState({
                  modelId,
                  categoryId,
                  elementIds: new Set([...elementsMap.keys()]),
                  on,
                  children: otherChildElements.size > 0 ? otherChildElements : undefined,
                });
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
    const { ids, on } = props;

    if (Id64.sizeOf(ids) === 0) {
      return EMPTY;
    }

    const result = defer(() => {
      const viewport = this._props.viewport;
      if (!viewport.view.isSpatialView()) {
        return EMPTY;
      }

      const idsObs = from(Id64.iterable(ids));
      if (!on) {
        viewport.changeModelDisplay(ids, false);
        return idsObs.pipe(
          mergeMap(async (modelId) => ({ modelId, categoryIds: await this._idsCache.getModelCategories(modelId) })),
          mergeMap(({ modelId, categoryIds }) => from(this._idsCache.getCategoriesModeledElements(modelId, categoryIds))),
          mergeMap((modeledElementIds) => this.changeModelState({ ids: modeledElementIds, on })),
        );
      }

      return concat(
        defer(() => {
          viewport.perModelCategoryVisibility.clearOverrides(ids);
          return from(viewport.addViewedModels(ids));
        }),
        idsObs.pipe(
          mergeMap((modelId) => {
            return from(this._idsCache.getModelCategories(modelId)).pipe(
              mergeMap((categoryIds) => this.changeCategoryState({ categoryIds, modelId, on: true })),
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
      alwaysDrawnElements: this.getAlwaysDrawnElements({ parentInstanceNodesIds: [modelId] }),
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
      const { modelId, categoryIds, on } = props;
      return concat(
        props.on && !viewport.view.viewsModel(modelId) ? this.showModelWithoutAnyCategoriesOrElements(modelId) : EMPTY,
        defer(() => {
          for (const categoryId of Id64.iterable(categoryIds)) {
            this.changeCategoryStateInViewportAccordingToModelVisibility(modelId, categoryId, on);
          }
          return this.clearAlwaysAndNeverDrawnElements(props);
        }),
        from(this._idsCache.getCategoriesModeledElements(modelId, categoryIds)).pipe(
          mergeMap((modeledElementIds) => this.changeModelState({ ids: modeledElementIds, on })),
        ),
      );
    });
    return createVisibilityHandlerResult(this, props, result, this._props.overrides?.changeCategoryState);
  }

  private doChangeElementsState(
    props: ChangeGeometricElementsDisplayStateProps & {
      children: Id64Arg | undefined;
    },
  ): Observable<void | undefined> {
    return defer(() => {
      const { modelId, categoryId, elementIds, on, children } = props;
      const viewport = this._props.viewport;
      return concat(
        on && !viewport.view.viewsModel(modelId) ? this.showModelWithoutAnyCategoriesOrElements(modelId) : EMPTY,
        defer(() => {
          const categoryVisibility = this.getDefaultCategoryVisibilityStatus({ categoryIds: categoryId, modelId, ignoreTooltip: true });
          const isCategoryVisible = categoryVisibility.state === "visible";
          const isDisplayedByDefault =
            isCategoryVisible === !on
              ? () => isCategoryVisible
              : (elementId: Id64String) => {
                  if (elementIds.has(elementId)) {
                    return isCategoryVisible;
                  }
                  return !on;
                };
          const elementsToChange = children ? [...elementIds, ...(typeof children === "string" ? [children] : children)] : elementIds;
          return this.queueElementsVisibilityChange(elementsToChange, on, isDisplayedByDefault);
        }),
        from(elementIds).pipe(
          mergeMap(async (elementId) => ({ elementId, isSubModel: await this._idsCache.hasSubModel(elementId) })),
          filter(({ isSubModel }) => isSubModel),
          map(({ elementId }) => elementId),
          toArray(),
          mergeMap((subModelIds) => this.changeModelState({ ids: subModelIds, on })),
        ),
      );
    });
  }

  /**
   * Updates visibility of all grouping node's elements.
   * @see `changeElementState`
   */
  private changeElementGroupingNodeState(node: GroupingHierarchyNode, on: boolean): Observable<void> {
    const { modelId, categoryId, elementIds } = this.getGroupingNodeInfo(node);
    const result = forkJoin({
      childrenTree: from(this._idsCache.getChildrenTree({ elementIds })),
      filteredTree: from(this._filteredTree ?? [undefined]),
    }).pipe(
      map(({ childrenTree, filteredTree }) => {
        if (!filteredTree) {
          return getChildIdsFromChildrenTree({ tree: childrenTree });
        }
        const filteredElements = filteredTree.getElementsFromUnfilteredChildrenTree({
          childrenTree,
          parentIdsArray: node.parentKeys
            .filter((key) => HierarchyNodeKey.isInstances(key))
            .map((key) => key.instanceKeys.map((instanceKey) => instanceKey.id)),
        });
        if (!filteredElements) {
          return new Set<Id64String>();
        }
        return filteredElements ? setDifference(filteredElements, new Set([...childrenTree.keys()])) : new Set<Id64String>();
      }),
      mergeMap((children) =>
        this.doChangeElementsState({
          modelId,
          categoryId,
          elementIds,
          children: children.size > 0 ? children : undefined,
          on,
        }),
      ),
    );
    return createVisibilityHandlerResult(this, { node, on }, result, this._props.overrides?.changeElementGroupingNodeState);
  }

  /**
   * Updates visibility of an element and all its child elements by adding them to the always/never drawn list.
   * @note If element is to be enabled and model is hidden, it will be enabled.
   */
  private changeElementsState(props: ChangeGeometricElementsDisplayStateProps & { children: Id64Arg | undefined }): Observable<void> {
    const result = this.doChangeElementsState(props);
    return createVisibilityHandlerResult(this, props, result, this._props.overrides?.changeElementsState);
  }

  private queueElementsVisibilityChange(elementIds: Id64Arg, on: boolean, visibleByDefault: (elementId: Id64String) => boolean) {
    const finishedSubject = new Subject<boolean>();
    // observable to track if visibility change is finished/cancelled
    const changeFinished = finishedSubject.pipe(
      startWith(false),
      shareReplay(1),
      filter((finished) => finished),
    );

    const changeObservable = from(Id64.iterable(elementIds)).pipe(
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

  private changeElementStateNoChildrenOperator(props: {
    on: boolean;
    isDisplayedByDefault: (elementId: Id64String) => boolean;
  }): OperatorFunction<string, void> {
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
              if ((!isDisplayedByDefault(elementId) || isAlwaysDrawnExclusive) && !acc.alwaysDrawn.has(elementId)) {
                acc.alwaysDrawn.add(elementId);
                acc.changedAlwaysDrawn = true;
              }
            } else {
              const wasRemoved = acc.alwaysDrawn.delete(elementId);
              acc.changedAlwaysDrawn ||= wasRemoved;
              // If exclusive mode is not enabled, we have to add the element to the never drawn list.
              if (isDisplayedByDefault(elementId) && !isAlwaysDrawnExclusive && !acc.neverDrawn.has(elementId)) {
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
      alwaysDrawn: Id64Arg | undefined;
      neverDrawn: Id64Arg | undefined;
      totalCount: number;
    } & GetVisibilityFromAlwaysAndNeverDrawnElementsProps & { ignoreTooltip?: boolean },
  ): VisibilityStatus {
    const { alwaysDrawn, neverDrawn, totalCount, ignoreTooltip } = props;
    if (totalCount === 0) {
      return props.defaultStatus();
    }
    const neverDrawnSize = neverDrawn ? Id64.sizeOf(neverDrawn) : undefined;
    const alwaysDrawnSize = alwaysDrawn ? Id64.sizeOf(alwaysDrawn) : undefined;
    if (neverDrawnSize === totalCount) {
      return createVisibilityStatus("hidden", getTooltipOptions(props.tooltips.allElementsInNeverDrawnList, ignoreTooltip));
    }

    if (alwaysDrawnSize === totalCount) {
      return createVisibilityStatus("visible", getTooltipOptions(props.tooltips.allElementsInAlwaysDrawnList, ignoreTooltip));
    }

    const viewport = this._props.viewport;
    if (viewport.isAlwaysDrawnExclusive && viewport.alwaysDrawn?.size) {
      return alwaysDrawnSize
        ? createVisibilityStatus("partial", getTooltipOptions(props.tooltips.elementsInBothAlwaysAndNeverDrawn, ignoreTooltip))
        : createVisibilityStatus("hidden", getTooltipOptions(props.tooltips.noElementsInExclusiveAlwaysDrawnList, ignoreTooltip));
    }

    const status = props.defaultStatus();
    if ((status.state === "visible" && neverDrawnSize) || (status.state === "hidden" && alwaysDrawnSize)) {
      return createVisibilityStatus("partial", getTooltipOptions(undefined, ignoreTooltip));
    }
    return status;
  }

  private getVisibilityFromAlwaysAndNeverDrawnElements({
    ignoreTooltip,
    ...props
  }: GetVisibilityFromAlwaysAndNeverDrawnElementsProps &
    (
      | { elements: Id64Set | Id64Array; parentInstanceNodesIds: Array<Id64Arg>; childrenCount: number }
      | { categoryProps: { categoryIds: Id64Arg; modelId: Id64String } }
    ) & {
      ignoreTooltip?: boolean;
    }): Observable<VisibilityStatus> {
    const viewport = this._props.viewport;
    if (viewport.isAlwaysDrawnExclusive) {
      if (!viewport?.alwaysDrawn?.size) {
        return of(createVisibilityStatus("hidden", getTooltipOptions(props.tooltips.noElementsInExclusiveAlwaysDrawnList, ignoreTooltip)));
      }
    } else if (!viewport?.neverDrawn?.size && !viewport?.alwaysDrawn?.size) {
      return of(props.defaultStatus());
    }

    if ("elements" in props) {
      const parentInstanceNodesIds = [...props.parentInstanceNodesIds, props.elements];
      return forkJoin({
        childAlwaysDrawn: this.getAlwaysDrawnElements({ parentInstanceNodesIds }),
        childNeverDrawn: this.getNeverDrawnElements({ parentInstanceNodesIds }),
      }).pipe(
        map(({ childAlwaysDrawn, childNeverDrawn }) => {
          const alwaysDrawn = new Set([...childAlwaysDrawn, ...(viewport.alwaysDrawn?.size ? setIntersection(props.elements, viewport.alwaysDrawn) : [])]);
          const neverDrawn = new Set([...childNeverDrawn, ...(viewport.neverDrawn?.size ? setIntersection(props.elements, viewport.neverDrawn) : [])]);
          return this.getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
            ...props,
            alwaysDrawn: alwaysDrawn.size > 0 ? alwaysDrawn : undefined,
            neverDrawn: neverDrawn.size > 0 ? neverDrawn : undefined,
            totalCount: props.childrenCount + Id64.sizeOf(props.elements),
            ignoreTooltip,
          });
        }),
      );
    }

    const { modelId, categoryIds } = props.categoryProps;
    return from(Id64.iterable(categoryIds)).pipe(
      mergeMap((categoryId) => {
        return forkJoin({
          totalCount: this._idsCache.getCategoryElementsCount(modelId, categoryId),
          alwaysDrawn: this.getAlwaysDrawnElements({ parentInstanceNodesIds: [modelId, categoryId] }),
          neverDrawn: this.getNeverDrawnElements({ parentInstanceNodesIds: [modelId, categoryId] }),
        }).pipe(
          // There is a known bug:
          // Categories that don't have root elements will make visibility result incorrect
          // E.g.:
          // - CategoryA
          //  - ElementA (CategoryA is visible)
          //    - ChildElementB (CategoryB is hidden) ChildElementB is in always drawn list
          // Result will be "partial" because CategoryB will return hidden visibility, even though all elements are visible
          // TODO fix with: https://github.com/iTwin/viewer-components-react/issues/1100
          map((state) => {
            return this.getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
              ...props,
              ...state,
              defaultStatus: () => props.defaultStatus(categoryId),
              ignoreTooltip,
            });
          }),
        );
      }),
      mergeVisibilityStatuses(),
    );
  }

  private getAlwaysDrawnElements({ parentInstanceNodesIds }: { parentInstanceNodesIds: Array<Id64Arg> }): Observable<Id64Set> {
    if (!this._filteredTree) {
      return this._alwaysAndNeverDrawnElements.getElementChildrenTree({ parentInstanceNodeIds: parentInstanceNodesIds, setType: "always" }).pipe(
        map((childrenTree) => {
          return getIdsFromChildrenTree({ tree: childrenTree, additionalCheck: (additionalProps) => !!additionalProps?.isInList });
        }),
      );
    }
    return forkJoin({
      filteredTree: from(this._filteredTree),
      childrenTree: this._alwaysAndNeverDrawnElements.getElementChildrenTree({ parentInstanceNodeIds: parentInstanceNodesIds, setType: "always" }),
    }).pipe(
      map(({ filteredTree, childrenTree }) => {
        const elements = filteredTree.getElementsFromUnfilteredChildrenTree({ parentIdsArray: parentInstanceNodesIds, childrenTree });
        return elements
          ? setIntersection(elements, getIdsFromChildrenTree({ tree: childrenTree, additionalCheck: (additionalProps) => !!additionalProps?.isInList }))
          : new Set();
      }),
    );
  }

  private getNeverDrawnElements({ parentInstanceNodesIds }: { parentInstanceNodesIds: Array<Id64Arg> }): Observable<Id64Set> {
    if (!this._filteredTree) {
      return this._alwaysAndNeverDrawnElements
        .getElementChildrenTree({ parentInstanceNodeIds: parentInstanceNodesIds, setType: "never" })
        .pipe(map((childrenTree) => getIdsFromChildrenTree({ tree: childrenTree, additionalCheck: (additionalProps) => !!additionalProps?.isInList })));
    }
    return forkJoin({
      filteredTree: from(this._filteredTree),
      childrenTree: this._alwaysAndNeverDrawnElements.getElementChildrenTree({ parentInstanceNodeIds: parentInstanceNodesIds, setType: "never" }),
    }).pipe(
      map(({ filteredTree, childrenTree }) => {
        const elements = filteredTree.getElementsFromUnfilteredChildrenTree({ parentIdsArray: parentInstanceNodesIds, childrenTree });
        return elements
          ? setIntersection(elements, getIdsFromChildrenTree({ tree: childrenTree, additionalCheck: (additionalProps) => !!additionalProps?.isInList }))
          : new Set();
      }),
    );
  }

  private clearAlwaysAndNeverDrawnElements(props: { categoryIds: Id64Arg; modelId: Id64String }) {
    return forkJoin({
      alwaysDrawn: this.getAlwaysDrawnElements({ parentInstanceNodesIds: [props.modelId, props.categoryIds] }),
      neverDrawn: this.getNeverDrawnElements({ parentInstanceNodesIds: [props.modelId, props.categoryIds] }),
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
    const childrenCount: number | undefined = node.extendedData?.childrenCount;
    const isFiltered: boolean = node.extendedData?.isFiltered;
    return { modelId, categoryId, elementIds, childrenCount, isFiltered };
  }

  private getSubModeledElementsVisibilityStatus({
    parentNodeVisibilityStatus,
    haveSubModel,
    tooltips,
    ignoreTooltips,
  }: {
    parentNodeVisibilityStatus: VisibilityStatus;
    haveSubModel: "yes" | "unknown";
    tooltips: { [key in Visibility]: string | undefined };
    ignoreTooltips?: boolean;
  }): OperatorFunction<Id64Arg, VisibilityStatus> {
    return (obs) => {
      return obs.pipe(
        // ensure we're only looking at elements that have a sub-model
        mergeMap((modeledElementIds) => {
          if (haveSubModel === "yes") {
            return of(modeledElementIds);
          }
          return from(Id64.iterable(modeledElementIds)).pipe(
            mergeMap(async (elementId) => ({ elementId, hasSubModel: await this._idsCache.hasSubModel(elementId) })),
            filter(({ hasSubModel }) => hasSubModel),
            map(({ elementId }) => elementId),
            toArray(),
          );
        }),
        // combine visibility status of sub-models with visibility status of parent node
        mergeMap((modeledElementIds) => {
          if (Id64.sizeOf(modeledElementIds) === 0) {
            return of(parentNodeVisibilityStatus);
          }
          return this.getModelVisibilityStatus({ modelIds: typeof modeledElementIds === "string" ? [modeledElementIds] : modeledElementIds }).pipe(
            startWith<VisibilityStatus>(parentNodeVisibilityStatus),
            mergeVisibilityStatuses(tooltips, ignoreTooltips),
          );
        }),
      );
    };
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
  defaultStatus: (categoryId?: Id64String) => VisibilityStatus;
}

function mergeVisibilities(obs: Observable<Visibility>): Observable<Visibility | "empty"> {
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

function mergeVisibilityStatuses(
  tooltipMap?: { [key in Visibility]: string | undefined },
  ignoreTooltip?: boolean,
): OperatorFunction<VisibilityStatus, VisibilityStatus> {
  return (obs) => {
    return obs.pipe(
      map((visibilityStatus) => visibilityStatus.state),
      mergeVisibilities,
      map((visibility) => {
        if (visibility === "empty") {
          visibility = "visible";
        }
        return createVisibilityStatus(visibility, getTooltipOptions(tooltipMap?.[visibility], ignoreTooltip));
      }),
    );
  };
}

function setDifference<T>(lhs: Set<T>, rhs: Set<T>): Set<T> {
  const result = new Set<T>();
  lhs.forEach((x) => !rhs.has(x) && result.add(x));
  return result;
}

function setIntersection<T>(lhs: Iterable<T>, rhs: Set<T>): Set<T> {
  const result = new Set<T>();
  for (const x of lhs) {
    if (rhs.has(x)) {
      result.add(x);
    }
  }
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

function getParentInstanceNodeIds(props: { parentKeys: HierarchyNodeKey[]; modelId: Id64String;}): Array<Id64Arg> {
  const parentInstanceNodeIds = new Array<Id64Arg>();
  let modelFound = false;
  props.parentKeys.forEach((parentKey) => {
    if (!HierarchyNodeKey.isInstances(parentKey)) {
      return;
    }
    if (modelFound) {
      parentInstanceNodeIds.push(parentKey.instanceKeys.map(({id}) => id));
      return;
    }
    if (parentKey.instanceKeys.some((instanceKey) => instanceKey.id === props.modelId)) {
      parentInstanceNodeIds.push(parentKey.instanceKeys.map(({id}) => id))
      modelFound = true;
    }
  });
  return parentInstanceNodeIds;
}
