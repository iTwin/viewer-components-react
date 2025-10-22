/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Observable, Subscription } from "rxjs";
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
import { getSetFromId64Arg, setDifference, setIntersection } from "../Utils.js";
import {
  changeElementStateNoChildrenOperator,
  enableCategoryDisplay,
  getVisibilityFromAlwaysAndNeverDrawnElementsImpl,
  mergeVisibilityStatuses,
} from "../VisibilityUtils.js";

import type { ITreeWidgetIdsCache } from "../TreeWidgetIdsCache.js";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { TreeWidgetViewport } from "../../TreeWidgetViewport.js";
import type { HierarchyVisibilityHandlerOverridableMethod, HierarchyVisibilityOverrideHandler, VisibilityStatus } from "../../UseHierarchyVisibility.js";
import type { AlwaysAndNeverDrawnElementInfo } from "../AlwaysAndNeverDrawnElementInfo.js";
import type { CategoryId, ModelId } from "../Types.js";
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

/**
 * Interface for a tree visibility handler that provides methods to get and change visibility status of hierarchy nodes.
 * @internal
 */
export interface TreeSpecificVisibilityHandler<TFilterTargets> {
  getVisibilityStatus: (node: HierarchyNode) => Observable<VisibilityStatus>;
  changeVisibilityStatus: (node: HierarchyNode, on: boolean) => Observable<void>;
  getFilterTargetsVisibilityStatus: (targets: TFilterTargets) => Observable<VisibilityStatus>;
  changeFilterTargetsVisibilityStatus: (targets: TFilterTargets, on: boolean) => Observable<void>;
}

/** @internal */
export interface BaseVisibilityHelperProps {
  viewport: TreeWidgetViewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfo;
  overrideHandler?: HierarchyVisibilityOverrideHandler;
  overrides?: BaseTreeVisibilityHandlerOverrides;
  treeWidgetIdsCache: ITreeWidgetIdsCache;
}

/**
 * Base class for visibility status getters and modifiers.
 *
 * It provides methods that help retrieve and change visibility status of models, categories, elements.
 * @internal
 */
