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
  forkJoin,
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
import { Guid, Id64 } from "@itwin/core-bentley";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { catchBeSQLiteInterrupts } from "../UseErrorState.js";
import { getClassesByView, getIdsFromChildrenTree, getOptimalBatchSize, releaseMainThreadOnItemsCount, setDifference, updateChildrenTree } from "../Utils.js";

import type { Observable, Subscription } from "rxjs";
import type { GuidString, Id64Arg, Id64Array, Id64String } from "@itwin/core-bentley";
import type { TreeWidgetViewport } from "../../TreeWidgetViewport.js";
import type { ChildrenTree } from "../Utils.js";

/** @internal */
export const SET_CHANGE_DEBOUNCE_TIME = 20;

type SetType = "always" | "never";

interface GetElementsTreeByModelProps {
  /** Only always/never drawn elements that have the specified models will be returned. */
  modelIds: Id64Arg;
  /**
   * The type of set from which tree should be retrieved.
   * `always` - ChildrenTree will be created from `alwaysDrawn` set.
   * `never` - ChildrenTree will be created from `neverDrawn` set.
   */
  setType: SetType;
}
interface GetElementsTreeByCategoryProps {
  modelIds: Id64Arg | undefined;
  /**
   * Categories of root elements.
   *
   * Elements are filtered by given categories. Children of those elements are also included, no matter their category.
   */
  categoryIds: Id64Arg;
  /**
   * The type of set from which tree should be retrieved.
   * `always` - ChildrenTree will be created from `alwaysDrawn` set.
   * `never` - ChildrenTree will be created from `neverDrawn` set.
   */
  setType: SetType;
}

interface GetElementsTreeByElementProps extends GetElementsTreeByCategoryProps {
  /** Path to element for which to get its' child always/never drawn elements. When undefined, models and categories will be used to get the always/never drawn elements. */
  parentElementIdsPath: Array<Id64Arg>;
}

/** @internal */
export type GetElementsTreeProps = GetElementsTreeByModelProps | GetElementsTreeByCategoryProps | GetElementsTreeByElementProps;

/**
 * - `categoryId` is assigned only to the elements in always/never drawn set.
 * - `isInAlwaysOrNeverDrawnSet` flag determines if key (ECInstanceId) is in always/never set.
 * @internal
 */
export type MapEntry = { isInAlwaysOrNeverDrawnSet: true; categoryId: Id64String } | { isInAlwaysOrNeverDrawnSet: false };

type CachedNodesMap = ChildrenTree<MapEntry>;

interface AlwaysAndNeverDrawnElementInfoCacheProps {
  viewport: TreeWidgetViewport;
  elementClassName?: string;
  componentId?: GuidString;
}

/** @internal */
export class AlwaysAndNeverDrawnElementInfoCache implements Disposable {
  #subscriptions: Subscription[];
  #alwaysDrawn: { cacheEntryObs: Observable<CachedNodesMap>; latestCacheEntryValue?: CachedNodesMap };
  #neverDrawn: { cacheEntryObs: Observable<CachedNodesMap>; latestCacheEntryValue?: CachedNodesMap };
  #disposeSubject = new Subject<void>();
  readonly #viewport: TreeWidgetViewport;
  readonly #elementClassName: string;
  #componentId: GuidString;
  #componentName: string;

  #suppressors: Observable<number>;
  #suppress = new Subject<boolean>();

  constructor(props: AlwaysAndNeverDrawnElementInfoCacheProps) {
    this.#viewport = props.viewport;
    this.#alwaysDrawn = { cacheEntryObs: this.createCacheEntryObservable("always") };
    this.#neverDrawn = { cacheEntryObs: this.createCacheEntryObservable("never") };
    this.#suppressors = this.#suppress.pipe(
      scan((acc, suppress) => acc + (suppress ? 1 : -1), 0),
      startWith(0),
      shareReplay(1),
    );
    this.#subscriptions = [this.#alwaysDrawn.cacheEntryObs.subscribe(), this.#neverDrawn.cacheEntryObs.subscribe()];
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

