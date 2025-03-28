/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  concat,
  concatAll,
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
  toArray,
} from "rxjs";
import { assert, Id64 } from "@itwin/core-bentley";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { HierarchyNode, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { enableCategoryDisplay, enableSubCategoryDisplay } from "../../common/CategoriesVisibilityUtils.js";
import { AlwaysAndNeverDrawnElementInfo } from "../../common/internal/AlwaysAndNeverDrawnElementInfo.js";
import { createVisibilityStatus, getTooltipOptions } from "../../common/internal/Tooltip.js";
import { getDistinctMapValues, releaseMainThreadOnItemsCount, setDifference, setIntersection } from "../../common/internal/Utils.js";
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
import { toVoidPromise } from "../../common/Rxjs.js";
import { createVisibilityHandlerResult } from "../../common/UseHierarchyVisibility.js";
import { getClassesByView } from "./CategoriesTreeIdsCache.js";
import { CategoriesTreeNode } from "./CategoriesTreeNode.js";
import { createFilteredTree, parseCategoryKey, parseSubCategoryKey } from "./FilteredTree.js";

import type { CategoryAlwaysOrNeverDrawnElementsQueryProps } from "../../common/internal/AlwaysAndNeverDrawnElementInfo.js";
import type { GetVisibilityFromAlwaysAndNeverDrawnElementsProps } from "../../common/internal/VisibilityUtils.js";
import type { Observable, Subscription } from "rxjs";
import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { GroupingHierarchyNode, HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { HierarchyVisibilityHandler, VisibilityStatus } from "../../common/UseHierarchyVisibility.js";
import type { NonPartialVisibilityStatus } from "../../common/internal/Tooltip.js";
import type { CategoriesTreeHierarchyConfiguration } from "../CategoriesTreeDefinition.js";
import type { CategoriesTreeIdsCache } from "./CategoriesTreeIdsCache.js";
import type { FilteredTree } from "./FilteredTree.js";
import type { IVisibilityChangeEventListener } from "../../common/internal/VisibilityChangeEventListener.js";

/** @alpha */
interface GetCategoryVisibilityStatusProps {
  categoryIds: Id64Array;
  modelId?: Id64String;
  ignoreSubCategories?: boolean;
}

/** @alpha */
interface ChangeCategoryVisibilityStateProps extends GetCategoryVisibilityStatusProps {
  on: boolean;
}

/** @alpha */
interface GetGeometricElementVisibilityStatusProps {
  elementId: Id64String;
  modelId: Id64String;
  categoryId: Id64String;
}

/** @alpha */
interface ChangeGeometricElementsDisplayStateProps {
  elementIds: Id64Set;
  modelId: Id64String;
  categoryId: Id64String;
  on: boolean;
}

/** @alpha */
interface ChangeModelVisibilityStateProps {
  ids: Id64Arg;
  on: boolean;
}

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
  hierarchyConfig: CategoriesTreeHierarchyConfiguration;
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
  private _filteredTree: Promise<FilteredTree> | undefined;
  private _elementChangeQueue = new Subject<Observable<void>>();
  private _subscriptions: Subscription[] = [];
  private _changeRequest = new Subject<{ key: HierarchyNodeKey; depth: number }>();

  constructor(private readonly _props: CategoriesTreeVisibilityHandlerProps) {
    this._eventListener = createVisibilityChangeEventListener({
      viewport: _props.viewport,
      listeners: {
        models: _props.hierarchyConfig.showElements,
        categories: true,
        elements: _props.hierarchyConfig.showElements,
        displayStyle: true,
      },
    });
    this._alwaysAndNeverDrawnElements = new AlwaysAndNeverDrawnElementInfo(_props.viewport);
    this._idsCache = this._props.idsCache;
    const { categoryClass, categoryElementClass, categoryModelClass } = getClassesByView(_props.viewport.view.is2d() ? "2d" : "3d");
    if (_props.filteredPaths) {
      this._filteredTree = createFilteredTree({
        idsCache: this._idsCache,
        filteringPaths: _props.filteredPaths,
        categoryClassName: categoryClass,
        categoryElementClassName: categoryElementClass,
        categoryModelClassName: categoryModelClass,
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

    if (CategoriesTreeNode.isDefinitionContainerNode(node)) {
      return this.getDefinitionContainerDisplayStatus({
        definitionContainerIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    if (CategoriesTreeNode.isCategoryNode(node)) {
      return this.getCategoryDisplayStatus({
        categoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        modelId: CategoriesTreeNode.getModelId(node),
        ignoreSubCategories: node.extendedData?.isCategoryOfSubModel,
      });
    }

    const categoryId = CategoriesTreeNode.getCategoryId(node);
    if (!categoryId) {
      return of(createVisibilityStatus("disabled"));
    }

    if (CategoriesTreeNode.isSubCategoryNode(node)) {
      return this.getSubCategoryDisplayStatus({
        categoryId,
        subCategoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    const modelId = CategoriesTreeNode.getModelId(node);
    if (!modelId) {
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
      mergeMap(({ definitionContainers, subCategories, models, categories, elements }) => {
        const observables = new Array<Observable<VisibilityStatus>>();
        if (definitionContainers?.size) {
          observables.push(
            from(definitionContainers).pipe(
              mergeMap((definitionContainerId) =>
                this.getDefinitionContainerDisplayStatus({ definitionContainerIds: [definitionContainerId], ignoreTooltip: true }),
              ),
            ),
          );
        }

        if (models?.size) {
          observables.push(from(models).pipe(mergeMap((modelId) => this.getModelVisibilityStatus({ modelId }))));
        }

        if (categories?.size) {
          observables.push(
            from(categories).pipe(
              mergeMap((key) => {
                const { modelId, categoryId } = parseCategoryKey(key);
                return this.getCategoryDisplayStatus({ ignoreTooltip: true, ignoreSubCategories: !!modelId, modelId, categoryIds: [categoryId] });
              }),
            ),
          );
        }

        if (subCategories?.size) {
          observables.push(
            from(subCategories).pipe(
              mergeMap((key) => {
                const { subCategoryId, categoryId } = parseSubCategoryKey(key);
                return this.getSubCategoryDisplayStatus({ subCategoryIds: [subCategoryId], categoryId, ignoreTooltip: true });
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
                assert(modelId !== undefined);
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
      mergeVisibilityStatuses({ visible: undefined, hidden: undefined, partial: undefined }),
    );
  }

  private getModelVisibilityStatus({ modelId }: { modelId: Id64String }): Observable<VisibilityStatus> {
    const result = defer(() => {
      const viewport = this._props.viewport;

      if (!viewport.view.viewsModel(modelId)) {
        return from(this._idsCache.getModelCategories(modelId)).pipe(
          mergeMap((categoryIds) => from(this._idsCache.getCategoriesModeledElements(modelId, categoryIds))),
          getSubModeledElementsVisibilityStatus({
            ignoreTooltips: true,
            tooltips: { visible: undefined, hidden: undefined, partial: undefined },
            parentNodeVisibilityStatus: createVisibilityStatus("hidden"),
            getModelVisibilityStatus: (modelProps) => this.getModelVisibilityStatus(modelProps),
          }),
        );
      }

      return from(this._idsCache.getModelCategories(modelId)).pipe(
        concatAll(),
        mergeMap((categoryId) => this.getCategoryDisplayStatus({ modelId, categoryIds: [categoryId], ignoreSubCategories: true, ignoreTooltip: true })),
        mergeVisibilityStatuses(
          {
            visible: undefined,
            hidden: undefined,
            partial: undefined,
          },
          true,
        ),
      );
    });
    return createVisibilityHandlerResult(this, { id: modelId }, result, undefined);
  }

  private getDefinitionContainerDisplayStatus(props: { definitionContainerIds: Id64Array; ignoreTooltip?: boolean }): Observable<VisibilityStatus> {
    const result = defer(() => {
      return from(this._idsCache.getAllContainedCategories(props.definitionContainerIds)).pipe(
        concatAll(),
        mergeMap((categoryId) => {
          return this.getCategoryDisplayStatus({ categoryIds: [categoryId], ignoreSubCategories: false, ignoreTooltip: true });
        }),
        mergeVisibilityStatuses({
          visible: "categoriesTree.definitionContainer.visibleThroughCategories",
          hidden: "categoriesTree.definitionContainer.hiddenThroughCategories",
          partial: "categoriesTree.definitionContainer.partialThroughCategories",
        }),
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private getSubCategoryDisplayStatus(props: { categoryId: Id64String; subCategoryIds: Id64Array; ignoreTooltip?: boolean }): Observable<VisibilityStatus> {
    const result = defer(() => {
      const { categoryId, subCategoryIds, ignoreTooltip } = props;
      const categoryOverrideResult = this.getCategoryVisibilityFromOverrides([categoryId], ignoreTooltip);
      if (categoryOverrideResult !== "none" && (categoryOverrideResult.state === "hidden" || categoryOverrideResult.state === "visible")) {
        return of(
          createVisibilityStatus(
            categoryOverrideResult.state,
            getTooltipOptions(`categoriesTree.subCategory.${categoryOverrideResult.state}ThroughCategoryOverride`),
          ),
        );
      }

      if (!this._props.viewport.view.viewsCategory(categoryId)) {
        return of(createVisibilityStatus("hidden", getTooltipOptions("categoriesTree.subCategory.hiddenThroughCategory", ignoreTooltip)));
      }

      let visibleCount = 0;
      let hiddenCount = 0;
      for (const subCategoryId of subCategoryIds) {
        const isVisible = this._props.viewport.isSubCategoryVisible(subCategoryId);
        if (isVisible) {
          ++visibleCount;
        } else {
          ++hiddenCount;
        }
        if (visibleCount > 0 && hiddenCount > 0) {
          return of(createVisibilityStatus("partial", getTooltipOptions("categoriesTree.subCategory.partialThroughSubCategory", ignoreTooltip)));
        }
      }
      return of(visibleCount > 0 ? createVisibilityStatus("visible") : createVisibilityStatus("hidden"));
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private getCategoryVisibilityFromOverrides(categoryIds: Id64Array, ignoreTooltip?: boolean): VisibilityStatus | "none" {
    let showOverrides = 0;
    let hideOverrides = 0;

    for (const currentOverride of this._props.viewport.perModelCategoryVisibility) {
      if (categoryIds.includes(currentOverride.categoryId)) {
        if (currentOverride.visible) {
          ++showOverrides;
        } else {
          ++hideOverrides;
        }

        if (showOverrides > 0 && hideOverrides > 0) {
          return createVisibilityStatus("partial", getTooltipOptions("categoriesTree.category.partialThroughOverrides", ignoreTooltip));
        }
      }
    }

    if (showOverrides === 0 && hideOverrides === 0) {
      return "none";
    }
    const visibility = showOverrides > 0 ? "visible" : "hidden";
    return createVisibilityStatus(visibility, getTooltipOptions(`categoriesTree.category.${visibility}ThroughOverrides`, ignoreTooltip));
  }

  private getDefaultModelsCategoryVisibilityStatus({
    modelId,
    categoryIds,
    ignoreTooltip,
  }: {
    categoryIds: Id64Array;
    modelId: Id64String;
    ignoreTooltip?: boolean;
  }): VisibilityStatus {
    const viewport = this._props.viewport;

    if (!viewport.view.viewsModel(modelId)) {
      return createVisibilityStatus("hidden", getTooltipOptions("categoriesTree.category.hiddenThroughModel", ignoreTooltip));
    }

    let visibleCount = 0;
    let hiddenCount = 0;
    let visibleThroughCategorySelectorCount = 0;
    for (const categoryId of categoryIds) {
      if (viewport.view.viewsCategory(categoryId)) {
        ++visibleThroughCategorySelectorCount;
      }

      const override = this._props.viewport.perModelCategoryVisibility.getOverride(modelId, categoryId);
      if (override === PerModelCategoryVisibility.Override.Show) {
        ++visibleCount;
        continue;
      }
      if (override === PerModelCategoryVisibility.Override.Hide) {
        ++hiddenCount;
        continue;
      }
      if (visibleCount > 0 && hiddenCount > 0) {
        return createVisibilityStatus("partial", getTooltipOptions("categoriesTree.category.partialThroughOverrides", ignoreTooltip));
      }
    }
    if (hiddenCount + visibleCount > 0) {
      const overridenVisibility = hiddenCount > 0 ? "hidden" : "visible";
      return createVisibilityStatus(overridenVisibility, getTooltipOptions(`categoriesTree.category.${overridenVisibility}ThroughOverrides`, ignoreTooltip));
    }

    const visbility = visibleThroughCategorySelectorCount > 0 ? "visible" : "hidden";

    return createVisibilityStatus(visbility, getTooltipOptions(`categoriesTree.category.${visbility}ThroughCategorySelector`, ignoreTooltip));
  }

  private async getDefaultCategoryVisibilityStatus({
    categoryIds,
    ignoreTooltip,
    ignoreSubCategories,
  }: {
    categoryIds: Id64Array;
    ignoreTooltip?: boolean;
    ignoreSubCategories?: boolean;
  }): Promise<VisibilityStatus> {
    const overrideResult = this.getCategoryVisibilityFromOverrides(categoryIds);
    if (overrideResult !== "none") {
      return overrideResult;
    }
    let hiddenCount = 0;
    for (const categoryId of categoryIds) {
      const isVisible = this._props.viewport.view.viewsCategory(categoryId);
      if (!isVisible) {
        ++hiddenCount;
      }
    }

    if (hiddenCount > 0 || this._props.hierarchyConfig.hideSubCategories || ignoreSubCategories) {
      const visibility = hiddenCount > 0 ? "hidden" : "visible";
      return createVisibilityStatus(visibility, getTooltipOptions(`categoriesTree.category.${visibility}ThroughCategorySelector`, ignoreTooltip));
    }

    const subCategories = getDistinctMapValues(await this._idsCache.getSubCategories(categoryIds));
    let visibleSubCategoryCount = 0;
    let hiddenSubCategoryCount = 0;

    for (const subCategory of subCategories) {
      const isVisible = this._props.viewport.isSubCategoryVisible(subCategory);
      if (isVisible) {
        ++visibleSubCategoryCount;
      } else {
        ++hiddenSubCategoryCount;
      }
      if (hiddenSubCategoryCount > 0 && visibleSubCategoryCount > 0) {
        return createVisibilityStatus("partial", getTooltipOptions("categoriesTree.category.partialThroughSubCategories", ignoreTooltip));
      }
    }
    const subCategoryVisiblity = hiddenSubCategoryCount > 0 ? "hidden" : "visible";
    const reason = subCategories.size > 0 ? "ThroughSubCategories" : "ThroughCategorySelector";

    return createVisibilityStatus(subCategoryVisiblity, getTooltipOptions(`categoriesTree.category.${subCategoryVisiblity}${reason}`, ignoreTooltip));
  }

  private getCategoryDisplayStatus({ ignoreTooltip, ...props }: GetCategoryVisibilityStatusProps & { ignoreTooltip?: boolean }): Observable<VisibilityStatus> {
    const result = defer(() => {
      if (!this._props.hierarchyConfig.showElements) {
        return from(this.getDefaultCategoryVisibilityStatus({ categoryIds: props.categoryIds, ignoreTooltip }));
      }
      const modelsObservable = props.modelId
        ? of(new Map(props.categoryIds.map((id) => [id, [props.modelId as string]])))
        : from(this._idsCache.getCategoriesElementModels(props.categoryIds));
      return merge(
        // get visibility status from always and never drawn elements
        this._props.hierarchyConfig.showElements
          ? modelsObservable.pipe(
              mergeMap((categoryModelsMap) => {
                if (categoryModelsMap.size === 0) {
                  return props.modelId
                    ? of(this.getDefaultModelsCategoryVisibilityStatus({ modelId: props.modelId, categoryIds: props.categoryIds, ignoreTooltip }))
                    : from(this.getDefaultCategoryVisibilityStatus({ categoryIds: props.categoryIds, ignoreTooltip }));
                }
                return from(categoryModelsMap).pipe(
                  mergeMap(([category, models]) =>
                    from(models).pipe(
                      mergeMap((model) => {
                        if (this._props.viewport.view.viewsModel(model)) {
                          return this.getVisibilityFromAlwaysAndNeverDrawnElements({
                            queryProps: props,
                            tooltips: {
                              allElementsInAlwaysDrawnList: "categoriesTree.category.allElementsVisible",
                              allElementsInNeverDrawnList: "categoriesTree.category.allElementsHidden",
                              elementsInBothAlwaysAndNeverDrawn: "categoriesTree.category.someElementsAreHidden",
                              noElementsInExclusiveAlwaysDrawnList: "categoriesTree.category.allElementsHidden",
                            },
                            defaultStatus: () => this.getDefaultModelsCategoryVisibilityStatus({ modelId: model, categoryIds: [category], ignoreTooltip }),
                            ignoreTooltip: true,
                          }).pipe(
                            mergeMap((visibilityStatusAlwaysAndNeverDraw) => {
                              return from(this._idsCache.getCategoriesModeledElements(model, [category])).pipe(
                                getSubModeledElementsVisibilityStatus({
                                  tooltips: {
                                    visible: undefined,
                                    hidden: undefined,
                                    partial: undefined,
                                  },
                                  parentNodeVisibilityStatus: visibilityStatusAlwaysAndNeverDraw,
                                  ignoreTooltips: true,
                                  getModelVisibilityStatus: (modelProps) => this.getModelVisibilityStatus(modelProps),
                                }),
                              );
                            }),
                          );
                        }
                        return from(this._idsCache.getCategoriesModeledElements(model, [category])).pipe(
                          getSubModeledElementsVisibilityStatus({
                            tooltips: {
                              visible: undefined,
                              hidden: undefined,
                              partial: undefined,
                            },
                            parentNodeVisibilityStatus: createVisibilityStatus("hidden"),
                            ignoreTooltips: true,
                            getModelVisibilityStatus: (modelProps) => this.getModelVisibilityStatus(modelProps),
                          }),
                        );
                      }),
                      mergeVisibilityStatuses({ visible: undefined, hidden: undefined, partial: undefined }),
                    ),
                  ),
                  mergeVisibilityStatuses(
                    {
                      visible: "categoriesTree.category.allElementsVisible",
                      hidden: "categoriesTree.category.allElementsHidden",
                      partial: "categoriesTree.category.someElementsHidden",
                    },
                    ignoreTooltip,
                  ),
                );
              }),
              map((visibilityStatus) => {
                return { visibilityStatus, type: 0 as const };
              }),
            )
          : EMPTY,
        // get category status
        (props.modelId
          ? of(this.getDefaultModelsCategoryVisibilityStatus({ modelId: props.modelId, categoryIds: props.categoryIds, ignoreTooltip }))
          : from(this.getDefaultCategoryVisibilityStatus({ categoryIds: props.categoryIds, ignoreTooltip }))
        ).pipe(
          map((visibilityStatus) => {
            return { visibilityStatus, type: 1 as const };
          }),
        ),
      ).pipe(
        toArray(),
        mergeMap(
          async (
            visibilityStatusesInfo: Array<{ visibilityStatus: VisibilityStatus; type: 1 } | { visibilityStatus: VisibilityStatus | undefined; type: 0 }>,
          ) => {
            let defaultStatus: VisibilityStatus | undefined;
            let alwaysNeverDrawStatus: VisibilityStatus | undefined;
            visibilityStatusesInfo.forEach((visibilityStatusInfo) => {
              switch (visibilityStatusInfo.type) {
                case 0:
                  alwaysNeverDrawStatus = visibilityStatusInfo.visibilityStatus;
                  break;
                case 1:
                  defaultStatus = visibilityStatusInfo.visibilityStatus;
                  break;
              }
            });
            assert(defaultStatus !== undefined);

            if (defaultStatus.state === "partial") {
              return defaultStatus;
            }

            // This can happen if:
            // a) showElements is set to false
            // b) root category does not have any elements (that dont have Parent)
            // In both cases we don't need to look at modeled elements visibility
            if (alwaysNeverDrawStatus === undefined) {
              return defaultStatus;
            }
            // In cases where
            // a) SubCategories are hidden
            // b) Category needs to ignore subCategories
            // c) Category has model (it means that category is under hidden subModel)
            // We dont need to look at default category status, it is already accounted for in always/never drawn visibility
            if (this._props.hierarchyConfig.hideSubCategories || props.ignoreSubCategories || props.modelId) {
              return alwaysNeverDrawStatus;
            }
            if ((await this._idsCache.getSubCategories(props.categoryIds)).size === 0) {
              return alwaysNeverDrawStatus;
            }

            if (alwaysNeverDrawStatus.state === "partial") {
              return createVisibilityStatus("partial", getTooltipOptions("categoriesTree.category.someChildrenVisible", ignoreTooltip));
            }
            if (alwaysNeverDrawStatus.state === "hidden") {
              if (defaultStatus.state === "hidden") {
                return createVisibilityStatus("hidden", getTooltipOptions("categoriesTree.category.allChildrenHidden", ignoreTooltip));
              }
              return createVisibilityStatus("partial", getTooltipOptions("categoriesTree.category.partialThroughSubCategories", ignoreTooltip));
            }
            if (defaultStatus.state === "hidden") {
              return createVisibilityStatus("partial", getTooltipOptions("categoriesTree.category.someChildrenVisible", ignoreTooltip));
            }
            return createVisibilityStatus("visible", getTooltipOptions("categoriesTree.category.allChildrenVisible", ignoreTooltip));
          },
        ),
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private getClassGroupingNodeDisplayStatus(node: GroupingHierarchyNode): Observable<VisibilityStatus> {
    const result = defer(() => {
      const info = this.getGroupingNodeInfo(node);

      const { modelElementsMap, categoryId } = info;
      return from(modelElementsMap).pipe(
        mergeMap(([modelId, elementIds]) => {
          if (!this._props.viewport.view.viewsModel(modelId)) {
            return of([...elementIds]).pipe(
              filterSubModeledElementIds({ doesSubModelExist: async (id) => this._idsCache.hasSubModel(id) }),
              getSubModeledElementsVisibilityStatus({
                tooltips: {
                  visible: undefined,
                  hidden: undefined,
                  partial: undefined,
                },
                parentNodeVisibilityStatus: createVisibilityStatus("hidden"),
                getModelVisibilityStatus: (modelProps) => this.getModelVisibilityStatus(modelProps),
              }),
            );
          }
          return this.getVisibilityFromAlwaysAndNeverDrawnElements({
            elements: elementIds,
            defaultStatus: () => {
              const status = this.getDefaultModelsCategoryVisibilityStatus({ categoryIds: [categoryId], modelId, ignoreTooltip: true });
              return createVisibilityStatus(status.state, getTooltipOptions(`categoriesTree.groupingNode.${status.state}ThroughCategory`));
            },
            tooltips: {
              allElementsInAlwaysDrawnList: "categoriesTree.groupingNode.allElementsVisible",
              allElementsInNeverDrawnList: "categoriesTree.groupingNode.allElementsHidden",
              elementsInBothAlwaysAndNeverDrawn: "categoriesTree.groupingNode.someElementsAreHidden",
              noElementsInExclusiveAlwaysDrawnList: "categoriesTree.groupingNode.allElementsHidden",
            },
          }).pipe(
            mergeMap((visibilityStatusAlwaysAndNeverDraw) => {
              return of([...elementIds]).pipe(
                filterSubModeledElementIds({ doesSubModelExist: async (id) => this._idsCache.hasSubModel(id) }),
                getSubModeledElementsVisibilityStatus({
                  tooltips: {
                    visible: undefined,
                    hidden: undefined,
                    partial: undefined,
                  },
                  parentNodeVisibilityStatus: visibilityStatusAlwaysAndNeverDraw,
                  getModelVisibilityStatus: (modelProps) => this.getModelVisibilityStatus(modelProps),
                }),
              );
            }),
          );
        }),
        mergeVisibilityStatuses(
          {
            visible: undefined,
            hidden: undefined,
            partial: undefined,
          },
          true,
        ),
      );
    });
    return createVisibilityHandlerResult(this, { node }, result, undefined);
  }

  private getElementDisplayStatus({
    ignoreTooltip,
    ...props
  }: GetGeometricElementVisibilityStatusProps & { ignoreTooltip?: boolean }): Observable<VisibilityStatus> {
    const result: Observable<VisibilityStatus> = defer(() => {
      const viewport = this._props.viewport;
      const { elementId, modelId, categoryId } = props;

      const viewsModel = viewport.view.viewsModel(modelId);
      const elementStatus = getElementOverriddenVisibility({
        elementId,
        ignoreTooltip,
        viewport,
        tooltips: {
          visibileThorughAlwaysDrawn: "categoriesTree.element.displayedThroughAlwaysDrawnList",
          hiddenThroughAlwaysDrawnExclusive: "categoriesTree.element.hiddenDueToOtherElementsExclusivelyAlwaysDrawn",
          hiddenThroughNeverDrawn: "categoriesTree.element.hiddenThroughNeverDrawnList",
        },
      });

      return from(this._idsCache.hasSubModel(elementId)).pipe(
        mergeMap((hasSubModel) => (hasSubModel ? this.getModelVisibilityStatus({ modelId: elementId }) : of(undefined))),
        map((subModelVisibilityStatus) =>
          getElementVisibility(
            ignoreTooltip,
            viewsModel,
            elementStatus,
            this.getDefaultModelsCategoryVisibilityStatus({ categoryIds: [categoryId], modelId, ignoreTooltip: true }) as unknown as NonPartialVisibilityStatus,
            subModelVisibilityStatus,
          ),
        ),
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
      return this.changeElementGroupingNodeState(node, on);
    }

    if (!HierarchyNode.isInstancesNode(node)) {
      return EMPTY;
    }

    if (CategoriesTreeNode.isDefinitionContainerNode(node)) {
      return this.changeDefinitionContainerState({
        definitionContainerIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        on,
      });
    }

    if (CategoriesTreeNode.isCategoryNode(node)) {
      return this.changeCategoryState({
        categoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        modelId: CategoriesTreeNode.getModelId(node),
        on,
        ignoreSubCategories: node.extendedData?.isCategoryOfSubModel,
      });
    }

    const categoryId = CategoriesTreeNode.getCategoryId(node);
    if (!categoryId) {
      return EMPTY;
    }

    if (CategoriesTreeNode.isSubCategoryNode(node)) {
      if (this._props.hierarchyConfig.hideSubCategories) {
        return EMPTY;
      }
      return this.changeSubCategoryState({
        categoryId,
        subCategoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        on,
      });
    }

    if (!this._props.hierarchyConfig.showElements) {
      return EMPTY;
    }

    const modelId = CategoriesTreeNode.getModelId(node);
    if (!modelId) {
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
      mergeMap(({ definitionContainers, subCategories, models, categories, elements }) => {
        const observables = new Array<Observable<void>>();
        if (definitionContainers?.size) {
          observables.push(this.changeDefinitionContainerState({ definitionContainerIds: [...definitionContainers], on }));
        }

        if (models?.size) {
          observables.push(this.changeModelState({ ids: models, on }));
        }

        if (categories?.size) {
          observables.push(
            from(categories).pipe(
              mergeMap((key) => {
                const { modelId, categoryId } = parseCategoryKey(key);
                return this.changeCategoryState({ modelId, categoryIds: [categoryId], ignoreSubCategories: false, on });
              }),
            ),
          );
        }

        if (subCategories?.size) {
          observables.push(
            from(subCategories).pipe(
              mergeMap((key) => {
                const { subCategoryId, categoryId } = parseSubCategoryKey(key);
                return this.changeSubCategoryState({ categoryId, subCategoryIds: [subCategoryId], on });
              }),
            ),
          );
        }

        if (elements?.size) {
          observables.push(
            from(elements).pipe(
              mergeMap(([categoryKey, elementIds]) => {
                const { modelId, categoryId } = parseCategoryKey(categoryKey);
                assert(modelId !== undefined);
                return this.changeElementsState({ modelId, categoryId, elementIds, on });
              }),
            ),
          );
        }

        return merge(...observables);
      }),
    );
  }

  private changeModelState(props: ChangeModelVisibilityStateProps): Observable<void> {
    const { ids, on } = props;

    if (Id64.sizeOf(ids) === 0) {
      return EMPTY;
    }

    const result = defer(() => {
      const viewport = this._props.viewport;

      const idsObs = from(Id64.iterable(ids));
      if (!on) {
        viewport.changeModelDisplay(ids, false);
        return idsObs.pipe(
          mergeMap(async (modelId) => ({ modelId, categoryIds: await this._idsCache.getModelCategories(modelId) })),
          mergeMap(({ modelId, categoryIds }) => from(this._idsCache.getCategoriesModeledElements(modelId, categoryIds))),
          mergeMap((modeledElementIds) => this.changeModelState({ ids: modeledElementIds, on })),
        );
      }

      viewport.perModelCategoryVisibility.clearOverrides(ids);
      return concat(
        from(viewport.addViewedModels(ids)),
        idsObs.pipe(
          mergeMap((modelId) => {
            return from(this._idsCache.getModelCategories(modelId)).pipe(
              concatAll(),
              mergeMap((categoryId) => this.changeCategoryState({ categoryIds: [categoryId], modelId, on: true, ignoreSubCategories: true })),
            );
          }),
        ),
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private showModelWithoutAnyCategoriesOrElements(modelId: Id64String): Observable<void> {
    const viewport = this._props.viewport;
    return forkJoin({
      categories: this._idsCache.getModelCategories(modelId),
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

  private changeSubCategoryState(props: { categoryId: Id64String; subCategoryIds: Id64Array; on: boolean }): Observable<void> {
    const result = defer(() => {
      return concat(
        // make sure parent category is enabled
        props.on ? from(enableCategoryDisplay(this._props.viewport, [props.categoryId], props.on, false)) : EMPTY,
        from(props.subCategoryIds).pipe(map((subCategoryId) => enableSubCategoryDisplay(this._props.viewport, subCategoryId, props.on))),
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private changeDefinitionContainerState(props: { definitionContainerIds: Id64Array; on: boolean }): Observable<void> {
    const result = defer(() => {
      return from(this._idsCache.getAllContainedCategories(props.definitionContainerIds)).pipe(
        mergeMap((categoryIds) => {
          return this.changeCategoryState({ categoryIds, ignoreSubCategories: false, on: props.on });
        }),
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private changeCategoryState(props: ChangeCategoryVisibilityStateProps): Observable<void> {
    const result = defer(() => {
      const viewport = this._props.viewport;
      if (!this._props.hierarchyConfig.showElements) {
        return from(enableCategoryDisplay(viewport, props.categoryIds, props.on, props.on));
      }
      const { modelId, categoryIds, on } = props;
      const modelIdsObservable = modelId
        ? of(new Map(categoryIds.map((id) => [id, [modelId]])))
        : from(this._idsCache.getCategoriesElementModels(categoryIds, true));
      return concat(
        props.on
          ? modelIdsObservable.pipe(
              mergeMap((categoriesMap) => from(categoriesMap.values())),
              map((modelIds) => {
                for (const modelIdToCheck of modelIds) {
                  if (!viewport.view.viewsModel(modelIdToCheck)) {
                    this.showModelWithoutAnyCategoriesOrElements(modelIdToCheck);
                  }
                }
              }),
            )
          : EMPTY,
        modelIdsObservable.pipe(
          mergeMap((categoriesMap) => from(categoriesMap.entries())),
          mergeMap(([categoryId, modelIds]) => {
            return from(modelIds).pipe(
              mergeMap((modelOfCategory) => {
                this.changeCategoryStateInViewportAccordingToModelVisibility(modelOfCategory, categoryId, on);
                return this._alwaysAndNeverDrawnElements.clearAlwaysAndNeverDrawnElements({ modelId: modelOfCategory, categoryIds: [categoryId] });
              }),
            );
          }),
        ),
        modelIdsObservable.pipe(
          mergeMap((categoriesMap) => from(categoriesMap.entries())),
          mergeMap(([categoryId, modelIds]) => {
            return from(modelIds).pipe(
              mergeMap((modelOfCategory) =>
                from(this._idsCache.getCategoriesModeledElements(modelOfCategory, [categoryId])).pipe(
                  mergeMap((modeledElementIds) => this.changeModelState({ ids: modeledElementIds, on })),
                ),
              ),
            );
          }),
        ),
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private doChangeElementsState(props: ChangeGeometricElementsDisplayStateProps): Observable<void | undefined> {
    return defer(() => {
      const { modelId, categoryId, elementIds, on } = props;
      const viewport = this._props.viewport;
      return concat(
        on && !viewport.view.viewsModel(modelId) ? this.showModelWithoutAnyCategoriesOrElements(modelId) : EMPTY,
        defer(() => {
          const categoryVisibility = this.getDefaultModelsCategoryVisibilityStatus({ categoryIds: [categoryId], modelId, ignoreTooltip: true });
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
    const info = this.getGroupingNodeInfo(node);
    const result = from(info.modelElementsMap).pipe(
      mergeMap(([modelId, elementIds]) => {
        return this.doChangeElementsState({ modelId, elementIds, categoryId: info.categoryId, on });
      }),
    );
    return createVisibilityHandlerResult(this, { node, on }, result, undefined);
  }

  /**
   * Updates visibility of an element and all its child elements by adding them to the always/never drawn list.
   * @note If element is to be enabled and model is hidden, it will be enabled.
   */
  private changeElementsState(props: ChangeGeometricElementsDisplayStateProps): Observable<void> {
    const result = this.doChangeElementsState(props);
    return createVisibilityHandlerResult(this, props, result, undefined);
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

  private getVisibilityFromAlwaysAndNeverDrawnElements({
    ignoreTooltip,
    ...props
  }: GetVisibilityFromAlwaysAndNeverDrawnElementsProps &
    ({ elements: Id64Set } | { queryProps: CategoryAlwaysOrNeverDrawnElementsQueryProps }) & { ignoreTooltip?: boolean }): Observable<VisibilityStatus> {
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
        getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
          ...props,
          alwaysDrawn: viewport.alwaysDrawn?.size ? setIntersection(props.elements, viewport.alwaysDrawn) : undefined,
          neverDrawn: viewport.neverDrawn?.size ? setIntersection(props.elements, viewport.neverDrawn) : undefined,
          totalCount: props.elements.size,
          ignoreTooltip,
          viewport,
        }),
      );
    }
    const { modelId, categoryIds } = props.queryProps;

    const totalCount = (
      modelId ? of(new Map(categoryIds.map((categoryId) => [categoryId, [modelId]]))) : from(this._idsCache.getCategoriesElementModels(categoryIds))
    ).pipe(
      mergeMap((categoriesMap) => from(categoriesMap)),
      mergeMap(([categoryId, modelIds]) => {
        return from(modelIds).pipe(
          mergeMap((modelOfCategory) => from(this._idsCache.getCategoryElementsCount(modelOfCategory, categoryId))),
          reduce((acc, specificModelCategoryCount) => {
            return acc + specificModelCategoryCount;
          }, 0),
        );
      }),
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
          ignoreTooltip,
          viewport,
        });
      }),
    );
  }

  private getGroupingNodeInfo(node: GroupingHierarchyNode) {
    const modelElementsMap: Map<Id64String, Id64Set> = node.extendedData?.modelElementsMap;
    const categoryId = node.extendedData?.categoryId;
    assert(!!modelElementsMap && !!categoryId);

    return { modelElementsMap, categoryId };
  }
}

/**
 * Enables display of all given models. Also clears always and
 * never drawn lists in the viewport.
 * @public
 */
export async function showAllModelsCategoriesTree(models: string[], viewport: Viewport) {
  await viewport.addViewedModels(models);
  viewport.clearNeverDrawn();
  viewport.clearAlwaysDrawn();
}
