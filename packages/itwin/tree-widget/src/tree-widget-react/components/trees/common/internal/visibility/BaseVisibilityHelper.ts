/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  concatAll,
  defaultIfEmpty,
  defer,
  EMPTY,
  filter,
  forkJoin,
  from,
  map,
  merge,
  mergeAll,
  mergeMap,
  of,
  reduce,
  shareReplay,
  startWith,
  Subject,
  take,
  takeLast,
  takeUntil,
  tap,
  toArray,
} from "rxjs";
import { assert, Id64 } from "@itwin/core-bentley";
import { subscribeAll } from "../Rxjs.js";
import { createVisibilityStatus } from "../Tooltip.js";
import { countInSet, fromWithRelease, getId64Spreadable, getOrCreate, releaseMainThreadOnItemsCount, setDifference } from "../Utils.js";
import { changeElementStateNoChildrenOperator, getCategoryVisibilityFromAlwaysAndNeverDrawnElementsImpl, mergeVisibilityStatuses } from "../VisibilityUtils.js";

import type { Observable, Subscription } from "rxjs";
import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { TreeWidgetViewport } from "../../TreeWidgetViewport.js";
import type { HierarchyVisibilityHandlerOverridableMethod, HierarchyVisibilityOverrideHandler, VisibilityStatus } from "../../UseHierarchyVisibility.js";
import type { AlwaysAndNeverDrawnElementInfoCache } from "../caches/AlwaysAndNeverDrawnElementInfoCache.js";
import type { BaseIdsCacheImpl } from "../caches/BaseIdsCache.js";
import type { NonPartialVisibilityStatus } from "../Tooltip.js";
import type { CategoryId, ElementId, ModelId } from "../Types.js";

/**
 * Functionality of tree visibility handler methods that can be overridden.
 * Each callback is provided original implementation and reference to a `HierarchyVisibilityHandler`.
 * @beta
 */
export interface BaseTreeVisibilityHandlerOverrides {
  getModelsVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: { modelIds: Id64Arg }) => Promise<VisibilityStatus>>;
  getCategoriesVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<
    (props: { categoryIds: Id64Arg; modelId?: Id64String }) => Promise<VisibilityStatus>
  >;
  getElementsVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<
    (props: { elementIds: Id64Arg; modelId: Id64String; categoryId: Id64String }) => Promise<VisibilityStatus>
  >;

  changeModelsVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: { modelIds: Id64Arg; on: boolean }) => Promise<void>>;
  changeCategoriesVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<
    (props: { categoryIds: Id64Arg; modelId?: Id64String; on: boolean }) => Promise<void>
  >;
  changeElementsVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<
    (props: { elementIds: Id64Arg; modelId: Id64String; categoryId: Id64String; on: boolean }) => Promise<void>
  >;
}

/**
 * Interface for a tree visibility handler that provides methods to get and change visibility status of hierarchy nodes.
 * @internal
 */
export interface TreeSpecificVisibilityHandler<TSearchTargets> {
  getVisibilityStatus: (node: HierarchyNode) => Observable<VisibilityStatus>;
  changeVisibilityStatus: (node: HierarchyNode, on: boolean) => Observable<void>;
  getSearchTargetsVisibilityStatus: (targets: TSearchTargets) => Observable<VisibilityStatus>;
  changeSearchTargetsVisibilityStatus: (targets: TSearchTargets, on: boolean) => Observable<void>;
}

/** @internal */
export interface BaseVisibilityHelperProps {
  viewport: TreeWidgetViewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfoCache;
  overrideHandler?: HierarchyVisibilityOverrideHandler;
  overrides?: BaseTreeVisibilityHandlerOverrides;
  baseIdsCache: BaseIdsCacheImpl;
}

/**
 * Base class for visibility status getters and modifiers.
 *
 * It provides methods that help retrieve and change visibility status of models, categories, elements.
 * @internal
 */
export class BaseVisibilityHelper implements Disposable {
  readonly #props: BaseVisibilityHelperProps;
  readonly #alwaysAndNeverDrawnElements: AlwaysAndNeverDrawnElementInfoCache;
  #elementChangeQueue = new Subject<Observable<void>>();
  #subscriptions: Subscription[] = [];

  constructor(props: BaseVisibilityHelperProps) {
    this.#props = props;
    this.#alwaysAndNeverDrawnElements = this.#props.alwaysAndNeverDrawnElementInfo;
    this.#subscriptions.push(this.#elementChangeQueue.pipe(concatAll()).subscribe());
  }

  public [Symbol.dispose]() {
    this.#subscriptions.forEach((x) => x.unsubscribe());
  }

  /**
   * Removes "always drawn exclusive" mode from the viewport without affecting any visibilities.
   *
   * This is achieved by:
   * - Resets `alwaysDrawn` exclusive flag to `false`;
   * - Turns off all categories;
   * - Clears never drawn list;
   * - Removes all per-model category overrides. */
  public removeAlwaysDrawnExclusive(): Observable<void> {
    return from(this.#props.baseIdsCache.getAllCategoriesOfElements()).pipe(
      map((categories) => {
        if (categories.size) {
          this.#props.viewport.changeCategoryDisplay({ categoryIds: categories, display: false, enableAllSubCategories: false });
        }
        this.#props.viewport.clearNeverDrawn();
        this.#props.viewport.clearPerModelCategoryOverrides();
        this.#props.viewport.setAlwaysDrawn({ elementIds: this.#props.viewport.alwaysDrawn ? new Set([...this.#props.viewport.alwaysDrawn]) : new Set() });
      }),
    );
  }