  public getElementsTree({ setType, modelIds, ...props }: GetElementsTreeProps): Observable<CachedNodesMap> {
    const cache = setType === "always" ? this.#alwaysDrawn : this.#neverDrawn;
    const getElements = (rootTreeNodes: CachedNodesMap | undefined): CachedNodesMap => {
      if (!rootTreeNodes) {
        return new Map();
      }
      const pathToElements = [modelIds];
      if ("categoryIds" in props && props.categoryIds) {
        pathToElements.push(props.categoryIds);
        if ("parentElementIdsPath" in props && props.parentElementIdsPath) {
          props.parentElementIdsPath.forEach((parentElementIds) => pathToElements.push(parentElementIds));
        }
      }
      return this.getChildrenTree({ currentChildrenTree: rootTreeNodes, pathToElements, currentIdsIndex: 0 });
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

  private getChildrenTree({
    currentChildrenTree,
    pathToElements,
    currentIdsIndex,
  }: {
    currentChildrenTree: ChildrenTree<MapEntry>;
    pathToElements: Array<Id64Arg | undefined>;
    currentIdsIndex: number;
  }): ChildrenTree<MapEntry> {
    if (currentIdsIndex >= pathToElements.length) {
      return currentChildrenTree;
    }
    const result: ChildrenTree<MapEntry> = new Map();
    const currentParentIds = pathToElements[currentIdsIndex];
    // currentParentIds is undefined - it means that we are getting children for categories that don't have model as parent
    if (!currentParentIds) {
      for (const entry of currentChildrenTree.values()) {
        if (entry.children) {
          const childrenTreeOfChildren = this.getChildrenTree({
            currentChildrenTree: entry.children,
            pathToElements,
            currentIdsIndex: currentIdsIndex + 1,
          });
          childrenTreeOfChildren.forEach((val, childId) => result.set(childId, val));
        }
      }
      return result;
    }
    for (const parentId of Id64.iterable(currentParentIds)) {
      const entry = currentChildrenTree.get(parentId);
      if (entry?.children) {
        const childrenTreeOfChildren = this.getChildrenTree({
          currentChildrenTree: entry.children,
          pathToElements,
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
      debounceTime(SET_CHANGE_DEBOUNCE_TIME),
      // Cancel pending request if dispose() is called.
      takeUntil(this.#disposeSubject),
      // If multiple requests are sent at once, preserve only the result of the newest.
      switchMap(() =>
        // Race between the event and the query.
        // In cases where event is raised before query returns, the query result is discarded.
        race(
          sharedObs,
          defer(() => this.queryAlwaysOrNeverDrawnElementInfo(getIds(), setType)),
        ),
      ),
      tap((cacheEntry) => {
        if (cacheEntry !== undefined) {
          const value = setType === "always" ? this.#alwaysDrawn : this.#neverDrawn;
          value.latestCacheEntryValue = cacheEntry;
        }
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

  public [Symbol.dispose](): void {
    this.#subscriptions.forEach((x) => x.unsubscribe());
    this.#subscriptions = [];
    this.#disposeSubject.next();
  }

  private queryAlwaysOrNeverDrawnElementInfo(set: ReadonlySet<Id64String> | undefined, setType: SetType): Observable<CachedNodesMap> {
    const elementInfo = set?.size
      ? set.size > 5000
        ? // When set is larger, buffer helps to not block main thread for long periods of time
          from(set).pipe(
            bufferCount(getOptimalBatchSize({ totalSize: set.size, maximumBatchSize: 5000 })),
            releaseMainThreadOnItemsCount(2),
            mergeMap((block, index) => this.queryElementInfo(block, `${setType}-${index}`), 10),
          )
        : this.queryElementInfo([...set], `${setType}-0`)
      : EMPTY;
    return elementInfo.pipe(
      releaseMainThreadOnItemsCount(500),
      reduce((acc: CachedNodesMap, { categoryId, rootCategoryId, modelId, elementsPath }) => {
        const elementIdInList = elementsPath[elementsPath.length - 1];
        const additionalPropsGetter = (id: Id64String, additionalProps?: MapEntry): MapEntry => {
          if (id === elementIdInList) {
            // Last element in elementsPath is in always/never drawn set. We want to mark, that it is in the set, and save it's categoryId.
            return { isInAlwaysOrNeverDrawnSet: true, categoryId };
          }
          // Existing entries can keep their value, if it's a new entry it's not in the list.
          return additionalProps ?? { isInAlwaysOrNeverDrawnSet: false };
        };
        updateChildrenTree({ tree: acc, idsToAdd: [modelId, rootCategoryId, ...elementsPath], additionalPropsGetter });
        return acc;
      }, new Map()),
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
              FROM ${this.#elementClassName}
              WHERE InVirtualSet(?, ECInstanceId)

              UNION ALL

              SELECT
                e.modelId modelId,
                p.Category.Id rootCategoryId,
                e.categoryId categoryId,
                p.Parent.Id parentId,
                CAST(IdToHex(p.ECInstanceId) AS TEXT) || ';' || e.elementsPath
              FROM ${this.#elementClassName} p
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
          restartToken: `${this.#componentName}/${this.#componentId}/${requestId}`,
        },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row) => {
        return { elementsPath: row.elementsPath.split(";"), modelId: row.modelId, categoryId: row.categoryId, rootCategoryId: row.rootCategoryId };
      }),
    );
  }

  public getAlwaysOrNeverDrawnElements(props: GetElementsTreeProps) {
    return this.getElementsTree(props).pipe(
      map((childrenTree) => getIdsFromChildrenTree({ tree: childrenTree, predicate: ({ treeEntry }) => treeEntry.isInAlwaysOrNeverDrawnSet })),
    );
  }

  public clearAlwaysAndNeverDrawnElements(props: { categoryIds: Id64Arg; modelId: Id64String | undefined }) {
    return forkJoin({
      alwaysDrawn: this.#viewport.alwaysDrawn?.size
        ? this.getAlwaysOrNeverDrawnElements({ modelIds: props.modelId, categoryIds: props.categoryIds, setType: "always" })
        : of(new Set<Id64String>()),
      neverDrawn: this.#viewport.neverDrawn?.size
        ? this.getAlwaysOrNeverDrawnElements({ modelIds: props.modelId, categoryIds: props.categoryIds, setType: "never" })
        : of(new Set<Id64String>()),
    }).pipe(
      map(({ alwaysDrawn, neverDrawn }) => {
        const viewport = this.#viewport;
        if (viewport.alwaysDrawn?.size && alwaysDrawn.size) {
          viewport.setAlwaysDrawn({ elementIds: setDifference(viewport.alwaysDrawn, alwaysDrawn) });
        }
        if (viewport.neverDrawn?.size && neverDrawn.size) {
          viewport.setNeverDrawn({ elementIds: setDifference(viewport.neverDrawn, neverDrawn) });
        }
      }),
    );
  }
}
