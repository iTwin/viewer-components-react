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
import { setDifference, setIntersection } from "../Utils.js";
import {
  changeElementStateNoChildrenOperator,
  enableCategoryDisplay,
  getVisibilityFromAlwaysAndNeverDrawnElementsImpl,
  mergeVisibilityStatuses,
} from "../VisibilityUtils.js";

import type { AlwaysAndNeverDrawnElementInfo } from "../AlwaysAndNeverDrawnElementInfo.js";
import type { CategoryId, ElementId, ModelId, SubCategoryId } from "../Types.js";
import type { GetVisibilityFromAlwaysAndNeverDrawnElementsProps } from "../VisibilityUtils.js";
import type { VisibilityStatus } from "../../UseHierarchyVisibility.js";
import type { Observable, Subscription } from "rxjs";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";

/**
 * Props for `createCategoriesTreeVisibilityHandler`.
 * @internal
 */
export interface BaseVisibilityStatusHelperProps {
  viewport: Viewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfo;
  hasSubModel: (elementId: Id64String) => Promise<boolean>;
  getElementsCount: (props: { modelId: Id64String; categoryId: Id64String }) => Observable<number>;
  getSubCategories: (props: { categoryIds: Id64Arg }) => Observable<{ id: Id64String; subCategories: Array<SubCategoryId> }>;
  getModels: (props: { categoryIds: Id64Arg }) => Observable<{ id: Id64String; models: Array<ModelId> }>;
  getCategories: (props: { modelIds: Id64Arg }) => Observable<{ id: Id64String; drawingCategories?: Array<CategoryId>; spatialCategories?: Array<CategoryId> }>;
  getSubModels: (
    props: { modelIds: Id64Arg } | { categoryIds: Id64Arg; modelId: Id64String | undefined },
  ) => Observable<{ id: Id64String; subModels: Array<ModelId> }>;
}

export class BaseVisibilityStatusHelper implements Disposable {
  private readonly _alwaysAndNeverDrawnElements: AlwaysAndNeverDrawnElementInfo;
  private _elementChangeQueue = new Subject<Observable<void>>();
  private _subscriptions: Subscription[] = [];

  constructor(private readonly _props: BaseVisibilityStatusHelperProps) {
    this._alwaysAndNeverDrawnElements = this._props.alwaysAndNeverDrawnElementInfo;
    this._subscriptions.push(this._elementChangeQueue.pipe(concatAll()).subscribe());
  }

  public [Symbol.dispose]() {
    this._subscriptions.forEach((x) => x.unsubscribe());
  }

