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
  race,
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
import { assert, Guid, Id64 } from "@itwin/core-bentley";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { catchBeSQLiteInterrupts } from "../hooks/UseErrorState.js";
import { releaseMainThreadOnItemsCount } from "../Rxjs.js";
import { ChildrenTree, getClassesByView, getOptimalBatchSize, getOrCreate } from "../Utils.js";

import type { Observable, Subscription } from "rxjs";
import type { GuidString, Id64Arg, Id64Array, Id64String } from "@itwin/core-bentley";
import type { TreeWidgetViewport } from "../../TreeWidgetViewport.js";
import type { CategoryId, ElementId } from "../Types.js";

/** @internal */
export const SET_CHANGE_DEBOUNCE_TIME = 20;
/** @internal */
export const ALWAYS_NEVER_BUFFER_THRESHOLD = 5000;

type SetType = "always" | "never";

/**
 * A segment for navigating the cache tree (model -> cat -> el -> cat -> el -> ...).
 * - `categoryIds`: category node(s) to descend into.
 * - `elementIds`: element node(s) to descend into after the category. Omit to stop at category level.
 *
 * Uses `Id64Arg` so a single segment can fan out across multiple categories/elements.
 * `ParentElementsPath` is the narrower counterpart (single values per segment) and can be
 * spread directly into `ElementPathSegment[]`.
 * @internal
 */
export interface ElementPathSegment {
  categoryIds: Id64Arg;
  elementIds?: Id64Arg;
}

/** @internal */
export interface GetElementsTreeProps {
  /** Only always/never drawn elements that have the specified model will be returned. */
  modelId: Id64String;
  /**
   * The type of set from which tree should be retrieved.
   * `always` - ChildrenTree will be created from `alwaysDrawn` set.
   * `never` - ChildrenTree will be created from `neverDrawn` set.
   */
  setType: SetType;
  /**
   * Path through the cache tree. Each segment navigates through a category level and optionally an element level.
   * - `[]`: model level (all elements in the model)
   * - `[{ categoryIds: catA }]`: category catA's subtree
   * - `[{ categoryIds: catA, elementIds: el1 }]`: element el1's subtree (el1 belongs to catA)
   * - `[{ categoryIds: catA, elementIds: el1 }, { categoryIds: catB }]`: intermediate catB under el1
   */
  elementCategoryPath: ElementPathSegment[];
}

/** @internal */
export type MapEntry =
  | {
      isInAlwaysOrNeverDrawnSet: false;
      type: "category" | "model";
    }
  | {
      isInAlwaysOrNeverDrawnSet: false;
      type: "element";
    }
  | {
      isInAlwaysOrNeverDrawnSet: true;
      type: "element";
      categoryId: Id64String;
    };

type CachedNodesMap = ChildrenTree<MapEntry>;

type GetAlwaysOrNeverDrawnElementsResult = Map<CategoryId, Array<ElementId>>;

/** @internal */
export interface AlwaysAndNeverDrawnElementsAccessor {
  getAlwaysOrNeverDrawnElements: (segment?: ElementPathSegment) => GetAlwaysOrNeverDrawnElementsResult;
}

interface AlwaysAndNeverDrawnElementInfoCacheProps {
  viewport: TreeWidgetViewport;
  elementClassName?: string;
  componentId?: GuidString;
}
interface LatestCacheEntry {
  value: Observable<CachedNodesMap>;
  isUsed: boolean;
  invalidateValue: Subject<void>;
}

