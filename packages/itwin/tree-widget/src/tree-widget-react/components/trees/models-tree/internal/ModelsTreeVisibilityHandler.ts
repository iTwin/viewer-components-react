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
import type { IVisibilityChangeEventListener } from "./VisibilityChangeEventListener.js";
import type { Viewport } from "@itwin/core-frontend";
import type { NonPartialVisibilityStatus, Visibility } from "../../common/Tooltip.js";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { FilteredTree } from "./FilteredTree.js";

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
    const result = defer(() => {
      const info = this.getGroupingNodeInfo(node);

      const { modelId, categoryId, elementIds } = info;
      if (!this._props.viewport.view.viewsModel(modelId)) {
        return of([...elementIds]).pipe(
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
    subModelVisibilityStatus?: VisibilityStatus,
  ): VisibilityStatus {
    if (subModelVisibilityStatus === undefined) {
      if (!viewsModel) {
        return createVisibilityStatus("hidden", getTooltipOptions("modelsTree.element.hiddenThroughModel", ignoreTooltip));
      }

      if (overridenVisibility) {
        return overridenVisibility;
      }

      return createVisibilityStatus(
        categoryVisibility.state,
        getTooltipOptions(categoryVisibility.state === "visible" ? undefined : "modelsTree.element.hiddenThroughCategory", ignoreTooltip),
      );
    }

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
        mergeMap((hasSubModel) => (hasSubModel ? this.getModelVisibilityStatus({ modelIds: [elementId] }) : of(undefined))),
        map((subModelVisibilityStatus) =>
          this.getElementVisibility(
            ignoreTooltip,
            viewsModel,
            elementStatus,
            // Single category will always return "visible" or "hidden"
            this.getDefaultCategoryVisibilityStatus({ categoryIds: categoryId, modelId, ignoreTooltip: true }) as NonPartialVisibilityStatus,
            subModelVisibilityStatus,
          ),
        ),
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
                return this.changeCategoryState({ modelId, categoryIds: categoryId, on });
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

  private doChangeElementsState(props: ChangeGeometricElementsDisplayStateProps): Observable<void | undefined> {
    return defer(() => {
      const { modelId, categoryId, elementIds, on } = props;
      const viewport = this._props.viewport;
      return concat(
        on && !viewport.view.viewsModel(modelId) ? this.showModelWithoutAnyCategoriesOrElements(modelId) : EMPTY,
        defer(() => {
          const categoryVisibility = this.getDefaultCategoryVisibilityStatus({ categoryIds: categoryId, modelId, ignoreTooltip: true });
          const isDisplayedByDefault = categoryVisibility.state === "visible";
          return this.queueElementsVisibilityChange(elementIds, on, isDisplayedByDefault);
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
    const result = this.doChangeElementsState({ ...this.getGroupingNodeInfo(node), on });
    return createVisibilityHandlerResult(this, { node, on }, result, this._props.overrides?.changeElementGroupingNodeState);
  }

  /**
   * Updates visibility of an element and all its child elements by adding them to the always/never drawn list.
   * @note If element is to be enabled and model is hidden, it will be enabled.
   */
  private changeElementsState(props: ChangeGeometricElementsDisplayStateProps): Observable<void> {
    const result = this.doChangeElementsState(props);
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
    ({ elements: Id64Set } | { categoryProps: { categoryIds: Id64Arg; modelId: Id64String } }) & { ignoreTooltip?: boolean }): Observable<VisibilityStatus> {
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

    const { modelId, categoryIds } = props.categoryProps;
    return from(Id64.iterable(categoryIds)).pipe(
      mergeMap((categoryId) => {
        const totalCount = this._idsCache.getCategoryElementsCount(modelId, categoryId);
        return forkJoin({
          totalCount,
          alwaysDrawn: this.getAlwaysDrawnElements({ categoryIds: categoryId, modelId }),
          neverDrawn: this.getNeverDrawnElements({ categoryIds: categoryId, modelId }),
        }).pipe(
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

  private getAlwaysDrawnElements(props: { categoryIds?: Id64Arg; modelId: Id64String }): Observable<Id64Set> {
    return this._alwaysAndNeverDrawnElements.getElements({ modelId: props.modelId, categoryIds: props.categoryIds, setType: "always" });
  }

  private getNeverDrawnElements(props: { categoryIds?: Id64Arg; modelId: Id64String }): Observable<Id64Set> {
    return this._alwaysAndNeverDrawnElements.getElements({ modelId: props.modelId, categoryIds: props.categoryIds, setType: "never" });
  }

  private clearAlwaysAndNeverDrawnElements(props: { categoryIds: Id64Arg; modelId: Id64String }) {
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
  }): OperatorFunction<Id64Array, VisibilityStatus> {
    return (obs) => {
      return obs.pipe(
        // ensure we're only looking at elements that have a sub-model
        mergeMap((modeledElementIds) => {
          if (haveSubModel === "yes") {
            return of(modeledElementIds);
          }
          return from(modeledElementIds).pipe(
            mergeMap(async (elementId) => ({ elementId, hasSubModel: await this._idsCache.hasSubModel(elementId) })),
            filter(({ hasSubModel }) => hasSubModel),
            map(({ elementId }) => elementId),
            toArray(),
          );
        }),
        // combine visibility status of sub-models with visibility status of parent node
        mergeMap((modeledElementIds) => {
          if (modeledElementIds.length === 0) {
            return of(parentNodeVisibilityStatus);
          }
          return this.getModelVisibilityStatus({ modelIds: modeledElementIds }).pipe(
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