  public getModelsVisibilityStatus({ modelIds, type }: { modelIds: Id64Arg; type: "GeometricModel3d" | "GeometricModel2d" }): Observable<VisibilityStatus> {
    if ((type === "GeometricModel3d" && !this._props.viewport.view.isSpatialView()) || (type === "GeometricModel2d" && this._props.viewport.view.is3d())) {
      return of(createVisibilityStatus("disabled"));
    }
    return from(Id64.iterable(modelIds)).pipe(
      mergeMap((modelId) => {
        // For hidden models we only need to check subModels
        if (!this._props.viewport.view.viewsModel(modelId)) {
          return this._props.getSubModels({ modelIds: modelId }).pipe(
            mergeMap(({ subModels }) => {
              if (subModels.length > 0) {
                return this.getModelsVisibilityStatus({ modelIds: subModels, type }).pipe(
                  map((subModelsVisibilityStatus) =>
                    subModelsVisibilityStatus.state !== "hidden" ? createVisibilityStatus("partial") : createVisibilityStatus("hidden"),
                  ),
                );
              }
              return of(createVisibilityStatus("hidden"));
            }),
            mergeVisibilityStatuses,
          );
        }
        // For visible models we need to check all categories
        return this._props.getCategories({ modelIds: modelId }).pipe(
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
          mergeVisibilityStatuses,
        );
      }),
      mergeVisibilityStatuses,
    );
  }

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
      this._props.getSubModels({ modelId, categoryIds }).pipe(
        mergeMap(({ subModels }) => {
          if (subModels.length > 0) {
            return this.getModelsVisibilityStatus({ modelIds: subModels, type });
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

  public getSubCategoriesVisibilityStatus(props: { subCategoryIds: Id64Arg; categoryId: Id64String; modelId?: Id64String }): Observable<VisibilityStatus> {
    return (props.modelId ? of({ id: props.categoryId, models: [props.modelId] }) : from(this._props.getModels({ categoryIds: props.categoryId }))).pipe(
      map(({ models }) => models),
      map((categoryModels) => {
        let visibility: "visible" | "hidden" | "unknown" = "unknown";
        let nonDefaultModelDisplayStatesCount = 0;
        for (const modelId of categoryModels) {
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
        if (categoryModels && Id64.sizeOf(categoryModels) > 0 && nonDefaultModelDisplayStatesCount === Id64.sizeOf(categoryModels)) {
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

  public getCategoriesVisibilityStatus({
    categoryIds,
    modelId: modelIdFromProps,
    type,
  }: {
    categoryIds: Id64Arg;
    modelId: Id64String | undefined;
    type: "DrawingCategory" | "SpatialCategory";
  }): Observable<VisibilityStatus> {
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
        ? from(Id64.iterable(categoryIds)).pipe(map((categoryId) => ({ id: categoryId, models: [modelIdFromProps] })))
        : this._props.getModels({ categoryIds })
    ).pipe(
      map(({ id, models }) => {
        const result = { categoryId: id, visibleModels: new Array<Id64String>(), hiddenModels: new Array<Id64String>() };
        models.forEach((modelId) => {
          if (this._props.viewport.viewsModel(modelId)) {
            result.visibleModels.push(modelId);
          } else {
            result.hiddenModels.push(modelId);
          }
        });
        return result;
      }),
      mergeMap(({ categoryId, visibleModels, hiddenModels }) => {
        return merge(
          // For hidden models we only need to check subModels
          hiddenModels.length > 0
            ? this._props.getSubModels({ modelIds: hiddenModels }).pipe(
                mergeMap(({ subModels }) => {
                  if (subModels.length > 0) {
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
                mergeVisibilityStatuses,
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
                  }).pipe(
                    mergeMap((categoryVisibilityStatus) => {
                      // When category is either:
                      // - partial / not viewed in selector
                      // - visible due to model 'show' override
                      // - under model
                      // We don't need to check subCategories
                      // if (
                      //   categoryVisibilityStatus.state === "partial" ||
                      //   modelIdFromProps
                      // ) {
                      return of(categoryVisibilityStatus);
                      // }
                      // return this._props.getSubCategories({ categoryIds: categoryId }).pipe(
                      //   mergeMap(({ subCategories }) => this.getSubCategoriesVisibilityStatus({ subCategoryIds: subCategories, categoryId, modelId })),
                      //   startWith<VisibilityStatus>(categoryVisibilityStatus),
                      //   mergeVisibilityStatuses,
                      // );
                    }),
                  ),
                ),
                mergeVisibilityStatuses,
              )
            : EMPTY,
          // If modelId was not provided, that means we want to check subCategories as well
          !modelIdFromProps
            ? this._props.getSubCategories({ categoryIds: categoryId }).pipe(
                mergeMap(({ subCategories }) => {
                  if (subCategories.length === 0 && (visibleModels.length > 0 || hiddenModels.length > 0)) {
                    return EMPTY;
                  }
                  if (!this._props.viewport.view.viewsCategory(categoryId)) {
                    return of(createVisibilityStatus("hidden"));
                  }
                  return of(this.getVisibileCategorySubCategoriesVisibilityStatus({ subCategoryIds: subCategories }));
                }),
              )
            : EMPTY,
        ).pipe(mergeVisibilityStatuses);
      }),
      mergeVisibilityStatuses,
    );
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

  public getGroupedElementsVisibilityStatus(props: {
    modelElementsMap: Map<ModelId, Set<ElementId>>;
    categoryId: Id64String;
    type: "GeometricElement3d" | "GeometricElement2d";
  }): Observable<VisibilityStatus> {
    const { modelElementsMap, categoryId, type } = props;
    return from(modelElementsMap).pipe(
      mergeMap(([modelId, elementIds]) => this.getElementsVisibilityStatus({ elementIds, modelId, categoryId, type })),
      mergeVisibilityStatuses,
    );
  }

  public getElementsVisibilityStatus(props: {
    elementIds: Id64Arg;
    modelId: Id64String;
    categoryId: Id64String;
    type: "GeometricElement3d" | "GeometricElement2d";
  }): Observable<VisibilityStatus> {
    const { elementIds, modelId, categoryId, type } = props;

    const isSupportedInView =
      (this._props.viewport.view.is3d() && type === "GeometricElement3d") || (this._props.viewport.view.is2d() && type === "GeometricElement2d");
    if (!isSupportedInView) {
      return of(createVisibilityStatus("disabled"));
    }

    // TODO: check child subModels
    if (!this._props.viewport.view.viewsModel(modelId)) {
      return from(elementIds).pipe(
        mergeMap((elementId) =>
          from(this._props.hasSubModel(elementId)).pipe(
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
    // TODO: check child subModels
    return this.getVisibilityFromAlwaysAndNeverDrawnElements({
      elements: elementIds,
      defaultStatus: () => this.getVisibleModelDefaultCategoriesVisibilityStatus({ categoryIds: categoryId, modelId }),
    }).pipe(
      mergeMap((visibilityStatusAlwaysAndNeverDraw) => {
        return from(Id64.iterable(elementIds)).pipe(
          mergeMap((elementId) =>
            from(this._props.hasSubModel(elementId)).pipe(
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
  }

  public changeModelsVisibilityStatus(props: { modelIds: Id64Arg; on: boolean }): Observable<void> {
    const { modelIds, on } = props;

    if (Id64.sizeOf(modelIds) === 0) {
      return EMPTY;
    }

    const viewport = this._props.viewport;

    viewport.perModelCategoryVisibility.clearOverrides(modelIds);
    if (!on) {
      viewport.changeModelDisplay(modelIds, false);
      return this._props.getSubModels({ modelIds }).pipe(mergeMap(({ subModels }) => this.changeModelsVisibilityStatus({ modelIds: subModels, on })));
    }

    return concat(
      from(viewport.addViewedModels(modelIds)),
      this._props.getCategories({ modelIds }).pipe(
        mergeMap(({ id, drawingCategories, spatialCategories }) => {
          return merge(
            drawingCategories ? this.changeCategoriesVisibilityStatus({ categoryIds: drawingCategories, modelId: id, on }) : EMPTY,
            spatialCategories ? this.changeCategoriesVisibilityStatus({ categoryIds: spatialCategories, modelId: id, on }) : EMPTY,
          );
        }),
      ),
    );
  }

  private showModelWithoutAnyCategoriesOrElements(modelId: Id64String, categoriesToNotOverride?: Id64Arg): Observable<void> {
    const viewport = this._props.viewport;
    return forkJoin({
      allModelCategories: this._props.getCategories({ modelIds: modelId }).pipe(
        reduce((acc, { drawingCategories, spatialCategories }) => {
          drawingCategories?.forEach((category) => acc.add(category));
          spatialCategories?.forEach((category) => acc.add(category));
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
          ? setDifference(
              allModelCategories,
              typeof categoriesToNotOverride === "string"
                ? new Set([categoriesToNotOverride])
                : Array.isArray(categoriesToNotOverride)
                  ? new Set(categoriesToNotOverride)
                  : categoriesToNotOverride,
            )
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

  public changeCategoriesVisibilityStatus(props: { modelId: Id64String | undefined; categoryIds: Id64Arg; on: boolean }): Observable<void> {
    const { modelId: modelIdFromProps, categoryIds, on } = props;
    const viewport = this._props.viewport;
    const modelIdsObservable = (
      modelIdFromProps
        ? of(
            new Map<ModelId, Set<CategoryId>>([
              [modelIdFromProps, typeof categoryIds === "string" ? new Set([categoryIds]) : Array.isArray(categoryIds) ? new Set(categoryIds) : categoryIds],
            ]),
          )
        : this._props.getModels({ categoryIds }).pipe(
            reduce((acc, { id, models }) => {
              models.forEach((modelId) => {
                let entry = acc.get(modelId);
                if (!entry) {
                  entry = new Set();
                  acc.set(modelId, entry);
                }
                entry.add(id);
              });
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
      this._props
        .getSubModels({ categoryIds, modelId: modelIdFromProps })
        .pipe(mergeMap(({ subModels }) => this.changeModelsVisibilityStatus({ modelIds: subModels, on }))),
    );
  }

  public changeElementsVisibilityStatus(props: { elementIds: Id64Arg; modelId: Id64String; categoryId: Id64String; on: boolean }): Observable<void> {
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
          from(this._props.hasSubModel(elementId)).pipe(
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
  }

  public changeGroupedElementsVisibilityStatus(props: {
    modelElementsMap: Map<ModelId, Set<ElementId>>;
    categoryId: Id64String;
    on: boolean;
  }): Observable<void> {
    return from(props.modelElementsMap).pipe(
      mergeMap(([modelId, elementIds]) => {
        return this.changeElementsVisibilityStatus({ modelId, elementIds, categoryId: props.categoryId, on: props.on });
      }),
    );
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
      mergeMap((categoryId) => this._props.getElementsCount({ modelId, categoryId })),
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
