/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  concat,
  concatAll,
  defaultIfEmpty,
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
import { AlwaysAndNeverDrawnElementInfo } from "../../common/internal/AlwaysAndNeverDrawnElementInfo.js";
import { CLASS_NAME_GeometricElement3d } from "../../common/internal/ClassNameDefinitions.js";
import { toVoidPromise } from "../../common/internal/Rxjs.js";
import { createVisibilityStatus } from "../../common/internal/Tooltip.js";
import { releaseMainThreadOnItemsCount, setDifference, setIntersection } from "../../common/internal/Utils.js";
import { createVisibilityChangeEventListener } from "../../common/internal/VisibilityChangeEventListener.js";
import {
  changeElementStateNoChildrenOperator,
  filterSubModeledElementIds,
  getElementOverriddenVisibility,
  getElementVisibility,
  getSubModeledElementsVisibilityStatus,
  getVisibilityFromAlwaysAndNeverDrawnElementsImpl,
  mergeVisibilityStatuses,
} from "../../common/internal/VisibilityUtils.js";
import { createVisibilityHandlerResult } from "../../common/UseHierarchyVisibility.js";
import { createFilteredTree, parseCategoryKey } from "./FilteredTree.js";
import { ModelsTreeNode } from "./ModelsTreeNode.js";

