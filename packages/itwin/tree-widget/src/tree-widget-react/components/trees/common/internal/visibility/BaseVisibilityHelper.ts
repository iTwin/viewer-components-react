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
  identity,
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
} from "rxjs";
import { assert, Id64 } from "@itwin/core-bentley";
import { createVisibilityStatus } from "../Tooltip.js";
import { fromWithRelease, getMergedSet, releaseMainThreadOnItemsCount, setDifference, setIntersection } from "../Utils.js";
import {
  changeElementStateNoChildrenOperator,
  enableCategoryDisplay,
  getVisibilityFromAlwaysAndNeverDrawnElementsImpl,
  mergeVisibilityStatuses,
} from "../VisibilityUtils.js";

import type { Observable, Subscription } from "rxjs";
import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { ClassGroupingNodeKey, HierarchyNode, InstancesNodeKey } from "@itwin/presentation-hierarchies";
import type { TreeWidgetViewport } from "../../TreeWidgetViewport.js";
import type { HierarchyVisibilityHandlerOverridableMethod, HierarchyVisibilityOverrideHandler, VisibilityStatus } from "../../UseHierarchyVisibility.js";
import type { AlwaysAndNeverDrawnElementInfoCache } from "../caches/AlwaysAndNeverDrawnElementInfoCache.js";
import type { CategoryId, ModelId } from "../Types.js";
import type { ChildrenTree } from "../Utils.js";
import type { GetVisibilityFromAlwaysAndNeverDrawnElementsProps } from "../VisibilityUtils.js";

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

/** @internal */
export interface BaseIdsCache {
  getSubModelsUnderElement: (elementId: Id64String) => Observable<Id64Array>;
  getElementsCount: (props: { modelId: Id64String; categoryId: Id64String }) => Observable<number>;
  getSubCategories: (props: { categoryId: Id64String }) => Observable<Id64Array>;
  getModels: (props: { categoryId: Id64String; includeOnlyIfCategoryOfTopMostElement?: boolean }) => Observable<Id64Arg>;
  getCategories: (props: { modelId: Id64String; includeOnlyIfCategoryOfTopMostElement?: boolean }) => Observable<Id64Arg>;
  getSubModels: (
    props: { modelId: Id64String; categoryId?: Id64String } | { categoryId: Id64String; modelId: Id64String | undefined },
  ) => Observable<Id64Array>;
  getAllCategoriesOfElements: () => Observable<Id64Set>;
  getChildElementsTree: (props: { elementIds: Id64Arg }) => Observable<ChildrenTree>;
  getAllChildElementsCount: (props: { elementIds: Id64Arg }) => Observable<Map<Id64String, number>>;
}

/**
 * Interface for a tree visibility handler that provides methods to get and change visibility status of hierarchy nodes.
 * @internal
 */
export interface TreeSpecificVisibilityHandler<TSearchTargets> {
  getVisibilityStatus: (node: HierarchyNode) => Observable<VisibilityStatus>;
  changeVisibilityStatus: (node: HierarchyNode, on: boolean) => Observable<void>;
  getSearchTargetsVisibilityStatus: (
    targets: TSearchTargets,
    node: HierarchyNode & {
      key: ClassGroupingNodeKey | InstancesNodeKey;
    },
  ) => Observable<VisibilityStatus>;
  changeSearchTargetsVisibilityStatus: (targets: TSearchTargets, on: boolean) => Observable<void>;
}

