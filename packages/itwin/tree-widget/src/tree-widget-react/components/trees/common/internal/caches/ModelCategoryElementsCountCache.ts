/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, bufferTime, defer, filter, from, map, mergeAll, mergeMap, reduce, ReplaySubject, Subject, take, toArray } from "rxjs";
import { assert, Guid } from "@itwin/core-bentley";
import { catchBeSQLiteInterrupts } from "../UseErrorState.js";
import { releaseMainThreadOnItemsCount } from "../Utils.js";

import type { Observable, Subscription } from "rxjs";
import type { GuidString, Id64Set, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ModelId } from "../Types.js";

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

/** @internal */
export class ModelCategoryElementsCountCache implements Disposable {
  #cache = new Map<ModelCategoryKey, Subject<number>>();
  #requestsStream = new Subject<{ modelId: Id64String; categoryId: Id64String }>();
  #subscription: Subscription;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #elementsClassName: string;
  #componentId: GuidString;
  #componentName: string;

  public constructor(props: { queryExecutor: LimitingECSqlQueryExecutor; elementsClassName: string; componentId: GuidString; viewType: "2d" | "3d" }) {
    this.#componentId = props.componentId;
    this.#queryExecutor = props.queryExecutor;
    this.#elementsClassName = props.elementsClassName;
    this.#componentName = `ModelCategoryElementsCountCache${props.viewType}`;
    this.#subscription = this.#requestsStream
      .pipe(
        bufferTime(20),
        filter((requests) => requests.length > 0),
        mergeMap((requests) => this.queryCategoryElementCounts(requests)),
        mergeAll(),
      )
      .subscribe({
        next: ({ modelId, categoryId, elementsCount }) => {
          const subject = this.#cache.get(`${modelId}-${categoryId}`);
          assert(!!subject);
          subject.next(elementsCount);
        },
      });
  }

  private queryCategoryElementCounts(
    input: Array<{ modelId: Id64String; categoryId: Id64String }>,
  ): Observable<Array<{ modelId: Id64String; categoryId: Id64String; elementsCount: number }>> {
    return from(input).pipe(
      reduce((acc, { modelId, categoryId }) => {
        const entry = acc.get(modelId);
        if (!entry) {
          acc.set(modelId, new Set([categoryId]));
        } else {
          entry.add(categoryId);
        }
        return acc;
      }, new Map<Id64String, Id64Set>()),
      mergeMap((modelCategoryMap) => modelCategoryMap.entries()),
      map(([modelId, categoryIds]) => `Model.Id = ${modelId} AND Category.Id IN (${[...categoryIds].join(", ")})`),
      // we may have thousands of where clauses here, and sending a single query with all of them could take a
      // long time - instead, split it into smaller chunks
      bufferCount(100),
      mergeMap((whereClauses) =>
        defer(() =>
          this.#queryExecutor.createQueryReader(
            {
              ctes: [
                `
                  CategoryElements(id, modelId, categoryId) AS (
                    SELECT ECInstanceId, Model.Id, Category.Id
                    FROM ${this.#elementsClassName}
                    WHERE
                      Parent.Id IS NULL
                      AND (
                        ${whereClauses.join(" OR ")}
                      )

                    UNION ALL

                    SELECT c.ECInstanceId, p.modelId, p.categoryId
                    FROM ${this.#elementsClassName} c
                    JOIN CategoryElements p ON c.Parent.Id = p.id
                  )
                `,
              ],
              ecsql: `
                SELECT modelId, categoryId, COUNT(id) elementsCount
                FROM (SELECT * FROM CategoryElements)
                GROUP BY modelId, categoryId
              `,
            },
            {
              rowFormat: "ECSqlPropertyNames",
              limit: "unbounded",
              restartToken: `${this.#componentName}/${this.#componentId}/category-element-counts/${Guid.createValue()}`,
            },
          ),
        ).pipe(catchBeSQLiteInterrupts),
      ),
      releaseMainThreadOnItemsCount(500),
      reduce(
        ({ acc, createKey }, row) => {
          acc.set(createKey({ modelId: row.modelId, categoryId: row.categoryId }), {
            modelId: row.modelId,
            categoryId: row.categoryId,
            elementsCount: row.elementsCount,
          });
          return { acc, createKey };
        },
        {
          acc: new Map<string, { modelId: Id64String; categoryId: Id64String; elementsCount: number }>(),
          createKey: (keyProps: { modelId: Id64String; categoryId: Id64String }) => `${keyProps.modelId}-${keyProps.categoryId}`,
        },
      ),
      mergeMap(({ acc: result, createKey }) => {
        input.forEach(({ modelId, categoryId }) => {
          if (!result.has(createKey({ modelId, categoryId }))) {
            result.set(createKey({ modelId, categoryId }), { categoryId, modelId, elementsCount: 0 });
          }
        });

        return from(result.values());
      }),
      toArray(),
    );
  }

  public [Symbol.dispose]() {
    this.#subscription.unsubscribe();
  }

  public getCategoryElementsCount({ modelId, categoryId }: { modelId: Id64String; categoryId: Id64String }): Observable<number> {
    const cacheKey: ModelCategoryKey = `${modelId}-${categoryId}`;
    let result = this.#cache.get(cacheKey);
    if (result !== undefined) {
      return from(result).pipe(take(1));
    }

    result = new ReplaySubject(1);
    this.#cache.set(cacheKey, result);
    this.#requestsStream.next({ modelId, categoryId });
    return from(result).pipe(take(1));
  }
}