import type { NonPartialVisibilityStatus } from "../../common/internal/Tooltip.js";
import type { GetVisibilityFromAlwaysAndNeverDrawnElementsProps } from "../../common/internal/VisibilityUtils.js";
import type { Observable, Subscription } from "rxjs";
import type { GroupingHierarchyNode, HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { HierarchyVisibilityHandler, HierarchyVisibilityHandlerOverridableMethod, VisibilityStatus } from "../../common/UseHierarchyVisibility.js";
import type { ModelsTreeIdsCache } from "./ModelsTreeIdsCache.js";
import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { FilteredTree } from "./FilteredTree.js";
import type { IVisibilityChangeEventListener } from "../../common/internal/VisibilityChangeEventListener.js";
import type { ElementId } from "../../common/internal/Types.js";

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
    this._eventListener = createVisibilityChangeEventListener({
      viewport: _props.viewport,
      listeners: {
        models: true,
        categories: true,
        elements: true,
      },
    });
    this._alwaysAndNeverDrawnElements = new AlwaysAndNeverDrawnElementInfo(_props.viewport, CLASS_NAME_GeometricElement3d);
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
        defaultIfEmpty(createVisibilityStatus("hidden")),
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
      mergeMap(({ subjectIds: subjects, modelIds: models, categories, elements }) => {
        const observables = new Array<Observable<VisibilityStatus>>();
        if (subjects?.size) {
          observables.push(this.getSubjectNodeVisibilityStatus({ subjectIds: [...subjects] }));
        }

        if (models?.size) {
          observables.push(this.getModelVisibilityStatus({ modelIds: models }));
        }

        if (categories?.size) {
          observables.push(
            from(categories).pipe(
              mergeMap((key) => {
                const { modelId, categoryId } = parseCategoryKey(key);
                return this.getCategoryDisplayStatus({ modelId, categoryIds: categoryId });
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
                  mergeMap((elementId) => this.getElementDisplayStatus({ modelId, categoryId, elementId })),
                );
              }),
            ),
          );
        }

        return merge(...observables);
      }),
      mergeVisibilityStatuses,
    );
  }

  private getSubjectNodeVisibilityStatus({ subjectIds }: { subjectIds: Id64Array }): Observable<VisibilityStatus> {
    const result = defer(() => {
      if (!this._props.viewport.view.isSpatialView()) {
        return of(createVisibilityStatus("disabled"));
      }

      return from(this._idsCache.getSubjectModelIds(subjectIds)).pipe(
        mergeMap((modelIds) => this.getModelVisibilityStatus({ modelIds })),
        mergeVisibilityStatuses,
      );
    });
    return createVisibilityHandlerResult(this, { ids: subjectIds }, result, this._props.overrides?.getSubjectNodeVisibility);
  }

  private getModelVisibilityStatus({ modelIds }: { modelIds: Id64Set | Id64Array }): Observable<VisibilityStatus> {
    const result = defer(() => {
      const viewport = this._props.viewport;
      if (!viewport.view.isSpatialView()) {
        return of(createVisibilityStatus("disabled"));
      }

      return from(modelIds).pipe(
        distinct(),
        mergeMap((modelId) => {
          if (!viewport.view.viewsModel(modelId)) {
            return from(this._idsCache.getModelCategoryIds(modelId)).pipe(
              mergeMap((categoryIds) => from(this._idsCache.getCategoriesModeledElements(modelId, categoryIds))),
              getSubModeledElementsVisibilityStatus({
                parentNodeVisibilityStatus: createVisibilityStatus("hidden"),
                getModelVisibilityStatus: (modelProps) => this.getModelVisibilityStatus(modelProps),
              }),
            );
          }

          return from(this._idsCache.getModelCategoryIds(modelId)).pipe(
            mergeMap((categoryIds) =>
              categoryIds.length === 0 ? of(createVisibilityStatus("visible")) : this.getCategoryDisplayStatus({ modelId, categoryIds }),
            ),
            mergeVisibilityStatuses,
          );
        }),
        mergeVisibilityStatuses,
      );
    });
    return createVisibilityHandlerResult(this, { ids: modelIds }, result, this._props.overrides?.getModelDisplayStatus);
  }

  private getDefaultCategoryVisibilityStatus({ modelId, categoryIds }: { categoryIds: Id64Arg; modelId: Id64String }): VisibilityStatus {
    const viewport = this._props.viewport;

    if (!viewport.view.viewsModel(modelId) || Id64.sizeOf(categoryIds) === 0) {
      return createVisibilityStatus("hidden");
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

  private getCategoryDisplayStatus(props: GetCategoryVisibilityStatusProps): Observable<VisibilityStatus> {
    const result = defer(() => {
      if (!this._props.viewport.view.viewsModel(props.modelId)) {
        return from(this._idsCache.getCategoriesModeledElements(props.modelId, props.categoryIds)).pipe(
          getSubModeledElementsVisibilityStatus({
            parentNodeVisibilityStatus: createVisibilityStatus("hidden"),
            getModelVisibilityStatus: (modelProps) => this.getModelVisibilityStatus(modelProps),
          }),
        );
      }

      return this.getVisibilityFromAlwaysAndNeverDrawnElements({
        categoryProps: { categoryIds: props.categoryIds, modelId: props.modelId },
        defaultStatus: (categoryId) =>
          categoryId
            ? this.getDefaultCategoryVisibilityStatus({ modelId: props.modelId, categoryIds: categoryId })
            : this.getDefaultCategoryVisibilityStatus({ modelId: props.modelId, categoryIds: props.categoryIds }),
      }).pipe(
        mergeMap((visibilityStatusAlwaysAndNeverDraw) => {
          return from(this._idsCache.getCategoriesModeledElements(props.modelId, props.categoryIds)).pipe(
            getSubModeledElementsVisibilityStatus({
              parentNodeVisibilityStatus: visibilityStatusAlwaysAndNeverDraw,
              getModelVisibilityStatus: (modelProps) => this.getModelVisibilityStatus(modelProps),
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
          filterSubModeledElementIds({ doesSubModelExist: async (id) => this._idsCache.hasSubModel(id) }),
          getSubModeledElementsVisibilityStatus({
            parentNodeVisibilityStatus: createVisibilityStatus("hidden"),
            getModelVisibilityStatus: (modelProps) => this.getModelVisibilityStatus(modelProps),
          }),
        );
      }

      return this.getVisibilityFromAlwaysAndNeverDrawnElements({
        elements: elementIds,
        defaultStatus: () => this.getDefaultCategoryVisibilityStatus({ categoryIds: categoryId, modelId }),
      }).pipe(
        mergeMap((visibilityStatusAlwaysAndNeverDraw) => {
          return of([...elementIds]).pipe(
            filterSubModeledElementIds({ doesSubModelExist: async (id) => this._idsCache.hasSubModel(id) }),
            getSubModeledElementsVisibilityStatus({
              parentNodeVisibilityStatus: visibilityStatusAlwaysAndNeverDraw,
              getModelVisibilityStatus: (modelProps) => this.getModelVisibilityStatus(modelProps),
            }),
          );
        }),
      );
    });
    return createVisibilityHandlerResult(this, { node }, result, this._props.overrides?.getElementGroupingNodeDisplayStatus);
  }

  private getElementDisplayStatus(props: GetGeometricElementVisibilityStatusProps): Observable<VisibilityStatus> {
    const result: Observable<VisibilityStatus> = defer(() => {
      const viewport = this._props.viewport;
      const { elementId, modelId, categoryId } = props;

      const viewsModel = viewport.view.viewsModel(modelId);
      const elementStatus = getElementOverriddenVisibility({
        elementId,
        viewport,
      });

      return from(this._idsCache.hasSubModel(elementId)).pipe(
        mergeMap((hasSubModel) => (hasSubModel ? this.getModelVisibilityStatus({ modelIds: [elementId] }) : of(undefined))),
        map((subModelVisibilityStatus) =>
          getElementVisibility(
            viewsModel,
            elementStatus,
            // Single category will always return "visible" or "hidden"
            this.getDefaultCategoryVisibilityStatus({ categoryIds: categoryId, modelId }) as NonPartialVisibilityStatus,
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
      mergeMap(({ subjectIds: subjects, modelIds: models, categories, elements }) => {
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

  private changeSubjectNodeState(subjectIds: Id64Array, on: boolean): Observable<void> {
    const result = defer(() => {
      if (!this._props.viewport.view.isSpatialView()) {
        return EMPTY;
      }

      return from(this._idsCache.getSubjectModelIds(subjectIds)).pipe(mergeMap((modelIds) => this.changeModelState({ ids: modelIds, on })));
    });
    return createVisibilityHandlerResult(this, { ids: subjectIds, on }, result, this._props.overrides?.changeSubjectNodeState);
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
          mergeMap(async (modelId) => ({ modelId, categoryIds: await this._idsCache.getModelCategoryIds(modelId) })),
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
            return from(this._idsCache.getModelCategoryIds(modelId)).pipe(
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
      categories: this._idsCache.getModelCategoryIds(modelId),
      alwaysDrawnElements: this._alwaysAndNeverDrawnElements.getAlwaysDrawnElements({ modelId }),
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

  private changeCategoryStateInViewportAccordingToModelVisibility(modelId: Id64String, categoryId: Id64String, on: boolean) {
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
          return this._alwaysAndNeverDrawnElements.clearAlwaysAndNeverDrawnElements(props);
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
          const categoryVisibility = this.getDefaultCategoryVisibilityStatus({ categoryIds: categoryId, modelId });
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
      changeElementStateNoChildrenOperator({ on, isDisplayedByDefault: visibleByDefault, viewport: this._props.viewport }),
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

  private getVisibilityFromAlwaysAndNeverDrawnElements(
    props: GetVisibilityFromAlwaysAndNeverDrawnElementsProps &
      ({ elements: Set<ElementId> } | { categoryProps: { categoryIds: Id64Arg; modelId: Id64String } }),
  ): Observable<VisibilityStatus> {
    const viewport = this._props.viewport;
    if (viewport.isAlwaysDrawnExclusive) {
      if (!viewport?.alwaysDrawn?.size) {
        return of(createVisibilityStatus("hidden"));
      }
    } else if (!viewport?.neverDrawn?.size && !viewport?.alwaysDrawn?.size) {
      return of(props.defaultStatus());
    }

    if ("elements" in props) {
      return of(
        getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
          ...props,
          alwaysDrawn: viewport.alwaysDrawn?.size ? setIntersection(props.elements, viewport.alwaysDrawn) : undefined,
          neverDrawn: viewport.neverDrawn?.size ? setIntersection(props.elements, viewport.neverDrawn) : undefined,
          totalCount: props.elements.size,
          viewport,
        }),
      );
    }

    const { modelId, categoryIds } = props.categoryProps;
    return from(Id64.iterable(categoryIds)).pipe(
      mergeMap((categoryId) => {
        const totalCount = this._idsCache.getCategoryElementsCount(modelId, categoryId);
        return forkJoin({
          totalCount,
          alwaysDrawn: this._alwaysAndNeverDrawnElements.getAlwaysDrawnElements({ categoryIds: categoryId, modelId }),
          neverDrawn: this._alwaysAndNeverDrawnElements.getNeverDrawnElements({ categoryIds: categoryId, modelId }),
        }).pipe(
          map((state) => {
            return getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
              ...props,
              ...state,
              defaultStatus: () => props.defaultStatus(categoryId),
              viewport,
            });
          }),
        );
      }),
      mergeVisibilityStatuses,
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
