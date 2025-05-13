/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  BehaviorSubject,
  debounceTime,
  EMPTY,
  filter,
  first,
  forkJoin,
  from,
  fromEventPattern,
  map,
  merge,
  reduce,
  scan,
  share,
  shareReplay,
  startWith,
  Subject,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs";
import type { BeEvent, Id64Arg, Id64String } from "@itwin/core-bentley";
import { Id64 } from "@itwin/core-bentley";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { GEOMETRIC_ELEMENT_3D_CLASS_NAME } from "../ClassNameDefinitions.js";
import { pushToMap, setDifference } from "../Utils.js";

import type { Observable, Subscription } from "rxjs";
import type { Viewport } from "@itwin/core-frontend";
import type { CategoryId, ElementId, ModelId, ParentId } from "../Types.js";

interface ElementInfo {
  elementId: Id64String;
  modelId: Id64String;
  categoryId: Id64String;
  parentElementId?: Id64String;
}

type CacheEntry = Map<ModelId, Map<ParentId | undefined, Map<CategoryId, Set<ElementId>>>>;

/** @internal */
export interface ModelAlwaysOrNeverDrawnElementsQueryProps {
  modelId: Id64String;
}

/** @internal */
export interface CategoryAlwaysOrNeverDrawnElementsQueryProps {
  modelId?: Id64String;
  categoryIds: Id64Arg;
  parentElementIds?: Id64Arg;
}

/** @internal */
export type AlwaysOrNeverDrawnElementsQueryProps = ModelAlwaysOrNeverDrawnElementsQueryProps | CategoryAlwaysOrNeverDrawnElementsQueryProps;

/** @internal */
export const SET_CHANGE_DEBOUNCE_TIME = 20;

/** @internal */
export class AlwaysAndNeverDrawnElementInfo implements Disposable {
  private _subscriptions: Subscription[];
  private _alwaysDrawn: Observable<CacheEntry>;
  private _neverDrawn: Observable<CacheEntry>;
  private _disposeSubject = new Subject<void>();

  private _suppressors: Observable<number>;
  private _suppress = new Subject<boolean>();
  private _forceUpdate = new Subject<void>();

  constructor(
    private readonly _viewport: Viewport,
    private readonly _elementClassName?: string,
  ) {
    this._alwaysDrawn = this.createCacheEntryObservable({
      event: this._viewport.onAlwaysDrawnChanged,
      getSet: () => this._viewport.alwaysDrawn,
      id: "alwaysDrawn",
    });
    this._neverDrawn = this.createCacheEntryObservable({
      event: this._viewport.onNeverDrawnChanged,
      getSet: () => this._viewport.neverDrawn,
      id: "neverDrawn",
    });
    this._suppressors = this._suppress.pipe(
      scan((acc, suppress) => acc + (suppress ? 1 : -1), 0),
      startWith(0),
      shareReplay(1),
    );
    this._subscriptions = [
      this._alwaysDrawn.subscribe(),
      this._neverDrawn.subscribe(),
      this._suppressors.pipe(filter((suppressors) => suppressors === 0)).subscribe({
        next: () => this._forceUpdate.next(),
      }),
    ];
  }

  public suppressChangeEvents() {
    this._suppress.next(true);
  }

  public resumeChangeEvents() {
    this._suppress.next(false);
  }

  public getElements(props: { setType: "always" | "never" } & AlwaysOrNeverDrawnElementsQueryProps): Observable<Set<ElementId>> {
    const cache = props.setType === "always" ? this._alwaysDrawn : this._neverDrawn;
    const getElements =
      "categoryIds" in props
        ? (entry: CacheEntry | undefined): Set<ElementId> => {
            if (!entry) {
              return new Set();
            }
            const result = new Set<ElementId>();
            const { modelId, parentElementIds, categoryIds } = props;

            const parentElementMaps = modelId ? [entry.get(modelId)] : entry.values();
            for (const parentElementMap of parentElementMaps) {
              if (!parentElementMap) {
                continue;
              }
              for (const parentElementId of parentElementIds ? Id64.iterable(parentElementIds) : [undefined]) {
                const parentEntry = parentElementMap.get(parentElementId);
                if (!parentEntry) {
                  continue;
                }
                for (const categoryId of Id64.iterable(categoryIds)) {
                  const categoryElements = parentEntry.get(categoryId);
                  categoryElements?.forEach((element) => result.add(element));
                }
              }
            }

            return result;
          }
        : (entry: CacheEntry | undefined) => {
            const parentElementMap = entry?.get(props.modelId);
            const elements = new Set<ElementId>();
            parentElementMap?.forEach((categoriesMap) => {
              categoriesMap.forEach((elementIds) => elementIds.forEach((id) => elements.add(id)));
            });
            return elements;
          };

    return cache.pipe(map(getElements));
  }

