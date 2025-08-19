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
import { Id64 } from "@itwin/core-bentley";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { createVisibilityHandlerResult } from "../../UseHierarchyVisibility.js";
import { getSetFromId64Arg, setDifference } from "../Utils.js";
import { changeElementStateNoChildrenOperator, enableCategoryDisplay } from "../VisibilityUtils.js";

import type { Observable, Subscription } from "rxjs";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { HierarchyVisibilityHandler } from "../../UseHierarchyVisibility.js";
import type { AlwaysAndNeverDrawnElementInfo } from "../AlwaysAndNeverDrawnElementInfo.js";
import type { CategoryId, ModelId } from "../Types.js";
import type { BaseVisibilityStatusGetter } from "./BaseVisibilityStatusGetter.js";
import type { BaseTreeVisibilityHandlerOverrides, VisibilityStatusHelper } from "./TreeVisibilityHandler.js";

/** @internal */
export interface BaseVisibilityStatusModifierProps {
  viewport: Viewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfo;
  visibilityHandler: HierarchyVisibilityHandler;
  overrides?: BaseTreeVisibilityHandlerOverrides;
  visibilityStatusHelper: VisibilityStatusHelper;
  visibilityStatusGetter: BaseVisibilityStatusGetter;
}

/**
 * Base class for visibility status modifiers.
 *
 * It provides methods that help change visibility statuses of models, categories and elements.
 * @internal
 */
export class BaseVisibilityStatusModifier implements Disposable {
  private readonly _alwaysAndNeverDrawnElements: AlwaysAndNeverDrawnElementInfo;
  private readonly _visibilityHandler: HierarchyVisibilityHandler;
  private _elementChangeQueue = new Subject<Observable<void>>();
  private _subscriptions: Subscription[] = [];

  constructor(private readonly _props: BaseVisibilityStatusModifierProps) {
    this._alwaysAndNeverDrawnElements = this._props.alwaysAndNeverDrawnElementInfo;
    this._subscriptions.push(this._elementChangeQueue.pipe(concatAll()).subscribe());
    this._visibilityHandler = this._props.visibilityHandler;
  }

  public [Symbol.dispose]() {
    this._subscriptions.forEach((x) => x.unsubscribe());
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
        return this._props.visibilityStatusHelper
          .getSubModels({ modelIds })
          .pipe(mergeMap(({ subModels }) => (subModels ? this.changeModelsVisibilityStatus({ modelIds: subModels, on }) : EMPTY)));
      }

      return concat(
        from(viewport.addViewedModels(modelIds)),
        this._props.visibilityStatusHelper.getCategories({ modelIds }).pipe(
          mergeMap(({ id, drawingCategories, spatialCategories }) => {
            return merge(
              drawingCategories ? this.changeCategoriesVisibilityStatus({ categoryIds: drawingCategories, modelId: id, on }) : EMPTY,
              spatialCategories ? this.changeCategoriesVisibilityStatus({ categoryIds: spatialCategories, modelId: id, on }) : EMPTY,
            );
          }),
        ),
      );
    });
    return createVisibilityHandlerResult(this._visibilityHandler, props, result, this._props.overrides?.changeModelsVisibilityStatus);
  }

  /** Turns model on and turns off elements and categories related to that model. */
  private showModelWithoutAnyCategoriesOrElements(modelId: Id64String, categoriesToNotOverride?: Id64Arg): Observable<void> {
    const viewport = this._props.viewport;
    return forkJoin({
      allModelCategories: this._props.visibilityStatusHelper.getCategories({ modelIds: modelId }).pipe(
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

  /** Adds per-model category overrides based on default category visibility. */
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
   * Changes categories visibility statuses.
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
          : this._props.visibilityStatusHelper.getModels({ categoryIds }).pipe(
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
        this._props.visibilityStatusHelper
          .getSubModels({ categoryIds, modelId: modelIdFromProps })
          .pipe(mergeMap(({ subModels }) => (subModels ? this.changeModelsVisibilityStatus({ modelIds: subModels, on }) : EMPTY))),
      );
    });
    return createVisibilityHandlerResult(this._visibilityHandler, props, result, this._props.overrides?.changeCategoriesVisibilityStatus);
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
                const defaultVisibility = this._props.visibilityStatusGetter.getVisibleModelDefaultCategoriesVisibilityStatus({
                  categoryIds: categoryId,
                  modelId,
                });
                const displayedByDefault = defaultVisibility.state === "visible";
                return this.queueElementsVisibilityChange(elementIds, on, displayedByDefault);
              }),
            );
          }

          const categoryVisibility = this._props.visibilityStatusGetter.getVisibleModelDefaultCategoriesVisibilityStatus({ categoryIds: categoryId, modelId });
          const isDisplayedByDefault = categoryVisibility.state === "visible";
          return this.queueElementsVisibilityChange(elementIds, on, isDisplayedByDefault);
        }),
        // Change visibility of elements that are models
        from(Id64.iterable(elementIds)).pipe(
          mergeMap((elementId) =>
            from(this._props.visibilityStatusHelper.hasSubModel(elementId)).pipe(
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
    return createVisibilityHandlerResult(this._visibilityHandler, props, result, this._props.overrides?.changeElementsVisibilityStatus);
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
