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
  forkJoin,
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
import { getClassesByView, pushToMap, setDifference } from "./Utils.js";

import type { Id64Arg, Id64Array, Id64String } from "@itwin/core-bentley";
import type { Observable, Subscription } from "rxjs";
import type { Viewport } from "@itwin/core-frontend";
import type { CategoryId, ElementId, ModelId } from "./Types.js";

/** @internal */
export interface ModelAlwaysOrNeverDrawnElementsQueryProps {
  modelId: Id64String;
}

/** @internal */
export interface CategoryAlwaysOrNeverDrawnElementsQueryProps {
  modelId?: Id64String;
  categoryIds: Id64Arg;
}

/** @internal */
export type AlwaysOrNeverDrawnElementsQueryProps = ModelAlwaysOrNeverDrawnElementsQueryProps | CategoryAlwaysOrNeverDrawnElementsQueryProps;

/** @internal */
export const SET_CHANGE_DEBOUNCE_TIME = 20;

interface ElementInfo {
  elementId: Id64String;
  modelId: Id64String;
  categoryId: Id64String;
}

type CacheEntry = Map<ModelId, Map<CategoryId, Set<ElementId>>>;

type SetType = "always" | "never";

/** @internal */
export class AlwaysAndNeverDrawnElementInfo implements Disposable {
  #subscriptions: Subscription[];
  #alwaysDrawn: { cacheEntryObs: Observable<CacheEntry>; latestCacheEntryValue?: CacheEntry };
  #neverDrawn: { cacheEntryObs: Observable<CacheEntry>; latestCacheEntryValue?: CacheEntry };
  #disposeSubject = new Subject<void>();
  readonly #viewport: Viewport;
  readonly #elementClassName?: string;

  #suppressors: Observable<number>;
  #suppress = new Subject<boolean>();

  constructor(viewport: Viewport, elementClassName?: string) {
    this.#elementClassName = elementClassName;
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

  public getElements(props: { setType: SetType } & AlwaysOrNeverDrawnElementsQueryProps): Observable<Set<ElementId>> {
    const cache = props.setType === "always" ? this.#alwaysDrawn : this.#neverDrawn;
    const getElements =
      "categoryIds" in props
        ? (entry: CacheEntry | undefined) => {
            const result = new Set<ElementId>();
            if (props.modelId) {
              const categoryMap = entry?.get(props.modelId);
              if (!categoryMap) {
                return result;
              }
              for (const categoryId of Id64.iterable(props.categoryIds)) {
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
              for (const categoryId of Id64.iterable(props.categoryIds)) {
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

  public [Symbol.dispose](): void {
    this.#subscriptions.forEach((x) => x.unsubscribe());
    this.#subscriptions = [];
    this.#disposeSubject.next();
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

  private queryElementInfo(elementIds: Id64Array, requestId: string): Observable<ElementInfo> {
    return defer(() => {
      const executor = createECSqlQueryExecutor(this.#viewport.iModel);
      const { elementClass } = this.#elementClassName ? { elementClass: this.#elementClassName } : getClassesByView(this.#viewport.view.is2d() ? "2d" : "3d");
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
              FROM ${elementClass}
              WHERE InVirtualSet(?, ECInstanceId)

              UNION ALL

              SELECT
                e.elementId,
                e.modelId,
                p.Category.Id categoryId,
                p.Parent.Id parentId
              FROM ${elementClass} p
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
        const viewport = this.#viewport;
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
