/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Observable, Subscription } from "rxjs";
import { BehaviorSubject, concat, debounceTime, defer, EMPTY, first, fromEventPattern, map, of, reduce, share, Subject, switchMap } from "rxjs";
import { pushToMap } from "./Utils";

import type { Viewport } from "@itwin/core-frontend";
import type { ElementsByParentQueryProps, ElementsQueryProps, ModelsTreeQueryHandler } from "./ModelsTreeQueryHandler";
import type { BeEvent, Id64Set, Id64String, IDisposable } from "@itwin/core-bentley";
const SET_CHANGE_DEBOUNCE_TIME = 20;
const EMPTY_ID_SET = new Set<Id64String>();

interface CacheEntry {
  byModel: Map<Id64String, Id64Set>;
  byCategory: Map<string, Id64Set>;
}

export type AlwaysOrNeverDrawnElementsQueryProps = Exclude<ElementsQueryProps, ElementsByParentQueryProps>;

export class AlwaysAndNeverDrawnElementInfo implements IDisposable {
  private _subscriptions?: Subscription[];
  private _alwaysDrawn?: Observable<CacheEntry>;
  private _neverDrawn?: Observable<CacheEntry>;
  private _subject = new Subject<boolean>();

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
            return entry?.byCategory.get(this.createCategoryCacheKey(props.categoryId, props.modelId)) ?? EMPTY_ID_SET;
          }
        : (entry: CacheEntry | undefined) => {
            return entry?.byModel.get(props.modelId) ?? EMPTY_ID_SET;
          };

    return cache!.pipe(map(getElements));
  }

  private initialQuery(props: { getEvent(): BeEvent<() => void>; getSet(): Id64Set | undefined }) {
    const obs = concat(
      defer(() => {
        const set = props.getSet();
        return set?.size ? of(undefined) : EMPTY;
      }),
      fromEventPattern(
        (handler) => props.getEvent().addListener(handler),
        (handler) => props.getEvent().removeListener(handler),
      ).pipe(debounceTime(this._debounceTime)),
    ).pipe(
      switchMap(() => {
        const set = props.getSet();
        return this.queryAlwaysOrNeverDrawnElementInfo(set);
      }),
      share({
        // Share only the last emitted value
        connector: () => new BehaviorSubject<CacheEntry | undefined>(undefined),
        resetOnRefCountZero: () => this._subject,
      }),
      first((x): x is CacheEntry => !!x),
    );
    return obs;
  }

  public reset() {
    this.clearCache();
    this._alwaysDrawn = this.initialQuery({
      getEvent: () => this._viewport.onAlwaysDrawnChanged,
      getSet: () => this._viewport.alwaysDrawn,
    });
    this._neverDrawn = this.initialQuery({
      getEvent: () => this._viewport.onNeverDrawnChanged,
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
    if (!this._subject.closed) {
      this._subject.next(true);
      this._subject.unsubscribe();
    }
  }

  private createCategoryCacheKey(categoryId: string, modelId: string) {
    return `${categoryId}${modelId}`;
  }

  private queryAlwaysOrNeverDrawnElementInfo(set: Id64Set | undefined) {
    const elementInfo = set?.size ? this._queryHandler.queryElementInfo(set) : EMPTY;
    return elementInfo.pipe(
      reduce(
        (state, val) => {
          pushToMap(state.byModel, val.modelId, val.elementId);
          pushToMap(state.byCategory, this.createCategoryCacheKey(val.categoryId, val.modelId), val.elementId);
          return state;
        },
        { byModel: new Map<Id64String, Id64Set>(), byCategory: new Map<string, Id64Set>() },
      ),
    );
  }
}