/** @internal */
export interface BaseVisibilityHelperProps {
  viewport: TreeWidgetViewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfoCache;
  overrideHandler?: HierarchyVisibilityOverrideHandler;
  overrides?: BaseTreeVisibilityHandlerOverrides;
  baseIdsCache: BaseIdsCache;
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
  public getSubCategoriesVisibilityStatus(props: {
    subCategoryIds: Id64Arg;
    categoryId: Id64String;
    returnOnEmpty?: VisibilityStatus | "empty";
  }): Observable<VisibilityStatus> {
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
          // When always drawn exclusive mode is enabled need to get only models for which category has top most element.
          // This is because always/never drawn elements can be retrieved using top most category.
          // TODO fix with: https://github.com/iTwin/viewer-components-react/issues/1100
          this.#props.baseIdsCache.getModels({ categoryId, includeOnlyIfCategoryOfTopMostElement: this.#props.viewport.isAlwaysDrawnExclusive }).pipe(
            mergeMap((models) =>
              merge(
                from(Id64.iterable(models)).pipe(
                  mergeMap((modelId) => this.getModelWithCategoryVisibilityStatus({ modelId, categoryId })),
                  mergeVisibilityStatuses(),
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
          queryProps: { modelId, categoryId },
          defaultStatus: () => this.getVisibleModelCategoryDirectVisibilityStatus({ modelId, categoryId }),
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
  public getVisibleModelCategoryDirectVisibilityStatus({ modelId, categoryId }: { categoryId: Id64String; modelId: Id64String }): VisibilityStatus {
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
  public getElementsVisibilityStatus(props: {
    elementIds: Id64Arg;
    modelId: Id64String;
    categoryId: Id64String;
    categoryOfTopMostParentElement: CategoryId;
    parentElementsIdsPath: Array<Id64Arg>;
    childrenCount: number | undefined;
  }): Observable<VisibilityStatus> {
    const result = defer(() => {
      const { elementIds, modelId, categoryId, parentElementsIdsPath, childrenCount, categoryOfTopMostParentElement } = props;
      const elementsVisibilityStatus = this.#props.viewport.viewsModel(modelId)
        ? // For visible model need to check category and always/never drawn elements
          this.getVisibilityFromAlwaysAndNeverDrawnElements({
            elements: elementIds,
            defaultStatus: () => this.getVisibleModelCategoryDirectVisibilityStatus({ categoryId, modelId }),
            parentElementsIdsPath,
            modelId,
            categoryOfTopMostParentElement,
            childrenCount,
          })
        : of(createVisibilityStatus("hidden"));

      const subModelsVisibilityStatus = fromWithRelease({ source: elementIds, releaseOnCount: 100 }).pipe(
        mergeMap((elementId) => this.#props.baseIdsCache.getSubModelsUnderElement(elementId)),
        mergeMap((subModelsUnderElement) => this.getModelsVisibilityStatus({ modelIds: subModelsUnderElement })),
      );

      return merge(elementsVisibilityStatus, subModelsVisibilityStatus).pipe(mergeVisibilityStatuses());
    });

    return this.#props.overrideHandler
      ? this.#props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: props,
          nonOverriddenResult: result,
          override: this.#props.overrides?.getElementsVisibilityStatus,
        })
      : result;
  }

  /** Gets visibility status of elements based on viewport's always/never drawn elements and related categories and models. */
  private getVisibilityFromAlwaysAndNeverDrawnElements(
    props: GetVisibilityFromAlwaysAndNeverDrawnElementsProps &
      (
        | {
            elements: Id64Arg;
            parentElementsIdsPath: Array<Id64Arg>;
            categoryOfTopMostParentElement: Id64String;
            modelId: Id64String;
            childrenCount: number | undefined;
          }
        | { queryProps: { modelId: Id64String; categoryId: Id64String } }
      ),
  ): Observable<VisibilityStatus> {
    if (this.#props.viewport.isAlwaysDrawnExclusive) {
      if (!this.#props.viewport?.alwaysDrawn?.size) {
        return of(createVisibilityStatus("hidden"));
      }
    } else if (!this.#props.viewport?.neverDrawn?.size && !this.#props.viewport?.alwaysDrawn?.size) {
      return of(props.defaultStatus());
    }

    if ("elements" in props) {
      const { childrenCount } = props;
      const parentElementIdsPath = [...props.parentElementsIdsPath, props.elements];
      // When elements children count is 0 or undefined, no need to query for child always/never drawn elements.
      if (!childrenCount) {
        return of(
          getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
            ...props,
            alwaysDrawnSize: this.#props.viewport.alwaysDrawn?.size ? setIntersection(props.elements, this.#props.viewport.alwaysDrawn).size : 0,
            neverDrawnSize: this.#props.viewport.neverDrawn?.size ? setIntersection(props.elements, this.#props.viewport.neverDrawn).size : 0,
            totalCount: Id64.sizeOf(props.elements),
            viewport: this.#props.viewport,
          }),
        );
      }
      // Get child always/never drawn elements.
      return forkJoin({
        childAlwaysDrawn: this.#props.viewport.alwaysDrawn?.size
          ? this.#alwaysAndNeverDrawnElements.getAlwaysOrNeverDrawnElements({
              modelIds: props.modelId,
              categoryIds: props.categoryOfTopMostParentElement,
              parentElementIdsPath,
              setType: "always",
            })
          : of(new Set<Id64String>()),
        childNeverDrawn: this.#props.viewport.neverDrawn?.size
          ? this.#alwaysAndNeverDrawnElements.getAlwaysOrNeverDrawnElements({
              modelIds: props.modelId,
              categoryIds: props.categoryOfTopMostParentElement,
              parentElementIdsPath,
              setType: "never",
            })
          : of(new Set<Id64String>()),
      }).pipe(
        map(({ childAlwaysDrawn, childNeverDrawn }) => {
          // Combine child always/never drawn with the ones provided in props.
          return getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
            ...props,
            alwaysDrawnSize: this.#props.viewport.alwaysDrawn?.size
              ? getMergedSet(childAlwaysDrawn, setIntersection(props.elements, this.#props.viewport.alwaysDrawn)).size
              : 0,
            neverDrawnSize: this.#props.viewport.neverDrawn?.size
              ? getMergedSet(childNeverDrawn, setIntersection(props.elements, this.#props.viewport.neverDrawn)).size
              : 0,
            totalCount: childrenCount + Id64.sizeOf(props.elements),
            viewport: this.#props.viewport,
          });
        }),
      );
    }
    const { modelId, categoryId } = props.queryProps;
    return forkJoin({
      totalCount: this.#props.baseIdsCache.getElementsCount({ modelId, categoryId }),
      alwaysDrawn: this.#props.viewport.alwaysDrawn?.size
        ? this.#alwaysAndNeverDrawnElements.getAlwaysOrNeverDrawnElements({ modelIds: modelId, categoryIds: categoryId, setType: "always" })
        : of(new Set<Id64String>()),
      neverDrawn: this.#props.viewport.neverDrawn?.size
        ? this.#alwaysAndNeverDrawnElements.getAlwaysOrNeverDrawnElements({ modelIds: modelId, categoryIds: categoryId, setType: "never" })
        : of(new Set<Id64String>()),
    }).pipe(
      // There is a known bug:
      // Categories that don't have root elements will make visibility result incorrect
      // E.g.:
      // - CategoryA
      //  - ElementA (CategoryA is visible)
      //    - ChildElementB (CategoryB is hidden) ChildElementB is in always drawn list
      // Result will be "partial" because CategoryB will return hidden visibility, even though all elements are visible
      // TODO fix with: https://github.com/iTwin/viewer-components-react/issues/1100
      mergeMap((state) => {
        if (this.#props.viewport.isAlwaysDrawnExclusive && state.totalCount === 0) {
          return EMPTY;
        }
        return of(
          getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
            ...props,
            totalCount: state.totalCount,
            viewport: this.#props.viewport,
            alwaysDrawnSize: state.alwaysDrawn.size,
            neverDrawnSize: state.neverDrawn.size,
          }),
        );
      }),
      defaultIfEmpty(createVisibilityStatus("hidden")),
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
        mergeMap((modelId) => forkJoin({ categories: this.#props.baseIdsCache.getCategories({ modelId }), modelId: of(modelId) })),
        mergeMap(({ categories, modelId }) => this.changeCategoriesVisibilityStatus({ categoryIds: categories, modelId, on })),
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
  private showModelWithoutAnyCategoriesOrElements(modelId: Id64String, categoriesToNotOverride?: Id64Arg): Observable<void> {
    return forkJoin({
      allModelCategories: this.#props.baseIdsCache.getCategories({ modelId }),
      modelAlwaysDrawnElements: this.#alwaysAndNeverDrawnElements.getAlwaysOrNeverDrawnElements({ modelIds: modelId, setType: "always" }),
    }).pipe(
      mergeMap(({ allModelCategories, modelAlwaysDrawnElements }) => {
        const alwaysDrawn = this.#props.viewport.alwaysDrawn;
        if (alwaysDrawn && modelAlwaysDrawnElements) {
          this.#props.viewport.setAlwaysDrawn({ elementIds: setDifference(alwaysDrawn, modelAlwaysDrawnElements) });
        }
        this.#props.viewport.changeModelDisplay({ modelIds: modelId, display: true });
        return from(Id64.iterable(allModelCategories)).pipe(
          categoriesToNotOverride ? filter((modelCategory) => !Id64.has(categoriesToNotOverride, modelCategory)) : identity,
          map((categoryId) => this.changeCategoryStateInViewportAccordingToModelVisibility(modelId, categoryId, false, false)),
          takeLast(1),
          defaultIfEmpty(undefined),
        );
      }),
    );
  }

  /** Adds per-model category overrides based on category visibility in category selector. */
  private changeCategoryStateInViewportAccordingToModelVisibility(modelId: string, categoryId: string, on: boolean, changeSubCategories: boolean) {
    const isDisplayedInSelector = this.#props.viewport.viewsCategory(categoryId);
    const override = on === isDisplayedInSelector ? "none" : on ? "show" : "hide";
    this.#props.viewport.setPerModelCategoryOverride({ modelIds: modelId, categoryIds: categoryId, override });

    if (override === "none" && on) {
      // we took off the override which means the category is displayed in selector, but
      // doesn't mean all its subcategories are displayed - this call ensures that
      this.#props.viewport.changeCategoryDisplay({ categoryIds: categoryId, display: true, enableAllSubCategories: changeSubCategories });
    }
  }

  /**
   * Changes categories visibility status.
   *
   * Also:
   * - Turns on models in cases where categories need to be turned on and models are not already on.
   * - Removed related elements from always/never drawn elements.
   * - changes visibility of sub-models that are related to the specified categories.
   */
  public changeCategoriesVisibilityStatus(props: { modelId: Id64String | undefined; categoryIds: Id64Arg; on: boolean }): Observable<void> {
    const result = defer(() => {
      const { modelId: modelIdFromProps, categoryIds, on } = props;
      if (Id64.sizeOf(categoryIds) === 0) {
        return EMPTY;
      }
      const modelIdsObservable = (
        modelIdFromProps
          ? of(new Map<ModelId, Set<CategoryId>>([[modelIdFromProps, Id64.toIdSet(categoryIds)]]))
          : from(Id64.iterable(props.categoryIds)).pipe(
              mergeMap((categoryId) => forkJoin({ categoryId: of(categoryId), models: this.#props.baseIdsCache.getModels({ categoryId }) })),
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
              this.#props.viewport.setPerModelCategoryOverride({
                modelIds: modelIdFromProps,
                categoryIds,
                override: on ? "show" : "hide",
              }),
            )
          : merge(
              // In case of turning categories on, need to change sub-categories separately as enableCategoryDisplay
              // takes a long time to get sub-categories for each category
              on
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
                : EMPTY,
              from(enableCategoryDisplay(this.#props.viewport, categoryIds, on, false)),
              modelIdsObservable.pipe(
                map(([modelId, modelCategories]) => {
                  this.#props.viewport.setPerModelCategoryOverride({ modelIds: modelId, categoryIds: modelCategories, override: "none" });
                }),
              ),
            ),
        // If categories visibility needs to be turned on, we need to turn on models without turning on unrelated elements or categories for that model
        on
          ? modelIdsObservable.pipe(
              mergeMap(([modelId, categories]) =>
                this.#props.viewport.viewsModel(modelId) ? EMPTY : this.showModelWithoutAnyCategoriesOrElements(modelId, categories),
              ),
            )
          : EMPTY,
        this.#alwaysAndNeverDrawnElements.clearAlwaysAndNeverDrawnElements({ categoryIds, modelId: modelIdFromProps }),
        from(Id64.iterable(categoryIds)).pipe(
          mergeMap((categoryId) => this.#props.baseIdsCache.getSubModels({ categoryId, modelId: modelIdFromProps })),
          mergeMap((subModels) => this.changeModelsVisibilityStatus({ modelIds: subModels, on })),
        ),
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
      const viewport = this.#props.viewport;
      // TODO: determine which child elements to change based on their categories https://github.com/iTwin/viewer-components-react/issues/1561
      return concat(
        // Change elements state
        defer(() => {
          const elementsToChange = children ? [...elementIds, ...(typeof children === "string" ? [children] : children)] : elementIds;
          const isDisplayedByDefault = (isCategoryVisible: boolean) =>
            // When category is visible and elements need to be turned off, or when category is hidden and elements need to be turned on,
            // We can set isDisplayedByDefault to isCategoryVisible. This allows to not check if each element is in the elementIds list or not.
            isCategoryVisible === !on
              ? () => isCategoryVisible
              : (elementId: Id64String) => {
                  if (Id64.has(elementIds, elementId)) {
                    return isCategoryVisible;
                  }
                  return !on;
                };
          if (!viewport.viewsModel(modelId)) {
            if (!on) {
              return this.queueElementsVisibilityChange(elementsToChange, on, () => false);
            }

            return this.showModelWithoutAnyCategoriesOrElements(modelId).pipe(
              mergeMap(() => {
                const defaultVisibility = this.getVisibleModelCategoryDirectVisibilityStatus({
                  categoryId,
                  modelId,
                });
                return this.queueElementsVisibilityChange(elementsToChange, on, isDisplayedByDefault(defaultVisibility.state === "visible"));
              }),
            );
          }

          const categoryVisibility = this.getVisibleModelCategoryDirectVisibilityStatus({ categoryId, modelId });
          return this.queueElementsVisibilityChange(elementsToChange, on, isDisplayedByDefault(categoryVisibility.state === "visible"));
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