/** @internal */
export class AlwaysAndNeverDrawnElementInfoCache implements Disposable {
  #subscriptions: Subscription[];
  #alwaysDrawn: {
    upToDateCacheEntryValue: Observable<CachedNodesMap>;
    latestCacheEntry: LatestCacheEntry;
  };
  #neverDrawn: {
    upToDateCacheEntryValue: Observable<CachedNodesMap>;
    latestCacheEntry: LatestCacheEntry;
  };
  #disposeSubject = new Subject<void>();
  readonly #viewport: TreeWidgetViewport;
  readonly #elementClassName: string;
  #componentId: GuidString;
  #componentName: string;

  #suppressors: Observable<number>;
  #suppress = new Subject<boolean>();

  constructor(props: AlwaysAndNeverDrawnElementInfoCacheProps) {
    this.#viewport = props.viewport;
    const partialLatestAlwaysDrawnCacheEntry = { isUsed: false, invalidateValue: new Subject<void>() };
    // Entry value is created only for typescript types, it will be thrown away when createUpToDateCacheEntryValue is called
    const latestAlwaysDrawnCacheEntryValue = this.createLatestCacheEntryValue({ setType: "always", latestCacheEntry: partialLatestAlwaysDrawnCacheEntry });
    this.#alwaysDrawn = {
      upToDateCacheEntryValue: this.createUpToDateCacheEntryValue("always"),
      latestCacheEntry: { ...partialLatestAlwaysDrawnCacheEntry, value: latestAlwaysDrawnCacheEntryValue },
    };
    const partialLatestNeverDrawnCacheEntry = { isUsed: false, invalidateValue: new Subject<void>() };
    // Entry value is created only for typescript types, it will be thrown away when createUpToDateCacheEntryValue is called
    const latestNeverDrawnCacheEntryValue = this.createLatestCacheEntryValue({ setType: "never", latestCacheEntry: partialLatestNeverDrawnCacheEntry });
    this.#neverDrawn = {
      upToDateCacheEntryValue: this.createUpToDateCacheEntryValue("never"),
      latestCacheEntry: { ...partialLatestNeverDrawnCacheEntry, value: latestNeverDrawnCacheEntryValue },
    };
    this.#suppressors = this.#suppress.pipe(
      scan((acc, suppress) => acc + (suppress ? 1 : -1), 0),
      startWith(0),
      shareReplay(1),
    );
    this.#subscriptions = [this.#alwaysDrawn.upToDateCacheEntryValue.subscribe(), this.#neverDrawn.upToDateCacheEntryValue.subscribe()];
    this.#componentId = props.componentId ?? Guid.createValue();
    this.#componentName = "AlwaysAndNeverDrawnElementInfo";
    this.#elementClassName = props.elementClassName ? props.elementClassName : getClassesByView(this.#viewport.viewType === "2d" ? "2d" : "3d").elementClass;
  }

  public suppressChangeEvents() {
    this.#suppress.next(true);
  }

  public resumeChangeEvents() {
    this.#suppress.next(false);
  }

  public getCachedNodesMap({ setType }: GetElementsTreeProps): Observable<CachedNodesMap> {
    const cache = setType === "always" ? this.#alwaysDrawn : this.#neverDrawn;

    return this.#suppressors.pipe(
      take(1),
      mergeMap((suppressionCount) => {
        if (suppressionCount > 0) {
          cache.latestCacheEntry.isUsed = true;
          return cache.latestCacheEntry.value;
        }
        return cache.upToDateCacheEntryValue;
      }),
    );
  }

  private createUpToDateCacheEntryValue(setType: SetType): Observable<CachedNodesMap> {
    const event = setType === "always" ? this.#viewport.onAlwaysDrawnChanged : this.#viewport.onNeverDrawnChanged;
    const resultSubject = new BehaviorSubject<CachedNodesMap | undefined>(undefined);
    // Observable listens to viewport always/never drawn set change events.
    const sharedObs = fromEventPattern(
      (handler) => event.addListener(handler),
      (handler) => event.removeListener(handler),
    ).pipe(
      // Return undefined when event is raised.
      map(() => undefined),
      share(),
    );

    const obs = sharedObs.pipe(
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
      map(() => {
        const cache = setType === "always" ? this.#alwaysDrawn : this.#neverDrawn;
        // Make sure to set new latestCacheEntry value
        const queryObservable = this.createLatestCacheEntryValue({ setType, latestCacheEntry: cache.latestCacheEntry });
        cache.latestCacheEntry.value = queryObservable;
        return queryObservable;
      }),
      debounceTime(SET_CHANGE_DEBOUNCE_TIME),
      // Cancel pending request if dispose() is called.
      takeUntil(this.#disposeSubject),
      // If multiple requests are sent at once, preserve only the result of the newest.
      switchMap((queryObservable) =>
        // Race between the event and the query.
        // In cases where event is raised before query returns, the query result is discarded.
        race(sharedObs, queryObservable),
      ),
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

  private createLatestCacheEntryValue({
    setType,
    latestCacheEntry,
  }: {
    setType: SetType;
    latestCacheEntry: Omit<LatestCacheEntry, "value">;
  }): Observable<CachedNodesMap> {
    if (!latestCacheEntry.isUsed) {
      // previous latestCacheEntry is not used, invalidate it
      latestCacheEntry.invalidateValue.next();
    }
    const set = setType === "always" ? this.#viewport.alwaysDrawn : this.#viewport.neverDrawn;
    const queryObservable = this.queryAlwaysOrNeverDrawnElementInfo(set, setType).pipe(
      takeUntil(latestCacheEntry.invalidateValue),
      takeUntil(this.#disposeSubject),
      shareReplay(),
    );

    latestCacheEntry.isUsed = false;
    return queryObservable;
  }

  public [Symbol.dispose](): void {
    this.#subscriptions.forEach((x) => x.unsubscribe());
    this.#subscriptions = [];
    this.#disposeSubject.next();
  }

  private queryAlwaysOrNeverDrawnElementInfo(set: ReadonlySet<Id64String> | undefined, setType: SetType): Observable<CachedNodesMap> {
    const elementInfo = set?.size
      ? set.size > ALWAYS_NEVER_BUFFER_THRESHOLD
        ? // When set is larger, buffer helps to not block main thread for long periods of time
          from(set).pipe(
            filter((id) => !Id64.isTransient(id)),
            bufferCount(getOptimalBatchSize({ totalSize: set.size, maximumBatchSize: ALWAYS_NEVER_BUFFER_THRESHOLD })),
            releaseMainThreadOnItemsCount(2),
            mergeMap((block, index) => this.queryElementInfo(block, `${setType}-${index}`), 2),
          )
        : this.queryElementInfo(
            [...set].filter((id) => !Id64.isTransient(id)),
            `${setType}-0`,
          )
      : EMPTY;
    return elementInfo.pipe(
      releaseMainThreadOnItemsCount(500),
      reduce((acc: CachedNodesMap, { modelId, categoryElementPath }) => {
        assert(() => categoryElementPath.length >= 2 && categoryElementPath.length % 2 === 0, "Category element path should have at least one pair");
        const lastElementId = categoryElementPath[categoryElementPath.length - 1];
        const lastElementCategoryId = categoryElementPath[categoryElementPath.length - 2];
        ChildrenTree.update({
          tree: acc,
          idsToAdd: [modelId, ...categoryElementPath],
          additionalPropsGetter: ({ id, additionalProps, depth }): MapEntry => {
            if (id === lastElementId) {
              return { isInAlwaysOrNeverDrawnSet: true, type: "element", categoryId: lastElementCategoryId };
            }
            if (id === modelId) {
              return { isInAlwaysOrNeverDrawnSet: false, type: "model" };
            }
            // idsToAdd looks something like: [model, catA, el1, catB, el2, ...]. So categories are on odd indexes and elements are on even indexes.
            return additionalProps ?? { isInAlwaysOrNeverDrawnSet: false, type: depth % 2 === 1 ? "category" : "element" };
          },
        });
        return acc;
      }, new Map()),
    );
  }

  private queryElementInfo(
    elementIds: Id64Array,
    requestId: string,
  ): Observable<{
    modelId: Id64String;
    categoryElementPath: Id64Array;
  }> {
    return defer(() => {
      if (elementIds.length === 0) {
        return EMPTY;
      }
      const executor = createECSqlQueryExecutor(this.#viewport.iModel);
      return executor.createQueryReader(
        {
          ctes: [
            `
            ElementInfo(modelId, parentId, categoryElementPath) AS (
              SELECT
                Model.Id modelId,
                Parent.Id parentId,
                CAST(IdToHex(Category.Id) AS TEXT) || ';' || CAST(IdToHex(ECInstanceId) AS TEXT) categoryElementPath
              FROM ${this.#elementClassName}
              JOIN IdSet(?) elementIdSet ON elementIdSet.id = ECInstanceId
              ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES

              UNION ALL

              SELECT
                e.modelId modelId,
                p.Parent.Id parentId,
                CAST(IdToHex(p.Category.Id) AS TEXT) || ';' || CAST(IdToHex(p.ECInstanceId) AS TEXT) || ';' || e.categoryElementPath
              FROM ${this.#elementClassName} p
              JOIN ElementInfo e ON p.ECInstanceId = e.parentId
            )
            `,
          ],
          ecsql: `
            SELECT categoryElementPath categoryElementPath, modelId modelId
            FROM ElementInfo
            WHERE parentId IS NULL
          `,
          bindings: [{ type: "idset", value: elementIds }],
        },
        {
          rowFormat: "ECSqlPropertyNames",
          restartToken: `${this.#componentName}/${this.#componentId}/${requestId}`,
        },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row) => {
        return { categoryElementPath: row.categoryElementPath.split(";"), modelId: row.modelId };
      }),
    );
  }

  public getAlwaysAndNeverDrawnElementsAccessor(props: GetElementsTreeProps): Observable<AlwaysAndNeverDrawnElementsAccessor> {
    const cache = props.setType === "always" ? this.#viewport.alwaysDrawn : this.#viewport.neverDrawn;
    if (!cache?.size) {
      return of({ getAlwaysOrNeverDrawnElements: (): GetAlwaysOrNeverDrawnElementsResult => new Map() });
    }
    return this.getCachedNodesMap(props).pipe(
      map((cachedNodesMap) => {
        const modelTree = cachedNodesMap.get(props.modelId)?.children;
        if (!modelTree) {
          return { getAlwaysOrNeverDrawnElements: (): GetAlwaysOrNeverDrawnElementsResult => new Map() };
        }
        const subTreesAtPath = this.getSubTreesForPath({ childrenTree: modelTree, elementCategoryPath: props.elementCategoryPath });
        return {
          getAlwaysOrNeverDrawnElements: (segment?: ElementPathSegment) => this.collectAlwaysOrNeverDrawnElements({ segment, subTreesAtPath }),
        };
      }),
      shareReplay(),
    );
  }

  private getSubTreesForPath({
    childrenTree,
    elementCategoryPath,
  }: {
    childrenTree: CachedNodesMap;
    elementCategoryPath: ElementPathSegment[];
  }): CachedNodesMap[] {
    if (elementCategoryPath.length === 0) {
      return [childrenTree];
    }
    const { categoryIds, elementIds } = elementCategoryPath[0];
    const remainderPath = elementCategoryPath.slice(1);
    const subTreesAtPath: CachedNodesMap[] = [];
    for (const categoryId of Id64.iterable(categoryIds)) {
      const catEntry = childrenTree.get(categoryId);
      if (!catEntry?.children) {
        continue;
      }
      if (!elementIds) {
        // if elementIds is not specified, then the path ends here.
        subTreesAtPath.push(catEntry.children);
        continue;
      }
      for (const elementId of Id64.iterable(elementIds)) {
        const elEntry = catEntry.children.get(elementId);
        if (!elEntry?.children) {
          continue;
        }
        const childSubTrees = this.getSubTreesForPath({ childrenTree: elEntry.children, elementCategoryPath: remainderPath });
        subTreesAtPath.push(...childSubTrees);
      }
    }
    return subTreesAtPath;
  }

  private collectAlwaysOrNeverDrawnElements(props: { segment?: ElementPathSegment; subTreesAtPath: CachedNodesMap[] }): GetAlwaysOrNeverDrawnElementsResult {
    const acc: GetAlwaysOrNeverDrawnElementsResult = new Map();
    const visitTree = (tree: CachedNodesMap) => {
      ChildrenTree.visit({
        tree,
        accept: ({ treeEntry, key }) => {
          if (treeEntry.isInAlwaysOrNeverDrawnSet) {
            const elements = getOrCreate({ map: acc, key: treeEntry.categoryId, createFunc: () => [] });
            elements.push(key);
          }
          return { ignoreChildren: false };
        },
      });
    };
    if (!props.segment) {
      for (const subTree of props.subTreesAtPath) {
        visitTree(subTree);
      }
      return acc;
    }
    for (const subTree of props.subTreesAtPath) {
      for (const categoryId of Id64.iterable(props.segment.categoryIds)) {
        const catEntry = subTree.get(categoryId);
        if (!catEntry?.children) {
          continue;
        }
        if (props.segment.elementIds === undefined) {
          visitTree(catEntry.children);
          continue;
        }
        for (const elementId of Id64.iterable(props.segment.elementIds)) {
          const elEntry = catEntry.children.get(elementId);
          if (!elEntry?.children) {
            continue;
          }
          visitTree(elEntry.children);
        }
      }
    }
    return acc;
  }
}
