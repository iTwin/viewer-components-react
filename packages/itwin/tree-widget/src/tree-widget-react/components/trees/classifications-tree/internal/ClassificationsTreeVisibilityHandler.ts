/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  concat, concatAll, defaultIfEmpty, defer, distinct, EMPTY, filter, firstValueFrom, forkJoin, from, fromEventPattern, map, merge, mergeAll, mergeMap,
  of, reduce, shareReplay, startWith, Subject, take, takeUntil, tap, toArray,
} from "rxjs";
import { assert, Id64 } from "@itwin/core-bentley";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { HierarchyNode, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { AlwaysAndNeverDrawnElementInfo } from "../../common/internal/AlwaysAndNeverDrawnElementInfo.js";
import { toVoidPromise } from "../../common/internal/Rxjs.js";
import { createVisibilityStatus } from "../../common/internal/Tooltip.js";
import { setDifference, setIntersection } from "../../common/internal/Utils.js";
import { createVisibilityChangeEventListener } from "../../common/internal/VisibilityChangeEventListener.js";
import {
  changeElementStateNoChildrenOperator, enableCategoryDisplay, getElementOverriddenVisibility, getElementVisibility,
  getSubModeledElementsVisibilityStatus, getVisibilityFromAlwaysAndNeverDrawnElementsImpl, mergeVisibilityStatuses,
} from "../../common/internal/VisibilityUtils.js";
import { createVisibilityHandlerResult } from "../../common/UseHierarchyVisibility.js";
import { ClassificationsTreeNode } from "./ClassificationsTreeNode.js";

import type { GetVisibilityFromAlwaysAndNeverDrawnElementsProps } from "../../common/internal/VisibilityUtils.js";
import type { Viewport } from "@itwin/core-frontend";
import type { HierarchyVisibilityHandler, VisibilityStatus } from "../../common/UseHierarchyVisibility.js";
import type { NonPartialVisibilityStatus } from "../../common/internal/Tooltip.js";
import type { Observable, Subscription } from "rxjs";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { ClassificationsTreeIdsCache } from "./ClassificationsTreeIdsCache.js";
import type { IVisibilityChangeEventListener } from "../../common/internal/VisibilityChangeEventListener.js";
import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { CategoryId, ElementId } from "../../common/internal/Types.js";

/**
 * Props for `createClassificationsTreeVisibilityHandler`.
 * @internal
 */
export interface ClassificationsTreeVisibilityHandlerProps {
  viewport: Viewport;
  idsCache: ClassificationsTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
}

/**
 * Creates an instance if `ClassificationsTreeVisibilityHandler`.
 * @internal
 */
export function createClassificationsTreeVisibilityHandler(props: ClassificationsTreeVisibilityHandlerProps): HierarchyVisibilityHandler & Disposable {
  return new ClassificationsTreeVisibilityHandlerImpl(props);
}

class ClassificationsTreeVisibilityHandlerImpl implements HierarchyVisibilityHandler {
  private readonly _eventListener: IVisibilityChangeEventListener;
  private readonly _alwaysAndNeverDrawnElements: AlwaysAndNeverDrawnElementInfo;
  private readonly _idsCache: ClassificationsTreeIdsCache;
  private _elementChangeQueue = new Subject<Observable<void>>();
  private _subscriptions: Subscription[] = [];
  private _changeRequest = new Subject<{ key: HierarchyNodeKey; depth: number }>();

  constructor(private readonly _props: ClassificationsTreeVisibilityHandlerProps) {
    this._eventListener = createVisibilityChangeEventListener({
      viewport: _props.viewport,
      listeners: {
        models: true,
        categories: true,
        elements: true,
      },
    });
    this._alwaysAndNeverDrawnElements = new AlwaysAndNeverDrawnElementInfo(_props.viewport);
    this._idsCache = this._props.idsCache;
    this._subscriptions.push(this._elementChangeQueue.pipe(concatAll()).subscribe());
  }

  public [Symbol.dispose]() {
    this._eventListener[Symbol.dispose]();
    this._alwaysAndNeverDrawnElements[Symbol.dispose]();
    this._subscriptions.forEach((x) => x.unsubscribe());
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
        defaultIfEmpty(createVisibilityStatus("disabled")),
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

  private getVisibilityStatusObs(node: HierarchyNode): Observable<VisibilityStatus> {
    if (!HierarchyNode.isInstancesNode(node)) {
      return EMPTY;
    }

    if (ClassificationsTreeNode.isClassificationTableNode(node)) {
      return this.getClassificationTableDisplayStatus({
        classificationTableIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    if (ClassificationsTreeNode.isClassificationNode(node)) {
      return this.getClassificationDisplayStatus({
        classificationIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    return this.getGeometricElementDisplayStatus({
      elementId: (() => {
        assert(node.key.instanceKeys.length === 1);
        return node.key.instanceKeys[0].id;
      })(),
      modelId: ClassificationsTreeNode.getModelId(node),
      categoryId: ClassificationsTreeNode.getCategoryId(node),
      elementType: node.extendedData?.type,
    });
  }

  private getClassificationTableDisplayStatus(props: { classificationTableIds: Id64Array }): Observable<VisibilityStatus> {
    const result = defer(() => {
      return from(this._idsCache.getAllContainedCategories(props.classificationTableIds)).pipe(
        mergeMap(({ drawing, spatial }) =>
          merge(
            of(drawing).pipe(mergeMap((categoryIds) => this.getCategoryDisplayStatus({ categoryIds, type: "DrawingCategory" }))),
            of(spatial).pipe(mergeMap((categoryIds) => this.getCategoryDisplayStatus({ categoryIds, type: "SpatialCategory" }))),
          ),
        ),
        mergeVisibilityStatuses,
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private getClassificationDisplayStatus(props: { classificationIds: Id64Array }): Observable<VisibilityStatus> {
    const result = defer(() => {
      return from(this._idsCache.getAllContainedCategories(props.classificationIds)).pipe(
        mergeMap(({ drawing, spatial }) =>
          merge(
            of(drawing).pipe(mergeMap((categoryIds) => this.getCategoryDisplayStatus({ categoryIds, type: "DrawingCategory" }))),
            of(spatial).pipe(mergeMap((categoryIds) => this.getCategoryDisplayStatus({ categoryIds, type: "SpatialCategory" }))),
          ),
        ),
        mergeVisibilityStatuses,
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private getModelVisibilityStatus({ modelIds }: { modelIds: Id64Array | Id64Set }): Observable<VisibilityStatus> {
    const result = defer(() => {
      const viewport = this._props.viewport;
      return from(modelIds).pipe(
        distinct(),
        mergeMap((modelId) => {
          if (!viewport.view.viewsModel(modelId)) {
            return from(this._idsCache.getModelCategoryIds(modelId)).pipe(
              mergeMap(({ drawing, spatial }) => merge(drawing, spatial)),
              toArray(),
              mergeMap((categoryIds) => from(this._idsCache.getCategoriesModeledElements(modelId, categoryIds))),
              getSubModeledElementsVisibilityStatus({
                parentNodeVisibilityStatus: createVisibilityStatus("hidden"),
                getModelVisibilityStatus: (modelProps) => this.getModelVisibilityStatus(modelProps),
              }),
            );
          }
          return from(this._idsCache.getModelCategoryIds(modelId)).pipe(
            mergeMap(({ drawing, spatial }) =>
              merge(
                of(drawing).pipe(mergeMap((categoryIds) => this.getCategoryDisplayStatus({ modelId, categoryIds, type: "DrawingCategory" }))),
                of(spatial).pipe(mergeMap((categoryIds) => this.getCategoryDisplayStatus({ modelId, categoryIds, type: "SpatialCategory" }))),
              ),
            ),
            mergeVisibilityStatuses,
          );
        }),
        mergeVisibilityStatuses,
      );
    });
    return createVisibilityHandlerResult(this, { ids: modelIds }, result, undefined);
  }

  private getDefaultModelsCategoryVisibilityStatus({ modelId, categoryIds }: { categoryIds: Id64Array; modelId: Id64String }): VisibilityStatus {
    const viewport = this._props.viewport;

    if (!viewport.view.viewsModel(modelId)) {
      return createVisibilityStatus("hidden");
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
        return createVisibilityStatus("partial");
      }
    }
    if (hiddenCount + visibleCount > 0) {
      return createVisibilityStatus(hiddenCount > 0 ? "hidden" : "visible");
    }

    return createVisibilityStatus(visibleThroughCategorySelectorCount > 0 ? "visible" : "hidden");
  }

  private getDefaultCategoryVisibilityStatus({ categoryIds }: { categoryIds: Array<CategoryId> }): Observable<VisibilityStatus> {
    const result = from(categoryIds).pipe(
      mergeMap(async (categoryId) => {
        let visibility: "visible" | "hidden" | "unknown" = "unknown";
        const categoryModels = [...(await this._idsCache.getCategoriesElementModels([categoryId], true)).values()].flat();
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
          const override = this._props.viewport.perModelCategoryVisibility.getOverride(modelId, categoryId);
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

        if (categoryModels.length > 0 && nonDefaultModelDisplayStatesCount === categoryModels.length) {
          assert(visibility === "visible" || visibility === "hidden");
          return createVisibilityStatus(visibility);
        }

        if (!this._props.viewport.view.viewsCategory(categoryId)) {
          return createVisibilityStatus(visibility === "visible" ? "partial" : "hidden");
        }

        if (visibility === "hidden") {
          return createVisibilityStatus("partial");
        }
        return createVisibilityStatus("visible");
      }),
      mergeVisibilityStatuses,
    );
    return result;
  }

  private getCategoryDisplayStatus(props: {
    modelId?: Id64String;
    categoryIds: Id64Array;
    type: "DrawingCategory" | "SpatialCategory";
  }): Observable<VisibilityStatus> {
    const result = defer(() => {
      if (props.categoryIds.length === 0) {
        return EMPTY;
      }

      const isSupportedInView =
        (this._props.viewport.view.is3d() && props.type === "SpatialCategory") || (this._props.viewport.view.is2d() && props.type === "DrawingCategory");
      if (!isSupportedInView) {
        return of(createVisibilityStatus("disabled"));
      }

      const modelsObservable = props.modelId
        ? of(new Map(props.categoryIds.map((id) => [id, [props.modelId!]])))
        : from(this._idsCache.getCategoriesElementModels(props.categoryIds));
      return merge(
        // get visibility status from always and never drawn elements
        modelsObservable.pipe(
          mergeMap((categoryModelsMap) => {
            if (categoryModelsMap.size === 0) {
              return props.modelId
                ? of(this.getDefaultModelsCategoryVisibilityStatus({ modelId: props.modelId, categoryIds: props.categoryIds }))
                : from(this.getDefaultCategoryVisibilityStatus({ categoryIds: props.categoryIds }));
            }
            return from(categoryModelsMap).pipe(
              mergeMap(([category, models]) =>
                from(models).pipe(
                  mergeMap((model) => {
                    if (this._props.viewport.view.viewsModel(model)) {
                      return this.getVisibilityFromAlwaysAndNeverDrawnElements({
                        queryProps: props,
                        defaultStatus: () => this.getDefaultModelsCategoryVisibilityStatus({ modelId: model, categoryIds: [category] }),
                      }).pipe(
                        mergeMap((visibilityStatusAlwaysAndNeverDraw) => {
                          return from(this._idsCache.getCategoriesModeledElements(model, [category])).pipe(
                            getSubModeledElementsVisibilityStatus({
                              parentNodeVisibilityStatus: visibilityStatusAlwaysAndNeverDraw,
                              getModelVisibilityStatus: (modelProps) => this.getModelVisibilityStatus(modelProps),
                            }),
                          );
                        }),
                      );
                    }
                    return from(this._idsCache.getCategoriesModeledElements(model, [category])).pipe(
                      getSubModeledElementsVisibilityStatus({
                        parentNodeVisibilityStatus: createVisibilityStatus("hidden"),
                        getModelVisibilityStatus: (modelProps) => this.getModelVisibilityStatus(modelProps),
                      }),
                    );
                  }),
                ),
              ),
              mergeVisibilityStatuses,
            );
          }),
          map((visibilityStatus) => {
            return { visibilityStatus, type: 0 as const };
          }),
        ),
        // get category status
        (props.modelId
          ? of(this.getDefaultModelsCategoryVisibilityStatus({ modelId: props.modelId, categoryIds: props.categoryIds }))
          : from(this.getDefaultCategoryVisibilityStatus({ categoryIds: props.categoryIds }))
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
            // In cases where Category has model (it means that category is under hidden subModel)
            // We don't need to look at default category status, it is already accounted for in always/never drawn visibility
            if (props.modelId) {
              return alwaysNeverDrawStatus;
            }

            if (alwaysNeverDrawStatus.state === "partial" || alwaysNeverDrawStatus.state !== defaultStatus.state) {
              return createVisibilityStatus("partial");
            }
            return alwaysNeverDrawStatus;
          },
        ),
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private getVisibilityFromAlwaysAndNeverDrawnElements(
    props: GetVisibilityFromAlwaysAndNeverDrawnElementsProps &
      ({ elements: Set<ElementId> } | { queryProps: { modelId?: Id64String; categoryIds: Id64Array } }),
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
          alwaysDrawn: viewport.alwaysDrawn?.size ? setIntersection(props.elements, viewport.alwaysDrawn) : undefined,
          neverDrawn: viewport.neverDrawn?.size ? setIntersection(props.elements, viewport.neverDrawn) : undefined,
          totalCount: props.elements.size,
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
          reduce((acc, specificModelCategoryCount) => acc + specificModelCategoryCount, 0),
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
          viewport,
        });
      }),
    );
  }

  private getGeometricElementDisplayStatus(props: {
    elementId: Id64String;
    categoryId: Id64String;
    modelId: Id64String;
    elementType: string;
  }): Observable<VisibilityStatus> {
    const result: Observable<VisibilityStatus> = defer(() => {
      const viewport = this._props.viewport;
      const { elementId, modelId, categoryId, elementType } = props;

      const isSupportedInView =
        (viewport.view.is3d() && elementType === "GeometricElement3d") || (viewport.view.is2d() && elementType === "GeometricElement2d");
      if (!isSupportedInView) {
        return of(createVisibilityStatus("disabled"));
      }

      const viewsModel = viewport.view.viewsModel(modelId);
      const elementStatus = getElementOverriddenVisibility({
        elementId,
        viewport,
      });

      return from(this._idsCache.hasSubModel(elementId)).pipe(
        mergeMap((hasSubModel) => (hasSubModel ? this.getModelVisibilityStatus({ modelIds: [elementId] }) : of(undefined))),
        map((subModelVisibilityStatus) =>
          getElementVisibility(
            viewsModel,
            elementStatus,
            this.getDefaultModelsCategoryVisibilityStatus({ categoryIds: [categoryId], modelId }) as NonPartialVisibilityStatus,
            subModelVisibilityStatus,
          ),
        ),
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private changeVisibilityObs(node: HierarchyNode, on: boolean): Observable<void> {
    if (!HierarchyNode.isInstancesNode(node)) {
      return EMPTY;
    }

    if (ClassificationsTreeNode.isClassificationTableNode(node)) {
      return this.changeClassificationTableDisplayState({
        classificationTableIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        on,
      });
    }

    if (ClassificationsTreeNode.isClassificationNode(node)) {
      return this.changeClassificationDisplayState({
        classificationIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        on,
      });
    }

    return this.changeGeometricElementsDisplayState({
      elementIds: new Set([...node.key.instanceKeys.map(({ id }) => id)]),
      modelId: ClassificationsTreeNode.getModelId(node),
      categoryId: ClassificationsTreeNode.getCategoryId(node),
      on,
    });
  }

  private changeClassificationTableDisplayState(props: { classificationTableIds: Id64Array; on: boolean }): Observable<void> {
    const result = defer(() => {
      return from(this._idsCache.getAllContainedCategories(props.classificationTableIds)).pipe(
        mergeMap(({ drawing, spatial }) => merge(drawing, spatial)),
        toArray(),
        mergeMap((categoryIds) => {
          return this.changeCategoryDisplayState({ categoryIds, on: props.on });
        }),
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private changeClassificationDisplayState(props: { classificationIds: Id64Array; on: boolean }): Observable<void> {
    const result = defer(() => {
      return from(this._idsCache.getAllContainedCategories(props.classificationIds)).pipe(
        mergeMap(({ drawing, spatial }) => merge(drawing, spatial)),
        toArray(),
        mergeMap((categoryIds) => {
          return this.changeCategoryDisplayState({ categoryIds, on: props.on });
        }),
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private changeModelDisplayState(props: { modelIds: Id64Arg; on: boolean }): Observable<void> {
    const { modelIds, on } = props;

    if (Id64.sizeOf(modelIds) === 0) {
      return EMPTY;
    }

    const result = defer(() => {
      const viewport = this._props.viewport;

      viewport.perModelCategoryVisibility.clearOverrides(modelIds);
      const idsObs = from(Id64.iterable(modelIds));
      if (!on) {
        viewport.changeModelDisplay(modelIds, false);
        return idsObs.pipe(
          mergeMap(async (modelId) => ({ modelId, categoryIds: await this._idsCache.getModelCategoryIds(modelId) })),
          mergeMap(({ modelId, categoryIds }) => from(this._idsCache.getCategoriesModeledElements(modelId, [...categoryIds.drawing, ...categoryIds.spatial]))),
          mergeMap((modeledElementIds) => this.changeModelDisplayState({ modelIds: modeledElementIds, on })),
        );
      }

      return concat(
        from(viewport.addViewedModels(modelIds)),
        idsObs.pipe(
          mergeMap((modelId) => {
            return from(this._idsCache.getModelCategoryIds(modelId)).pipe(
              mergeMap(({ drawing, spatial }) => merge(drawing, spatial)),
              mergeMap((categoryId) => this.changeCategoryDisplayState({ categoryIds: [categoryId], modelId, on })),
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
      categories: this._idsCache.getModelCategoryIds(modelId),
      alwaysDrawnElements: this._alwaysAndNeverDrawnElements.getAlwaysDrawnElements({ modelId }),
    }).pipe(
      mergeMap(async ({ categories, alwaysDrawnElements }) => {
        const alwaysDrawn = this._props.viewport.alwaysDrawn;
        if (alwaysDrawn && alwaysDrawnElements) {
          viewport.setAlwaysDrawn(setDifference(alwaysDrawn, alwaysDrawnElements));
        }
        categories.drawing.forEach((categoryId) => {
          this.changeCategoryStateInViewportAccordingToModelVisibility(modelId, categoryId, false);
        });
        categories.spatial.forEach((categoryId) => {
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
      viewport.changeCategoryDisplay(categoryId, true);
    }
  }

  private changeCategoryDisplayState(props: { categoryIds: Id64Array; modelId?: Id64String; on: boolean }): Observable<void> {
    const result = defer(() => {
      const { modelId, categoryIds, on } = props;
      const viewport = this._props.viewport;
      const modelIdsObservable = modelId
        ? of(new Map(categoryIds.map((id) => [id, [modelId]])))
        : from(this._idsCache.getCategoriesElementModels(categoryIds, true));
      return concat(
        modelId ? EMPTY : from(enableCategoryDisplay(viewport, categoryIds, on)),
        on
          ? modelIdsObservable.pipe(
              mergeMap((categoriesMap) => from(categoriesMap.values())),
              mergeAll(),
              filter((modelIdToCheck) => !viewport.view.viewsModel(modelIdToCheck)),
              mergeMap((modelIdToCheck) => this.showModelWithoutAnyCategoriesOrElements(modelIdToCheck)),
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
                  mergeMap((modeledElementIds) => this.changeModelDisplayState({ modelIds: modeledElementIds, on })),
                ),
              ),
            );
          }),
        ),
      );
    });
    return createVisibilityHandlerResult(this, props, result, undefined);
  }

  private changeGeometricElementsDisplayState(props: { elementIds: Id64Set; modelId: Id64String; categoryId: Id64String; on: boolean }): Observable<void> {
    const { modelId, categoryId, elementIds, on } = props;
    const viewport = this._props.viewport;
    const result = concat(
      on && !viewport.view.viewsModel(modelId) ? this.showModelWithoutAnyCategoriesOrElements(modelId) : EMPTY,
      defer(() => {
        const categoryVisibility = this.getDefaultModelsCategoryVisibilityStatus({ categoryIds: [categoryId], modelId });
        const isDisplayedByDefault = categoryVisibility.state === "visible";
        return this.queueElementsVisibilityChange(elementIds, on, isDisplayedByDefault);
      }),
      from(elementIds).pipe(
        mergeMap(async (elementId) => ({ elementId, isSubModel: await this._idsCache.hasSubModel(elementId) })),
        filter(({ isSubModel }) => isSubModel),
        map(({ elementId }) => elementId),
        toArray(),
        mergeMap((subModelIds) => this.changeModelDisplayState({ modelIds: subModelIds, on })),
      ),
    );
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
}
