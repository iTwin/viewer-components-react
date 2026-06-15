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
import { countInSet, fromWithRelease, getId64Spreadable, getOrCreate, ParentElementsPath, releaseMainThreadOnItemsCount, setDifference } from "../Utils.js";
import { changeElementStateNoChildrenOperator, getCategoryVisibilityFromAlwaysAndNeverDrawnElementsImpl, mergeVisibilityStatuses } from "../VisibilityUtils.js";

import type { Observable, Subscription } from "rxjs";
import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { TreeWidgetViewport } from "../../TreeWidgetViewport.js";
import type { HierarchyVisibilityHandlerOverridableMethod, HierarchyVisibilityOverrideHandler, VisibilityStatus } from "../../UseHierarchyVisibility.js";
import type {
  AlwaysAndNeverDrawnElementInfoCache,
  AlwaysAndNeverDrawnElementsAccessor,
  ElementPathSegment,
} from "../caches/AlwaysAndNeverDrawnElementInfoCache.js";
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

type SetType = "always" | "never";

/** A memoized factory that resolves the always/never drawn elements accessor for a given set type. */
type ElementsAccessor = (setType: SetType) => Observable<AlwaysAndNeverDrawnElementsAccessor>;

/**
 * Base class for visibility status getters and modifiers.
 *
 * It provides methods that help retrieve and change visibility status of models, categories, elements.
 * @internal
 */ export class BaseVisibilityHelper implements Disposable {
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
   * Creates a memoized accessor factory for a single model.
   * The cache is resolved at most once per set type ("always"/"never"), so multiple categories or
   * segments sharing the same model reuse a single resolution.
   */
  #createElementsAccessor({ modelId, elementCategoryPath }: { modelId: ModelId; elementCategoryPath: ElementPathSegment[] }): ElementsAccessor {
    const accessorsBySetType = new Map<SetType, Observable<AlwaysAndNeverDrawnElementsAccessor>>();
    return (setType: SetType) =>
      getOrCreate({
        map: accessorsBySetType,
        key: setType,
        createFunc: () => this.#alwaysAndNeverDrawnElements.getAlwaysAndNeverDrawnElementsAccessor({ modelId, setType, elementCategoryPath }),
      });
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
        this.#props.baseIdsCache.getSubModels({ modelIds: Id64.toIdSet(modelIds) }).pipe(
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
                  parentElementsPath: [],
                  getElementsAccessor: this.#createElementsAccessor({ modelId, elementCategoryPath: [] }),
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
  public getCategoriesVisibilityStatus(
    props: {
      categoryIds: Id64Arg;
    } & (
      | {
          modelId: Id64String;
          parentElementsPath: ParentElementsPath;
          ignoreSubCategories?: undefined;
        }
      | { modelId: undefined; ignoreSubCategories?: boolean }
    ),
  ): Observable<VisibilityStatus> {
    const result = defer(() => {
      const { categoryIds, modelId: modelIdFromProps } = props;
      if (modelIdFromProps) {
        return this.getModelWithCategoriesVisibilityStatus({
          modelId: modelIdFromProps,
          categoryIds: Id64.toIdSet(categoryIds),
          parentElementsPath: props.parentElementsPath,
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
            map(({ id: modelId }) => {
              return {
                modelId,
                categoryId,
              };
            }),
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
                modelIds: new Set([modelId]),
                categoryIds: new Set([categoryId]),
                parentElementsPath: [],
              });
            }),
          ),
        ),
        toArray(),
        mergeMap((subModels) => (subModels.length > 0 ? this.getModelsVisibilityStatus({ modelIds: subModels }) : EMPTY)),
      );
      const accessorsByModel = new Map<ModelId, ElementsAccessor>();
      const getElementsAccessorForModel = (modelId: ModelId): ElementsAccessor =>
        getOrCreate({
          map: accessorsByModel,
          key: modelId,
          createFunc: () => this.#createElementsAccessor({ modelId, elementCategoryPath: [] }),
        });
      const categoryAlwaysAndNeverDrawnVisibilityStatus = categoryModelsObservable.pipe(
        mergeMap(({ modelId, categoryId }) =>
          this.#props.viewport.viewsModel(modelId)
            ? this.getCategoryVisibilityFromAlwaysAndNeverDrawnElements({
                modelId,
                categoryId,
                parentElementsPath: [],
                getElementsAccessor: getElementsAccessorForModel(modelId),
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
  private getModelWithCategoriesVisibilityStatus({
    modelId,
    categoryIds,
    parentElementsPath,
  }: {
    modelId: Id64String;
    categoryIds: Id64Set;
    parentElementsPath: ParentElementsPath;
  }): Observable<VisibilityStatus> {
    const modelVisibilityStatus = this.#props.viewport.viewsModel(modelId)
      ? // For visible model need to check category and always/never drawn elements
        fromWithRelease({ source: categoryIds, releaseOnCount: 100 }).pipe(
          mergeMap((categoryId) =>
            this.getCategoryVisibilityFromAlwaysAndNeverDrawnElements({
              modelId,
              categoryId,
              parentElementsPath,
              getElementsAccessor: this.#createElementsAccessor({ modelId, elementCategoryPath: parentElementsPath }),
            }),
          ),
        )
      : of(createVisibilityStatus("hidden"));

    const subModelsVisibilityStatus = this.#props.baseIdsCache.getSubModels({ modelIds: new Set([modelId]), categoryIds, parentElementsPath }).pipe(
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
    } & ({ computeOnlyOwnStatus: true } | { computeOnlyOwnStatus?: (elementId: Id64String) => boolean; parentElementsPath: ParentElementsPath }),
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
        getElementsAccessor: this.#createElementsAccessor({ modelId, elementCategoryPath: props.parentElementsPath }),
        computeOnlyOwnStatus,
        categoryId,
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
    categoryId: Id64String;
    modelId: Id64String;
    computeOnlyOwnStatus?: (elementId: Id64String) => boolean;
    getElementsAccessor: ElementsAccessor;
  }): Observable<VisibilityStatus> {
    const { elementIds, modelId } = props;
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
      segment: { categoryIds: props.categoryId, elementIds },
      getElementsAccessor: props.getElementsAccessor,
    });
  }

  /**
   * Gets visibility status of a category based on viewport's always/never drawn elements.
   * Groups descendant elements by their actual categories, checks which categories are
   * visible/hidden, then queries always/never drawn per group to compute overall status.
   */
  private getCategoryVisibilityFromAlwaysAndNeverDrawnElements(props: {
    modelId: Id64String;
    categoryId: Id64String;
    parentElementsPath: ParentElementsPath;
    getElementsAccessor: ElementsAccessor;
  }): Observable<VisibilityStatus> {
    return this.#props.baseIdsCache.categoryHasParentElements(props.categoryId).pipe(
      mergeMap((hasParentElements) => {
        if (!hasParentElements) {
          const categoryVisibility = this.getVisibleModelCategoryDirectVisibilityStatus({ modelId: props.modelId, categoryId: props.categoryId });
          const oppositeSet = categoryVisibility.state === "visible" ? this.#props.viewport.neverDrawn : this.#props.viewport.alwaysDrawn;
          // If no elements could override category visibility (opposite A/N drawn set is empty), return early
          // without the descendant grouping query. Otherwise, fall through, some elements in
          // this or child categories may be in the A/N drawn set and need to be counted.
          if (!oppositeSet?.size) {
            return of(categoryVisibility);
          }
        }
        const parentElementIds = props.parentElementsPath.length > 0 ? props.parentElementsPath[props.parentElementsPath.length - 1].elementIds : [undefined];
        const descendantsCountsObs = from(parentElementIds).pipe(
          mergeMap((parentElementId) =>
            this.#props.baseIdsCache.getDescendantsCounts({ modelId: props.modelId, categoryId: props.categoryId, parentElementId }),
          ),
          reduce((acc, counts) => {
            for (const { categoryId, count } of counts) {
              const entry = getOrCreate({ map: acc, key: categoryId, createFunc: () => 0 });
              acc.set(categoryId, entry + count);
            }
            return acc;
          }, new Map<CategoryId, number>()),
          map((descendantsCountsMap) => {
            const result = new Array<{ categoryId: CategoryId; count: number }>();
            for (const [categoryId, count] of descendantsCountsMap) {
              result.push({ categoryId, count });
            }
            return result;
          }),
        );
        return this.getVisibilityFromGroupedDescendants({
          modelId: props.modelId,
          descendantsCounts: descendantsCountsObs,
          segment: { categoryIds: props.categoryId },
          getElementsAccessor: props.getElementsAccessor,
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
    segment: ElementPathSegment;
    getElementsAccessor: ElementsAccessor;
  }): Observable<VisibilityStatus> {
    const { modelId, segment } = props;
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
            ? props.getElementsAccessor("never").pipe(
                map(({ getAlwaysOrNeverDrawnElements }) => {
                  const groupedElements = getAlwaysOrNeverDrawnElements(segment);
                  return getCategoryVisibilityFromAlwaysAndNeverDrawnElementsImpl({
                    defaultStatus: createVisibilityStatus("visible"),
                    numberOfElementsInOppositeSet: countGroupedElementsForCategories({ groupedElements, categories: visibleCategories }),
                    totalCount: visibleCategoriesDescendantsCount,
                  });
                }),
              )
            : EMPTY,
          hiddenCategories.size > 0
            ? props.getElementsAccessor("always").pipe(
                map(({ getAlwaysOrNeverDrawnElements }) => {
                  const groupedElements = getAlwaysOrNeverDrawnElements(segment);
                  return getCategoryVisibilityFromAlwaysAndNeverDrawnElementsImpl({
                    defaultStatus: createVisibilityStatus("hidden"),
                    numberOfElementsInOppositeSet: countGroupedElementsForCategories({ groupedElements, categories: hiddenCategories }),
                    totalCount: hiddenCategoriesDescendantsCount,
                  });
                }),
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
        return this.#props.baseIdsCache.getSubModels({ modelIds: Id64.toIdSet(modelIds) }).pipe(
          toArray(),
          mergeMap((subModels) => this.changeModelsVisibilityStatus({ modelIds: subModels, on })),
        );
      }

      this.#props.viewport.changeModelDisplay({ modelIds, display: true });
      return from(Id64.iterable(modelIds)).pipe(
        mergeMap((modelId) =>
          forkJoin({ categoryIds: this.#props.baseIdsCache.getCategories({ modelId, includeOnlyIfCategoryOfTopMostElement: true }), modelId: of(modelId) }),
        ),
        mergeMap(({ categoryIds, modelId }) => this.changeCategoriesVisibilityStatus({ categoryIds, modelId, on, parentElementsPath: [] })),
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
      modelAlwaysDrawnElements: this.#alwaysAndNeverDrawnElements
        .getAlwaysAndNeverDrawnElementsAccessor({ modelId, setType: "always", elementCategoryPath: [] })
        .pipe(map(({ getAlwaysOrNeverDrawnElements }) => getAlwaysOrNeverDrawnElements())),
    }).pipe(
      map(({ allModelCategories, modelAlwaysDrawnElements }) => {
        if (this.#props.viewport.viewsModel(modelId)) {
          // Model might have been turned on while completing forkJoin, if that happens, no need to do anything, just return.
          return;
        }
        const alwaysDrawn = this.#props.viewport.alwaysDrawn;
        if (alwaysDrawn && modelAlwaysDrawnElements.size) {
          const elementsList = getElementsList(modelAlwaysDrawnElements);
          this.#props.viewport.setAlwaysDrawn({ elementIds: setDifference(alwaysDrawn, elementsList) });
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
  public changeCategoriesVisibilityStatus(
    props: {
      categoryIds: Id64Arg;
      on: boolean;
    } & (
      | {
          modelId: Id64String;
          parentElementsPath: ParentElementsPath;
        }
      | { modelId: undefined }
    ),
  ): Observable<void> {
    const result = defer(() => {
      const { categoryIds, on } = props;
      if (Id64.sizeOf(categoryIds) === 0) {
        return EMPTY;
      }
      if (props.modelId) {
        return this.changeCategoriesUnderModelVisibilityStatus({ categoryIds, modelId: props.modelId, on, parentElementsPath: props.parentElementsPath });
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
          return this.#props.baseIdsCache.getSubModels({ modelIds: new Set([modelId]), categoryIds: modelCategories, parentElementsPath: [] });
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
        mergeMap(([modelId, modelCategories]) => this.clearAlwaysAndNeverDrawnElements({ categoryIds: modelCategories, modelId, parentElementsPath: [] })),
      );

      const getChangeChildElementsInDifferentCategoriesObs = () =>
        categoryModelsObs.pipe(
          mergeMap(([modelId, modelCategories]) =>
            // Descendants need to be changed only when model is visible, if it's hidden, any changes to A/N drawn won't have any effect.
            this.#props.viewport.viewsModel(modelId)
              ? this.getCategoryDescendantsToChange({ modelId, categoryIds: modelCategories, on, parentElementsPath: [] })
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

  private clearAlwaysAndNeverDrawnElements(props: { categoryIds: Id64Arg; modelId: Id64String; parentElementsPath: ParentElementsPath }): Observable<void> {
    const lastSegment: ElementPathSegment = { categoryIds: props.categoryIds };
    return forkJoin({
      alwaysDrawn: this.#alwaysAndNeverDrawnElements
        .getAlwaysAndNeverDrawnElementsAccessor({
          modelId: props.modelId,
          elementCategoryPath: props.parentElementsPath,
          setType: "always",
        })
        .pipe(map(({ getAlwaysOrNeverDrawnElements }) => getElementsList(getAlwaysOrNeverDrawnElements(lastSegment)))),
      neverDrawn: this.#alwaysAndNeverDrawnElements
        .getAlwaysAndNeverDrawnElementsAccessor({
          modelId: props.modelId,
          elementCategoryPath: props.parentElementsPath,
          setType: "never",
        })
        .pipe(map(({ getAlwaysOrNeverDrawnElements }) => getElementsList(getAlwaysOrNeverDrawnElements(lastSegment)))),
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
    parentElementsPath,
  }: {
    modelId: Id64String;
    categoryIds: Id64Arg;
    on: boolean;
    parentElementsPath: ParentElementsPath;
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
      parentElementsPath,
    });

    const getChangeChildElementsInDifferentCategoriesObs = () =>
      this.getCategoryDescendantsToChange({ modelId, categoryIds, on, parentElementsPath }).pipe(
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
        return this.#props.baseIdsCache.getSubModels({ categoryIds: Id64.toIdSet(categoryIds), modelIds: new Set([modelId]), parentElementsPath });
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
      | {
          ignoreDescendants?: (elementId: Id64String) => boolean;
          parentElementsPath: ParentElementsPath;
        }
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
            return this.getElementDescendantsToChange({
              elementIds,
              modelId,
              on,
              parentElementsPath: ParentElementsPath.appendToPath({
                path: props.parentElementsPath,
                ids: elementIds,
                categoryId,
              }),
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

  /** Gets descendant elements of the given elements, grouped by whether their category matches the desired visibility state. */
  private getElementDescendantsToChange(props: {
    elementIds: Id64Arg;
    modelId: Id64String;
    on: boolean;
    parentElementsPath: ParentElementsPath;
    ignoreDescendants?: (elementId: Id64String) => boolean;
  }): Observable<{ matchingDesiredState: Id64Set; notMatchingDesiredState: Id64Array }> {
    const source = subscribeAll({
      ids: props.elementIds,
      getObservable: (elementId) =>
        props.ignoreDescendants?.(elementId) ? of([]) : this.#props.baseIdsCache.getDescendantsCounts({ parentElementId: elementId, modelId: props.modelId }),
    });
    return this.collectDescendantElementsToChange({
      source,
      modelId: props.modelId,
      on: props.on,
      parentElementsPath: props.parentElementsPath,
      ignoreChildCategory: () => false,
      getChildElementsScope: (sourceId) => ({ parentElementId: sourceId }),
    });
  }

  /** Gets descendant elements of the given categories, grouped by whether their category matches the desired visibility state. */
  private getCategoryDescendantsToChange(props: {
    categoryIds: Id64Arg;
    modelId: Id64String;
    on: boolean;
    parentElementsPath: ParentElementsPath;
  }): Observable<{ matchingDesiredState: Id64Set; notMatchingDesiredState: Id64Array }> {
    const categoryIdsSet = Id64.toIdSet(props.categoryIds);
    const source = subscribeAll({
      ids: props.categoryIds,
      getObservable: (categoryId) =>
        this.#props.baseIdsCache.categoryHasParentElements(categoryId).pipe(
          mergeMap((hasParentElements) => {
            if (!hasParentElements) {
              return of([]);
            }
            return this.#props.baseIdsCache.getDescendantsCounts({ modelId: props.modelId, categoryId });
          }),
        ),
    });
    return this.collectDescendantElementsToChange({
      source,
      modelId: props.modelId,
      on: props.on,
      parentElementsPath: props.parentElementsPath,
      ignoreChildCategory: (childCategoryId) => categoryIdsSet.has(childCategoryId),
      getChildElementsScope: (sourceId) => ({ categoryId: sourceId }),
    });
  }

  /**
   * Collects descendant element IDs that need visibility changes, split by whether their
   * category's default visibility already matches the desired state.
   *
   * 1. Groups descendant categories into matching/non-matching based on per-model category overrides.
   * 2. For matching categories: fetches elements from the opposite A/N drawn set (to be removed).
   * 3. For non-matching categories: fetches all child element IDs (to be added to A/N drawn).
   */
  private collectDescendantElementsToChange(props: {
    source: Observable<{ sourceId: Id64String; result: Array<{ categoryId: CategoryId; count: number }> }>;
    modelId: Id64String;
    on: boolean;
    parentElementsPath: ParentElementsPath;
    ignoreChildCategory: (childCategoryId: CategoryId) => boolean;
    getChildElementsScope: (sourceId: Id64String) => { parentElementId: Id64String } | { categoryId: Id64String };
  }): Observable<{ matchingDesiredState: Id64Set; notMatchingDesiredState: Id64Array }> {
    const { source, modelId, on, parentElementsPath, ignoreChildCategory, getChildElementsScope } = props;
    const getElementsAccessor = this.#createElementsAccessor({ modelId, elementCategoryPath: parentElementsPath });
    return source.pipe(
      reduce(
        (acc, { sourceId, result: descendantsCounts }) => {
          const nonMatchingCategoriesForSource = new Array<CategoryId>();
          for (const { categoryId: childCategoryId } of descendantsCounts) {
            if (ignoreChildCategory(childCategoryId)) {
              continue;
            }
            if (acc.matchingCategories.has(childCategoryId)) {
              continue;
            }
            if (acc.nonMatchingCategories.has(childCategoryId)) {
              nonMatchingCategoriesForSource.push(childCategoryId);
              continue;
            }
            const categoryMatchesDesiredState =
              this.getVisibleModelCategoryDirectVisibilityStatus({ categoryId: childCategoryId, modelId }).state === (on ? "visible" : "hidden");
            if (categoryMatchesDesiredState) {
              acc.matchingCategories.add(childCategoryId);
            } else {
              acc.nonMatchingCategories.add(childCategoryId);
              nonMatchingCategoriesForSource.push(childCategoryId);
            }
          }
          if (nonMatchingCategoriesForSource.length > 0) {
            acc.sourceWithNonMatchingCategories.push({ sourceId, categoryIds: nonMatchingCategoriesForSource });
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
              ? getElementsAccessor(on ? "never" : "always").pipe(
                  map(({ getAlwaysOrNeverDrawnElements }) => getAlwaysOrNeverDrawnElements()),
                  map((groupedElements) => getElementsListMatchingCategories({ groupedElements, categories: matchingCategories })),
                )
              : of(new Set<Id64String>()),
          notMatchingDesiredState: from(sourceWithNonMatchingCategories).pipe(
            mergeMap(({ sourceId, categoryIds }) =>
              this.#props.baseIdsCache.getChildElements({
                modelId,
                childCategoryIds: categoryIds,
                ...getChildElementsScope(sourceId),
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

/** Flattens all element sets from a grouped elements map into a single set. */
function getElementsList(groupedElements: Map<CategoryId, Array<ElementId>>): Set<ElementId> {
  const result = new Set<ElementId>();
  for (const elements of groupedElements.values()) {
    for (const element of elements) {
      result.add(element);
    }
  }
  return result;
}

/** Counts total elements across specific categories in a grouped elements map. */
function countGroupedElementsForCategories({
  groupedElements,
  categories,
}: {
  groupedElements: Map<CategoryId, Array<ElementId>>;
  categories: Set<CategoryId>;
}): number {
  let count = 0;
  for (const categoryId of categories) {
    const elements = groupedElements.get(categoryId);
    if (elements) {
      count += elements.length;
    }
  }
  return count;
}

/** Flattens elements for specific categories from a grouped elements map into a single set. */
function getElementsListMatchingCategories({
  groupedElements,
  categories,
}: {
  groupedElements: Map<CategoryId, Array<ElementId>>;
  categories: Set<CategoryId>;
}): Set<ElementId> {
  const result = new Set<ElementId>();
  for (const categoryId of categories) {
    const elements = groupedElements.get(categoryId);
    if (elements) {
      for (const element of elements) {
        result.add(element);
      }
    }
  }
  return result;
}