  /**
   * Returns visibility status of models.
   *
   * Determines visibility status by checking:
   * - Models visibility in the viewport;
   * - Models' subModels visibility (if elements' modelId is in the provided modelIds, and element is itself a model, then it is considered a subModel);
   * - Categories visibility in the viewport (if elements' modelId is in the provided modelIds, then its' category gets checked).
   */
  public getModelsVisibilityStatus(props: { modelIds: Id64Arg }): Observable<VisibilityStatus> {
    const result = defer(() => {
      if (Id64.sizeOf(props.modelIds) === 0) {
        return EMPTY;
      }
      const { modelIds } = props;
      return merge(
        from(Id64.iterable(modelIds)).pipe(
          mergeMap((modelId) => this.#props.baseIdsCache.getSubModels({ modelId })),
          toArray(),
          mergeMap((subModels) => this.getModelsVisibilityStatus({ modelIds: subModels })),
        ),
        from(Id64.iterable(modelIds)).pipe(
          mergeMap((modelId) => {
            // For hidden models we only need to check subModels
            if (!this.#props.viewport.viewsModel(modelId)) {
              return of(createVisibilityStatus("hidden"));
            }
            // For visible models we need to check all categories.
            // Only need to take top-most categories, they take into account all descendants.
            return this.#props.baseIdsCache.getCategories({ modelId, includeOnlyIfCategoryOfTopMostElement: true }).pipe(
              mergeMap((categories) => {
                if (categories.size === 0) {
                  return EMPTY;
                }
                return fromWithRelease({ source: categories, releaseOnCount: 100 });
              }),
              mergeMap((categoryId) =>
                this.getCategoryVisibilityFromAlwaysAndNeverDrawnElements({
                  modelId,
                  categoryId,
                }),
              ),
              defaultIfEmpty(createVisibilityStatus("visible")),
            );
          }),
        ),
      ).pipe(mergeVisibilityStatuses());
    });
    return this.#props.overrideHandler
      ? this.#props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: { modelIds: props.modelIds },
          nonOverriddenResult: result,
          override: this.#props.overrides?.getModelsVisibilityStatus,
        })
      : result;
  }

  /**
   * Gets visibility status of sub-categories.
   *
   * Determines visibility status by checking:
   * - Category selector visibility in the viewport.
   * - Sub-categories visibility in the viewport.
   */
  public getSubCategoriesVisibilityStatus(props: { subCategoryIds: Id64Arg; categoryId: Id64String }): Observable<VisibilityStatus> {
    if (Id64.sizeOf(props.subCategoryIds) === 0) {
      return EMPTY;
    }
    if (!this.#props.viewport.viewsCategory(props.categoryId)) {
      return of(createVisibilityStatus("hidden"));
    }

    let subCategoryVisibility: "visible" | "hidden" | "unknown" = "unknown";
    for (const subCategoryId of Id64.iterable(props.subCategoryIds)) {
      const isSubCategoryVisible = this.#props.viewport.viewsSubCategory(subCategoryId);
      if (isSubCategoryVisible && subCategoryVisibility === "hidden") {
        return of(createVisibilityStatus("partial"));
      }
      if (!isSubCategoryVisible && subCategoryVisibility === "visible") {
        return of(createVisibilityStatus("partial"));
      }
      subCategoryVisibility = isSubCategoryVisible ? "visible" : "hidden";
    }
    assert(subCategoryVisibility !== "unknown");
    return of(createVisibilityStatus(subCategoryVisibility));
  }

  /**
   * Gets visibility status of categories.
   *
   * Determines visibility status by checking:
   * - Categories visibility;
   * - Visibility of models that are related to the categories;
   * - sub-categories visibility.
   */
  public getCategoriesVisibilityStatus(props: {
    categoryIds: Id64Arg;
    modelId: Id64String | undefined;
    ignoreSubCategories?: boolean;
  }): Observable<VisibilityStatus> {
    const result = defer(() => {
      const { categoryIds, modelId: modelIdFromProps } = props;
      if (modelIdFromProps) {
        return this.getModelWithCategoriesVisibilityStatus({
          modelId: modelIdFromProps,
          categoryIds: Id64.toIdSet(categoryIds),
        });
      }

      const subCategoriesVisibilityStatus = props.ignoreSubCategories
        ? EMPTY
        : fromWithRelease({ source: categoryIds, releaseOnCount: 100 }).pipe(
            mergeMap((categoryId) =>
              this.#props.baseIdsCache
                .getSubCategories({ categoryId })
                .pipe(mergeMap((subCategoryIds) => this.getSubCategoriesVisibilityStatus({ categoryId, subCategoryIds }))),
            ),
          );

      const categoryModelsObservable = fromWithRelease({ source: categoryIds, releaseOnCount: 100 }).pipe(
        mergeMap((categoryId) =>
          this.#props.baseIdsCache.getModels({ categoryId }).pipe(
            filter(({ categoryIsOfTopMostElement, isSubModel }) => categoryIsOfTopMostElement && !isSubModel),
            map(({ id: modelId }) => ({ modelId, categoryId })),
          ),
        ),
        shareReplay({ refCount: true }),
      );

      const categorySubModelsVisibilityStatus = categoryModelsObservable.pipe(
        mergeMap(({ modelId, categoryId }) =>
          this.#props.baseIdsCache.hasSubModels({ modelId }).pipe(
            mergeMap((hasSubModels) => {
              if (!hasSubModels) {
                return EMPTY;
              }
              return this.#props.baseIdsCache.getSubModels({
                modelId,
                categoryId,
              });
            }),
          ),
        ),
        toArray(),
        mergeMap((subModels) => (subModels.length > 0 ? this.getModelsVisibilityStatus({ modelIds: subModels }) : EMPTY)),
      );
      const categoryAlwaysAndNeverDrawnVisibilityStatus = categoryModelsObservable.pipe(
        mergeMap(({ modelId, categoryId }) =>
          this.#props.viewport.viewsModel(modelId)
            ? this.getCategoryVisibilityFromAlwaysAndNeverDrawnElements({
                modelId,
                categoryId,
              })
            : of(createVisibilityStatus("hidden")),
        ),
      );
      const getEmptyCategoryVisibilityStatus = () => {
        let isVisible = true;
        for (const categoryId of Id64.iterable(categoryIds)) {
          if (this.#props.viewport.viewsCategory(categoryId)) {
            if (!isVisible) {
              return "partial";
            }
            continue;
          }
          isVisible = false;
        }
        return isVisible ? "visible" : "hidden";
      };
      return merge(subCategoriesVisibilityStatus, categorySubModelsVisibilityStatus, categoryAlwaysAndNeverDrawnVisibilityStatus).pipe(
        mergeVisibilityStatuses(),
        defaultIfEmpty(createVisibilityStatus(!this.#props.viewport.isAlwaysDrawnExclusive ? getEmptyCategoryVisibilityStatus() : "hidden")),
      );
    });

    return this.#props.overrideHandler
      ? this.#props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: props,
          nonOverriddenResult: result,
          override: this.#props.overrides?.getCategoriesVisibilityStatus,
        })
      : result;
  }

  /**
   * Gets visibility status of a model's category.
   *
   * Determines visibility status by checking:
   * - Elements in the viewports' always/never drawn lists;
   * - Default categories visibility status in the viewport;
   * - SubModels that are related to the modelId and categoryId.
   */
  private getModelWithCategoriesVisibilityStatus({ modelId, categoryIds }: { modelId: Id64String; categoryIds: Id64Set }): Observable<VisibilityStatus> {
    const modelVisibilityStatus = this.#props.viewport.viewsModel(modelId)
      ? // For visible model need to check category and always/never drawn elements
        fromWithRelease({ source: categoryIds, releaseOnCount: 100 }).pipe(
          mergeMap((categoryId) =>
            this.getCategoryVisibilityFromAlwaysAndNeverDrawnElements({
              modelId,
              categoryId,
            }),
          ),
        )
      : of(createVisibilityStatus("hidden"));

    const subModelsVisibilityStatus = fromWithRelease({ source: categoryIds, releaseOnCount: 100 }).pipe(
      mergeMap((categoryId) => this.#props.baseIdsCache.getSubModels({ modelId, categoryId })),
      toArray(),
      mergeMap((subModels) => this.getModelsVisibilityStatus({ modelIds: subModels })),
    );

    return merge(modelVisibilityStatus, subModelsVisibilityStatus).pipe(mergeVisibilityStatuses());
  }

  /**
   * Gets visibility status of category, assuming model is visible.
   *
   * Determines visibility status by checking:
   * - Per model category visibility overrides;
   * - Category selector visibility in the viewport.
   * - Always drawn exclusive flag.
   */
  public getVisibleModelCategoryDirectVisibilityStatus({ modelId, categoryId }: { categoryId: Id64String; modelId: Id64String }): NonPartialVisibilityStatus {
    if (this.#props.viewport.isAlwaysDrawnExclusive) {
      return createVisibilityStatus("hidden");
    }
    const override = this.#props.viewport.getPerModelCategoryOverride({ modelId, categoryId });
    if (override === "show" || (override === "none" && this.#props.viewport.viewsCategory(categoryId))) {
      return createVisibilityStatus("visible");
    }
    return createVisibilityStatus("hidden");
  }

  /**
   * Gets visibility status of elements.
   *
   * Determines visibility status by checking:
   * - Elements in the viewports' always/never drawn lists;
   * - Related categories and models visibility status;
   * - Descendant elements grouped by their actual categories;
   * - Sub-models that are related to the specified elements.
   */
  public getElementsVisibilityStatus(
    props: {
      elementIds: Id64Arg;
      modelId: Id64String;
      categoryId: Id64String;
    } & (
      | { computeOnlyOwnStatus: true }
      | { computeOnlyOwnStatus?: (elementId: Id64String) => boolean; categoryOfTopMostParentElement: CategoryId; parentElementsIdsPath: Array<Id64Arg> }
    ),
  ): Observable<VisibilityStatus> {
    const result = defer(() => {
      const { elementIds, modelId, categoryId, computeOnlyOwnStatus } = props;
      // Compute element's own visibility
      const elementsOwnStatus = this.getElementsOwnVisibilityStatus({ elementIds, modelId, categoryId });
      if (computeOnlyOwnStatus === true) {
        return elementsOwnStatus;
      }

      const subModelsVisibilityStatus = this.#props.baseIdsCache.hasSubModels({ modelId }).pipe(
        mergeMap((hasSubModels) => {
          if (!hasSubModels) {
            return EMPTY;
          }
          return fromWithRelease({ source: elementIds, releaseOnCount: 100 }).pipe(
            mergeMap((elementId) => (computeOnlyOwnStatus?.(elementId) ? EMPTY : this.#props.baseIdsCache.getSubModelsUnderElement(elementId))),
            mergeMap((subModelsUnderElement) => this.getModelsVisibilityStatus({ modelIds: subModelsUnderElement })),
          );
        }),
      );

      const descendantsVisibilityStatus = this.getDescendantsVisibilityStatus({
        elementIds,
        modelId,
        categoryOfTopMostParentElement: props.categoryOfTopMostParentElement,
        // For descendants path includes elementIds
        parentElementIdsPath: [...props.parentElementsIdsPath, elementIds],
        computeOnlyOwnStatus,
      });

      return merge(elementsOwnStatus, descendantsVisibilityStatus, subModelsVisibilityStatus).pipe(mergeVisibilityStatuses());
    });

    return this.#props.overrideHandler
      ? this.#props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: props,
          nonOverriddenResult: result,
          override: this.#props.overrides?.getElementsVisibilityStatus,
        })
      : result;
  }

  /** Computes only the element's own visibility (without descendants). */
  public getElementsOwnVisibilityStatus(props: { elementIds: Id64Arg; modelId: Id64String; categoryId: Id64String }): Observable<VisibilityStatus> {
    const { elementIds, modelId, categoryId } = props;
    if (!this.#props.viewport.viewsModel(modelId)) {
      return of(createVisibilityStatus("hidden"));
    }
    const defaultStatus = this.getVisibleModelCategoryDirectVisibilityStatus({ categoryId, modelId });
    const oppositeSet = defaultStatus.state === "visible" ? this.#props.viewport.neverDrawn : this.#props.viewport.alwaysDrawn;
    if (!oppositeSet?.size) {
      return of(defaultStatus);
    }
    return of(
      getCategoryVisibilityFromAlwaysAndNeverDrawnElementsImpl({
        defaultStatus,
        numberOfElementsInOppositeSet: countInSet(elementIds, oppositeSet),
        totalCount: Id64.sizeOf(elementIds),
      }),
    );
  }

  /**
   * Gets visibility status of descendants by:
   * 1. Retrieves counts of descendant elements grouped by their actual categories;
   * 2. Groups categories into visible/hidden based on per-model category overrides and category selector;
   * 3. For visible categories, retrieves never-drawn descendants; for hidden categories, retrieves always-drawn descendants;
   * 4. Computes visibility status per group based on total count and number of elements in opposite set.
   */
  private getDescendantsVisibilityStatus(props: {
    elementIds: Id64Arg;
    modelId: Id64String;
    categoryOfTopMostParentElement: CategoryId;
    parentElementIdsPath: Array<Id64Arg>;
    computeOnlyOwnStatus?: (elementId: Id64String) => boolean;
  }): Observable<VisibilityStatus> {
    const { elementIds, modelId, categoryOfTopMostParentElement, parentElementIdsPath } = props;
    if (!this.#props.viewport.viewsModel(modelId)) {
      return of(createVisibilityStatus("hidden"));
    }
    const descendantsCounts = fromWithRelease({ source: elementIds, releaseOnCount: 500 }).pipe(
      mergeMap((elementId) =>
        props.computeOnlyOwnStatus?.(elementId) ? EMPTY : this.#props.baseIdsCache.getDescendantsCounts({ parentElementId: elementId, modelId }),
      ),
    );
    return this.getVisibilityFromGroupedDescendants({
      modelId,
      descendantsCounts,
      categoryIds: categoryOfTopMostParentElement,
      parentElementIdsPath,
    });
  }

  /**
   * Gets visibility status of a category based on viewport's always/never drawn elements.
   * Groups descendant elements by their actual categories, checks which categories are
   * visible/hidden, then queries always/never drawn per group to compute overall status.
   */
  private getCategoryVisibilityFromAlwaysAndNeverDrawnElements(props: { modelId: Id64String; categoryId: Id64String }): Observable<VisibilityStatus> {
    return this.#props.baseIdsCache.categoryHasParentElements(props.categoryId).pipe(
      mergeMap((hasParentElements) => {
        if (!hasParentElements) {
          const categoryVisibility = this.getVisibleModelCategoryDirectVisibilityStatus({ modelId: props.modelId, categoryId: props.categoryId });
          const oppositeSet = categoryVisibility.state === "visible" ? this.#props.viewport.neverDrawn : this.#props.viewport.alwaysDrawn;
          if (!oppositeSet?.size) {
            return of(categoryVisibility);
          }
        }
        return this.getVisibilityFromGroupedDescendants({
          modelId: props.modelId,
          descendantsCounts: this.#props.baseIdsCache.getDescendantsCounts({ modelId: props.modelId, categoryId: props.categoryId }),
          categoryIds: props.categoryId,
        });
      }),
    );
  }

  /**
   * Shared logic for computing visibility from per-category descendant counts.
   * 1. Accumulates counts grouped into visible/hidden categories;
   * 2. For visible categories, retrieves never-drawn descendants; for hidden, retrieves always-drawn;
   * 3. Computes visibility status per group and emits each.
   */
  private getVisibilityFromGroupedDescendants(props: {
    modelId: Id64String;
    descendantsCounts: Observable<Array<{ categoryId: CategoryId; count: number }>>;
    categoryIds: Id64Arg;
    parentElementIdsPath?: Array<Id64Arg>;
  }): Observable<VisibilityStatus> {
    const { modelId, categoryIds, parentElementIdsPath } = props;
    return props.descendantsCounts.pipe(
      reduce(
        (acc, descendantsCounts) => {
          for (const { categoryId, count } of descendantsCounts) {
            if (acc.visibleCategories.has(categoryId)) {
              acc.visibleCategoriesDescendantsCount += count;
              continue;
            }
            if (acc.hiddenCategories.has(categoryId)) {
              acc.hiddenCategoriesDescendantsCount += count;
              continue;
            }
            if (this.getVisibleModelCategoryDirectVisibilityStatus({ categoryId, modelId }).state === "visible") {
              acc.visibleCategoriesDescendantsCount += count;
              acc.visibleCategories.add(categoryId);
            } else {
              acc.hiddenCategoriesDescendantsCount += count;
              acc.hiddenCategories.add(categoryId);
            }
          }
          return acc;
        },
        {
          visibleCategoriesDescendantsCount: 0,
          hiddenCategoriesDescendantsCount: 0,
          visibleCategories: new Set<CategoryId>(),
          hiddenCategories: new Set<CategoryId>(),
        },
      ),
      mergeMap(({ hiddenCategories, visibleCategories, visibleCategoriesDescendantsCount, hiddenCategoriesDescendantsCount }) => {
        return merge(
          visibleCategories.size > 0
            ? this.#alwaysAndNeverDrawnElements
                .getAlwaysOrNeverDrawnElements({
                  modelId,
                  parentElementIdsPath,
                  categoryIds,
                  setType: "never",
                  childCategoryIds: visibleCategories,
                })
                .pipe(
                  map((elementsInOppositeSet) =>
                    getCategoryVisibilityFromAlwaysAndNeverDrawnElementsImpl({
                      defaultStatus: createVisibilityStatus("visible"),
                      numberOfElementsInOppositeSet: elementsInOppositeSet.size,
                      totalCount: visibleCategoriesDescendantsCount,
                    }),
                  ),
                )
            : EMPTY,
          hiddenCategories.size > 0
            ? this.#alwaysAndNeverDrawnElements
                .getAlwaysOrNeverDrawnElements({
                  modelId,
                  parentElementIdsPath,
                  categoryIds,
                  setType: "always",
                  childCategoryIds: hiddenCategories,
                })
                .pipe(
                  map((elementsInOppositeSet) =>
                    getCategoryVisibilityFromAlwaysAndNeverDrawnElementsImpl({
                      defaultStatus: createVisibilityStatus("hidden"),
                      numberOfElementsInOppositeSet: elementsInOppositeSet.size,
                      totalCount: hiddenCategoriesDescendantsCount,
                    }),
                  ),
                )
            : EMPTY,
        );
      }),
    );
  }

  /**
   * Changes visibility status of models.
   *
   * Also, changes visibility status of related categories and sub-models.
   */
  public changeModelsVisibilityStatus(props: { modelIds: Id64Arg; on: boolean }): Observable<void> {
    const result = defer(() => {
      const { modelIds, on } = props;

      if (Id64.sizeOf(modelIds) === 0) {
        return EMPTY;
      }

      this.#props.viewport.clearPerModelCategoryOverrides({ modelIds });
      if (!on) {
        this.#props.viewport.changeModelDisplay({ modelIds, display: false });
        return from(Id64.iterable(modelIds)).pipe(
          mergeMap((modelId) => this.#props.baseIdsCache.getSubModels({ modelId })),
          toArray(),
          mergeMap((subModels) => this.changeModelsVisibilityStatus({ modelIds: subModels, on })),
        );
      }

      this.#props.viewport.changeModelDisplay({ modelIds, display: true });
      return from(Id64.iterable(modelIds)).pipe(
        mergeMap((modelId) =>
          forkJoin({ categoryIds: this.#props.baseIdsCache.getCategories({ modelId, includeOnlyIfCategoryOfTopMostElement: true }), modelId: of(modelId) }),
        ),
        mergeMap(({ categoryIds, modelId }) => this.changeCategoriesVisibilityStatus({ categoryIds, modelId, on })),
      );
    });
    return this.#props.overrideHandler
      ? this.#props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: props,
          nonOverriddenResult: result,
          override: this.#props.overrides?.changeModelsVisibilityStatus,
        })
      : result;
  }

  /** Turns model on and turns off elements with categories related to that model. */
  private showModelWithoutAnyCategoriesOrElements({
    modelId,
    categoriesToNotOverride,
  }: {
    modelId: Id64String;
    categoriesToNotOverride?: Id64Set;
  }): Observable<void> {
    return forkJoin({
      allModelCategories: this.#props.baseIdsCache.getCategories({ modelId }),
      modelAlwaysDrawnElements: this.#alwaysAndNeverDrawnElements.getAlwaysOrNeverDrawnElements({ modelId, setType: "always" }),
    }).pipe(
      map(({ allModelCategories, modelAlwaysDrawnElements }) => {
        if (this.#props.viewport.viewsModel(modelId)) {
          // Model might have been turned on while completing forkJoin, if that happens, no need to do anything, just return.
          return;
        }
        const alwaysDrawn = this.#props.viewport.alwaysDrawn;
        if (alwaysDrawn && modelAlwaysDrawnElements) {
          this.#props.viewport.setAlwaysDrawn({ elementIds: setDifference(alwaysDrawn, modelAlwaysDrawnElements) });
        }
        this.#props.viewport.changeModelDisplay({ modelIds: modelId, display: true });
        const toHide = new Array<Id64String>();
        const toNone = new Array<Id64String>();
        for (const categoryId of allModelCategories) {
          if (categoriesToNotOverride?.has(categoryId)) {
            continue;
          }
          if (this.#props.viewport.viewsCategory(categoryId)) {
            toHide.push(categoryId);
          } else {
            toNone.push(categoryId);
          }
        }
        if (toHide.length > 0) {
          this.#props.viewport.setPerModelCategoryOverride({ modelIds: modelId, categoryIds: toHide, override: "hide" });
        }
        if (toNone.length > 0) {
          this.#props.viewport.setPerModelCategoryOverride({ modelIds: modelId, categoryIds: toNone, override: "none" });
        }
      }),
    );
  }
  /**
   * Changes categories visibility status.
   *
   * - Changes category selector for specified categories
   * - Removes per-model category overrides
   * - Clears always and never drawn elements related to those categories
   * - Changes sub-models visibility status that are related to specified categories.
   * - If `on` is set to true:
   *   - Turns on models of those categories without affecting any visibilities
   *   - Turns on sub-categories visibility status of specified categories.
   */
  public changeCategoriesVisibilityStatus(props: { categoryIds: Id64Arg; on: boolean; modelId: Id64String | undefined }): Observable<void> {
    const result = defer(() => {
      const { categoryIds, on } = props;
      if (Id64.sizeOf(categoryIds) === 0) {
        return EMPTY;
      }
      if (props.modelId) {
        return this.changeCategoriesUnderModelVisibilityStatus({ categoryIds, modelId: props.modelId, on });
      }
      this.#props.viewport.changeCategoryDisplay({ categoryIds, display: on, enableAllSubCategories: false });

      const categoryModelsObs = fromWithRelease({ source: categoryIds, releaseOnCount: 500 }).pipe(
        mergeMap((categoryId) =>
          this.#props.baseIdsCache.getModels({ categoryId }).pipe(
            filter(({ categoryIsOfTopMostElement, isSubModel }) => categoryIsOfTopMostElement && !isSubModel),
            map(({ id }) => {
              return { modelId: id, categoryId };
            }),
          ),
        ),
        reduce((acc, { modelId, categoryId }) => {
          const entry = getOrCreate({ map: acc, key: modelId, createFunc: () => new Set<CategoryId>() });
          entry.add(categoryId);
          return acc;
        }, new Map<ModelId, Set<CategoryId>>()),
        mergeMap((modelCategoriesMap) => modelCategoriesMap.entries()),
        shareReplay({ refCount: true }),
      );

      const changeSubModelsObs = categoryModelsObs.pipe(
        mergeMap(([modelId, modelCategories]) =>
          forkJoin({ modelId: of(modelId), modelCategories: of(modelCategories), hasSubModels: this.#props.baseIdsCache.hasSubModels({ modelId }) }),
        ),
        mergeMap(({ modelId, modelCategories, hasSubModels }) => {
          if (!hasSubModels) {
            return EMPTY;
          }
          return fromWithRelease({ source: modelCategories, releaseOnCount: 100 }).pipe(
            mergeMap((categoryId) => this.#props.baseIdsCache.getSubModels({ modelId, categoryId })),
          );
        }),
        toArray(),
        mergeMap((subModels) => this.changeModelsVisibilityStatus({ modelIds: subModels, on })),
      );
      const changeModelsObs = on
        ? categoryModelsObs.pipe(
            mergeMap(([modelId, modelCategories]) =>
              this.#props.viewport.viewsModel(modelId)
                ? EMPTY
                : this.showModelWithoutAnyCategoriesOrElements({ modelId, categoriesToNotOverride: modelCategories }),
            ),
          )
        : EMPTY;
      const removeCategoriesOverridesObs = categoryModelsObs.pipe(
        map(([modelId, modelCategories]) =>
          this.#props.viewport.setPerModelCategoryOverride({
            modelIds: modelId,
            categoryIds: modelCategories,
            override: "none",
          }),
        ),
      );
      const changeAlwaysAndNeverDrawnElementsObs = categoryModelsObs.pipe(
        mergeMap(([modelId, modelCategories]) => this.clearAlwaysAndNeverDrawnElements({ categoryIds: modelCategories, modelId })),
      );

      const getChangeChildElementsInDifferentCategoriesObs = () =>
        categoryModelsObs.pipe(
          mergeMap(([modelId, modelCategories]) =>
            // Descendants need to be changed only when model is visible, if it's hidden, any changes to A/N drawn won't have any effect.
            this.#props.viewport.viewsModel(modelId)
              ? this.getDescendantsToChange({ modelId, categoryIds: modelCategories, on, parentElementIdsPath: [] })
              : EMPTY,
          ),
          reduce(
            (acc, { matchingDesiredState, notMatchingDesiredState }) => {
              acc.matchingDesiredState.push(...matchingDesiredState);
              acc.notMatchingDesiredState.push(...notMatchingDesiredState);
              return acc;
            },
            { matchingDesiredState: Array<ElementId>(), notMatchingDesiredState: Array<ElementId>() },
          ),
          mergeMap(({ matchingDesiredState, notMatchingDesiredState }) =>
            matchingDesiredState.length > 0 || notMatchingDesiredState.length > 0
              ? this.queueElementsVisibilityChange({
                  elementsMatchingDesiredState: matchingDesiredState.length > 0 ? matchingDesiredState : undefined,
                  elementsNotMatchingDesiredState: notMatchingDesiredState.length > 0 ? notMatchingDesiredState : undefined,
                  on,
                })
              : EMPTY,
          ),
        );

      const changeSubCategoriesObs = on
        ? fromWithRelease({ source: categoryIds, releaseOnCount: 200 }).pipe(
            mergeMap((categoryId) => this.#props.baseIdsCache.getSubCategories({ categoryId })),
            mergeAll(),
            releaseMainThreadOnItemsCount(200),
            map((subCategoryId) => {
              if (!this.#props.viewport.viewsSubCategory(subCategoryId)) {
                this.#props.viewport.changeSubCategoryDisplay({ subCategoryId, display: true });
              }
            }),
          )
        : EMPTY;

      return merge(
        changeSubModelsObs,
        changeModelsObs.pipe(
          defaultIfEmpty(undefined),
          takeLast(1),
          mergeMap(() => getChangeChildElementsInDifferentCategoriesObs()),
        ),
        removeCategoriesOverridesObs,
        changeAlwaysAndNeverDrawnElementsObs,
        changeSubCategoriesObs,
      );
    });

    return this.#props.overrideHandler
      ? this.#props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: props,
          nonOverriddenResult: result,
          override: this.#props.overrides?.changeCategoriesVisibilityStatus,
        })
      : result;
  }

  private clearAlwaysAndNeverDrawnElements(props: { categoryIds: Id64Arg; modelId: Id64String }): Observable<void> {
    return forkJoin({
      alwaysDrawn: this.#alwaysAndNeverDrawnElements.getAlwaysOrNeverDrawnElements({ ...props, setType: "always" }),
      neverDrawn: this.#alwaysAndNeverDrawnElements.getAlwaysOrNeverDrawnElements({ ...props, setType: "never" }),
    }).pipe(
      map(({ alwaysDrawn, neverDrawn }) => {
        const viewport = this.#props.viewport;
        if (viewport.alwaysDrawn?.size && alwaysDrawn.size) {
          viewport.setAlwaysDrawn({ elementIds: setDifference(viewport.alwaysDrawn, alwaysDrawn) });
        }
        if (viewport.neverDrawn?.size && neverDrawn.size) {
          viewport.setNeverDrawn({ elementIds: setDifference(viewport.neverDrawn, neverDrawn) });
        }
      }),
    );
  }

  /**
   * Changes categories under specific model visibility status.
   *
   * - Turns on model without affecting it's elements or categories
   * - Sets per-model category overrides for specified categories.
   * - Clears always and never drawn elements in the target category
   * - For descendant elements in other categories: clears A/N drawn if their category matches
   *   desired state, or adds them to A/N drawn if it doesn't.
   * - Changes sub-models visibility status that are related to specified categories in the model.
   */
  private changeCategoriesUnderModelVisibilityStatus({
    modelId,
    categoryIds,
    on,
  }: {
    modelId: Id64String;
    categoryIds: Id64Arg;
    on: boolean;
  }): Observable<void> {
    this.#props.viewport.setPerModelCategoryOverride({
      modelIds: modelId,
      categoryIds,
      override: on ? "show" : "hide",
    });

    const changeModelsVisibilityStatusObs =
      on && !this.#props.viewport.viewsModel(modelId)
        ? this.showModelWithoutAnyCategoriesOrElements({ modelId, categoriesToNotOverride: Id64.toIdSet(categoryIds) })
        : EMPTY;

    const changeAlwaysAndNeverDrawnElementsObs = this.clearAlwaysAndNeverDrawnElements({
      categoryIds,
      modelId,
    });

    const getChangeChildElementsInDifferentCategoriesObs = () =>
      this.getDescendantsToChange({ modelId, categoryIds, on, parentElementIdsPath: [] }).pipe(
        mergeMap(({ matchingDesiredState, notMatchingDesiredState }) => {
          return matchingDesiredState.size > 0 || notMatchingDesiredState.length > 0
            ? this.queueElementsVisibilityChange({
                elementsMatchingDesiredState: matchingDesiredState.size > 0 ? matchingDesiredState : undefined,
                elementsNotMatchingDesiredState: notMatchingDesiredState.length > 0 ? notMatchingDesiredState : undefined,
                on,
              })
            : EMPTY;
        }),
      );

    const changeSubModelsObs = this.#props.baseIdsCache.hasSubModels({ modelId }).pipe(
      mergeMap((hasSubModels) => {
        if (!hasSubModels) {
          return EMPTY;
        }
        return fromWithRelease({ source: categoryIds, releaseOnCount: 100 }).pipe(
          mergeMap((categoryId) => this.#props.baseIdsCache.getSubModels({ modelId, categoryId })),
        );
      }),
      toArray(),
      mergeMap((subModels) => this.changeModelsVisibilityStatus({ modelIds: subModels, on })),
    );
    return merge(
      changeModelsVisibilityStatusObs.pipe(
        defaultIfEmpty(undefined),
        takeLast(1),
        // Descendants need to be changed only when model is visible, if it's hidden, any changes to A/N drawn won't have any effect.
        mergeMap(() => (this.#props.viewport.viewsModel(modelId) ? getChangeChildElementsInDifferentCategoriesObs() : EMPTY)),
      ),
      changeAlwaysAndNeverDrawnElementsObs,
      changeSubModelsObs,
    );
  }

  /**
   * Changes visibility status of elements by adding them to the viewport's always/never drawn elements.
   *
   * For the elements themselves, checks if their category default matches the desired state.
   * For descendants, groups by category and either clears from always/never drawn (if category default
   * matches desired state) or fetches child IDs and adds to the appropriate set.
   * Also changes visibility of sub-models.
   */
  public changeElementsVisibilityStatus(
    props: {
      elementIds: Id64Arg;
      modelId: Id64String;
      categoryId: Id64String;
      on: boolean;
    } & (
      | { ignoreDescendants: true }
      | { ignoreDescendants?: (elementId: Id64String) => boolean; categoryOfTopMostParentElement: CategoryId; parentElementsIdsPath: Array<Id64Arg> }
    ),
  ): Observable<void> {
    const result = defer(() => {
      const { modelId, categoryId, elementIds, on, ignoreDescendants } = props;
      // Make sure model visibility is on if elements should be turned on
      const prepareModelObs = on && !this.#props.viewport.viewsModel(modelId) ? this.showModelWithoutAnyCategoriesOrElements({ modelId }) : of(undefined);
      if (ignoreDescendants === true) {
        return prepareModelObs.pipe(
          mergeMap(() => {
            if (!this.#props.viewport.viewsModel(modelId)) {
              return EMPTY;
            }
            const elementsMatchDesiredState = this.getVisibleModelCategoryDirectVisibilityStatus({ categoryId, modelId }).state === (on ? "visible" : "hidden");
            return this.queueElementsVisibilityChange({
              elementsMatchingDesiredState: elementsMatchDesiredState ? elementIds : undefined,
              elementsNotMatchingDesiredState: elementsMatchDesiredState ? undefined : elementIds,
              on,
            });
          }),
        );
      }

      return merge(
        prepareModelObs.pipe(
          mergeMap(() => {
            if (!this.#props.viewport.viewsModel(modelId)) {
              return EMPTY;
            }
            const elementsMatchDesiredState = this.getVisibleModelCategoryDirectVisibilityStatus({ categoryId, modelId }).state === (on ? "visible" : "hidden");
            return this.getDescendantsToChange({
              elementIds,
              modelId,
              on,
              categoryOfTopMostParentElement: props.categoryOfTopMostParentElement,
              parentElementIdsPath: [...props.parentElementsIdsPath, elementIds],
              ignoreDescendants,
            }).pipe(
              mergeMap(({ matchingDesiredState: descendantsMatching, notMatchingDesiredState: descendantsNotMatching }) => {
                const elementsMatchingDesiredState = elementsMatchDesiredState
                  ? [...descendantsMatching, ...getId64Spreadable(elementIds)]
                  : descendantsMatching;
                const elementsNotMatchingDesiredState = elementsMatchDesiredState
                  ? descendantsNotMatching
                  : [...descendantsNotMatching, ...getId64Spreadable(elementIds)];
                return this.queueElementsVisibilityChange({
                  elementsMatchingDesiredState: Id64.sizeOf(elementsMatchingDesiredState) > 0 ? elementsMatchingDesiredState : undefined,
                  elementsNotMatchingDesiredState: Id64.sizeOf(elementsNotMatchingDesiredState) > 0 ? elementsNotMatchingDesiredState : undefined,
                  on,
                });
              }),
            );
          }),
        ),
        this.#props.baseIdsCache.hasSubModels({ modelId }).pipe(
          mergeMap((hasSubModels) => {
            if (!hasSubModels) {
              return EMPTY;
            }
            return fromWithRelease({ source: elementIds, releaseOnCount: 100 });
          }),
          mergeMap((elementId) => this.#props.baseIdsCache.getSubModelsUnderElement(elementId)),
          mergeMap((subModelsUnderElement) => {
            if (subModelsUnderElement.length > 0) {
              return this.changeModelsVisibilityStatus({ modelIds: subModelsUnderElement, on });
            }
            return EMPTY;
          }),
        ),
      );
    });

    return this.#props.overrideHandler
      ? this.#props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: props,
          nonOverriddenResult: result,
          override: this.#props.overrides?.changeElementsVisibilityStatus,
        })
      : result;
  }

  /**
   * Gets descendant elements grouped by whether their category matches the desired visibility state.
   * Can operate from either element scope (parentElementIds) or category scope (categoryIds).
   *
   * For each descendant category:
   * - If category matches desired state: retrieves those elements from opposite set (to be removed from it).
   * - If category does NOT match desired state: fetches child element IDs (to be added to the appropriate set)
   */
  private getDescendantsToChange(
    props: {
      modelId: Id64String;
      on: boolean;
      parentElementIdsPath: Array<Id64Arg>;
    } & (
      | { elementIds: Id64Arg; categoryOfTopMostParentElement: CategoryId; ignoreDescendants?: (elementId: Id64String) => boolean }
      | { categoryIds: Id64Arg }
    ),
  ): Observable<{ matchingDesiredState: Id64Set; notMatchingDesiredState: Id64Array }> {
    const { modelId, on, parentElementIdsPath } = props;
    const categoryIdsSet = "categoryIds" in props ? Id64.toIdSet(props.categoryIds) : new Set<CategoryId>();
    const {
      source,
      isSourceElement,
      ignoreChildCategory,
    }: {
      source: Observable<{ sourceId: ElementId | CategoryId; result: Array<{ categoryId: CategoryId; count: number }> }>;
      isSourceElement: boolean;
      ignoreChildCategory: (childCategoryId: CategoryId) => boolean;
    } =
      "elementIds" in props
        ? {
            source: subscribeAll({
              ids: props.elementIds,
              getObservable: (elementId) =>
                props.ignoreDescendants?.(elementId) ? of([]) : this.#props.baseIdsCache.getDescendantsCounts({ parentElementId: elementId, modelId }),
            }),
            isSourceElement: true,
            ignoreChildCategory: () => false,
          }
        : {
            source: subscribeAll({
              ids: props.categoryIds,
              getObservable: (categoryId) =>
                this.#props.baseIdsCache.categoryHasParentElements(categoryId).pipe(
                  mergeMap((hasParentElements) => {
                    if (!hasParentElements) {
                      return of([]);
                    }
                    return this.#props.baseIdsCache.getDescendantsCounts({ modelId, categoryId });
                  }),
                ),
            }),
            isSourceElement: false,
            ignoreChildCategory: (childCategoryId: CategoryId) => categoryIdsSet.has(childCategoryId),
          };
    return source.pipe(
      reduce(
        (acc, { sourceId, result: descendantsCounts }) => {
          const nonMatchingCategoriesForElement = new Array<CategoryId>();
          for (const { categoryId: childCategoryId } of descendantsCounts) {
            if (ignoreChildCategory(childCategoryId)) {
              continue;
            }
            if (acc.matchingCategories.has(childCategoryId)) {
              continue;
            }
            if (acc.nonMatchingCategories.has(childCategoryId)) {
              nonMatchingCategoriesForElement.push(childCategoryId);
              continue;
            }
            const categoryMatchesDesiredState =
              this.getVisibleModelCategoryDirectVisibilityStatus({ categoryId: childCategoryId, modelId }).state === (on ? "visible" : "hidden");
            if (categoryMatchesDesiredState) {
              acc.matchingCategories.add(childCategoryId);
            } else {
              acc.nonMatchingCategories.add(childCategoryId);
              nonMatchingCategoriesForElement.push(childCategoryId);
            }
          }
          if (nonMatchingCategoriesForElement.length > 0) {
            acc.sourceWithNonMatchingCategories.push({ sourceId, categoryIds: nonMatchingCategoriesForElement });
          }
          return acc;
        },
        {
          matchingCategories: new Set<CategoryId>(),
          nonMatchingCategories: new Set<CategoryId>(),
          sourceWithNonMatchingCategories: new Array<{ sourceId: Id64String; categoryIds: Id64Array }>(),
        },
      ),
      mergeMap(({ matchingCategories, sourceWithNonMatchingCategories }) => {
        return forkJoin({
          matchingDesiredState:
            matchingCategories.size > 0
              ? this.#alwaysAndNeverDrawnElements.getAlwaysOrNeverDrawnElements({
                  modelId,
                  parentElementIdsPath,
                  categoryIds: "categoryIds" in props ? props.categoryIds : props.categoryOfTopMostParentElement,
                  setType: on ? "never" : "always",
                  childCategoryIds: matchingCategories,
                })
              : of(new Set<Id64String>()),
          notMatchingDesiredState: from(sourceWithNonMatchingCategories).pipe(
            mergeMap(({ sourceId, categoryIds }) =>
              this.#props.baseIdsCache.getChildElements({
                modelId,
                childCategoryIds: categoryIds,
                ...(isSourceElement ? { parentElementId: sourceId } : { categoryId: sourceId }),
              }),
            ),
            toArray(),
            map((childElements) => ([] as ElementId[]).concat(...childElements)),
            defaultIfEmpty([]),
          ),
        });
      }),
    );
  }

  /** Queues visibility change for elements. */
  private queueElementsVisibilityChange({
    elementsMatchingDesiredState,
    elementsNotMatchingDesiredState,
    on,
  }: {
    on: boolean;
    elementsMatchingDesiredState?: Id64Arg;
    elementsNotMatchingDesiredState?: Id64Arg;
  }) {
    const finishedSubject = new Subject<boolean>();
    // observable to track if visibility change is finished/cancelled
    const changeFinished = finishedSubject.pipe(
      startWith(false),
      shareReplay(1),
      filter((finished) => finished),
    );

    const changeObservable = merge(
      elementsMatchingDesiredState
        ? from(Id64.iterable(elementsMatchingDesiredState)).pipe(
            map((elementId) => {
              return { elementId, matchesDesiredState: true };
            }),
          )
        : EMPTY,
      elementsNotMatchingDesiredState
        ? from(Id64.iterable(elementsNotMatchingDesiredState)).pipe(
            map((elementId) => {
              return { elementId, matchesDesiredState: false };
            }),
          )
        : EMPTY,
    ).pipe(
      // check if visibility change is not finished (cancelled) due to change overall change request being cancelled
      takeUntil(changeFinished),
      changeElementStateNoChildrenOperator({ on, viewport: this.#props.viewport }),
      tap({
        next: () => {
          // notify that visibility change is finished
          finishedSubject.next(true);
        },
      }),
    );

    // queue visibility change. `changeObservable` will be subscribed to when other queue changes are finished
    this.#elementChangeQueue.next(changeObservable);

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
}
