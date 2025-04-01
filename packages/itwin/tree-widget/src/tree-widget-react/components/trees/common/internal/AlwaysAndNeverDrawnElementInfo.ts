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
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { getClassesByView, pushToMap, setDifference } from "./Utils.js";

import type { Observable, Subscription } from "rxjs";
import type { BeEvent } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { CategoryId, ElementId, ModelId } from "./Types.js";

interface ElementInfo {
  elementId: ElementId;
  modelId: ModelId;
  categoryId: CategoryId;
}

type CacheEntry = Map<ModelId, Map<CategoryId, Set<ElementId>>>;

/** @internal */
export interface ModelAlwaysOrNeverDrawnElementsQueryProps {
  modelId: ModelId;
}

/** @internal */
export interface CategoryAlwaysOrNeverDrawnElementsQueryProps {
  modelId?: ModelId;
  categoryIds: Array<CategoryId>;
}

/** @internal */
export type AlwaysOrNeverDrawnElementsQueryProps = ModelAlwaysOrNeverDrawnElementsQueryProps | CategoryAlwaysOrNeverDrawnElementsQueryProps;

export const SET_CHANGE_DEBOUNCE_TIME = 20;

export class AlwaysAndNeverDrawnElementInfo implements Disposable {
  private _subscriptions: Subscription[];
  private _alwaysDrawn: Observable<CacheEntry>;
  private _neverDrawn: Observable<CacheEntry>;
  private _disposeSubject = new Subject<void>();

  private _suppressors: Observable<number>;
  private _suppress = new Subject<boolean>();
  private _forceUpdate = new Subject<void>();
  private _viewType: "2d" | "3d";

  constructor(private readonly _viewport: Viewport) {
    this._viewType = _viewport.view.is2d() ? "2d" : "3d";
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
        ? (entry: CacheEntry | undefined) => {
            const result = new Set<ElementId>();
            if (props.modelId) {
              const categoryMap = entry?.get(props.modelId);
              if (!categoryMap) {
                return result;
              }
              for (const categoryId of props.categoryIds) {
                const elements = categoryMap.get(categoryId);
                if (elements) {
                  elements.forEach((element) => {
                    result.add(element);
                  });
                }
              }
              return result;
            }
            for (const [, categoryMap] of entry ?? []) {
              for (const categoryId of props.categoryIds) {
                const elements = categoryMap.get(categoryId);
                if (elements) {
                  elements.forEach((element) => {
                    result.add(element);
                  });
                }
              }
            }
            return result;
          }
        : (entry: CacheEntry | undefined) => {
            const modelEntry = entry?.get(props.modelId);
            const elements = new Set<ElementId>();
            for (const set of modelEntry?.values() ?? []) {
              set.forEach((id) => elements.add(id));
            }
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

  public [Symbol.dispose](): void {
    this._subscriptions.forEach((x) => x.unsubscribe());
    this._subscriptions = [];
    this._disposeSubject.next();
  }

  private queryAlwaysOrNeverDrawnElementInfo(set: Set<ElementId> | undefined, requestId: string): Observable<CacheEntry> {
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
      }, new Map<ModelId, Map<CategoryId, Set<ElementId>>>()),
    );
  }

  private queryElementInfo(elementIds: Array<ElementId>, requestId: string): Observable<ElementInfo> {
    const executor = createECSqlQueryExecutor(this._viewport.iModel);
    const { elementClass } = getClassesByView(this._viewType);
    const reader = executor.createQueryReader(
      {
        ctes: [
          `
            ElementInfo(elementId, modelId, categoryId, parentId) AS (
              SELECT
                ECInstanceId elementId,
                Model.Id modelId,
                Category.Id categoryId,
                Parent.Id parentId
              FROM ${elementClass}
              WHERE InVirtualSet(?, ECInstanceId)

              UNION ALL

              SELECT
                e.elementId,
                e.modelId,
                p.Category.Id categoryId,
                p.Parent.Id parentId
              FROM${elementClass} p
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

    return from(reader).pipe(map((row) => ({ elementId: row.elementId, modelId: row.modelId, categoryId: row.categoryId })));
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
