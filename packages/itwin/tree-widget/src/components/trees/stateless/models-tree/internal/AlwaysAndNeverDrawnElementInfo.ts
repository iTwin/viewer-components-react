/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { BehaviorSubject, debounceTime, EMPTY, first, from, fromEventPattern, map, reduce, share, startWith, Subject, switchMap, takeUntil, tap } from "rxjs";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { pushToMap } from "../../common/Utils";

import type { Observable, Subscription } from "rxjs";
import type { Viewport } from "@itwin/core-frontend";
import type { BeEvent, Id64Array, Id64Set, Id64String, IDisposable } from "@itwin/core-bentley";

interface ElementInfo {
  elementId: Id64String;
  modelId: Id64String;
  categoryId: Id64String;
}

type CacheEntry = Map<Id64String, Map<Id64String, Id64Set>>;

export interface AlwaysOrNeverDrawnElementsQueryProps {
  modelId: Id64String;
  categoryId?: Id64String;
}

export const SET_CHANGE_DEBOUNCE_TIME = 20;

export class AlwaysAndNeverDrawnElementInfo implements IDisposable {
  private _subscriptions: Subscription[];
  private _alwaysDrawn: Observable<CacheEntry>;
  private _neverDrawn: Observable<CacheEntry>;
  private _disposeSubject = new Subject<void>();

  constructor(private readonly _viewport: Viewport) {
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

  public getElements({ setType, modelId, categoryId }: { setType: "always" | "never" } & AlwaysOrNeverDrawnElementsQueryProps): Observable<Id64Set> {
    const cache = setType === "always" ? this._alwaysDrawn : this._neverDrawn;
    const getElements = categoryId
      ? (entry: CacheEntry | undefined) => {
          return entry?.get(modelId)?.get(categoryId) ?? new Set();
        }
      : (entry: CacheEntry | undefined) => {
          const modelEntry = entry?.get(modelId);
          const elements = new Set<Id64String>();
          for (const set of modelEntry?.values() ?? []) {
            set.forEach((id) => elements.add(id));
          }
          return elements;
        };

    return cache.pipe(map(getElements));
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
      debounceTime(SET_CHANGE_DEBOUNCE_TIME),
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

  public dispose(): void {
    this._subscriptions.forEach((x) => x.unsubscribe());
    this._subscriptions = [];
    this._disposeSubject.next();
  }

  private queryAlwaysOrNeverDrawnElementInfo(set: Id64Set | undefined): Observable<CacheEntry> {
    const elementInfo = set?.size ? this.queryElementInfo([...set]) : EMPTY;
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

  private queryElementInfo(elementIds: Id64Array): Observable<ElementInfo> {
    const executor = createECSqlQueryExecutor(this._viewport.iModel);
    const reader = executor.createQueryReader({
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
    });

    return from(reader).pipe(map((row) => ({ elementId: row.elementId, modelId: row.modelId, categoryId: row.categoryId })));
  }
}