export class BaseVisibilityHelper implements Disposable {
  readonly #props: BaseVisibilityHelperProps;
  readonly #alwaysAndNeverDrawnElements: AlwaysAndNeverDrawnElementInfo;
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
   * - Clears always drawn list;
   * - Removes all per-model category overrides. */
  public removeAlwaysDrawnExclusive(): Observable<void> {
    return from(this.#props.treeWidgetIdsCache.getAllCategoriesThatContainElements()).pipe(
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
            return this.#props.treeWidgetIdsCache.getSubModels({ modelIds: modelId }).pipe(
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
          return this.#props.treeWidgetIdsCache.getCategories({ modelIds: modelId }).pipe(
            mergeMap(({ drawingCategories, spatialCategories }) =>
              merge(
                drawingCategories
                  ? of(drawingCategories).pipe(
                      mergeMap((categoryIds) =>
                        this.getCategoriesVisibilityStatus({ modelId, categoryIds, type: "DrawingCategory", checkSubCategories: false }),
                      ),
                    )
                  : EMPTY,
                spatialCategories
                  ? of(spatialCategories).pipe(
                      mergeMap((categoryIds) =>
                        this.getCategoriesVisibilityStatus({ modelId, categoryIds, type: "SpatialCategory", checkSubCategories: false }),
                      ),
                    )
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
      this.#props.treeWidgetIdsCache.getSubModels({ modelId, categoryIds }).pipe(
        mergeMap(({ subModels }) => {
          if (subModels && Id64.sizeOf(subModels) > 0) {
            return this.getModelsVisibilityStatus({ modelIds: subModels, type });
          }
          return EMPTY;
        }),
      ),
    ).pipe(mergeVisibilityStatuses);
  }

  /** Gets visibility status of sub-categories, assuming category is visible. */
  private getVisibleCategorySubCategoriesVisibilityStatus(props: { subCategoryIds: Id64Arg }): VisibilityStatus {
    const { subCategoryIds } = props;
    let subCategoryVisibility: "visible" | "hidden" | "unknown" = "unknown";
    for (const subCategoryId of Id64.iterable(subCategoryIds)) {
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
   * Gets visibility status of sub-categories.
   *
   * Determines visibility status by checking:
   * - Models that contain the category visibility;
   * - Per model category visibility overrides;
   * - Category selector visibility in the viewport.
   * - Sub-categories visibility in the viewport.
   */
  public getSubCategoriesVisibilityStatus(props: { subCategoryIds: Id64Arg; categoryId: Id64String; modelId?: Id64String }): Observable<VisibilityStatus> {
    return (
      props.modelId ? of({ id: props.categoryId, models: props.modelId }) : from(this.#props.treeWidgetIdsCache.getModels({ categoryIds: props.categoryId }))
    ).pipe(
      map(({ models }) => {
        let visibility: "visible" | "hidden" | "unknown" = "unknown";
        let nonDefaultModelDisplayStatesCount = 0;
        for (const modelId of Id64.iterable(models ?? [])) {
          if (!this.#props.viewport.viewsModel(modelId)) {
            if (visibility === "visible") {
              return createVisibilityStatus("partial");
            }
            visibility = "hidden";
            ++nonDefaultModelDisplayStatesCount;
            continue;
          }
          const override = this.#props.viewport.getPerModelCategoryOverride({ modelId, categoryId: props.categoryId });
          if (override === "show") {
            if (visibility === "hidden") {
              return createVisibilityStatus("partial");
            }
            visibility = "visible";
            ++nonDefaultModelDisplayStatesCount;
            continue;
          }
          if (override === "hide") {
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
        if (!this.#props.viewport.viewsCategory(props.categoryId)) {
          return createVisibilityStatus(visibility === "visible" ? "partial" : "hidden");
        }

        if (Id64.sizeOf(props.subCategoryIds) === 0) {
          if (visibility === "hidden") {
            return createVisibilityStatus("partial");
          }
          return createVisibilityStatus("visible");
        }

        const subCategoriesVisibility = this.getVisibleCategorySubCategoriesVisibilityStatus({ subCategoryIds: props.subCategoryIds });
        return subCategoriesVisibility.state === visibility || visibility === "unknown" ? subCategoriesVisibility : createVisibilityStatus("partial");
      }),
      mergeVisibilityStatuses,
    );
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
    checkSubCategories: boolean;
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

      return (
        modelIdFromProps
          ? from(Id64.iterable(categoryIds)).pipe(map((categoryId) => ({ id: categoryId, models: modelIdFromProps })))
          : this.#props.treeWidgetIdsCache.getModels({ categoryIds })
      ).pipe(
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
              ? this.#props.treeWidgetIdsCache.getSubModels({ modelIds: hiddenModels }).pipe(
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
            props.checkSubCategories
              ? this.#props.treeWidgetIdsCache.getSubCategories({ categoryIds: categoryId }).pipe(
                  mergeMap(({ subCategories }) => {
                    if (subCategories && Id64.sizeOf(subCategories) > 0) {
                      // We only want to check default sub-category visibility status if category does not have any models
                      if (Id64.sizeOf(subCategories) === 1 && (hiddenModels.length > 0 || visibleModels.length > 0)) {
                        return EMPTY;
                      }
                      return this.getSubCategoriesVisibilityStatus({ categoryId, modelId: modelIdFromProps, subCategoryIds: subCategories });
                    }

                    return EMPTY;
                  }),
                )
              : EMPTY,
          ).pipe(defaultIfEmpty(createVisibilityStatus(this.#props.viewport.viewsCategory(categoryId) ? "visible" : "hidden")));
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
  }): Observable<VisibilityStatus> {
    const result = defer(() => {
      const { elementIds, modelId, categoryId, type } = props;
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
        return from(elementIds).pipe(
          mergeMap((elementId) =>
            from(this.#props.treeWidgetIdsCache.hasSubModel(elementId)).pipe(
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
      // TODO: check child elements
      // TODO: check child element categories
      // TODO: check child elements that are subModels
      return this.getVisibilityFromAlwaysAndNeverDrawnElements({
        elements: elementIds,
        defaultStatus: () => this.getVisibleModelCategoriesDirectVisibilityStatus({ categoryIds: categoryId, modelId }),
      }).pipe(
        mergeMap((visibilityStatusAlwaysAndNeverDraw) => {
          return from(Id64.iterable(elementIds)).pipe(
            mergeMap((elementId) =>
              from(this.#props.treeWidgetIdsCache.hasSubModel(elementId)).pipe(
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
    props: GetVisibilityFromAlwaysAndNeverDrawnElementsProps & ({ elements: Id64Arg } | { queryProps: { modelId: Id64String; categoryIds: Id64Arg } }),
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
      mergeMap((categoryId) => this.#props.treeWidgetIdsCache.getElementsCount({ modelId, categoryId })),
      reduce((acc, specificModelCategoryCount) => {
        return acc + specificModelCategoryCount;
      }, 0),
    );
    return forkJoin({
      totalCount,
      alwaysDrawn: this.#alwaysAndNeverDrawnElements.getAlwaysDrawnElements(props.queryProps),
      neverDrawn: this.#alwaysAndNeverDrawnElements.getNeverDrawnElements(props.queryProps),
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
        return getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
          ...props,
          ...state,
          viewport,
        });
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

      const viewport = this.#props.viewport;

      viewport.clearPerModelCategoryOverrides({ modelIds });
      if (!on) {
        viewport.changeModelDisplay({ modelIds, display: false });
        return this.#props.treeWidgetIdsCache
          .getSubModels({ modelIds })
          .pipe(mergeMap(({ subModels }) => (subModels ? this.changeModelsVisibilityStatus({ modelIds: subModels, on }) : EMPTY)));
      }

      viewport.changeModelDisplay({ modelIds, display: true });
      return this.#props.treeWidgetIdsCache.getCategories({ modelIds }).pipe(
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
      allModelCategories: this.#props.treeWidgetIdsCache.getCategories({ modelIds: modelId }).pipe(
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
      modelAlwaysDrawnElements: this.#alwaysAndNeverDrawnElements.getAlwaysDrawnElements({ modelId }),
    }).pipe(
      mergeMap(async ({ allModelCategories, modelAlwaysDrawnElements }) => {
        const alwaysDrawn = this.#props.viewport.alwaysDrawn;
        if (alwaysDrawn && modelAlwaysDrawnElements) {
          viewport.setAlwaysDrawn({ elementIds: setDifference(alwaysDrawn, modelAlwaysDrawnElements) });
        }
        const categoriesToOverride = categoriesToNotOverride
          ? setDifference(allModelCategories, getSetFromId64Arg(categoriesToNotOverride))
          : allModelCategories;
        categoriesToOverride.forEach((categoryId) => {
          this.changeCategoryStateInViewportAccordingToModelVisibility(modelId, categoryId, false, false);
        });
        viewport.changeModelDisplay({ modelIds: modelId, display: true });
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
          : this.#props.treeWidgetIdsCache.getModels({ categoryIds }).pipe(
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
          : concat(
              from(enableCategoryDisplay(viewport, categoryIds, on, on)),
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
        this.#props.treeWidgetIdsCache
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
  public changeElementsVisibilityStatus(props: { elementIds: Id64Arg; modelId: Id64String; categoryId: Id64String; on: boolean }): Observable<void> {
    const result = defer(() => {
      const { modelId, categoryId, elementIds, on } = props;
      const viewport = this.#props.viewport;
      // TODO: change child elements
      // TODO: change child element categories
      // TODO: change child subModels
      return concat(
        // Change elements state
        defer(() => {
          if (!viewport.viewsModel(modelId)) {
            if (!on) {
              return this.queueElementsVisibilityChange(elementIds, on, false);
            }

            return this.showModelWithoutAnyCategoriesOrElements(modelId).pipe(
              mergeMap(() => {
                const defaultVisibility = this.getVisibleModelCategoriesDirectVisibilityStatus({
                  categoryIds: categoryId,
                  modelId,
                });
                const displayedByDefault = defaultVisibility.state === "visible";
                return this.queueElementsVisibilityChange(elementIds, on, displayedByDefault);
              }),
            );
          }

          const categoryVisibility = this.getVisibleModelCategoriesDirectVisibilityStatus({ categoryIds: categoryId, modelId });
          const isDisplayedByDefault = categoryVisibility.state === "visible";
          return this.queueElementsVisibilityChange(elementIds, on, isDisplayedByDefault);
        }),
        // Change visibility of elements that are models
        from(Id64.iterable(elementIds)).pipe(
          mergeMap((elementId) =>
            from(this.#props.treeWidgetIdsCache.hasSubModel(elementId)).pipe(
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
