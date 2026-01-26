/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defaultIfEmpty, defer, EMPTY, firstValueFrom, from, map, mergeMap, reduce, tap } from "rxjs";
import { Guid, Id64 } from "@itwin/core-bentley";
import { catchBeSQLiteInterrupts } from "./UseErrorState.js";
import { getOptimalBatchSize } from "./Utils.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Arg, Id64Array, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { ChildrenTree } from "./Utils.js";

type ChildElementsMap = Map<Id64String, { children: Id64Array | undefined }>;
type ChildElementsLoadingMap = Map<Id64String, Promise<void>>;

interface ElementChildrenCacheProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  elementClassName: string;
  componentId?: GuidString;
}

/** @internal */
export class ElementChildrenCache {
  #queryExecutor: LimitingECSqlQueryExecutor;
  readonly #elementClassName: string;
  #componentId: GuidString;
  #componentName: string;
  #childElementsMap: ChildElementsMap;
  /** Stores element ids which have children query scheduled to execute. */
  #childElementsLoadingMap: ChildElementsLoadingMap;

  constructor(props: ElementChildrenCacheProps) {
    this.#queryExecutor = props.queryExecutor;
    this.#elementClassName = props.elementClassName;
    this.#componentId = props.componentId ?? Guid.createValue();
    this.#componentName = "ElementChildrenCache";
    this.#childElementsMap = new Map();
    this.#childElementsLoadingMap = new Map();
  }

  private queryChildren({ elementIds }: { elementIds: Id64Array }): Observable<{ id: Id64String; parentId: Id64String }> {
    if (elementIds.length === 0) {
      return EMPTY;
    }

    return defer(() => {
      const ctes = [
        `
          ElementChildren(id, parentId) AS (
            SELECT ECInstanceId id, Parent.Id parentId
            FROM ${this.#elementClassName}
            WHERE Parent.Id IN (${elementIds.join(", ")})
            UNION ALL
            SELECT c.ECInstanceId id, c.Parent.Id
            FROM ${this.#elementClassName} c
            JOIN ElementChildren p ON c.Parent.Id = p.id
          )
        `,
      ];
      const ecsql = `
        SELECT id, parentId
        FROM ElementChildren
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql, ctes },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/children/${Guid.createValue()}` },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row) => {
        return { id: row.id, parentId: row.parentId };
      }),
    );
  }

  private getChildElementsTreeFromMap({ elementIds }: { elementIds: Id64Arg }): ChildrenTree {
    const result: ChildrenTree = new Map();
    if (Id64.sizeOf(elementIds) === 0 || this.#childElementsMap.size === 0) {
      return result;
    }
    for (const elementId of Id64.iterable(elementIds)) {
      const entry = this.#childElementsMap.get(elementId);
      if (!entry?.children) {
        continue;
      }
      const elementChildrenTree: ChildrenTree = new Map();
      result.set(elementId, { children: elementChildrenTree });
      entry.children.forEach((childId) => {
        const childrenTreeOfChild = this.getChildElementsTreeFromMap({ elementIds: childId });
        // Need to add children tree created from childId. This tree includes childId as root element
        // If child does not have children, children tree won't be created. Need to add childId with undefined children
        elementChildrenTree.set(childId, { children: childrenTreeOfChild.size > 0 ? childrenTreeOfChild : undefined });
      });
    }
    return result;
  }

  private getChildElementsCountMap({ elementIds }: { elementIds: Id64Arg }): Map<Id64String, number> {
    const result = new Map<Id64String, number>();
    for (const elementId of Id64.iterable(elementIds)) {
      const entry = this.#childElementsMap.get(elementId);
      if (entry?.children) {
        let totalChildrenCount = entry.children.length;
        this.getChildElementsCountMap({ elementIds: entry.children }).forEach((childrenOfChildCount) => (totalChildrenCount += childrenOfChildCount));
        result.set(elementId, totalChildrenCount);
      }
    }
    return result;
  }

  /**
   * Populates #childElementsLoadingMap with promises. When these promises resolve, they will populate #childElementsMap with values and delete entries from #childElementsLoadingMap.
   */
  private createChildElementsLoadingMapEntries({ elementsToQuery }: { elementsToQuery: Id64Array }): { loadingMapEntries: Promise<void> } {
    const getElementsToQueryPromise = async (batchedElementsToQuery: Id64Array) =>
      firstValueFrom(
        this.queryChildren({ elementIds: batchedElementsToQuery }).pipe(
          // Want to have void at the end instead of void[], so using reduce
          reduce(
            (acc, { parentId, id }) => {
              let entry = this.#childElementsMap.get(parentId);
              if (!entry) {
                entry = { children: [] };
                this.#childElementsMap.set(parentId, entry);
              }
              if (!entry.children) {
                entry.children = [];
              }
              // Add child to parent's entry and add child to children map
              entry.children.push(id);
              if (!this.#childElementsMap.has(id)) {
                this.#childElementsMap.set(id, { children: undefined });
              }
              return acc;
            },
            (() => {})(),
          ),
          tap({ complete: () => batchedElementsToQuery.forEach((elementId) => this.#childElementsLoadingMap.delete(elementId)) }),
          defaultIfEmpty((() => {})()),
        ),
      );
    const maximumBatchSize = 1000;
    const totalSize = elementsToQuery.length;
    const optimalBatchSize = getOptimalBatchSize({ totalSize, maximumBatchSize });
    const loadingMapEntries = new Array<Promise<void>>();
    // Don't want to slice if its not necessary
    if (totalSize <= maximumBatchSize) {
      loadingMapEntries.push(getElementsToQueryPromise(elementsToQuery));
    } else {
      for (let i = 0; i < elementsToQuery.length; i += optimalBatchSize) {
        loadingMapEntries.push(getElementsToQueryPromise(elementsToQuery.slice(i, i + optimalBatchSize)));
      }
    }

    elementsToQuery.forEach((elementId, index) => this.#childElementsLoadingMap.set(elementId, loadingMapEntries[Math.floor(index / optimalBatchSize)]));
    return { loadingMapEntries: Promise.all(loadingMapEntries).then(() => {}) };
  }

  private createChildElementsMapEntries({ elementIds }: { elementIds: Id64Arg }): Observable<void[]> {
    return from(Id64.iterable(elementIds)).pipe(
      reduce(
        (acc, elementId) => {
          if (this.#childElementsMap.has(elementId)) {
            return acc;
          }
          const loadingPromise = this.#childElementsLoadingMap.get(elementId);
          if (loadingPromise) {
            acc.existingPromises.push(loadingPromise);
          } else {
            acc.elementsToQuery.push(elementId);
          }
          return acc;
        },
        { existingPromises: new Array<Promise<void>>(), elementsToQuery: new Array<Id64String>() },
      ),
      mergeMap(async ({ elementsToQuery, existingPromises }) => {
        existingPromises.push(this.createChildElementsLoadingMapEntries({ elementsToQuery }).loadingMapEntries);
        return Promise.all(existingPromises);
      }),
    );
  }

  public getChildElementsTree({ elementIds }: { elementIds: Id64Arg }): Observable<ChildrenTree> {
    return this.createChildElementsMapEntries({ elementIds }).pipe(map(() => this.getChildElementsTreeFromMap({ elementIds })));
  }

  public getAllChildElementsCount({ elementIds }: { elementIds: Id64Arg }): Observable<Map<Id64String, number>> {
    return this.createChildElementsMapEntries({ elementIds }).pipe(map(() => this.getChildElementsCountMap({ elementIds })));
  }
}
