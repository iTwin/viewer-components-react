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
import { createVisibilityStatus } from "../Tooltip.js";
import { getSetFromId64Arg, setDifference, setIntersection } from "../Utils.js";
import {
  changeElementStateNoChildrenOperator,
  enableCategoryDisplay,
  getVisibilityFromAlwaysAndNeverDrawnElementsImpl,
  mergeVisibilityStatuses,
} from "../VisibilityUtils.js";

import type { Observable, Subscription } from "rxjs";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
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

/** @internal */
export interface BaseIdsCache {
  hasSubModel: (elementId: Id64String) => Promise<boolean>;
  getElementsCount: (props: { modelId: Id64String; categoryId: Id64String }) => Observable<number>;
  getSubCategories: (props: { categoryIds: Id64Arg }) => Observable<{ id: Id64String; subCategories: Id64Arg | undefined }>;
  getModels: (props: { categoryIds: Id64Arg }) => Observable<{ id: Id64String; models: Id64Arg | undefined }>;
  getCategories: (props: { modelIds: Id64Arg }) => Observable<{ id: Id64String; drawingCategories?: Id64Arg; spatialCategories?: Id64Arg }>;
  getSubModels: (
    props: { modelIds: Id64Arg } | { categoryIds: Id64Arg; modelId: Id64String | undefined },
  ) => Observable<{ id: Id64String; subModels: Id64Arg | undefined }>;
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
  viewport: Viewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfo;
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
  private readonly _alwaysAndNeverDrawnElements: AlwaysAndNeverDrawnElementInfo;
  private _elementChangeQueue = new Subject<Observable<void>>();
  private _subscriptions: Subscription[] = [];

  constructor(private readonly _props: BaseVisibilityHelperProps) {
    this._alwaysAndNeverDrawnElements = this._props.alwaysAndNeverDrawnElementInfo;
    this._subscriptions.push(this._elementChangeQueue.pipe(concatAll()).subscribe());
  }

