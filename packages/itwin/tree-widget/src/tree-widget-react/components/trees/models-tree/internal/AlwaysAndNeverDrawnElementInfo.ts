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

import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { Observable, Subscription } from "rxjs";
import type { Viewport } from "@itwin/core-frontend";
import type { ChildrenTree } from "../Utils.js";

/** @internal */
export const SET_CHANGE_DEBOUNCE_TIME = 20;

type SetType = "always" | "never";

/** @internal */
export interface GetElementsProps {
  parentInstanceNodeIds: Array<Id64Arg>;
  setType: SetType;
}

type CachedNodesMap = ChildrenTree<{ categoryId?: Id64String; isInList: boolean }>;

export class AlwaysAndNeverDrawnElementInfo implements Disposable {
  #subscriptions: Subscription[];
  #alwaysDrawn: { cacheEntryObs: Observable<CachedNodesMap>; latestCacheEntryValue?: CachedNodesMap };
  #neverDrawn: { cacheEntryObs: Observable<CachedNodesMap>; latestCacheEntryValue?: CachedNodesMap };
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

  public getElementChildrenTree({ setType, parentInstanceNodeIds }: GetElementsProps): Observable<CachedNodesMap> {
    const cache = setType === "always" ? this.#alwaysDrawn : this.#neverDrawn;
    const getElements = (rootTreeNode: CachedNodesMap | undefined): CachedNodesMap => {
      if (!rootTreeNode) {
        return new Map();
      }
      return this.getChildrenTree({ currentChildrenTree: rootTreeNode, parentInstanceNodeIds });
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

  private getChildrenTree<T>({
    currentChildrenTree,
    parentInstanceNodeIds,
  }: {
    currentChildrenTree: ChildrenTree<T>;
    parentInstanceNodeIds: Array<Id64Arg>;
  }): ChildrenTree<T> {
    if (parentInstanceNodeIds.length === 0) {
      return currentChildrenTree;
    }
    const result: ChildrenTree<T> = new Map();
    for (const parentId of Id64.iterable(parentInstanceNodeIds[0])) {
      const entry = currentChildrenTree.get(parentId);
      if (entry?.children) {
        const childrenTreeOfChildren = this.getChildrenTree({ currentChildrenTree: entry.children, parentInstanceNodeIds: parentInstanceNodeIds.slice(1) });
        childrenTreeOfChildren.forEach((val, childId) => result.set(childId, val));
      }
    }
    return result;
  }

  private createCacheEntryObservable(setType: SetType): Observable<CachedNodesMap> {
    const event = setType === "always" ? this.#viewport.onAlwaysDrawnChanged : this.#viewport.onNeverDrawnChanged;
    const getIds = setType === "always" ? () => this.#viewport.alwaysDrawn : () => this.#viewport.neverDrawn;

    const resultSubject = new BehaviorSubject<CachedNodesMap | undefined>(undefined);

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
      first((x): x is CachedNodesMap => !!x),
    );
    return obs;
  }

  public [Symbol.dispose]() {
    this.#subscriptions.forEach((x) => x.unsubscribe());
    this.#subscriptions = [];
    this.#disposeSubject.next();
  }

  private queryAlwaysOrNeverDrawnElementInfo(set: Id64Set | undefined, requestId: string): Observable<CachedNodesMap> {
    const elementInfo = set?.size ? this.queryElementInfo([...set], requestId) : EMPTY;
    return elementInfo.pipe(
      reduce((acc, { categoryId, rootCategoryId, modelId, elementsPath }) => {
        let modelEntry = acc.get(modelId);
        if (!modelEntry) {
          modelEntry = { additionalProps: { isInList: false }, children: new Map() };
          acc.set(modelId, modelEntry);
        }

        let categoryEntry = modelEntry.children!.get(rootCategoryId);
        if (!categoryEntry) {
          categoryEntry = { additionalProps: { isInList: false }, children: new Map() };
          modelEntry.children!.set(rootCategoryId, categoryEntry);
        }

        let lastEntry = categoryEntry;
        const pathLength = elementsPath.length;
        for (let i = 0; i < pathLength; ++i) {
          const elementId = elementsPath[i];
          let elementEntry = lastEntry.children?.get(elementId);
          if (!elementEntry) {
            if (i + 1 === pathLength) {
              elementEntry = { additionalProps: { isInList: true, categoryId }};
            } else {
              elementEntry = { additionalProps: { isInList: false }, children: new Map()};
            }
            if (!lastEntry.children) {
              lastEntry.children = new Map();
            }
            lastEntry.children.set(elementId, elementEntry);
          }
          if (i + 1 === pathLength) {
            elementEntry.additionalProps = {
              isInList: true,
              categoryId
            }
          }
          lastEntry = elementEntry;
        }
        return acc;
      }, ((): CachedNodesMap => new Map())()),
    );
  }

  private queryElementInfo(
    elementIds: Id64Array,
    requestId: string,
  ): Observable<{
    rootCategoryId: Id64String;
    modelId: Id64String;
    categoryId: Id64String;
    elementsPath: Id64Array;
  }> {
    return defer(() => {
      const executor = createECSqlQueryExecutor(this.#viewport.iModel);
      return executor.createQueryReader(
        {
          ctes: [
            `
            ElementInfo(modelId, rootCategoryId, categoryId, parentId, elementsPath) AS (
              SELECT
                Model.Id modelId,
                Category.Id rootCategoryId,
                Category.Id categoryId,
                Parent.Id parentId,
                CAST(IdToHex(ECInstanceId) AS TEXT) elementsPath
              FROM bis.GeometricElement3d
              WHERE InVirtualSet(?, ECInstanceId)

              UNION ALL

              SELECT
                e.modelId modelId,
                p.Category.Id rootCategoryId,
                e.categoryId categoryId,
                p.Parent.Id parentId,
                CAST(IdToHex(p.ECInstanceId) AS TEXT) || ';' || e.elementsPath
              FROM bis.GeometricElement3d p
              JOIN ElementInfo e ON p.ECInstanceId = e.parentId
            )
            `,
          ],
          ecsql: `
            SELECT elementsPath elementsPath, modelId modelId, categoryId categoryId, rootCategoryId rootCategoryId
            FROM ElementInfo
            WHERE parentId IS NULL
          `,
          bindings: [{ type: "idset", value: elementIds }],
        },
        {
          rowFormat: "ECSqlPropertyNames",
          restartToken: `ModelsTreeVisibilityHandler/${requestId}`,
        },
      );
    }).pipe(
      map((row) => {
        return { elementsPath: row.elementsPath.split(";"), modelId: row.modelId, categoryId: row.categoryId, rootCategoryId: row.rootCategoryId };
      }),
    );
  }
}
