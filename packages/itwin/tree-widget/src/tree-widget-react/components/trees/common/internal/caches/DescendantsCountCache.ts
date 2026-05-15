/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, defer, from, map, mergeMap, of, reduce, shareReplay, switchMap, tap, timer } from "rxjs";
import { assert, Guid } from "@itwin/core-bentley";
import { catchBeSQLiteInterrupts } from "../UseErrorState.js";
import { releaseMainThreadOnItemsCount } from "../Utils.js";

import type { Observable } from "rxjs";
import type { GuidString } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ElementId, ModelId } from "../Types.js";

type RequestId = string;

interface DescendantsCountBaseRequest {
  modelId: ModelId;
}

interface DescendantsCountCategoryRequest extends DescendantsCountBaseRequest {
  categoryId: CategoryId;
  parentElementId?: ElementId; // undefined = root level
}

interface DescendantsCountElementRequest extends DescendantsCountBaseRequest {
  parentElementId: ElementId;
  categoryId?: undefined;
}

type RequestEntry = Map<ModelId, Map<ElementId | undefined, Set<CategoryId | undefined>>>;

/**
 * Cache used to store count of descendants grouped by category.
 *
 * Cache makes requests in batches of 20ms.
 * @internal
 */
export class DescendantsCountCache {
  // When a new request is made:
  // - If the value is already cached (#cachedValues), returns it.
  // - If it's already requested (#requestedValues), pipe through the observable. When observable emits, the cached value can be retrieved,
  // - If the value is not requested yet, add it to the values which will be requested (#valuesToRequest).
  // #valuesToRequest observable waits for 20ms, then adds the observable value to #requestedValues and starts the query.
  // When the query completes the observable removes the value from #requestedValues.

  #cachedValues = new Map<ModelId, Map<ElementId | undefined, Map<CategoryId | undefined, Array<{ categoryId: CategoryId; count: number }>>>>();
  #valuesToRequest: { values: RequestEntry; sharedObs: Observable<void> } | undefined;
  #requestedValues = new Map<RequestId, { values: RequestEntry; sharedObs: Observable<void> }>();
  #queryExecutor: LimitingECSqlQueryExecutor;
  #elementClassName: string;
  #componentId: GuidString;
  #componentName: string;

  public constructor(props: { queryExecutor: LimitingECSqlQueryExecutor; elementClassName: string; componentId: GuidString }) {
    this.#componentId = props.componentId;
    this.#queryExecutor = props.queryExecutor;
    this.#elementClassName = props.elementClassName;
    this.#componentName = "DescendantsCountCache";
  }

  private getCachedValueAfterObservable({
    modelId,
    categoryId,
    parentElementId,
    observable,
  }: {
    observable: Observable<void>;
  } & (DescendantsCountElementRequest | DescendantsCountCategoryRequest)): Observable<Array<{ categoryId: CategoryId; count: number }>> {
    return observable.pipe(
      map(() => {
        const entry = this.#cachedValues.get(modelId)?.get(parentElementId)?.get(categoryId);
        assert(entry !== undefined);
        return entry;
      }),
    );
  }

