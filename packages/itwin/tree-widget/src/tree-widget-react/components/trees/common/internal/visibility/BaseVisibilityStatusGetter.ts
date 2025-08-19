/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defaultIfEmpty, defer, EMPTY, forkJoin, from, map, merge, mergeMap, of, reduce } from "rxjs";
import { assert, Id64 } from "@itwin/core-bentley";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { createVisibilityHandlerResult } from "../../UseHierarchyVisibility.js";
import { createVisibilityStatus } from "../Tooltip.js";
import { setIntersection } from "../Utils.js";
import { getVisibilityFromAlwaysAndNeverDrawnElementsImpl, mergeVisibilityStatuses } from "../VisibilityUtils.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { HierarchyVisibilityHandler, VisibilityStatus } from "../../UseHierarchyVisibility.js";
import type { AlwaysAndNeverDrawnElementInfo } from "../AlwaysAndNeverDrawnElementInfo.js";
import type { GetVisibilityFromAlwaysAndNeverDrawnElementsProps } from "../VisibilityUtils.js";
import type { BaseTreeVisibilityHandlerOverrides, VisibilityStatusHelper } from "./TreeVisibilityHandler.js";

/** @internal */
export interface BaseVisibilityStatusGetterProps {
  viewport: Viewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfo;
  visibilityHandler: HierarchyVisibilityHandler;
  overrides?: BaseTreeVisibilityHandlerOverrides;
  visibilityStatusHelper: VisibilityStatusHelper;
}

/**
 * Base class for visibility status getters.
 *
 * It provides methods that help retrieve visibility statuses of models, categories, sub-categories and elements.
 * @internal
 */
export class BaseVisibilityStatusGetter {
  private readonly _alwaysAndNeverDrawnElements: AlwaysAndNeverDrawnElementInfo;
  private readonly _visibilityHandler: HierarchyVisibilityHandler;

  constructor(private readonly _props: BaseVisibilityStatusGetterProps) {
    this._alwaysAndNeverDrawnElements = this._props.alwaysAndNeverDrawnElementInfo;
    this._visibilityHandler = this._props.visibilityHandler;
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
            return this._props.visibilityStatusHelper.getSubModels({ modelIds: modelId }).pipe(
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
          return this._props.visibilityStatusHelper.getCategories({ modelIds: modelId }).pipe(
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

    return createVisibilityHandlerResult(this._visibilityHandler, props, result, this._props.overrides?.getModelsVisibilityStatus);
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
        defaultStatus: () => this.getVisibleModelDefaultCategoriesVisibilityStatus({ modelId, categoryIds }),
      }),
      this._props.visibilityStatusHelper.getSubModels({ modelId, categoryIds }).pipe(
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
      props.modelId
        ? of({ id: props.categoryId, models: props.modelId })
        : from(this._props.visibilityStatusHelper.getModels({ categoryIds: props.categoryId }))
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
          : this._props.visibilityStatusHelper.getModels({ categoryIds })
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
              ? this._props.visibilityStatusHelper.getSubModels({ modelIds: hiddenModels }).pipe(
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
            this._props.visibilityStatusHelper.getSubCategories({ categoryIds: categoryId }).pipe(
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

    return createVisibilityHandlerResult(this._visibilityHandler, props, result, this._props.overrides?.getCategoriesVisibilityStatus);
  }

  /**
   * Gets visibility status of categories, assuming model is visible.
   *
   * Determines visibility status by checking:
   * - Per model category visibility overrides;
   * - Category selector visibility in the viewport.
   */
  public getVisibleModelDefaultCategoriesVisibilityStatus({ modelId, categoryIds }: { categoryIds: Id64Arg; modelId: Id64String }): VisibilityStatus {
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
            from(this._props.visibilityStatusHelper.hasSubModel(elementId)).pipe(
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
        defaultStatus: () => this.getVisibleModelDefaultCategoriesVisibilityStatus({ categoryIds: categoryId, modelId }),
      }).pipe(
        mergeMap((visibilityStatusAlwaysAndNeverDraw) => {
          return from(Id64.iterable(elementIds)).pipe(
            mergeMap((elementId) =>
              from(this._props.visibilityStatusHelper.hasSubModel(elementId)).pipe(
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
    return createVisibilityHandlerResult(this._visibilityHandler, props, result, this._props.overrides?.getElementsVisibilityStatus);
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
      mergeMap((categoryId) => this._props.visibilityStatusHelper.getElementsCount({ modelId, categoryId })),
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
}
