/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defaultIfEmpty, delay, EMPTY, firstValueFrom, from, fromEventPattern, map, mergeMap, of, reduce, shareReplay, Subject, takeUntil, tap } from "rxjs";
import { Id64 } from "@itwin/core-bentley";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { pushToMap } from "../../common/Utils.js";
import { setIntersection } from "./ModelsTreeVisibilityHandler.js";

import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { Observable } from "rxjs";
import type { Viewport } from "@itwin/core-frontend";
/** @internal */
export const SET_CHANGE_DEBOUNCE_TIME = 20;

/** @internal */
export interface AlwaysOrNeverDrawnElementsQueryProps {
  modelId: Id64String;
  categoryIds?: Id64Arg;
}

interface ElementInfo {
  elementId: Id64String;
  modelId: Id64String;
  categoryId: Id64String;
}

type CacheEntry = Map<Id64String, Map<Id64String, Id64Set>>;

type SetType = "always" | "never";

/** @internal */
export class AlwaysAndNeverDrawnElementInfo implements Disposable {
  #alwaysDrawn: { cacheEntryObs: Observable<CacheEntry>; onChangeListener: () => void; latestCacheEntry?: CacheEntry };
  #neverDrawn: { cacheEntryObs: Observable<CacheEntry>; onChangeListener: () => void; latestCacheEntry?: CacheEntry };
  #disposeSubject = new Subject<void>();
  #activeSuppressionAmount = 0;
  readonly #viewport: Viewport;

  constructor(viewport: Viewport) {
    this.#viewport = viewport;
    this.#alwaysDrawn = {
      cacheEntryObs: this.createCacheEntry("always"),
      onChangeListener: this.#viewport.onAlwaysDrawnChanged.addListener(() => {
        this.#alwaysDrawn.cacheEntryObs = this.createCacheEntry("always");
      }),
    };
    this.#neverDrawn = {
      cacheEntryObs: this.createCacheEntry("never"),
      onChangeListener: this.#viewport.onNeverDrawnChanged.addListener(() => {
        this.#neverDrawn.cacheEntryObs = this.createCacheEntry("never");
      }),
    };
    void firstValueFrom(this.#alwaysDrawn.cacheEntryObs);
    void firstValueFrom(this.#neverDrawn.cacheEntryObs);
  }

  public suppressChangeEvents() {
    ++this.#activeSuppressionAmount;
  }

  public resumeChangeEvents() {
    if (this.#activeSuppressionAmount > 0) {
      --this.#activeSuppressionAmount;
    }
  }

  public getElements({ setType, modelId, categoryIds }: { setType: "always" | "never" } & AlwaysOrNeverDrawnElementsQueryProps): Observable<Id64Set> {
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
          for (const categoryEntry of modelEntry?.values() ?? []) {
            categoryEntry.forEach((id) => elements.add(id));
          }
          return elements;
        };

    if (this.#activeSuppressionAmount === 0 || !cache.latestCacheEntry) {
      return cache.cacheEntryObs.pipe(map(getElements));
    }
    return of(cache.latestCacheEntry).pipe(
      map(getElements),
      map((elements) => {
        const set = setType === "always" ? this.#viewport.alwaysDrawn : this.#viewport.neverDrawn;
        if (set === undefined) {
          return new Set<Id64String>();
        }
        return setIntersection(elements, set);
      }),
    );
  }

  private createCacheEntry(setType: SetType): Observable<CacheEntry> {
    const event = setType === "always" ? this.#viewport.onAlwaysDrawnChanged : this.#viewport.onNeverDrawnChanged;
    return of(undefined).pipe(
      delay(SET_CHANGE_DEBOUNCE_TIME),
      mergeMap(() => this.queryAlwaysOrNeverDrawnElementInfo(setType)),
      tap((cacheEntry) => (setType === "always" ? (this.#alwaysDrawn.latestCacheEntry = cacheEntry) : (this.#neverDrawn.latestCacheEntry = cacheEntry))),
      shareReplay(1),
      takeUntil(
        fromEventPattern(
          (handler) => event.addListener(handler),
          (handler) => event.removeListener(handler),
        ),
      ),
      takeUntil(this.#disposeSubject),
      defaultIfEmpty(new Map()),
    );
  }

  public [Symbol.dispose]() {
    this.#alwaysDrawn.onChangeListener();
    this.#neverDrawn.onChangeListener();
    this.#disposeSubject.next();
  }

  private queryAlwaysOrNeverDrawnElementInfo(setType: SetType): Observable<CacheEntry> {
    const set = setType === "always" ? this.#viewport.alwaysDrawn : this.#viewport.neverDrawn;
    const elementInfo = set?.size ? this.queryElementInfo([...set], `${setType}Drawn`) : EMPTY;
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

  private queryElementInfo(elementIds: Id64Array, requestId: string): Observable<ElementInfo> {
    const executor = createECSqlQueryExecutor(this.#viewport.iModel);
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

    return from(reader).pipe(map((row) => ({ elementId: row.elementId, modelId: row.modelId, categoryId: row.categoryId })));
  }
}
