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
  takeUntil,
  tap,
} from "rxjs";
import { assert, Id64 } from "@itwin/core-bentley";
import { createVisibilityStatus } from "../Tooltip.js";
import { countInSet, fromWithRelease, releaseMainThreadOnItemsCount, setDifference } from "../Utils.js";
import { changeElementStateNoChildrenOperator, getVisibilityFromAlwaysAndNeverDrawnElementsImpl, mergeVisibilityStatuses } from "../VisibilityUtils.js";

import type { Observable, Subscription } from "rxjs";
import type { Id64Arg, Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { TreeWidgetViewport } from "../../TreeWidgetViewport.js";
import type { HierarchyVisibilityHandlerOverridableMethod, HierarchyVisibilityOverrideHandler, VisibilityStatus } from "../../UseHierarchyVisibility.js";
import type { AlwaysAndNeverDrawnElementInfoCache } from "../caches/AlwaysAndNeverDrawnElementInfoCache.js";
import type { BaseIdsCacheImpl } from "../caches/BaseIdsCache.js";
import type { NonPartialVisibilityStatus } from "../Tooltip.js";
import type { CategoryId, ModelId } from "../Types.js";

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
      const { modelIds } = props;
      return from(Id64.iterable(modelIds)).pipe(
        mergeMap((modelId) => {
          // For hidden models we only need to check subModels
          if (!this.#props.viewport.viewsModel(modelId)) {
            return this.#props.baseIdsCache.getSubModels({ modelId }).pipe(
              mergeMap((subModels) =>
                this.getModelsVisibilityStatus({ modelIds: subModels }).pipe(
                  map((subModelsVisibilityStatus) =>
                    subModelsVisibilityStatus.state !== "hidden" ? createVisibilityStatus("partial") : subModelsVisibilityStatus,
                  ),
                ),
              ),
              defaultIfEmpty(createVisibilityStatus("hidden")),
            );
          }
          // For visible models we need to check all categories.
          // getCategoriesVisibilityStatus already checks subModels, no need to do that
          // Take top most element categories when always drawn exclusive mode is on, because only top most categories are used to get always/never drawn elements.
          // This means that non top most categories should not affect visibility in any way until https://github.com/iTwin/viewer-components-react/issues/1100 is resolved.
          return this.#props.baseIdsCache.getCategories({ modelId, includeOnlyIfCategoryOfTopMostElement: this.#props.viewport.isAlwaysDrawnExclusive }).pipe(
            mergeMap((categories) => this.getCategoriesVisibilityStatus({ modelId, categoryIds: categories })),
            defaultIfEmpty(createVisibilityStatus("visible")),
          );
        }),
        mergeVisibilityStatuses(),
      );
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
  public getCategoriesVisibilityStatus(props: { categoryIds: Id64Arg; modelId: Id64String | undefined }): Observable<VisibilityStatus> {
    const result = defer(() => {
      const { categoryIds, modelId: modelIdFromProps } = props;
      if (modelIdFromProps) {
        return fromWithRelease({ source: categoryIds, releaseOnCount: 100 }).pipe(
          mergeMap((categoryId) => this.getModelWithCategoryVisibilityStatus({ modelId: modelIdFromProps, categoryId })),
          mergeVisibilityStatuses(),
        );
      }

      return fromWithRelease({ source: categoryIds, releaseOnCount: 100 }).pipe(
        mergeMap((categoryId) =>
          merge(
            // When always drawn exclusive mode is enabled need to get only models for which category has top most element.
            // This is because always/never drawn elements can be retrieved using top most category.
            // TODO fix with: https://github.com/iTwin/viewer-components-react/issues/1100
            this.#props.baseIdsCache
              .getModels({ categoryId, includeOnlyIfCategoryOfTopMostElement: this.#props.viewport.isAlwaysDrawnExclusive, subModels: "include" })
              .pipe(
                mergeMap((models) =>
                  from(Id64.iterable(models)).pipe(
                    mergeMap((modelId) => this.getModelWithCategoryVisibilityStatus({ modelId, categoryId })),
                    mergeVisibilityStatuses(),
                  ),
                ),
              ),
            // For category not under specific model, need to check subCategories as well
            this.#props.baseIdsCache
              .getSubCategories({ categoryId })
              .pipe(mergeMap((subCategoryIds) => this.getSubCategoriesVisibilityStatus({ categoryId, subCategoryIds }))),
          ).pipe(
            // This can happen when category does not have any geometric elements or sub-categories
            defaultIfEmpty(
              createVisibilityStatus(!this.#props.viewport.isAlwaysDrawnExclusive && this.#props.viewport.viewsCategory(categoryId) ? "visible" : "hidden"),
            ),
          ),
        ),
        mergeVisibilityStatuses(),
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
  private getModelWithCategoryVisibilityStatus({ modelId, categoryId }: { modelId: Id64String; categoryId: Id64String }): Observable<VisibilityStatus> {
    const modelVisibilityStatus = this.#props.viewport.viewsModel(modelId)
      ? // For visible model need to check category and always/never drawn elements
        this.getVisibilityFromAlwaysAndNeverDrawnElements({
          modelId,
          categoryId,
          defaultStatus: this.getVisibleModelCategoryDirectVisibilityStatus({ modelId, categoryId }),
        })
      : of(createVisibilityStatus("hidden"));

    const subModelsVisibilityStatus = this.#props.baseIdsCache
      .getSubModels({ modelId, categoryId })
      .pipe(mergeMap((subModels) => this.getModelsVisibilityStatus({ modelIds: subModels })));

    return merge(modelVisibilityStatus, subModelsVisibilityStatus).pipe(mergeVisibilityStatuses());
  }

  /**
   * Gets visibility status of category, assuming model is visible.
   *
   * Determines visibility status by checking:
   * - Per model category visibility overrides;
   * - Category selector visibility in the viewport.
   */
  public getVisibleModelCategoryDirectVisibilityStatus({ modelId, categoryId }: { categoryId: Id64String; modelId: Id64String }): NonPartialVisibilityStatus {
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
   * - Sub-models that are related to the specified elements.
   */
  public getElementsVisibilityStatus(
    props: {
      elementIds: Id64Arg;
      modelId: Id64String;
      categoryId: Id64String;
    } & ({ ignoreDescendants: true } | { ignoreDescendants?: false; categoryOfTopMostParentElement: CategoryId; parentElementsIdsPath: Array<Id64Arg> }),
  ): Observable<VisibilityStatus> {
    const result = defer(() => {
      const { elementIds, modelId, categoryId, ignoreDescendants } = props;
      // Compute element's own visibility
      const elementsOwnStatus = this.getElementsOwnVisibilityStatus({ elementIds, modelId, categoryId });
      if (ignoreDescendants) {
        return elementsOwnStatus;
      }
      const subModelsVisibilityStatus = this.#props.baseIdsCache.hasSubModels({ modelId }).pipe(
        mergeMap((hasSubModels) =>
          hasSubModels
            ? fromWithRelease({ source: elementIds, releaseOnCount: 100 }).pipe(
                mergeMap((elementId) => this.#props.baseIdsCache.getSubModelsUnderElement(elementId)),
                mergeMap((subModelsUnderElement) => this.getModelsVisibilityStatus({ modelIds: subModelsUnderElement })),
              )
            : EMPTY,
        ),
      );

      const descendantsVisibilityStatus = this.getDescendantsVisibilityStatus({
        elementIds,
        modelId,
        categoryOfTopMostParentElement: props.categoryOfTopMostParentElement,
        // For descendants path includes elementIds
        parentElementIdsPath: [...props.parentElementsIdsPath, elementIds],
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
    const defaultStatus = this.#props.viewport.isAlwaysDrawnExclusive
      ? createVisibilityStatus("hidden")
      : this.getVisibleModelCategoryDirectVisibilityStatus({ categoryId, modelId });
    const oppositeSet = defaultStatus.state === "visible" ? this.#props.viewport.neverDrawn : this.#props.viewport.alwaysDrawn;
    if (!oppositeSet?.size) {
      return of(defaultStatus);
    }
    return of(
      getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
        defaultStatus,
        numberOfElementsInOppositeSet: countInSet(elementIds, oppositeSet),
        totalCount: Id64.sizeOf(elementIds),
      }),
    );
  }

  /**
   * Computes descendant visibility per category.
   * Groups categories by default visibility, queries always/never drawn per group,
   * and computes per-category status.
   */
  private getDescendantsVisibilityStatus(props: {
    elementIds: Id64Arg;
    modelId: Id64String;
    categoryOfTopMostParentElement: CategoryId;
    parentElementIdsPath: Array<Id64Arg>;
  }): Observable<VisibilityStatus> {
    const { elementIds, modelId, categoryOfTopMostParentElement, parentElementIdsPath } = props;
    if (!this.#props.viewport.viewsModel(modelId)) {
      return of(createVisibilityStatus("hidden"));
    }
    return from(Id64.iterable(elementIds)).pipe(
      mergeMap((elementId) => this.#props.baseIdsCache.getDescendantsCounts({ parentElementId: elementId, modelId })),
      reduce(
        (acc, descendantsCounts) => {
          for (const categoryWithCount of descendantsCounts) {
            if (acc.visibleCategories.has(categoryWithCount.categoryId)) {
              acc.visibleCategoriesDescendantsCount += categoryWithCount.count;
              continue;
            }
            if (acc.hiddenCategories.has(categoryWithCount.categoryId)) {
              acc.hiddenCategoriesDescendantsCount += categoryWithCount.count;
              continue;
            }
            const isCategoryVisible = this.#props.viewport.isAlwaysDrawnExclusive
              ? false
              : this.getVisibleModelCategoryDirectVisibilityStatus({ categoryId: categoryWithCount.categoryId, modelId }).state === "visible";
            if (isCategoryVisible) {
              acc.visibleCategoriesDescendantsCount += categoryWithCount.count;
              acc.visibleCategories.add(categoryWithCount.categoryId);
              continue;
            }
            acc.hiddenCategoriesDescendantsCount += categoryWithCount.count;
            acc.hiddenCategories.add(categoryWithCount.categoryId);
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
                  categoryIds: categoryOfTopMostParentElement,
                  setType: "never",
                  childCategoryIds: visibleCategories,
                })
                .pipe(
                  map((elementsInOppositeSet) =>
                    getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
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
                  categoryIds: categoryOfTopMostParentElement,
                  setType: "always",
                  childCategoryIds: hiddenCategories,
                })
                .pipe(
                  map((elementsInOppositeSet) =>
                    getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
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

  /** Gets visibility status of a category based on viewport's always/never drawn elements. */
  private getVisibilityFromAlwaysAndNeverDrawnElements({
    modelId,
    ...props
  }: {
    defaultStatus: NonPartialVisibilityStatus;
    modelId: Id64String;
    categoryId: Id64String;
  }): Observable<VisibilityStatus> {
    const defaultStatus = this.#props.viewport.isAlwaysDrawnExclusive ? createVisibilityStatus("hidden") : props.defaultStatus;
    const { oppositeSet, setType } =
      defaultStatus.state === "visible"
        ? { oppositeSet: this.#props.viewport.neverDrawn, setType: "never" as const }
        : { oppositeSet: this.#props.viewport.alwaysDrawn, setType: "always" as const };
    if (!oppositeSet?.size) {
      return of(defaultStatus);
    }

    const { categoryId } = props;
    return forkJoin({
      totalCount: this.#props.baseIdsCache.getElementsCount({ modelId, categoryId }),
      relatedElementsInOppositeSet: this.#alwaysAndNeverDrawnElements.getAlwaysOrNeverDrawnElements({
        modelId,
        categoryIds: categoryId,
        setType,
      }),
    }).pipe(
      // There is a known bug:
      // Categories that don't have root elements will make visibility result incorrect
      // E.g.:
      // - CategoryA
      //  - ElementA (CategoryA is visible)
      //    - ChildElementB (CategoryB is hidden) ChildElementB is in always drawn list
      // Result will be "partial" because CategoryB will return hidden visibility, even though all elements are visible
      // TODO fix with: https://github.com/iTwin/viewer-components-react/issues/1100
      map((state) =>
        getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
          defaultStatus,
          totalCount: state.totalCount,
          numberOfElementsInOppositeSet: state.relatedElementsInOppositeSet.size,
        }),
      ),
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
          mergeMap((subModels) => this.changeModelsVisibilityStatus({ modelIds: subModels, on })),
        );
      }

      this.#props.viewport.changeModelDisplay({ modelIds, display: true });
      return from(Id64.iterable(modelIds)).pipe(
        mergeMap((modelId) => forkJoin({ categoryIds: this.#props.baseIdsCache.getCategories({ modelId }), modelId: of(modelId) })),
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
        mergeMap((categoryId) => forkJoin({ categoryId: of(categoryId), models: this.#props.baseIdsCache.getModels({ categoryId, subModels: "include" }) })),
        reduce((acc, { models, categoryId }) => {
          for (const modelId of Id64.iterable(models)) {
            let entry = acc.get(modelId);
            if (!entry) {
              entry = new Set();
              acc.set(modelId, entry);
            }
            entry.add(categoryId);
          }
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
          return fromWithRelease({ source: modelCategories, releaseOnCount: 500 }).pipe(
            mergeMap((modelCategoryId) => this.#props.baseIdsCache.getSubModels({ categoryId: modelCategoryId, modelId })),
          );
        }),
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

      return merge(changeSubModelsObs, changeModelsObs, removeCategoriesOverridesObs, changeAlwaysAndNeverDrawnElementsObs, changeSubCategoriesObs);
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
   * - sets per-model category overrides for specified categories.
   * - Clears always and never drawn elements related to those categories
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
    const changeSubModelsObs = this.#props.baseIdsCache.hasSubModels({ modelId }).pipe(
      mergeMap((hasSubModels) => {
        if (hasSubModels) {
          return fromWithRelease({ source: categoryIds, releaseOnCount: 200 }).pipe(
            mergeMap((categoryId) => this.#props.baseIdsCache.getSubModels({ categoryId, modelId })),
            mergeMap((subModels) => this.changeModelsVisibilityStatus({ modelIds: subModels, on })),
          );
        }
        return EMPTY;
      }),
    );
    return merge(changeModelsVisibilityStatusObs, changeAlwaysAndNeverDrawnElementsObs, changeSubModelsObs);
  }

  /**
   * Changes visibility status of elements by adding them to the viewport's always/never drawn elements.
   *
   * Also, changes visibility status of specified elements that are models.
   */
  public changeElementsVisibilityStatus(props: {
    elementIds: Id64Arg;
    modelId: Id64String;
    categoryId: Id64String;
    on: boolean;
    children: Id64Arg | undefined;
  }): Observable<void> {
    const result = defer(() => {
      const { modelId, categoryId, elementIds, on, children } = props;
      // TODO: determine which child elements to change based on their categories https://github.com/iTwin/viewer-components-react/issues/1561
      return concat(
        // Change elements state
        defer(() => {
          const elementIdsSet = Id64.toIdSet(elementIds);
          const elementsToChange = children ? [...elementIdsSet, ...(typeof children === "string" ? [children] : children)] : elementIdsSet;
          const isDisplayedByDefault = (isCategoryVisible: boolean) =>
            // When category is visible and elements need to be turned off, or when category is hidden and elements need to be turned on,
            // We can set isDisplayedByDefault to isCategoryVisible. This allows to not check if each element is in the elementIds list or not.
            isCategoryVisible === !on
              ? () => isCategoryVisible
              : (elementId: Id64String) => {
                  if (elementIdsSet.has(elementId)) {
                    return isCategoryVisible;
                  }
                  return !on;
                };
          if (!this.#props.viewport.viewsModel(modelId)) {
            if (!on) {
              return this.queueElementsVisibilityChange({ elementIds: elementsToChange, on, visibleByDefault: () => false });
            }

            return this.showModelWithoutAnyCategoriesOrElements({ modelId }).pipe(
              mergeMap(() => {
                const defaultVisibility = this.getVisibleModelCategoryDirectVisibilityStatus({
                  categoryId,
                  modelId,
                });
                return this.queueElementsVisibilityChange({
                  elementIds: elementsToChange,
                  on,
                  visibleByDefault: isDisplayedByDefault(defaultVisibility.state === "visible"),
                });
              }),
            );
          }

          const categoryVisibility = this.getVisibleModelCategoryDirectVisibilityStatus({ categoryId, modelId });
          return this.queueElementsVisibilityChange({
            elementIds: elementsToChange,
            on,
            visibleByDefault: isDisplayedByDefault(categoryVisibility.state === "visible"),
          });
        }),
        // Change visibility of elements that are models
        fromWithRelease({ source: elementIds, releaseOnCount: 100 }).pipe(
          mergeMap((elementId) =>
            this.#props.baseIdsCache.getSubModelsUnderElement(elementId).pipe(
              mergeMap((subModelsUnderElement) => {
                if (subModelsUnderElement.length > 0) {
                  return this.changeModelsVisibilityStatus({ modelIds: subModelsUnderElement, on });
                }
                return EMPTY;
              }),
            ),
          ),
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

  /** Queues visibility change for elements. */
  private queueElementsVisibilityChange({
    elementIds,
    on,
    visibleByDefault,
  }: {
    elementIds: Id64Arg;
    on: boolean;
    visibleByDefault: (elementId: Id64String) => boolean;
  }) {
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
      changeElementStateNoChildrenOperator({ on, isDisplayedByDefault: visibleByDefault, viewport: this.#props.viewport }),
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
