/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  BehaviorSubject,
  bufferCount,
  debounceTime,
  defer,
  EMPTY,
  filter,
  first,
  from,
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
import { releaseMainThreadOnItemsCount, updateChildrenTree } from "../Utils.js";

import type { Observable, Subscription } from "rxjs";
import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { ChildrenTree } from "../Utils.js";

/** @internal */
export const SET_CHANGE_DEBOUNCE_TIME = 20;

type SetType = "always" | "never";

/** @internal */
export interface GetElementChildrenTreeProps {
  /**
   * Ids of parent nodes.
   *
   * The array should have the following structure:
   * - 0 index: modelIds (can be subModel ids)
   * - 1 index: categoryIds
   * - Then parentIds for which to get the children tree.
   *
   * Array can be of any size.
   */
  parentInstanceNodeIds: Array<Id64Arg>;
  /**
   * The type of set from which tree should be retrieved.
   * `always` - ChildrenTree will be created from `alwaysDrawn` set.
   * `never` - ChildrenTree will be created from `neverDrawn` set.
   */
  setType: SetType;
}

interface MapEntry {
  categoryId?: Id64String;
  isInList: boolean;
}

/**
 * - `categoryId` is assigned only to the elements in always/never drawn set.
 * - `isInList` flag determines if key (ECInstanceId) is in always/never set.
 */
type CachedNodesMap = ChildrenTree<MapEntry>;

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

  public getElementChildrenTree({ setType, parentInstanceNodeIds }: GetElementChildrenTreeProps): Observable<CachedNodesMap> {
    const cache = setType === "always" ? this.#alwaysDrawn : this.#neverDrawn;
    const getElements = (rootTreeNodes: CachedNodesMap | undefined): CachedNodesMap => {
      if (!rootTreeNodes) {
        return new Map();
      }
      if (parentInstanceNodeIds.length === 0) {
        return rootTreeNodes;
      }
      return this.getChildrenTree({ currentChildrenTree: rootTreeNodes, parentInstanceNodeIds, currentIdsIndex: 0 });
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

  private getChildrenTree<T extends object>({
    currentChildrenTree,
    parentInstanceNodeIds,
    currentIdsIndex,
  }: {
    currentChildrenTree: ChildrenTree<T>;
    parentInstanceNodeIds: Array<Id64Arg>;
    currentIdsIndex: number;
  }): ChildrenTree<T> {
    if (currentIdsIndex >= parentInstanceNodeIds.length) {
      return currentChildrenTree;
    }
    const result: ChildrenTree<T> = new Map();
    for (const parentId of Id64.iterable(parentInstanceNodeIds[currentIdsIndex])) {
      const entry = currentChildrenTree.get(parentId);
      if (entry?.children) {
        const childrenTreeOfChildren = this.getChildrenTree({
          currentChildrenTree: entry.children,
          parentInstanceNodeIds,
          currentIdsIndex: currentIdsIndex + 1,
        });
        childrenTreeOfChildren.forEach((val, childId) => result.set(childId, val));
      }
    }
    return result;
  }

  private createCacheEntryObservable(setType: SetType): Observable<CachedNodesMap> {
    const event = setType === "always" ? this.#viewport.onAlwaysDrawnChanged : this.#viewport.onNeverDrawnChanged;
    const getIds = setType === "always" ? () => this.#viewport.alwaysDrawn : () => this.#viewport.neverDrawn;

    const resultSubject = new BehaviorSubject<CachedNodesMap | undefined>(undefined);

    const obs: Observable<CachedNodesMap> = fromEventPattern(
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
      first((x): x is CachedNodesMap => !!x, new Map()),
    );
    return obs;
  }

  public [Symbol.dispose]() {
    this.#subscriptions.forEach((x) => x.unsubscribe());
    this.#subscriptions = [];
    this.#disposeSubject.next();
  }

  private queryAlwaysOrNeverDrawnElementInfo(set: Id64Set | undefined, requestId: string): Observable<CachedNodesMap> {
    const elementInfo = set?.size
      ? from(set).pipe(
          bufferCount(Math.ceil(set.size / Math.ceil(set.size / 5000))),
          mergeMap((block, index) => this.queryElementInfo(block, `${requestId}-${index}`), 10),
        )
      : EMPTY;
    return elementInfo.pipe(
      releaseMainThreadOnItemsCount(1000),
      reduce(
        (acc, { categoryId, rootCategoryId, modelId, elementsPath }) => {
          const elementIdInList = elementsPath[elementsPath.length - 1];
          const additionalPropsGetter = (id: Id64String, additionalProps?: MapEntry): MapEntry => {
            if (id === elementIdInList) {
              // Last element in elementsPath is in always/never drawn set. We want to mark it that it is in the list, and save it's categoryId.
              return { isInList: true, categoryId };
            }
            // Existing entries can keep their value, if it's a new entry it's not in the list.
            return additionalProps ?? { isInList: false };
          };
          updateChildrenTree({ tree: acc, idsToAdd: [modelId, rootCategoryId, ...elementsPath], additionalPropsGetter });
          return acc;
        },
        ((): CachedNodesMap => new Map())(),
      ),
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
