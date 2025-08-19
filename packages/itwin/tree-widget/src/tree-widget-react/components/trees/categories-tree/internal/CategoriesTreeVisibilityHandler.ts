/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  concat,
  concatAll,
  defaultIfEmpty,
  defer,
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
} from "rxjs";
import { assert, Id64 } from "@itwin/core-bentley";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { HierarchyNode, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { AlwaysAndNeverDrawnElementInfo } from "../../common/internal/AlwaysAndNeverDrawnElementInfo.js";
import { toVoidPromise } from "../../common/internal/Rxjs.js";
import { createVisibilityStatus } from "../../common/internal/Tooltip.js";
import { getClassesByView, getSetFromId64Arg, releaseMainThreadOnItemsCount, setDifference, setIntersection } from "../../common/internal/Utils.js";
import { createVisibilityChangeEventListener } from "../../common/internal/VisibilityChangeEventListener.js";
import {
  changeElementStateNoChildrenOperator,
  enableCategoryDisplay,
  enableSubCategoryDisplay,
  getVisibilityFromAlwaysAndNeverDrawnElementsImpl,
  mergeVisibilityStatuses,
} from "../../common/internal/VisibilityUtils.js";
import { createVisibilityHandlerResult } from "../../common/UseHierarchyVisibility.js";
import { CategoriesTreeNode } from "./CategoriesTreeNode.js";
import { createFilteredCategoriesTree } from "./FilteredTree.js";

import type { Observable, Subscription } from "rxjs";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { GroupingHierarchyNode, HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId } from "../../common/internal/Types.js";
import type { IVisibilityChangeEventListener } from "../../common/internal/VisibilityChangeEventListener.js";
import type { GetVisibilityFromAlwaysAndNeverDrawnElementsProps } from "../../common/internal/VisibilityUtils.js";
import type { HierarchyVisibilityHandler, VisibilityStatus } from "../../common/UseHierarchyVisibility.js";
import type { CategoriesTreeIdsCache } from "./CategoriesTreeIdsCache.js";

/** @alpha */
interface GetFilteredNodeVisibilityProps {
  node: HierarchyNode;
}

/** @alpha */
interface ChangeFilteredNodeVisibilityProps extends GetFilteredNodeVisibilityProps {
  on: boolean;
}

/**
 * Props for `createCategoriesTreeVisibilityHandler`.
 * @internal
 */
export interface CategoriesTreeVisibilityHandlerProps {
  viewport: Viewport;
  idsCache: CategoriesTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  filteredPaths?: HierarchyFilteringPath[];
}

/**
 * Creates an instance if `CategoriesTreeVisibilityHandler`.
 * @internal
 */
export function createCategoriesTreeVisibilityHandler(props: CategoriesTreeVisibilityHandlerProps): HierarchyVisibilityHandler & Disposable {
  return new CategoriesTreeVisibilityHandlerImpl(props);
}

class CategoriesTreeVisibilityHandlerImpl implements HierarchyVisibilityHandler {
  private readonly _eventListener: IVisibilityChangeEventListener;
  private readonly _alwaysAndNeverDrawnElements: AlwaysAndNeverDrawnElementInfo;
  private readonly _idsCache: CategoriesTreeIdsCache;
  private _filteredTree: ReturnType<typeof createFilteredCategoriesTree> | undefined;
  private _elementChangeQueue = new Subject<Observable<void>>();
  private _subscriptions: Subscription[] = [];
  private _changeRequest = new Subject<{ key: HierarchyNodeKey; depth: number }>();

  constructor(private readonly _props: CategoriesTreeVisibilityHandlerProps) {
    this._eventListener = createVisibilityChangeEventListener({
      viewport: _props.viewport,
      listeners: {
        models: true,
        categories: true,
        elements: true,
        displayStyle: true,
      },
    });
    this._alwaysAndNeverDrawnElements = new AlwaysAndNeverDrawnElementInfo(_props.viewport);
    this._idsCache = this._props.idsCache;
    const { categoryClass, elementClass, modelClass } = getClassesByView(_props.viewport.view.is2d() ? "2d" : "3d");
    if (_props.filteredPaths) {
      this._filteredTree = createFilteredCategoriesTree({
        idsCache: this._idsCache,
        filteringPaths: _props.filteredPaths,
        categoryClassName: categoryClass,
        categoryElementClassName: elementClass,
        categoryModelClassName: modelClass,
        imodelAccess: this._props.imodelAccess,
      });
    }
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
      const nodeInfo = this.getGroupingNodeInfo(node);
      return this.getGroupedElementsVisibilityStatus({ categoryId: nodeInfo.categoryId, modelElementsMap: nodeInfo.modelElementsMap });
    }

    if (!HierarchyNode.isInstancesNode(node)) {
      return of(createVisibilityStatus("disabled"));
    }

    if (CategoriesTreeNode.isDefinitionContainerNode(node)) {
      return this.getDefinitionContainersVisibilityStatus({
        definitionContainerIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    if (CategoriesTreeNode.isModelNode(node)) {
      return this.getModelsVisibilityStatus({
        modelIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    if (CategoriesTreeNode.isCategoryNode(node)) {
      return this.getCategoriesVisibilityStatus({
        categoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        modelId: CategoriesTreeNode.getModelId(node),
      });
    }

    const categoryId = CategoriesTreeNode.getCategoryId(node);
    if (!categoryId) {
      return of(createVisibilityStatus("disabled"));
    }

    if (CategoriesTreeNode.isSubCategoryNode(node)) {
      return this.getSubCategoriesVisibilityStatus({
        categoryId,
        subCategoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    const modelId = CategoriesTreeNode.getModelId(node);
    if (!modelId) {
      return of(createVisibilityStatus("disabled"));
    }
    return this.getElementsVisibilityStatus({
      elementIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      modelId,
      categoryId,
    });
  }

  private getFilteredNodeVisibility(props: GetFilteredNodeVisibilityProps) {
    return from(this.getFilteredTreeTargets(props)).pipe(
      mergeMap((targets) => {
        if (!targets) {
          return EMPTY;
        }
        const { definitionContainerIds, subCategories, modelIds, categories, elements } = targets;
        const observables = new Array<Observable<VisibilityStatus>>();
        if (definitionContainerIds?.size) {
          observables.push(this.getDefinitionContainersVisibilityStatus({ definitionContainerIds }));
        }

        if (modelIds?.size) {
          observables.push(this.getModelsVisibilityStatus({ modelIds }));
        }

        if (categories?.length) {
          observables.push(
            from(categories).pipe(
              mergeMap(({ modelId, categoryIds }) =>
                this.getCategoriesVisibilityStatus({
                  categoryIds,
                  modelId,
                }),
              ),
            ),
          );
        }

        if (subCategories?.length) {
          observables.push(
            from(subCategories).pipe(mergeMap(({ categoryId, subCategoryIds }) => this.getSubCategoriesVisibilityStatus({ subCategoryIds, categoryId }))),
          );
        }

        if (elements?.length) {
          observables.push(
            from(elements).pipe(
              releaseMainThreadOnItemsCount(50),
              mergeMap(({ modelId, elementIds, categoryId }) => this.getElementsVisibilityStatus({ modelId, categoryId, elementIds })),
            ),
          );
        }

        return merge(...observables);
      }),
      mergeVisibilityStatuses,
    );
  }

  private getModelsVisibilityStatus({ modelIds }: { modelIds: Id64Arg }): Observable<VisibilityStatus> {
    const result = defer(() => {
      return from(Id64.iterable(modelIds)).pipe(
        mergeMap((modelId) => {
          // For hidden models we only need to check subModels
          if (!this._props.viewport.view.viewsModel(modelId)) {
            return this.getSubModels({ modelIds: modelId }).pipe(
              mergeMap(({ subModels }) => {
                if (subModels && Id64.sizeOf(subModels) > 0) {
                  return this.getModelsVisibilityStatus({ modelIds: subModels }).pipe(
                    map((subModelsVisibilityStatus) =>
                      subModelsVisibilityStatus.state !== "hidden" ? createVisibilityStatus("partial") : createVisibilityStatus("hidden"),
                    ),
                  );
                }
                return of(createVisibilityStatus("hidden"));
              }),
            );
          }
          // For visible models we need to check all categories
          return this.getCategories({ modelIds: modelId }).pipe(
            mergeMap(({ drawingCategories, spatialCategories }) =>
              merge(
                drawingCategories ? of(drawingCategories).pipe(mergeMap((categoryIds) => this.getCategoriesVisibilityStatus({ modelId, categoryIds }))) : EMPTY,
                spatialCategories ? of(spatialCategories).pipe(mergeMap((categoryIds) => this.getCategoriesVisibilityStatus({ modelId, categoryIds }))) : EMPTY,
              ),
            ),
            defaultIfEmpty(createVisibilityStatus("visible")),
          );
        }),
        mergeVisibilityStatuses,
      );
    });
    return createVisibilityHandlerResult(this, { modelIds }, result, undefined);
  }

  private getDefinitionContainersVisibilityStatus(props: { definitionContainerIds: Id64Arg }): Observable<VisibilityStatus> {
    const result = defer(() => {
      return from(this._idsCache.getAllContainedCategories(props.definitionContainerIds)).pipe(
        mergeMap((categoryIds) =>
          this.getCategoriesVisibilityStatus({
            categoryIds,
            modelId: undefined,
          }),
        ),
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private getVisibleModelCategoriesVisibilityStatus({ modelId, categoryIds }: { modelId: Id64String; categoryIds: Id64Arg }) {
    return merge(
      this.getVisibilityFromAlwaysAndNeverDrawnElements({
        queryProps: { modelId, categoryIds },
        defaultStatus: () => this.getVisibleModelDefaultCategoriesVisibilityStatus({ modelId, categoryIds }),
      }),
      this.getSubModels({ modelId, categoryIds }).pipe(
        mergeMap(({ subModels }) => {
          if (subModels && Id64.sizeOf(subModels) > 0) {
            return this.getModelsVisibilityStatus({ modelIds: subModels });
          }
          return EMPTY;
        }),
      ),
    ).pipe(mergeVisibilityStatuses);
  }

  private getVisibileCategorySubCategoriesVisibilityStatus(props: { subCategoryIds: Id64Arg }): VisibilityStatus {
    const { subCategoryIds } = props;
    let subCategoryVisiblity: "visible" | "hidden" | "unknown" = "unknown";
    for (const subCategoryId of Id64.iterable(subCategoryIds)) {
      const isSubCategoryVisible = this._props.viewport.isSubCategoryVisible(subCategoryId);
      if (isSubCategoryVisible && subCategoryVisiblity === "hidden") {
        return createVisibilityStatus("partial");
      }
      if (!isSubCategoryVisible && subCategoryVisiblity === "visible") {
        return createVisibilityStatus("partial");
      }
      subCategoryVisiblity = isSubCategoryVisible ? "visible" : "hidden";
    }
    // If visibility is unknown, no subCategories were provided,
    // Since category is visible we return visible
    return createVisibilityStatus(subCategoryVisiblity === "unknown" ? "visible" : subCategoryVisiblity);
  }

  private getSubCategoriesVisibilityStatus(props: { subCategoryIds: Id64Arg; categoryId: Id64String; modelId?: Id64String }): Observable<VisibilityStatus> {
    const result = defer(() => {
      return (props.modelId ? of({ id: props.categoryId, models: props.modelId }) : from(this.getModels({ categoryIds: props.categoryId }))).pipe(
        map(({ models }) => {
          let visibility: "visible" | "hidden" | "unknown" = "unknown";
          let nonDefaultModelDisplayStatesCount = 0;
          for (const modelId of Id64.iterable(models ?? [])) {
            if (!this._props.viewport.view.viewsModel(modelId)) {
              if (visibility === "visible") {
                return createVisibilityStatus("partial");
              }
              visibility = "hidden";
              ++nonDefaultModelDisplayStatesCount;
              continue;
            }
            const override = this._props.viewport.perModelCategoryVisibility.getOverride(modelId, props.categoryId);
            if (override === PerModelCategoryVisibility.Override.Show) {
              if (visibility === "hidden") {
                return createVisibilityStatus("partial");
              }
              visibility = "visible";
              ++nonDefaultModelDisplayStatesCount;
              continue;
            }
            if (override === PerModelCategoryVisibility.Override.Hide) {
              if (visibility === "visible") {
                return createVisibilityStatus("partial");
              }
              visibility = "hidden";
              ++nonDefaultModelDisplayStatesCount;
              continue;
            }
          }
          if (models && Id64.sizeOf(models) > 0 && nonDefaultModelDisplayStatesCount === Id64.sizeOf(models)) {
            assert(visibility === "visible" || visibility === "hidden");
            return createVisibilityStatus(visibility);
          }
          if (!this._props.viewport.view.viewsCategory(props.categoryId)) {
            return createVisibilityStatus(visibility === "visible" ? "partial" : "hidden");
          }

          if (Id64.sizeOf(props.subCategoryIds) === 0) {
            if (visibility === "hidden") {
              return createVisibilityStatus("partial");
            }
            return createVisibilityStatus("visible");
          }

          const subCategoriesVisibility = this.getVisibileCategorySubCategoriesVisibilityStatus({ subCategoryIds: props.subCategoryIds });
          return subCategoriesVisibility.state === visibility || visibility === "unknown" ? subCategoriesVisibility : createVisibilityStatus("partial");
        }),
        mergeVisibilityStatuses,
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private getVisibleModelDefaultCategoriesVisibilityStatus({ modelId, categoryIds }: { categoryIds: Id64Arg; modelId: Id64String }): VisibilityStatus {
    const viewport = this._props.viewport;

    let visibleCount = 0;
    for (const categoryId of Id64.iterable(categoryIds)) {
      const override = this._props.viewport.perModelCategoryVisibility.getOverride(modelId, categoryId);
      if (
        override === PerModelCategoryVisibility.Override.Show ||
        (override === PerModelCategoryVisibility.Override.None && viewport.view.viewsCategory(categoryId))
      ) {
        ++visibleCount;
        continue;
      }
      if (visibleCount > 0) {
        return createVisibilityStatus("partial");
      }
    }
    return visibleCount > 0 ? createVisibilityStatus("visible") : createVisibilityStatus("hidden");
  }

  private getCategoriesVisibilityStatus({
    categoryIds,
    modelId: modelIdFromProps,
  }: {
    categoryIds: Id64Arg;
    modelId: Id64String | undefined;
  }): Observable<VisibilityStatus> {
    const result = defer(() => {
      return (
        modelIdFromProps
          ? from(Id64.iterable(categoryIds)).pipe(map((categoryId) => ({ id: categoryId, models: modelIdFromProps })))
          : this.getModels({ categoryIds })
      ).pipe(
        map(({ id, models }) => {
          const acc = { categoryId: id, visibleModels: new Array<Id64String>(), hiddenModels: new Array<Id64String>() };
          if (!models) {
            return acc;
          }
          for (const modelId of Id64.iterable(models)) {
            if (this._props.viewport.viewsModel(modelId)) {
              acc.visibleModels.push(modelId);
            } else {
              acc.hiddenModels.push(modelId);
            }
          }
          return acc;
        }),
        mergeMap(({ categoryId, visibleModels, hiddenModels }) => {
          return merge(
            // For hidden models we only need to check subModels
            hiddenModels.length > 0
              ? this.getSubModels({ modelIds: hiddenModels }).pipe(
                  mergeMap(({ subModels }) => {
                    if (subModels && Id64.sizeOf(subModels) > 0) {
                      return this.getModelsVisibilityStatus({
                        modelIds: subModels,
                      }).pipe(
                        map((subModelsVisibilityStatus) =>
                          subModelsVisibilityStatus.state !== "hidden" ? createVisibilityStatus("partial") : createVisibilityStatus("hidden"),
                        ),
                      );
                    }
                    return of(createVisibilityStatus("hidden"));
                  }),
                )
              : EMPTY,
            // For visible models we need to check all categories
            visibleModels.length > 0
              ? from(visibleModels).pipe(
                  mergeMap((modelId) =>
                    this.getVisibleModelCategoriesVisibilityStatus({
                      modelId,
                      categoryIds: categoryId,
                    }),
                  ),
                )
              : EMPTY,
            // We need to check subCategories as well
            this.getSubCategories({ categoryIds: categoryId }).pipe(
              mergeMap(({ subCategories }) => {
                if (subCategories && Id64.sizeOf(subCategories) > 0) {
                  return this.getSubCategoriesVisibilityStatus({ categoryId, modelId: modelIdFromProps, subCategoryIds: subCategories });
                }

                return EMPTY;
              }),
            ),
          ).pipe(defaultIfEmpty(createVisibilityStatus(this._props.viewport.view.viewsCategory(categoryId) ? "visible" : "hidden")));
        }),
        mergeVisibilityStatuses,
      );
    });
    return createVisibilityHandlerResult(this, { categoryIds, modelId: modelIdFromProps }, result, undefined);
  }

  private getGroupedElementsVisibilityStatus(props: { modelElementsMap: Map<ModelId, Set<ElementId>>; categoryId: Id64String }): Observable<VisibilityStatus> {
    const result = defer(() => {
      const { modelElementsMap, categoryId } = props;
      return from(modelElementsMap).pipe(
        mergeMap(([modelId, elementIds]) => this.getElementsVisibilityStatus({ elementIds, modelId, categoryId })),
        mergeVisibilityStatuses,
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private getElementsVisibilityStatus(props: { elementIds: Id64Arg; modelId: Id64String; categoryId: Id64String }): Observable<VisibilityStatus> {
    const result = defer(() => {
      const { elementIds, modelId, categoryId } = props;

      // TODO: check child elements that are subModels
      if (!this._props.viewport.view.viewsModel(modelId)) {
        return from(elementIds).pipe(
          mergeMap((elementId) =>
            from(this._idsCache.hasSubModel(elementId)).pipe(
              mergeMap((isSubModel) => {
                if (isSubModel) {
                  return this.getModelsVisibilityStatus({
                    modelIds: elementId,
                  }).pipe(
                    map((subModelVisibilityStatus) =>
                      subModelVisibilityStatus.state !== "hidden" ? createVisibilityStatus("partial") : createVisibilityStatus("hidden"),
                    ),
                  );
                }
                return of(createVisibilityStatus("hidden"));
              }),
            ),
          ),
          mergeVisibilityStatuses,
        );
      }
      // TODO: check child elements
      // TODO: check child element categories
      // TODO: check child elements that are subModels
      return this.getVisibilityFromAlwaysAndNeverDrawnElements({
        elements: elementIds,
        defaultStatus: () => this.getVisibleModelDefaultCategoriesVisibilityStatus({ categoryIds: categoryId, modelId }),
      }).pipe(
        mergeMap((visibilityStatusAlwaysAndNeverDraw) => {
          return from(Id64.iterable(elementIds)).pipe(
            mergeMap((elementId) =>
              from(this._idsCache.hasSubModel(elementId)).pipe(
                mergeMap((isSubModel) => {
                  if (isSubModel) {
                    return this.getModelsVisibilityStatus({
                      modelIds: elementId,
                    }).pipe(
                      map((subModelVisibilityStatus) =>
                        subModelVisibilityStatus.state !== visibilityStatusAlwaysAndNeverDraw.state
                          ? createVisibilityStatus("partial")
                          : visibilityStatusAlwaysAndNeverDraw,
                      ),
                    );
                  }
                  return of(visibilityStatusAlwaysAndNeverDraw);
                }),
              ),
            ),
            mergeVisibilityStatuses,
          );
        }),
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  /** Changes visibility of the items represented by the tree node. */
  private changeVisibilityObs(node: HierarchyNode, on: boolean): Observable<void> {
    if (node.filtering?.filteredChildrenIdentifierPaths?.length && !node.filtering.isFilterTarget) {
      return this.changeFilteredNodeVisibility({ node, on });
    }

    if (HierarchyNode.isClassGroupingNode(node)) {
      const nodeInfo = this.getGroupingNodeInfo(node);
      return this.changeGroupedElementsVisibilityStatus({ categoryId: nodeInfo.categoryId, modelElementsMap: nodeInfo.modelElementsMap, on });
    }

    if (!HierarchyNode.isInstancesNode(node)) {
      return EMPTY;
    }

    if (CategoriesTreeNode.isDefinitionContainerNode(node)) {
      return this.changeDefinitionContainersVisibilityStatus({
        definitionContainerIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        on,
      });
    }

    if (CategoriesTreeNode.isModelNode(node)) {
      return this.changeModelsVisibilityStatus({
        modelIds: node.key.instanceKeys.map(({ id }) => id),
        on,
      });
    }

    if (CategoriesTreeNode.isCategoryNode(node)) {
      return this.changeCategoriesVisibilityStatus({
        categoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        modelId: CategoriesTreeNode.getModelId(node),
        on,
      });
    }

    const categoryId = CategoriesTreeNode.getCategoryId(node);
    if (!categoryId) {
      return EMPTY;
    }

    if (CategoriesTreeNode.isSubCategoryNode(node)) {
      return this.changeSubCategoriesVisibilityStatus({
        categoryId,
        subCategoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        on,
      });
    }

    const modelId = CategoriesTreeNode.getModelId(node);
    if (!modelId) {
      return EMPTY;
    }

    return this.changeElementsVisibilityStatus({
      elementIds: node.key.instanceKeys.map(({ id }) => id),
      modelId,
      categoryId,
      on,
    });
  }

  private async getFilteredTreeTargets({ node }: GetFilteredNodeVisibilityProps) {
    const filteredTree = await this._filteredTree;
    return filteredTree ? filteredTree.getFilterTargets(node) : undefined;
  }

  private changeFilteredNodeVisibility({ on, ...props }: ChangeFilteredNodeVisibilityProps) {
    return from(this.getFilteredTreeTargets(props)).pipe(
      mergeMap((targets) => {
        if (!targets) {
          return EMPTY;
        }
        const { definitionContainerIds, subCategories, modelIds, categories, elements } = targets;
        const observables = new Array<Observable<void>>();
        if (definitionContainerIds?.size) {
          observables.push(this.changeDefinitionContainersVisibilityStatus({ definitionContainerIds, on }));
        }

        if (modelIds?.size) {
          observables.push(this.changeModelsVisibilityStatus({ modelIds, on }));
        }

        if (categories?.length) {
          observables.push(from(categories).pipe(mergeMap(({ modelId, categoryIds }) => this.changeCategoriesVisibilityStatus({ categoryIds, modelId, on }))));
        }

        if (subCategories?.length) {
          observables.push(
            from(subCategories).pipe(
              mergeMap(({ categoryId, subCategoryIds }) => this.changeSubCategoriesVisibilityStatus({ subCategoryIds, categoryId, on })),
            ),
          );
        }

        if (elements?.length) {
          observables.push(
            from(elements).pipe(
              releaseMainThreadOnItemsCount(50),
              mergeMap(({ modelId, elementIds, categoryId }) => this.changeElementsVisibilityStatus({ modelId, categoryId, elementIds, on })),
            ),
          );
        }

        return merge(...observables);
      }),
    );
  }

  private changeModelsVisibilityStatus(props: { modelIds: Id64Arg; on: boolean }): Observable<void> {
    const { modelIds, on } = props;

    if (Id64.sizeOf(modelIds) === 0) {
      return EMPTY;
    }

    const result = defer(() => {
      const viewport = this._props.viewport;

      viewport.perModelCategoryVisibility.clearOverrides(modelIds);
      if (!on) {
        viewport.changeModelDisplay(modelIds, false);
        return this.getSubModels({ modelIds }).pipe(
          mergeMap(({ subModels }) => (subModels ? this.changeModelsVisibilityStatus({ modelIds: subModels, on }) : EMPTY)),
        );
      }

      return concat(
        from(viewport.addViewedModels(modelIds)),
        this.getCategories({ modelIds }).pipe(
          mergeMap(({ id, drawingCategories, spatialCategories }) => {
            return merge(
              drawingCategories ? this.changeCategoriesVisibilityStatus({ categoryIds: drawingCategories, modelId: id, on }) : EMPTY,
              spatialCategories ? this.changeCategoriesVisibilityStatus({ categoryIds: spatialCategories, modelId: id, on }) : EMPTY,
            );
          }),
        ),
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private showModelWithoutAnyCategoriesOrElements(modelId: Id64String, categoriesToNotOverride?: Id64Arg): Observable<void> {
    const viewport = this._props.viewport;
    return forkJoin({
      allModelCategories: this.getCategories({ modelIds: modelId }).pipe(
        reduce((acc, { drawingCategories, spatialCategories }) => {
          for (const category of Id64.iterable(drawingCategories ?? [])) {
            acc.add(category);
          }
          for (const category of Id64.iterable(spatialCategories ?? [])) {
            acc.add(category);
          }
          return acc;
        }, new Set<Id64String>()),
      ),
      modelAlwaysDrawnElements: this._alwaysAndNeverDrawnElements.getAlwaysDrawnElements({ modelId }),
    }).pipe(
      mergeMap(async ({ allModelCategories, modelAlwaysDrawnElements }) => {
        const alwaysDrawn = this._props.viewport.alwaysDrawn;
        if (alwaysDrawn && modelAlwaysDrawnElements) {
          viewport.setAlwaysDrawn(setDifference(alwaysDrawn, modelAlwaysDrawnElements));
        }
        const categoriesToOverride = categoriesToNotOverride
          ? setDifference(allModelCategories, getSetFromId64Arg(categoriesToNotOverride))
          : allModelCategories;
        categoriesToOverride.forEach((categoryId) => {
          this.changeCategoryStateInViewportAccordingToModelVisibility(modelId, categoryId, false, false);
        });
        await viewport.addViewedModels(modelId);
      }),
    );
  }

  private changeCategoryStateInViewportAccordingToModelVisibility(modelId: string, categoryId: string, on: boolean, changeSubCategories: boolean) {
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
      viewport.changeCategoryDisplay(categoryId, true, changeSubCategories);
    }
  }

  private changeSubCategoriesVisibilityStatus(props: { categoryId: Id64String; subCategoryIds: Id64Arg; on: boolean }): Observable<void> {
    const result = defer(() => {
      return concat(
        // make sure parent category and models are enabled
        props.on
          ? concat(
              from(enableCategoryDisplay(this._props.viewport, props.categoryId, props.on, false)),
              this.enableCategoriesElementModelsVisibility(props.categoryId),
            )
          : EMPTY,
        from(props.subCategoryIds).pipe(map((subCategoryId) => enableSubCategoryDisplay(this._props.viewport, subCategoryId, props.on))),
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private enableCategoriesElementModelsVisibility(categoryIds: Id64Arg): Observable<void> {
    return from(this._idsCache.getCategoriesElementModels(categoryIds, true)).pipe(
      mergeMap((categoriesModelsMap) => categoriesModelsMap.values()),
      reduce((acc, modelIds) => {
        modelIds.forEach((modelId) => {
          if (!this._props.viewport.view.viewsModel(modelId)) {
            acc.add(modelId);
          }
        });
        return acc;
      }, new Set<Id64String>()),
      map((hiddenModels) => {
        if (hiddenModels.size > 0) {
          this._props.viewport.changeModelDisplay(hiddenModels, true);
        }
      }),
    );
  }

  private changeDefinitionContainersVisibilityStatus(props: { definitionContainerIds: Id64Arg; on: boolean }): Observable<void> {
    const result = defer(() => {
      return from(this._idsCache.getAllContainedCategories(props.definitionContainerIds)).pipe(
        mergeMap((categoryIds) => this.changeCategoriesVisibilityStatus({ categoryIds, modelId: undefined, on: props.on })),
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private changeCategoriesVisibilityStatus(props: { modelId: Id64String | undefined; categoryIds: Id64Arg; on: boolean }): Observable<void> {
    const result = defer(() => {
      const { modelId: modelIdFromProps, categoryIds, on } = props;
      const viewport = this._props.viewport;
      const modelIdsObservable = (
        modelIdFromProps
          ? of(new Map<ModelId, Set<CategoryId>>([[modelIdFromProps, getSetFromId64Arg(categoryIds)]]))
          : this.getModels({ categoryIds }).pipe(
              reduce((acc, { id, models }) => {
                if (!models) {
                  return acc;
                }
                for (const modelId of Id64.iterable(models)) {
                  let entry = acc.get(modelId);
                  if (!entry) {
                    entry = new Set();
                    acc.set(modelId, entry);
                  }
                  entry.add(id);
                }
                return acc;
              }, new Map<ModelId, Set<CategoryId>>()),
            )
      ).pipe(
        mergeMap((modelCategoriesMap) => modelCategoriesMap.entries()),
        shareReplay(),
      );
      return concat(
        // If modelId was provided: add override
        // If modelId was not provided: change categoryDisplay and remove categories per model overrides
        modelIdFromProps
          ? of(
              viewport.perModelCategoryVisibility.setOverride(
                modelIdFromProps,
                categoryIds,
                on ? PerModelCategoryVisibility.Override.Show : PerModelCategoryVisibility.Override.Hide,
              ),
            )
          : concat(
              from(enableCategoryDisplay(viewport, categoryIds, on, on)),
              modelIdsObservable.pipe(
                map(([modelId, modelCategories]) => {
                  viewport.perModelCategoryVisibility.setOverride(modelId, modelCategories, PerModelCategoryVisibility.Override.None);
                }),
              ),
            ),
        // If categories visibility needs to be turned on, we need to turn on models without turning on unrelated elements or categories for that model
        on
          ? modelIdsObservable.pipe(
              mergeMap(([modelId, categories]) => {
                if (!viewport.view.viewsModel(modelId)) {
                  return this.showModelWithoutAnyCategoriesOrElements(modelId, categories);
                }
                return EMPTY;
              }),
            )
          : EMPTY,
        this._alwaysAndNeverDrawnElements.clearAlwaysAndNeverDrawnElements({ categoryIds, modelId: modelIdFromProps }),
        this.getSubModels({ categoryIds, modelId: modelIdFromProps }).pipe(
          mergeMap(({ subModels }) => (subModels ? this.changeModelsVisibilityStatus({ modelIds: subModels, on }) : EMPTY)),
        ),
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  /**
   * Updates visibility of all grouping node's elements.
   * @see `changeElementState`
   */
  private changeGroupedElementsVisibilityStatus(props: {
    modelElementsMap: Map<ModelId, Set<ElementId>>;
    categoryId: Id64String;
    on: boolean;
  }): Observable<void> {
    const result = defer(() => {
      return from(props.modelElementsMap).pipe(
        mergeMap(([modelId, elementIds]) => {
          return this.changeElementsVisibilityStatus({ modelId, elementIds, categoryId: props.categoryId, on: props.on });
        }),
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  /**
   * Updates visibility of an element and all its child elements by adding them to the always/never drawn list.
   * @note If element is to be enabled and model is hidden, it will be enabled.
   */
  private changeElementsVisibilityStatus(props: { elementIds: Id64Arg; modelId: Id64String; categoryId: Id64String; on: boolean }): Observable<void> {
    const result = defer(() => {
      const { modelId, categoryId, elementIds, on } = props;
      const viewport = this._props.viewport;
      // TODO: change child elements
      // TODO: change child element categories
      // TODO: change child subModels
      return concat(
        // Change elements state
        defer(() => {
          if (!viewport.view.viewsModel(modelId)) {
            if (!on) {
              return this.queueElementsVisibilityChange(elementIds, on, false);
            }

            return this.showModelWithoutAnyCategoriesOrElements(modelId).pipe(
              mergeMap(() => {
                const defaultVisibility = this.getVisibleModelDefaultCategoriesVisibilityStatus({ categoryIds: categoryId, modelId });
                const displayedByDefault = defaultVisibility.state === "visible";
                return this.queueElementsVisibilityChange(elementIds, on, displayedByDefault);
              }),
            );
          }

          const categoryVisibility = this.getVisibleModelDefaultCategoriesVisibilityStatus({ categoryIds: categoryId, modelId });
          const isDisplayedByDefault = categoryVisibility.state === "visible";
          return this.queueElementsVisibilityChange(elementIds, on, isDisplayedByDefault);
        }),
        // Change visibility of elements that are models
        from(Id64.iterable(elementIds)).pipe(
          mergeMap((elementId) =>
            from(this._idsCache.hasSubModel(elementId)).pipe(
              mergeMap((isSubModel) => {
                if (isSubModel) {
                  return this.changeModelsVisibilityStatus({ modelIds: elementId, on });
                }
                return EMPTY;
              }),
            ),
          ),
        ),
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private queueElementsVisibilityChange(elementIds: Id64Arg, on: boolean, visibleByDefault: boolean) {
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
    props: GetVisibilityFromAlwaysAndNeverDrawnElementsProps & ({ elements: Id64Arg } | { queryProps: { modelId: Id64String; categoryIds: Id64Arg } }),
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
          alwaysDrawn: viewport.alwaysDrawn?.size ? setIntersection(Id64.iterable(props.elements), viewport.alwaysDrawn) : undefined,
          neverDrawn: viewport.neverDrawn?.size ? setIntersection(Id64.iterable(props.elements), viewport.neverDrawn) : undefined,
          totalCount: Id64.sizeOf(props.elements),
          viewport,
        }),
      );
    }
    const { modelId, categoryIds } = props.queryProps;
    const totalCount = from(Id64.iterable(categoryIds)).pipe(
      mergeMap((categoryId) => this.getElementsCount({ modelId, categoryId })),
      reduce((acc, specificModelCategoryCount) => {
        return acc + specificModelCategoryCount;
      }, 0),
    );
    return forkJoin({
      totalCount,
      alwaysDrawn: this._alwaysAndNeverDrawnElements.getAlwaysDrawnElements(props.queryProps),
      neverDrawn: this._alwaysAndNeverDrawnElements.getNeverDrawnElements(props.queryProps),
    }).pipe(
      map((state) => {
        return getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
          ...props,
          ...state,
          viewport,
        });
      }),
    );
  }

  private getCategories(props: { modelIds: Id64Arg }): Observable<{ id: ModelId; drawingCategories?: Id64Arg; spatialCategories?: Id64Arg }> {
    return from(Id64.iterable(props.modelIds)).pipe(
      mergeMap((modelId) =>
        from(this._props.idsCache.getModelCategoryIds(modelId)).pipe(
          map((categories) => ({ id: modelId, ...(this._props.viewport.view.is2d() ? { drawingCategories: categories } : { spatialCategories: categories }) })),
        ),
      ),
    );
  }

  private getElementsCount(props: { modelId: Id64String; categoryId: Id64String }): Observable<number> {
    return from(this._props.idsCache.getCategoryElementsCount(props.modelId, props.categoryId));
  }

  private getModels(props: { categoryIds: Id64Arg }): Observable<{ id: CategoryId; models: Id64Arg | undefined }> {
    return from(Id64.iterable(props.categoryIds)).pipe(
      mergeMap((categoryId) =>
        from(this._props.idsCache.getCategoriesElementModels(categoryId, true)).pipe(
          mergeMap((categoryModelsMap) => (categoryModelsMap.size > 0 ? categoryModelsMap.values() : of(undefined))),
          map((categoryModels) => ({ id: categoryId, models: categoryModels })),
        ),
      ),
    );
  }

  private getSubCategories(props: { categoryIds: Id64Arg }): Observable<{ id: CategoryId; subCategories: Id64Arg | undefined }> {
    return from(Id64.iterable(props.categoryIds)).pipe(
      mergeMap((categoryId) =>
        from(this._props.idsCache.getSubCategories(categoryId)).pipe(
          mergeMap((categorySubCategoriesMap) => (categorySubCategoriesMap.size > 0 ? categorySubCategoriesMap.values() : of(undefined))),
          map((subCategories) => ({ id: categoryId, subCategories })),
        ),
      ),
    );
  }

  private getSubModels(
    props: { modelIds: Id64Arg } | { modelId: Id64String | undefined; categoryIds: Id64Arg },
  ): Observable<{ id: CategoryId | ModelId; subModels: Id64Arg | undefined }> {
    if ("modelIds" in props) {
      return from(Id64.iterable(props.modelIds)).pipe(
        mergeMap((modelId) =>
          from(this._props.idsCache.getModelCategoryIds(modelId)).pipe(
            mergeMap((categoryIds) => from(this._props.idsCache.getCategoriesModeledElements(modelId, categoryIds))),
            map((subModels) => ({ id: modelId, subModels })),
          ),
        ),
      );
    }

    if (props.modelId) {
      return from(Id64.iterable(props.categoryIds)).pipe(
        mergeMap((categoryId) =>
          from(this._props.idsCache.getCategoriesModeledElements(props.modelId!, categoryId)).pipe(map((subModels) => ({ id: categoryId, subModels }))),
        ),
      );
    }

    return from(Id64.iterable(props.categoryIds)).pipe(
      mergeMap((categoryId) =>
        from(this._props.idsCache.getCategoriesElementModels(categoryId)).pipe(
          mergeMap((categoryModelsMap) => {
            const models = categoryModelsMap.get(categoryId);
            if (!models) {
              return of({ id: categoryId, subModels: undefined });
            }
            return from(models).pipe(
              mergeMap((modelId) => from(this._props.idsCache.getCategoriesModeledElements(modelId, categoryId))),
              map((subModels) => ({ id: categoryId, subModels })),
            );
          }),
        ),
      ),
    );
  }

  private getGroupingNodeInfo(node: GroupingHierarchyNode) {
    const modelElementsMap: Map<ModelId, Set<ElementId>> = node.extendedData?.modelElementsMap;
    const categoryId = node.extendedData?.categoryId;
    assert(!!modelElementsMap && !!categoryId);

    return { modelElementsMap, categoryId };
  }
}