  private executeBatchQuery(valuesToRequest: RequestEntry) {
    return from(valuesToRequest.entries()).pipe(
      mergeMap(([modelId, parentMap]) =>
        from(parentMap.entries()).pipe(
          mergeMap(([parentElementId, categoryIds]) => {
            const clauses: Array<{ whereClause: string; type: "element" | "category" }> = [];
            if (categoryIds.has(undefined)) {
              assert(parentElementId !== undefined);
              clauses.push({ whereClause: `Model.Id = ${modelId} AND Parent.Id = ${parentElementId}`, type: "element" });
            }
            const concreteCategoryIds = [...categoryIds].filter((id): id is CategoryId => id !== undefined);
            if (concreteCategoryIds.length > 0) {
              clauses.push({
                whereClause: `Model.Id = ${modelId} AND Category.Id IN (${concreteCategoryIds.join(", ")}) ${parentElementId === undefined ? "AND Parent.Id IS NULL" : `AND Parent.Id = ${parentElementId}`}`,
                type: "category",
              });
            }
            return from(clauses);
          }),
        ),
      ),
      bufferCount(100),
      mergeMap((whereClauses) => {
        const categoryWhereClauses = whereClauses.filter((c) => c.type === "category").map((c) => c.whereClause);
        const elementWhereClauses = whereClauses.filter((c) => c.type === "element").map((c) => c.whereClause);

        const baseCases: string[] = [];

        if (categoryWhereClauses.length > 0) {
          baseCases.push(`
            SELECT ECInstanceId, Model.Id, Parent.Id, Category.Id, Category.Id
            FROM ${this.#elementClassName}
            WHERE ${categoryWhereClauses.join(" OR ")}
          `);
        }

        if (elementWhereClauses.length > 0) {
          baseCases.push(`
            SELECT ECInstanceId, Model.Id, Parent.Id, CAST(NULL AS TEXT), Category.Id
            FROM ${this.#elementClassName}
            WHERE ${elementWhereClauses.join(" OR ")}
          `);
        }

        if (baseCases.length === 0) {
          return of();
        }

        return defer(() =>
          this.#queryExecutor.createQueryReader(
            {
              ctes: [
                `
                Descendants(id, modelId, reqParent, reqCategory, ownCategory) AS (
                  ${baseCases.join(" UNION ALL ")}

                  UNION ALL

                  SELECT c.ECInstanceId, p.modelId, p.reqParent, p.reqCategory, c.Category.Id
                  FROM ${this.#elementClassName} c
                  JOIN Descendants p ON c.Parent.Id = p.id
                )
                `,
              ],
              ecsql: `
                SELECT modelId, reqParent, reqCategory, ownCategory, COUNT(*) as cnt
                FROM Descendants
                GROUP BY modelId, reqParent, reqCategory, ownCategory
              `,
            },
            {
              rowFormat: "ECSqlPropertyNames",
              limit: "unbounded",
              restartToken: `${this.#componentName}/${this.#componentId}/descendants-counts/${Guid.createValue()}`,
            },
          ),
        ).pipe(catchBeSQLiteInterrupts);
      }),
      releaseMainThreadOnItemsCount(500),
    );
  }

  public getDescendantsCounts(
    props: DescendantsCountCategoryRequest | DescendantsCountElementRequest,
  ): Observable<Array<{ categoryId: CategoryId; count: number }>> {
    const cachedValue = this.#cachedValues.get(props.modelId)?.get(props.parentElementId)?.get(props.categoryId);
    // Cached values can be returned immediately
    if (cachedValue !== undefined) {
      return of(cachedValue);
    }

    // Check if value was already requested. If it was, wait for requested observable to emit and then return the value from cache
    for (const { values, sharedObs: obs } of this.#requestedValues.values()) {
      if (values.get(props.modelId)?.get(props.parentElementId)?.has(props.categoryId)) {
        return this.getCachedValueAfterObservable({ ...props, observable: obs });
      }
    }

    if (this.#valuesToRequest === undefined) {
      // Store request guid so it can be deleted later.
      const requestId = Guid.createValue();
      const sharedObs = timer(20).pipe(
        switchMap(() => {
          assert(this.#valuesToRequest !== undefined);
          // After 20 ms, assign the observable in #valuesToRequest to the #requestedValues
          const valuesToRequest = this.#valuesToRequest;
          this.#requestedValues.set(requestId, valuesToRequest);
          // Clear #valuesToRequest so new requests can be collected while the query is executing
          this.#valuesToRequest = undefined;
          return this.executeBatchQuery(valuesToRequest.values).pipe(
            // Cache each row as it arrives, use reduce to emit one value when query completes
            reduce((acc, row) => {
              let modelEntry = this.#cachedValues.get(row.modelId);
              if (!modelEntry) {
                modelEntry = new Map();
                this.#cachedValues.set(row.modelId, modelEntry);
              }
              let parentEntry = modelEntry.get(row.reqParent);
              if (!parentEntry) {
                parentEntry = new Map();
                modelEntry.set(row.reqParent, parentEntry);
              }
              let categoryEntry = parentEntry.get(row.reqCategory);
              if (!categoryEntry) {
                categoryEntry = [];
                parentEntry.set(row.reqCategory, categoryEntry);
              }
              categoryEntry.push({ categoryId: row.ownCategory, count: row.cnt });
              return acc;
            }, undefined),
            tap(() => {
              for (const [entryModelId, parentMap] of valuesToRequest.values.entries()) {
                let modelEntry = this.#cachedValues.get(entryModelId);
                if (!modelEntry) {
                  modelEntry = new Map();
                  this.#cachedValues.set(entryModelId, modelEntry);
                }
                for (const [parentElementId, categoryIds] of parentMap) {
                  let parentEntry = modelEntry.get(parentElementId);
                  if (!parentEntry) {
                    parentEntry = new Map();
                    modelEntry.set(parentElementId, parentEntry);
                  }
                  for (const entryCategoryId of categoryIds) {
                    if (!parentEntry.has(entryCategoryId)) {
                      parentEntry.set(entryCategoryId, entryCategoryId === undefined ? [] : [{ categoryId: entryCategoryId, count: 0 }]);
                    }
                  }
                }
              }
            }),
          );
        }),
        tap({
          finalize: () => {
            // Remove requestedValues entry when the query completes.
            this.#requestedValues.delete(requestId);
          },
        }),
        shareReplay(1),
      );
      this.#valuesToRequest = { values: new Map([[props.modelId, new Map([[props.parentElementId, new Set([props.categoryId])]])]]), sharedObs };
      return this.getCachedValueAfterObservable({ ...props, observable: this.#valuesToRequest.sharedObs });
    }

    let existingModelEntry = this.#valuesToRequest.values.get(props.modelId);
    if (!existingModelEntry) {
      existingModelEntry = new Map();
      this.#valuesToRequest.values.set(props.modelId, existingModelEntry);
    }
    let existingParentEntry = existingModelEntry.get(props.parentElementId);
    if (!existingParentEntry) {
      existingParentEntry = new Set();
      existingModelEntry.set(props.parentElementId, existingParentEntry);
    }
    existingParentEntry.add(props.categoryId);
    return this.getCachedValueAfterObservable({ ...props, observable: this.#valuesToRequest.sharedObs });
  }
}
