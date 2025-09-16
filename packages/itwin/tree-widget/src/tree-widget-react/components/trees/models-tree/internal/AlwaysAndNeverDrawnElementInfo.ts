/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  BehaviorSubject,
  debounceTime,
  defer,
  EMPTY,
  filter,
  first,
  fromEventPattern,
  map,
  mergeMap,
  of,
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
import { Id64 } from "@itwin/core-bentley";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { pushToMap } from "../../common/Utils.js";

import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { Observable, Subscription } from "rxjs";
import type { Viewport } from "@itwin/core-frontend";

/** @internal */
export const SET_CHANGE_DEBOUNCE_TIME = 20;

type SetType = "always" | "never";

/** @internal */
export interface AlwaysOrNeverDrawnElementsQueryProps {
  modelId: Id64String;
  categoryIds?: Id64Arg;
}

type CacheEntry = Map<Id64String, Map<Id64String, Id64Set>>;

export class AlwaysAndNeverDrawnElementInfo implements Disposable {
  #subscriptions: Subscription[];
  #alwaysDrawn: { cacheEntryObs: Observable<CacheEntry>; latestCacheEntryValue?: CacheEntry };
  #neverDrawn: { cacheEntryObs: Observable<CacheEntry>; latestCacheEntryValue?: CacheEntry };
  #disposeSubject = new Subject<void>();
  readonly #viewport: Viewport;

  #suppressors: Observable<number>;
  #suppress = new Subject<boolean>();

  constructor(viewport: Viewport) {
    this.#viewport = viewport;
    this.#alwaysDrawn = { cacheEntryObs: this.createCacheEntryObservable("always") };
    this.#neverDrawn = { cacheEntryObs: this.createCacheEntryObservable("never") };
    this.#suppressors = this.#suppress.pipe(
      scan((acc, suppress) => acc + (suppress ? 1 : -1), 0),
      startWith(0),
      shareReplay(1),
    );
    this.#subscriptions = [this.#alwaysDrawn.cacheEntryObs.subscribe(), this.#neverDrawn.cacheEntryObs.subscribe()];
  }

  public suppressChangeEvents() {
    this.#suppress.next(true);
  }

  public resumeChangeEvents() {
    this.#suppress.next(false);
  }

  public getElements({ setType, modelId, categoryIds }: { setType: SetType } & AlwaysOrNeverDrawnElementsQueryProps): Observable<Id64Set> {
    const cache = setType === "always" ? this.#alwaysDrawn : this.#neverDrawn;
    const getElements = categoryIds
      ? (entry: CacheEntry | undefined) => {
          const result = new Set<Id64String>();
          for (const categoryId of Id64.iterable(categoryIds)) {
            const elements = entry?.get(modelId)?.get(categoryId);
            elements?.forEach((elementId) => result.add(elementId));
          }
          return result;
        }
      : (entry: CacheEntry | undefined) => {
          const modelEntry = entry?.get(modelId);
          const elements = new Set<Id64String>();
          for (const set of modelEntry?.values() ?? []) {
            set.forEach((id) => elements.add(id));
          }
          return elements;
        };

    return !cache.latestCacheEntryValue
      ? cache.cacheEntryObs.pipe(map(getElements))
      : this.#suppressors.pipe(
          take(1),
          mergeMap((suppressionCount) =>
            suppressionCount > 0 ? of(cache.latestCacheEntryValue).pipe(map(getElements)) : cache.cacheEntryObs.pipe(map(getElements)),
          ),
        );
  }

  private createCacheEntryObservable(setType: SetType): Observable<CacheEntry> {
    const event = setType === "always" ? this.#viewport.onAlwaysDrawnChanged : this.#viewport.onNeverDrawnChanged;
    const getIds = setType === "always" ? () => this.#viewport.alwaysDrawn : () => this.#viewport.neverDrawn;

    const resultSubject = new BehaviorSubject<CacheEntry | undefined>(undefined);

    const obs = fromEventPattern(
      (handler) => event.addListener(handler),
      (handler) => event.removeListener(handler),
    ).pipe(
      // Fire the observable once at the beginning
      startWith(undefined),
      // Reset result subject as soon as a new event is emitted.
      // This will make newly subscribed observers wait for the debounce period to pass
      // instead of consuming the cached value which at this point becomes invalid.
      tap(() => resultSubject.next(undefined)),
      // Check if cache updates are not suppressed.
      switchMap(() =>
        this.#suppressors.pipe(
          filter((suppressors) => suppressors === 0),
          take(1),
        ),
      ),
      debounceTime(SET_CHANGE_DEBOUNCE_TIME),
      // Cancel pending request if dispose() is called.
      takeUntil(this.#disposeSubject),
      // If multiple requests are sent at once, preserve only the result of the newest.
      switchMap(() => this.queryAlwaysOrNeverDrawnElementInfo(getIds(), `${setType}Drawn`)),
      tap((cacheEntry) => {
        const value = setType === "always" ? this.#alwaysDrawn : this.#neverDrawn;
        value.latestCacheEntryValue = cacheEntry;
      }),
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
    this.#subscriptions.forEach((x) => x.unsubscribe());
    this.#subscriptions = [];
    this.#disposeSubject.next();
  }

  private queryAlwaysOrNeverDrawnElementInfo(set: Id64Set | undefined, requestId: string): Observable<CacheEntry> {
    const elementInfo = set?.size ? this.queryElementInfo([...set], requestId) : EMPTY;
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

  private queryElementInfo(
    elementIds: Id64Array,
    requestId: string,
  ): Observable<{
    elementId: Id64String;
    modelId: Id64String;
    categoryId: Id64String;
  }> {
    return defer(() => {
      const executor = createECSqlQueryExecutor(this.#viewport.iModel);
      return executor.createQueryReader(
        {
          ctes: [
            `
            ElementInfo(elementId, modelId, categoryId, parentId) AS (
              SELECT
                ECInstanceId elementId,
                Model.Id modelId,
                Category.Id categoryId,
                Parent.Id parentId
              FROM bis.GeometricElement3d
              WHERE InVirtualSet(?, ECInstanceId)

              UNION ALL

              SELECT
                e.elementId,
                e.modelId,
                p.Category.Id categoryId,
                p.Parent.Id parentId
              FROM bis.GeometricElement3d p
              JOIN ElementInfo e ON p.ECInstanceId = e.parentId
            )
            `,
          ],
          ecsql: `
            SELECT elementId, modelId, categoryId
            FROM ElementInfo
            WHERE parentId IS NULL
          `,
          bindings: [{ type: "idset", value: elementIds }],
        },
        {
          restartToken: `ModelsTreeVisibilityHandler/${requestId}`,
        },
      );
    }).pipe(map((row) => ({ elementId: row.elementId, modelId: row.modelId, categoryId: row.categoryId })));
  }
}
