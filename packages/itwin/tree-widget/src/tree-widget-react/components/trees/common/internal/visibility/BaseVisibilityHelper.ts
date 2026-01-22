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
import { Id64 } from "@itwin/core-bentley";
import { createVisibilityStatus } from "../Tooltip.js";
import { fromWithRelease, getSetFromId64Arg, releaseMainThreadOnItemsCount, setDifference, setIntersection } from "../Utils.js";
import {
  changeElementStateNoChildrenOperator,
  enableCategoryDisplay,
  getVisibilityFromAlwaysAndNeverDrawnElementsImpl,
  mergeVisibilityStatuses,
} from "../VisibilityUtils.js";

import type { Observable, Subscription } from "rxjs";
import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { InstanceKey } from "@itwin/presentation-common";
import type { ClassGroupingNodeKey, HierarchyNode, InstancesNodeKey } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { TreeWidgetViewport } from "../../TreeWidgetViewport.js";
import type { HierarchyVisibilityHandlerOverridableMethod, HierarchyVisibilityOverrideHandler, VisibilityStatus } from "../../UseHierarchyVisibility.js";
import type { AlwaysAndNeverDrawnElementInfo } from "../AlwaysAndNeverDrawnElementInfo.js";
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
  hasSubModel: (elementId: Id64String) => Observable<boolean>;
  getElementsCount: (props: { modelId: Id64String; categoryId: Id64String }) => Observable<number>;
  getSubCategories: (props: { categoryId: Id64String }) => Observable<Id64Array>;
  getModels: (props: { categoryIds: Id64Arg }) => Observable<{ id: Id64String; models: Id64Arg | undefined }>;
  getCategories: (props: { modelIds: Id64Arg }) => Observable<{ id: Id64String; drawingCategories?: Id64Arg; spatialCategories?: Id64Arg }>;
  getSubModels: (
    props: { modelIds: Id64Arg; categoryId?: Id64String } | { categoryIds: Id64Arg; modelId: Id64String | undefined },
  ) => Observable<{ id: Id64String; subModels: Id64Arg | undefined }>;
  getAllCategories: () => Observable<{ drawingCategories?: Id64Set; spatialCategories?: Id64Set }>;
  getChildrenTree: (props: { elementIds: Id64Arg; type: "2d" | "3d" }) => Observable<ChildrenTree>;
  getAllChildrenCount: (props: { elementIds: Id64Arg; type: "2d" | "3d" }) => Observable<Map<Id64String, number>>;
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
export interface BaseVisibilityHelperProps<TSearchResultsTargets> {
  viewport: TreeWidgetViewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfo<TSearchResultsTargets>;
  overrideHandler?: HierarchyVisibilityOverrideHandler;
  overrides?: BaseTreeVisibilityHandlerOverrides;
  baseIdsCache: BaseIdsCache;
  classInspector: ECClassHierarchyInspector;
}

/**
 * Base class for visibility status getters and modifiers.
 *
 * It provides methods that help retrieve and change visibility status of models, categories, elements.
 * @internal
 */
export class BaseVisibilityHelper<TSearchResultsTargets> implements Disposable {
  readonly #props: BaseVisibilityHelperProps<TSearchResultsTargets>;
  readonly #alwaysAndNeverDrawnElements: AlwaysAndNeverDrawnElementInfo<TSearchResultsTargets>;
  #elementChangeQueue = new Subject<Observable<void>>();
  #subscriptions: Subscription[] = [];

