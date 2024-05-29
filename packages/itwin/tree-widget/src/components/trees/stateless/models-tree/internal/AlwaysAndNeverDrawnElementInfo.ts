/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Observable, Subscription } from "rxjs";
import {
  BehaviorSubject, debounceTime, EMPTY, first, fromEventPattern, map, reduce, share, startWith, Subject, switchMap, takeUntil, tap,
} from "rxjs";
import { pushToMap } from "../../common/Utils";

import type { Viewport } from "@itwin/core-frontend";
import type { ElementsByParentQueryProps, ElementsQueryProps, ModelsTreeQueryHandler } from "./ModelsTreeQueryHandler";
import type { BeEvent, Id64Set, Id64String, IDisposable } from "@itwin/core-bentley";

type CacheEntry = Map<Id64String, Map<Id64String, Id64Set>>;

export type AlwaysOrNeverDrawnElementsQueryProps = Exclude<ElementsQueryProps, ElementsByParentQueryProps>;

const SET_CHANGE_DEBOUNCE_TIME = 20;

export class AlwaysAndNeverDrawnElementInfo implements IDisposable {
  private _subscriptions?: Subscription[];
  private _alwaysDrawn?: Observable<CacheEntry>;
  private _neverDrawn?: Observable<CacheEntry>;
  private _disposeSubject = new Subject<boolean>();

  constructor(
    private readonly _viewport: Viewport,
    private readonly _queryHandler: ModelsTreeQueryHandler,
    private readonly _debounceTime = SET_CHANGE_DEBOUNCE_TIME,
  ) {
    this.reset();
  }

  public getElements(props: { setType: "always" | "never" } & AlwaysOrNeverDrawnElementsQueryProps): Observable<Id64Set> {
    const cache = props.setType === "always" ? this._alwaysDrawn : this._neverDrawn;
    const getElements =
      "categoryId" in props
        ? (entry: CacheEntry | undefined) => {
            return entry?.get(props.modelId)?.get(props.categoryId) ?? new Set();
          }
        : (entry: CacheEntry | undefined) => {
            const modelEntry = entry?.get(props.modelId);
            const elements = new Set<Id64String>();
            for (const set of modelEntry?.values() ?? []) {
              set.forEach((id) => elements.add(id));
            }
            return elements;
          };

    return cache!.pipe(map(getElements));
  }

  private createCacheEntryObservable(props: { event: BeEvent<() => void>; getSet(): Id64Set | undefined }) {
    const event = props.event;
    const resultSubject = new BehaviorSubject<CacheEntry | undefined>(undefined);
    const obs = fromEventPattern(
      (handler) => event.addListener(handler),
      (handler) => event.removeListener(handler),
    ).pipe(
      // Fire the observable once at the beginning
      startWith(undefined),
      // Stop listening to events when dispose() is called
      takeUntil(this._disposeSubject),
      // Reset result subject as soon as a new event is emitted.
      // This will make newly subscribed observers wait for the debounce period to pass
      // instead of consuming the cached value which at this point becomes invalid.
      tap(() => resultSubject.next(undefined)),
      debounceTime(this._debounceTime),
      // Cancel pending request if dispose() is called.
      takeUntil(this._disposeSubject),
      // If multiple requests are sent at once, preserve only the result of the newest.
      switchMap(() => this.queryAlwaysOrNeverDrawnElementInfo(props.getSet())),
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

  public reset() {
    this.clearCache();
    this._alwaysDrawn = this.createCacheEntryObservable({
      event: this._viewport.onAlwaysDrawnChanged,
      getSet: () => this._viewport.alwaysDrawn,
    });
    this._neverDrawn = this.createCacheEntryObservable({
      event: this._viewport.onNeverDrawnChanged,
      getSet: () => this._viewport.neverDrawn,
    });
    this._subscriptions = [this._alwaysDrawn.subscribe(), this._neverDrawn.subscribe()];
  }

  private clearCache() {
    this._subscriptions?.forEach((x) => x.unsubscribe());
    this._subscriptions = [];
  }

  public dispose(): void {
    this.clearCache();
    // istanbul ignore else
    if (!this._disposeSubject.closed) {
      this._disposeSubject.next(true);
      this._disposeSubject.unsubscribe();
    }
  }

  private createCategoryCacheKey(categoryId: string, modelId: string) {
    return `${categoryId}${modelId}`;
  }

  private queryAlwaysOrNeverDrawnElementInfo(set: Id64Set | undefined): Observable<CacheEntry> {
    const elementInfo = set?.size
      ? this._queryHandler.queryElementInfo({
          elementIds: set,
          useRootElementCategoryId: true,
        })
      : EMPTY;
    return elementInfo.pipe(
      reduce((state, val) => {
        let entry = state.get(val.modelId);
        if (!entry) {
          entry = new Map();
          state.set(val.modelId, entry);
        }
        pushToMap(entry, val.categoryId, val.elementId);
        return state;
      }, new Map<Id64String, Map<Id64String, Id64Set>>()),
    );
  }
}