  private createCacheEntryObservable(props: { event: BeEvent<() => void>; getSet(): Set<ElementId> | undefined; id: string }) {
    const event = props.event;
    const resultSubject = new BehaviorSubject<CacheEntry | undefined>(undefined);

    const obs = merge(
      fromEventPattern(
        (handler) => event.addListener(handler),
        (handler) => event.removeListener(handler),
      ),
      this._forceUpdate,
    ).pipe(
      // Fire the observable once at the beginning
      startWith(undefined),
      // Stop listening to events when dispose() is called
      takeUntil(this._disposeSubject),
      // Reset result subject as soon as a new event is emitted.
      // This will make newly subscribed observers wait for the debounce period to pass
      // instead of consuming the cached value which at this point becomes invalid.
      tap(() => resultSubject.next(undefined)),
      // Check if cache updates are not suppressed.
      switchMap(() =>
        this._suppressors.pipe(
          filter((suppressors) => suppressors === 0),
          take(1),
        ),
      ),
      debounceTime(SET_CHANGE_DEBOUNCE_TIME),
      // Cancel pending request if dispose() is called.
      takeUntil(this._disposeSubject),
      // If multiple requests are sent at once, preserve only the result of the newest.
      switchMap(() => this.queryAlwaysOrNeverDrawnElementInfo(props.getSet(), props.id)),
      // Share the result by using a subject which always emits the saved result.
      share({
        connector: () => resultSubject,
        resetOnRefCountZero: false,
      }),
      // Wait until the result is available.
      first((x): x is CacheEntry => !!x),
    );
    return obs;
  }

  public [Symbol.dispose]() {
    this._subscriptions.forEach((x) => x.unsubscribe());
    this._subscriptions = [];
    this._disposeSubject.next();
  }

  private queryAlwaysOrNeverDrawnElementInfo(set: Set<ElementId> | undefined, requestId: string): Observable<CacheEntry> {
    const elementInfo = set?.size ? this.queryElementInfo([...set], requestId) : EMPTY;
    return elementInfo.pipe(
      reduce((state, { categoryId, modelId, elementId, parentElementId }) => {
        let parentElementMap = state.get(modelId);
        if (!parentElementMap) {
          parentElementMap = new Map();
          state.set(modelId, parentElementMap);
        }
        let categoryMap = parentElementMap.get(parentElementId);
        if (!categoryMap) {
          categoryMap = new Map();
          parentElementMap.set(parentElementId, categoryMap);
        }

        pushToMap(categoryMap, categoryId, elementId);
        return state;
      }, new Map<ModelId, Map<ParentId | undefined, Map<CategoryId, Set<ElementId>>>>()),
    );
  }

  private queryElementInfo(elementIds: Array<ElementId>, requestId: string): Observable<ElementInfo> {
    const executor = createECSqlQueryExecutor(this._viewport.iModel);
    const reader = executor.createQueryReader(
      {
        ecsql: `
          SELECT
            ECInstanceId elementId,
            Model.Id modelId,
            Category.Id categoryId,
            Parent.Id parentElementId
          FROM ${GEOMETRIC_ELEMENT_3D_CLASS_NAME}
          WHERE InVirtualSet(?, ECInstanceId)
        `,
        bindings: [{ type: "idset", value: elementIds }],
      },
      {
        restartToken: `ModelsTreeVisibilityHandler/${requestId}`,
      },
    );

    return from(reader).pipe(
      map((row) => ({
        elementId: row.elementId,
        modelId: row.modelId,
        categoryId: row.categoryId,
        parentElementId: row.parentElementId ? row.parentElementId : undefined,
      })),
    );
  }
  public getAlwaysDrawnElements(props: AlwaysOrNeverDrawnElementsQueryProps) {
    return this.getElements({ ...props, setType: "always" });
  }

  public getNeverDrawnElements(props: AlwaysOrNeverDrawnElementsQueryProps) {
    return this.getElements({ ...props, setType: "never" });
  }

  public clearAlwaysAndNeverDrawnElements(props: AlwaysOrNeverDrawnElementsQueryProps) {
    return forkJoin({
      alwaysDrawn: this.getAlwaysDrawnElements(props),
      neverDrawn: this.getNeverDrawnElements(props),
    }).pipe(
      map(({ alwaysDrawn, neverDrawn }) => {
        const viewport = this._viewport;
        if (viewport.alwaysDrawn?.size && alwaysDrawn.size) {
          viewport.setAlwaysDrawn(setDifference(viewport.alwaysDrawn, alwaysDrawn));
        }
        if (viewport.neverDrawn?.size && neverDrawn.size) {
          viewport.setNeverDrawn(setDifference(viewport.neverDrawn, neverDrawn));
        }
      }),
    );
  }
}
