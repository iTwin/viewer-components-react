/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, bufferTime, filter, firstValueFrom, from, map, mergeAll, mergeMap, reduce, ReplaySubject, Subject } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { collect } from "./Rxjs.js";

import type { Subscription } from "rxjs";
import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ModelId } from "./Types.js";

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

/** @internal */
export class ModelCategoryElementsCountCache implements Disposable {
  #cache = new Map<ModelCategoryKey, Subject<number>>();
  #requestsStream = new Subject<{ modelId: Id64String; categoryId: Id64String }>();
  #subscription: Subscription;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #elementsClassNames: string[];

  public constructor(queryExecutor: LimitingECSqlQueryExecutor, elementsClassNames: string[]) {
    this.#queryExecutor = queryExecutor;
    this.#elementsClassNames = elementsClassNames;
    this.#subscription = this.#requestsStream
      .pipe(
        bufferTime(20),
        filter((requests) => requests.length > 0),
        mergeMap(async (requests) => this.queryCategoryElementCounts(requests)),
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

  private async queryCategoryElementCounts(
    input: Array<{ modelId: Id64String; categoryId: Id64String }>,
  ): Promise<Array<{ modelId: Id64String; categoryId: Id64String; elementsCount: number }>> {
    return collect(
      from(input).pipe(
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
        mergeMap(async (whereClauses) => {
          const reader = this.#queryExecutor.createQueryReader(
            {
              ctes: this.#elementsClassNames.map(
                (elementsClassName, index) => `
                  CategoryElements${index}(id, modelId, categoryId) AS (
                    SELECT ECInstanceId, Model.Id, Category.Id
                    FROM ${elementsClassName}
                    WHERE
                      Parent.Id IS NULL
                      AND (
                        ${whereClauses.join(" OR ")}
                      )

                    UNION ALL

                    SELECT c.ECInstanceId, p.modelId, p.categoryId
                    FROM ${elementsClassName} c
                    JOIN CategoryElements${index} p ON c.Parent.Id = p.id
                  )
                `,
              ),
              ecsql: `
                SELECT modelId, categoryId, COUNT(id) elementsCount
                FROM (
                  ${this.#elementsClassNames
                    .map(
                      (_, index) => `
                      SELECT * FROM CategoryElements${index}
                    `,
                    )
                    .join(" UNION ALL ")}
                )
                GROUP BY modelId, categoryId
              `,
            },
            { rowFormat: "ECSqlPropertyNames", limit: "unbounded" },
          );

          const result = new Array<{ modelId: Id64String; categoryId: Id64String; elementsCount: number }>();
          for await (const row of reader) {
            result.push({ modelId: row.modelId, categoryId: row.categoryId, elementsCount: row.elementsCount });
          }
          input.forEach(({ modelId, categoryId }) => {
            if (!result.some((queriedResult) => queriedResult.categoryId === categoryId && queriedResult.modelId === modelId)) {
              result.push({ categoryId, modelId, elementsCount: 0 });
            }
          });
          return result;
        }),
        mergeAll(),
      ),
    );
  }

  public [Symbol.dispose]() {
    this.#subscription.unsubscribe();
  }

  public async getCategoryElementsCount(modelId: Id64String, categoryId: Id64String): Promise<number> {
    const cacheKey: ModelCategoryKey = `${modelId}-${categoryId}`;
    let result = this.#cache.get(cacheKey);
    if (result !== undefined) {
      return firstValueFrom(result);
    }

    result = new ReplaySubject(1);
    this.#cache.set(cacheKey, result);
    this.#requestsStream.next({ modelId, categoryId });
    return firstValueFrom(result);
  }
}