  public [Symbol.dispose]() {
    this._subscriptions.forEach((x) => x.unsubscribe());
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
      if ((type === "GeometricModel3d" && !this._props.viewport.view.isSpatialView()) || (type === "GeometricModel2d" && this._props.viewport.view.is3d())) {
        return of(createVisibilityStatus("disabled"));
      }
      return from(Id64.iterable(modelIds)).pipe(
        mergeMap((modelId) => {
          // For hidden models we only need to check subModels
          if (!this._props.viewport.view.viewsModel(modelId)) {
            return this._props.baseIdsCache.getSubModels({ modelIds: modelId }).pipe(
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
          return this._props.baseIdsCache.getCategories({ modelIds: modelId }).pipe(
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
    return this._props.overrideHandler
      ? this._props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: { modelIds: props.modelIds },
          nonOverridenResult: result,
          override: this._props.overrides?.getModelsVisibilityStatus,
        })
      : result;
  }

  /**
   * Gets visibility status of a model's categories, assuming model is visible.
   *
   * Determines visibility status by checking:
   * - Elements in the viewports' always/never drawn lists;
   * - Default categories visibility status in the viewport;
   * - Submodels that are related to the modelId and categoryIds
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
      this._props.baseIdsCache.getSubModels({ modelId, categoryIds }).pipe(
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
      props.modelId ? of({ id: props.categoryId, models: props.modelId }) : from(this._props.baseIdsCache.getModels({ categoryIds: props.categoryId }))
    ).pipe(
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
      if (Id64.sizeOf(categoryIds) === 0) {
        return EMPTY;
      }

      const isSupportedInView =
        (this._props.viewport.view.is3d() && type === "SpatialCategory") || (this._props.viewport.view.is2d() && type === "DrawingCategory");
      if (!isSupportedInView) {
        return of(createVisibilityStatus("disabled"));
      }

      return (
        modelIdFromProps
          ? from(Id64.iterable(categoryIds)).pipe(map((categoryId) => ({ id: categoryId, models: modelIdFromProps })))
          : this._props.baseIdsCache.getModels({ categoryIds })
      ).pipe(
        map(({ id, models }) => {
          const acc = { categoryId: id, visibleModels: new Array<Id64String>(), hiddenModels: new Array<Id64String>() };
          if (!models) {
            return acc;
          }
          for (const modelId of Id64.iterable(models)) {
            if (this._props.viewport.view.viewsModel(modelId)) {
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
              ? this._props.baseIdsCache.getSubModels({ modelIds: hiddenModels }).pipe(
                  mergeMap(({ subModels }) => {
                    if (subModels && Id64.sizeOf(subModels) > 0) {
                      return this.getModelsVisibilityStatus({
                        modelIds: subModels,
                        type: this._props.viewport.view.is3d() ? "GeometricModel3d" : "GeometricModel2d",
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
                      type: this._props.viewport.view.is3d() ? "GeometricModel3d" : "GeometricModel2d",
                    }),
                  ),
                )
              : EMPTY,
            // We need to check subCategories as well
            this._props.baseIdsCache.getSubCategories({ categoryIds: categoryId }).pipe(
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

    return this._props.overrideHandler
      ? this._props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: props,
          nonOverridenResult: result,
          override: this._props.overrides?.getCategoriesVisibilityStatus,
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

      const isSupportedInView =
        (this._props.viewport.view.is3d() && type === "GeometricElement3d") || (this._props.viewport.view.is2d() && type === "GeometricElement2d");
      if (!isSupportedInView) {
        return of(createVisibilityStatus("disabled"));
      }

      // TODO: check child elements that are subModels
      if (!this._props.viewport.view.viewsModel(modelId)) {
        return from(elementIds).pipe(
          mergeMap((elementId) =>
            from(this._props.baseIdsCache.hasSubModel(elementId)).pipe(
              mergeMap((isSubModel) => {
                if (isSubModel) {
                  return this.getModelsVisibilityStatus({
                    modelIds: elementId,
                    type: this._props.viewport.view.is3d() ? "GeometricModel3d" : "GeometricModel2d",
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
              from(this._props.baseIdsCache.hasSubModel(elementId)).pipe(
                mergeMap((isSubModel) => {
                  if (isSubModel) {
                    return this.getModelsVisibilityStatus({
                      modelIds: elementId,
                      type: this._props.viewport.view.is3d() ? "GeometricModel3d" : "GeometricModel2d",
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
    return this._props.overrideHandler
      ? this._props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: props,
          nonOverridenResult: result,
          override: this._props.overrides?.getElementsVisibilityStatus,
        })
      : result;
  }

  /** Gets visiblity status of elements based on viewport's always/never drawn elements and related categories and models. */
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
      mergeMap((categoryId) => this._props.baseIdsCache.getElementsCount({ modelId, categoryId })),
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

      const viewport = this._props.viewport;

      viewport.perModelCategoryVisibility.clearOverrides(modelIds);
      if (!on) {
        viewport.changeModelDisplay(modelIds, false);
        return this._props.baseIdsCache
          .getSubModels({ modelIds })
          .pipe(mergeMap(({ subModels }) => (subModels ? this.changeModelsVisibilityStatus({ modelIds: subModels, on }) : EMPTY)));
      }

      return concat(
        from(viewport.addViewedModels(modelIds)),
        this._props.baseIdsCache.getCategories({ modelIds }).pipe(
          mergeMap(({ id, drawingCategories, spatialCategories }) => {
            return merge(
              drawingCategories ? this.changeCategoriesVisibilityStatus({ categoryIds: drawingCategories, modelId: id, on }) : EMPTY,
              spatialCategories ? this.changeCategoriesVisibilityStatus({ categoryIds: spatialCategories, modelId: id, on }) : EMPTY,
            );
          }),
        ),
      );
    });
    return this._props.overrideHandler
      ? this._props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: props,
          nonOverridenResult: result,
          override: this._props.overrides?.changeModelsVisibilityStatus,
        })
      : result;
  }

  /** Turns model on and turns off elements with categories related to that model. */
  private showModelWithoutAnyCategoriesOrElements(modelId: Id64String, categoriesToNotOverride?: Id64Arg): Observable<void> {
    const viewport = this._props.viewport;
    return forkJoin({
      allModelCategories: this._props.baseIdsCache.getCategories({ modelIds: modelId }).pipe(
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

  /** Adds per-model category overrides based on category visibility in category selector. */
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
      const viewport = this._props.viewport;
      const modelIdsObservable = (
        modelIdFromProps
          ? of(new Map<ModelId, Set<CategoryId>>([[modelIdFromProps, getSetFromId64Arg(categoryIds)]]))
          : this._props.baseIdsCache.getModels({ categoryIds }).pipe(
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
        this._props.baseIdsCache
          .getSubModels({ categoryIds, modelId: modelIdFromProps })
          .pipe(mergeMap(({ subModels }) => (subModels ? this.changeModelsVisibilityStatus({ modelIds: subModels, on }) : EMPTY))),
      );
    });
    return this._props.overrideHandler
      ? this._props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: props,
          nonOverridenResult: result,
          override: this._props.overrides?.changeCategoriesVisibilityStatus,
        })
      : result;
  }

  /**
   * Changes visibility status of elements by adding them to the viewport's always/never drawn elements.
   *
   * Also, changes vibility status of specified elements that are models.
   */
  public changeElementsVisibilityStatus(props: { elementIds: Id64Arg; modelId: Id64String; categoryId: Id64String; on: boolean }): Observable<void> {
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
            from(this._props.baseIdsCache.hasSubModel(elementId)).pipe(
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
    return this._props.overrideHandler
      ? this._props.overrideHandler.createVisibilityHandlerResult({
          overrideProps: props,
          nonOverridenResult: result,
          override: this._props.overrides?.changeElementsVisibilityStatus,
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
}