  constructor(props: BaseVisibilityHelperProps<TSearchResultsTargets>) {
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
   * - Clears always drawn list;
   * - Removes all per-model category overrides. */
  public removeAlwaysDrawnExclusive(): Observable<void> {
    return from(this.#props.baseIdsCache.getAllCategories()).pipe(
      map(({ drawingCategories, spatialCategories }) => {
        const categoriesToTurnOff = this.#props.viewport.viewType === "2d" ? drawingCategories : spatialCategories;
        if (categoriesToTurnOff) {
          this.#props.viewport.changeCategoryDisplay({ categoryIds: categoriesToTurnOff, display: false, enableAllSubCategories: false });
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
  public getModelsVisibilityStatus(props: { modelIds: Id64Arg; type: "GeometricModel3d" | "GeometricModel2d" }): Observable<VisibilityStatus> {
    const result = defer(() => {
      const { modelIds, type } = props;
      if ((type === "GeometricModel3d" && this.#props.viewport.viewType !== "3d") || (type === "GeometricModel2d" && this.#props.viewport.viewType !== "2d")) {
        return of(createVisibilityStatus("disabled"));
      }
      return from(Id64.iterable(modelIds)).pipe(
        mergeMap((modelId) => {
          // For hidden models we only need to check subModels
          if (!this.#props.viewport.viewsModel(modelId)) {
            return this.#props.baseIdsCache.getSubModels({ modelIds: modelId }).pipe(
              mergeMap(({ subModels }) => {
                if (subModels && Id64.sizeOf(subModels) > 0) {
                  return this.getModelsVisibilityStatus({ modelIds: subModels, type }).pipe(
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
          return this.#props.baseIdsCache.getCategories({ modelIds: modelId }).pipe(
            mergeMap(({ drawingCategories, spatialCategories }) =>
              merge(
                drawingCategories
                  ? of(drawingCategories).pipe(mergeMap((categoryIds) => this.getCategoriesVisibilityStatus({ modelId, categoryIds, type: "DrawingCategory" })))
                  : EMPTY,
                spatialCategories
                  ? of(spatialCategories).pipe(mergeMap((categoryIds) => this.getCategoriesVisibilityStatus({ modelId, categoryIds, type: "SpatialCategory" })))
                  : EMPTY,
              ),
            ),
            defaultIfEmpty(createVisibilityStatus("visible")),
          );
        }),
        mergeVisibilityStatuses,
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
   * Gets visibility status of a model's categories, assuming model is visible.
   *
   * Determines visibility status by checking:
   * - Elements in the viewports' always/never drawn lists;
   * - Default categories visibility status in the viewport;
   * - SubModels that are related to the modelId and categoryIds
   */
  private getVisibleModelCategoriesVisibilityStatus({
    modelId,
    categoryIds,
    type,
  }: {
    modelId: Id64String;
    categoryIds: Id64Arg;
    type: "GeometricModel3d" | "GeometricModel2d";
  }) {
    return merge(
      this.getVisibilityFromAlwaysAndNeverDrawnElements({
        queryProps: { modelId, categoryIds },
        defaultStatus: () => this.getVisibleModelCategoriesDirectVisibilityStatus({ modelId, categoryIds }),
      }),
      this.#props.baseIdsCache.getSubModels({ modelId, categoryIds }).pipe(
        mergeMap(({ subModels }) => {
          if (subModels && Id64.sizeOf(subModels) > 0) {
            return this.getModelsVisibilityStatus({ modelIds: subModels, type });
          }
          return EMPTY;
        }),
      ),
    ).pipe(mergeVisibilityStatuses);
  }

  /**
   * Gets visibility status of sub-categories.
   *
   * Determines visibility status by checking:
   * - Category selector visibility in the viewport.
   * - Sub-categories visibility in the viewport.
   */
  public getSubCategoriesVisibilityStatus(props: { subCategoryIds: Id64Arg; categoryId: Id64String }): VisibilityStatus {
    if (!this.#props.viewport.viewsCategory(props.categoryId)) {
      return createVisibilityStatus("hidden");
    }

    let subCategoryVisibility: "visible" | "hidden" | "unknown" = "unknown";
    for (const subCategoryId of Id64.iterable(props.subCategoryIds)) {
      const isSubCategoryVisible = this.#props.viewport.viewsSubCategory(subCategoryId);
      if (isSubCategoryVisible && subCategoryVisibility === "hidden") {
        return createVisibilityStatus("partial");
      }
      if (!isSubCategoryVisible && subCategoryVisibility === "visible") {
        return createVisibilityStatus("partial");
      }
      subCategoryVisibility = isSubCategoryVisible ? "visible" : "hidden";
    }
    // If visibility is unknown, no subCategories were provided,
    // Since category is visible we return visible
    return createVisibilityStatus(subCategoryVisibility === "unknown" ? "visible" : subCategoryVisibility);
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
    type: "DrawingCategory" | "SpatialCategory";
  }): Observable<VisibilityStatus> {
    const result = defer(() => {
      const { categoryIds, modelId: modelIdFromProps, type } = props;
      if (Id64.sizeOf(categoryIds) === 0 || this.#props.viewport.viewType === "other") {
        return EMPTY;
      }

      const isSupportedInView =
        (this.#props.viewport.viewType === "3d" && type === "SpatialCategory") || (this.#props.viewport.viewType === "2d" && type === "DrawingCategory");
      if (!isSupportedInView) {
        return of(createVisibilityStatus("disabled"));
      }
      const categoryModelsObs = modelIdFromProps
        ? from(Id64.iterable(categoryIds)).pipe(map((categoryId) => ({ id: categoryId, models: modelIdFromProps })))
        : this.#props.baseIdsCache.getModels({ categoryIds });
      return (Id64.sizeOf(categoryIds) > 100 ? categoryModelsObs.pipe(releaseMainThreadOnItemsCount(100)) : categoryModelsObs).pipe(
        mergeMap(({ id, models }) => {
          if (!this.#props.viewport.isAlwaysDrawnExclusive) {
            return of({ id, models });
          }
          // Ignore categories that don't have root geometric elements in always drawn exclusive mode
          if (!models) {
            return EMPTY;
          }
          return from(Id64.iterable(models)).pipe(
            mergeMap((modelId) =>
              forkJoin({
                modelId: of(modelId),
                elementCount: this.#props.baseIdsCache.getElementsCount({ modelId, categoryId: id }),
              }),
            ),
            reduce(
              (acc, { modelId, elementCount }) => {
                if (elementCount > 0) {
                  acc.models.push(modelId);
                }
                return acc;
              },
              { id, models: new Array<Id64String>() },
            ),
            filter(({ models: modelsWithElements }) => modelsWithElements.length > 0),
          );
        }),
        map(({ id, models }) => {
          const acc = { categoryId: id, visibleModels: new Array<Id64String>(), hiddenModels: new Array<Id64String>() };
          if (!models) {
            return acc;
          }
          for (const modelId of Id64.iterable(models)) {
            if (this.#props.viewport.viewsModel(modelId)) {
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
              ? this.#props.baseIdsCache.getSubModels({ modelIds: hiddenModels, categoryId }).pipe(
                  mergeMap(({ subModels }) => {
                    if (subModels && Id64.sizeOf(subModels) > 0) {
                      return this.getModelsVisibilityStatus({
                        modelIds: subModels,
                        type: this.#props.viewport.viewType === "2d" ? "GeometricModel2d" : "GeometricModel3d",
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
                      type: this.#props.viewport.viewType === "2d" ? "GeometricModel2d" : "GeometricModel3d",
                    }),
                  ),
                )
              : EMPTY,
            // We need to check subCategories as well
            !modelIdFromProps
              ? this.#props.baseIdsCache.getSubCategories({ categoryId }).pipe(
                  mergeMap((subCategoryIds) => {
                    if (subCategoryIds.length > 0) {
                      return of(this.getSubCategoriesVisibilityStatus({ categoryId, subCategoryIds }));
                    }

                    return EMPTY;
                  }),
                )
              : EMPTY,
          ).pipe(
            defaultIfEmpty(
              createVisibilityStatus(!this.#props.viewport.isAlwaysDrawnExclusive && this.#props.viewport.viewsCategory(categoryId) ? "visible" : "hidden"),
            ),
          );
        }),
        mergeVisibilityStatuses,
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
   * Gets visibility status of categories, assuming model is visible.
   *
   * Determines visibility status by checking:
   * - Per model category visibility overrides;
   * - Category selector visibility in the viewport.
   */
  public getVisibleModelCategoriesDirectVisibilityStatus({ modelId, categoryIds }: { categoryIds: Id64Arg; modelId: Id64String }): VisibilityStatus {
    const viewport = this.#props.viewport;

    let visibleCount = 0;
    for (const categoryId of Id64.iterable(categoryIds)) {
      const override = this.#props.viewport.getPerModelCategoryOverride({ modelId, categoryId });
      if (override === "show" || (override === "none" && viewport.viewsCategory(categoryId))) {
        ++visibleCount;
        continue;
      }
      if (visibleCount > 0) {
        return createVisibilityStatus("partial");
      }
    }
    return visibleCount > 0 ? createVisibilityStatus("visible") : createVisibilityStatus("hidden");
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
    type: "GeometricElement3d" | "GeometricElement2d";
    categoryOfElementOrParentElementWhichIsNotChild: CategoryId;
    parentElementsIdsPath: Array<Id64Arg>;
    childrenCount: number;
    searchPathToElements?: InstanceKey[];
  }): Observable<VisibilityStatus> {
    const result = defer(() => {
      const {
        elementIds,
        modelId,
        categoryId,
        type,
        parentElementsIdsPath,
        childrenCount,
        categoryOfElementOrParentElementWhichIsNotChild,
        searchPathToElements,
      } = props;
      if (this.#props.viewport.viewType === "other") {
        return EMPTY;
      }

      const isSupportedInView =
        (this.#props.viewport.viewType === "3d" && type === "GeometricElement3d") || (this.#props.viewport.viewType === "2d" && type === "GeometricElement2d");
      if (!isSupportedInView) {
        return of(createVisibilityStatus("disabled"));
      }

      // TODO: check child elements that are subModels
      if (!this.#props.viewport.viewsModel(modelId)) {
        return fromWithRelease({ source: elementIds, releaseOnCount: 100 }).pipe(
          mergeMap((elementId) =>
            this.#props.baseIdsCache.hasSubModel(elementId).pipe(
              mergeMap((isSubModel) => {
                if (isSubModel) {
                  return this.getModelsVisibilityStatus({
                    modelIds: elementId,
                    type: this.#props.viewport.viewType === "2d" ? "GeometricModel2d" : "GeometricModel3d",
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

      // TODO: check child element categories
      // TODO: check child elements that are subModels
      return this.getVisibilityFromAlwaysAndNeverDrawnElements({
        elements: elementIds,
        defaultStatus: () => this.getVisibleModelCategoriesDirectVisibilityStatus({ categoryIds: categoryId, modelId }),
        parentElementsIdsPath,
        modelId,
        categoryOfElementOrParentElementWhichIsNotChild,
        childrenCount,
        searchPathToElements,
      }).pipe(
        mergeMap((visibilityStatusAlwaysAndNeverDraw) => {
          return from(Id64.iterable(elementIds)).pipe(
            mergeMap((elementId) =>
              this.#props.baseIdsCache.hasSubModel(elementId).pipe(
                mergeMap((isSubModel) => {
                  if (isSubModel) {
                    return this.getModelsVisibilityStatus({
                      modelIds: elementId,
                      type: this.#props.viewport.viewType === "2d" ? "GeometricModel2d" : "GeometricModel3d",
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
            categoryOfElementOrParentElementWhichIsNotChild: Id64String;
            modelId: Id64String;
            childrenCount: number;
            searchPathToElements?: InstanceKey[];
          }
        | { queryProps: { modelId: Id64String; categoryIds: Id64Arg } }
      ),
  ): Observable<VisibilityStatus> {
    const viewport = this.#props.viewport;
    if (viewport.isAlwaysDrawnExclusive) {
      if (!viewport?.alwaysDrawn?.size) {
        return of(createVisibilityStatus("hidden"));
      }
    } else if (!viewport?.neverDrawn?.size && !viewport?.alwaysDrawn?.size) {
      return of(props.defaultStatus());
    }

    if ("elements" in props) {
      const parentElementIdsPath = [...props.parentElementsIdsPath, props.elements];
      // When element does not have children, we don't need to query for child always/never drawn elements.
      if (props.childrenCount === 0) {
        return of(
          getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
            ...props,
            alwaysDrawn: viewport.alwaysDrawn ? setIntersection(props.elements, viewport.alwaysDrawn) : undefined,
            neverDrawn: viewport.neverDrawn ? setIntersection(props.elements, viewport.neverDrawn) : undefined,
            totalCount: Id64.sizeOf(props.elements),
            viewport,
          }),
        );
      }
      // Get child always/never drawn elements.
      return forkJoin({
        childAlwaysDrawn: this.#alwaysAndNeverDrawnElements.getAlwaysOrNeverDrawnElements({
          modelIds: props.modelId,
          categoryIds: props.categoryOfElementOrParentElementWhichIsNotChild,
          parentElementIdsPath,
          setType: "always",
          searchPathToElements: props.searchPathToElements,
        }),
        childNeverDrawn: this.#alwaysAndNeverDrawnElements.getAlwaysOrNeverDrawnElements({
          modelIds: props.modelId,
          categoryIds: props.categoryOfElementOrParentElementWhichIsNotChild,
          parentElementIdsPath,
          setType: "never",
          searchPathToElements: props.searchPathToElements,
        }),
      }).pipe(
        map(({ childAlwaysDrawn, childNeverDrawn }) => {
          // Combine child always/never drawn with the ones provided in props.
          const alwaysDrawn = new Set([...childAlwaysDrawn, ...(viewport.alwaysDrawn?.size ? setIntersection(props.elements, viewport.alwaysDrawn) : [])]);
          const neverDrawn = new Set([...childNeverDrawn, ...(viewport.neverDrawn?.size ? setIntersection(props.elements, viewport.neverDrawn) : [])]);
          return getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
            ...props,
            alwaysDrawn: alwaysDrawn.size > 0 ? alwaysDrawn : undefined,
            neverDrawn: neverDrawn.size > 0 ? neverDrawn : undefined,
            totalCount: props.childrenCount + Id64.sizeOf(props.elements),
            viewport,
          });
        }),
      );
    }
    const { modelId, categoryIds } = props.queryProps;
    return fromWithRelease({ source: categoryIds, releaseOnCount: 100 }).pipe(
      mergeMap((categoryId) => {
        return forkJoin({
          categoryId: of(categoryId),
          totalCount: this.#props.baseIdsCache.getElementsCount({ modelId, categoryId }),
          alwaysDrawn: this.#alwaysAndNeverDrawnElements.getAlwaysOrNeverDrawnElements({ modelIds: modelId, categoryIds: categoryId, setType: "always" }),
          neverDrawn: this.#alwaysAndNeverDrawnElements.getAlwaysOrNeverDrawnElements({ modelIds: modelId, categoryIds: categoryId, setType: "never" }),
        });
      }),
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
            ...state,
            viewport,
            defaultStatus: () => props.defaultStatus(state.categoryId),
          }),
        );
      }),
      defaultIfEmpty(createVisibilityStatus("hidden")),
      mergeVisibilityStatuses,
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

      const viewport = this.#props.viewport;

      viewport.clearPerModelCategoryOverrides({ modelIds });
      if (!on) {
        viewport.changeModelDisplay({ modelIds, display: false });
        return this.#props.baseIdsCache
          .getSubModels({ modelIds })
          .pipe(mergeMap(({ subModels }) => (subModels ? this.changeModelsVisibilityStatus({ modelIds: subModels, on }) : EMPTY)));
      }

      viewport.changeModelDisplay({ modelIds, display: true });
      return this.#props.baseIdsCache.getCategories({ modelIds }).pipe(
        mergeMap(({ id, drawingCategories, spatialCategories }) => {
          return merge(
            drawingCategories ? this.changeCategoriesVisibilityStatus({ categoryIds: drawingCategories, modelId: id, on }) : EMPTY,
            spatialCategories ? this.changeCategoriesVisibilityStatus({ categoryIds: spatialCategories, modelId: id, on }) : EMPTY,
          );
        }),
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
    const viewport = this.#props.viewport;
    return forkJoin({
      allModelCategories: this.#props.baseIdsCache.getCategories({ modelIds: modelId }).pipe(
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
      modelAlwaysDrawnElements: this.#alwaysAndNeverDrawnElements.getAlwaysOrNeverDrawnElements({ modelIds: modelId, setType: "always" }),
    }).pipe(
      mergeMap(({ allModelCategories, modelAlwaysDrawnElements }) => {
        const alwaysDrawn = this.#props.viewport.alwaysDrawn;
        if (alwaysDrawn && modelAlwaysDrawnElements) {
          viewport.setAlwaysDrawn({ elementIds: setDifference(alwaysDrawn, modelAlwaysDrawnElements) });
        }
        viewport.changeModelDisplay({ modelIds: modelId, display: true });
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
    const viewport = this.#props.viewport;
    const isDisplayedInSelector = viewport.viewsCategory(categoryId);
    const override = on === isDisplayedInSelector ? "none" : on ? "show" : "hide";
    viewport.setPerModelCategoryOverride({ modelIds: modelId, categoryIds: categoryId, override });

    if (override === "none" && on) {
      // we took off the override which means the category is displayed in selector, but
      // doesn't mean all its subcategories are displayed - this call ensures that
      viewport.changeCategoryDisplay({ categoryIds: categoryId, display: true, enableAllSubCategories: changeSubCategories });
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
      const viewport = this.#props.viewport;
      const modelIdsObservable = (
        modelIdFromProps
          ? of(new Map<ModelId, Set<CategoryId>>([[modelIdFromProps, getSetFromId64Arg(categoryIds)]]))
          : this.#props.baseIdsCache.getModels({ categoryIds }).pipe(
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
              viewport.setPerModelCategoryOverride({
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
              from(enableCategoryDisplay(viewport, categoryIds, on, false)),
              modelIdsObservable.pipe(
                map(([modelId, modelCategories]) => {
                  viewport.setPerModelCategoryOverride({ modelIds: modelId, categoryIds: modelCategories, override: "none" });
                }),
              ),
            ),
        // If categories visibility needs to be turned on, we need to turn on models without turning on unrelated elements or categories for that model
        on
          ? modelIdsObservable.pipe(
              mergeMap(([modelId, categories]) => {
                if (!viewport.viewsModel(modelId)) {
                  return this.showModelWithoutAnyCategoriesOrElements(modelId, categories);
                }
                return EMPTY;
              }),
            )
          : EMPTY,
        this.#alwaysAndNeverDrawnElements.clearAlwaysAndNeverDrawnElements({ categoryIds, modelId: modelIdFromProps }),
        this.#props.baseIdsCache
          .getSubModels({ categoryIds, modelId: modelIdFromProps })
          .pipe(mergeMap(({ subModels }) => (subModels ? this.changeModelsVisibilityStatus({ modelIds: subModels, on }) : EMPTY))),
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
      // TODO: change child elements
      // TODO: change child element categories
      // TODO: change child subModels
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
                const defaultVisibility = this.getVisibleModelCategoriesDirectVisibilityStatus({
                  categoryIds: categoryId,
                  modelId,
                });
                return this.queueElementsVisibilityChange(elementsToChange, on, isDisplayedByDefault(defaultVisibility.state === "visible"));
              }),
            );
          }

          const categoryVisibility = this.getVisibleModelCategoriesDirectVisibilityStatus({ categoryIds: categoryId, modelId });
          return this.queueElementsVisibilityChange(elementsToChange, on, isDisplayedByDefault(categoryVisibility.state === "visible"));
        }),
        // Change visibility of elements that are models
        fromWithRelease({ source: elementIds, releaseOnCount: 100 }).pipe(
          mergeMap((elementId) =>
            this.#props.baseIdsCache.hasSubModel(elementId).pipe(
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
