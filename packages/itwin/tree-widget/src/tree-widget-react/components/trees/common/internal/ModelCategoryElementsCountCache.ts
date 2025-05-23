/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferTime, filter, firstValueFrom, mergeAll, mergeMap, ReplaySubject, Subject } from "rxjs";
import { assert } from "@itwin/core-bentley";

import type { Id64String } from "@itwin/core-bentley";
import type { Subscription } from "rxjs";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ModelId } from "./Types.js";

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

/** @internal */
export class ModelCategoryElementsCountCache implements Disposable {
  private _cache = new Map<ModelCategoryKey, Subject<number>>();
  private _requestsStream = new Subject<{ modelId: Id64String; categoryId: Id64String }>();
  private _subscription: Subscription;

  public constructor(
    private _queryExecutor: LimitingECSqlQueryExecutor,
    private _elementsClassNames: string[],
  ) {
    this._subscription = this._requestsStream
      .pipe(
        bufferTime(20),
        filter((requests) => requests.length > 0),
        mergeMap(async (requests) => this.queryCategoryElementCounts(requests)),
        mergeAll(),
      )
      .subscribe({
        next: ({ modelId, categoryId, elementsCount }) => {
          const subject = this._cache.get(`${modelId}-${categoryId}`);
          assert(!!subject);
          subject.next(elementsCount);
        },
      });
  }

  private async queryCategoryElementCounts(
    input: Array<{ modelId: Id64String; categoryId: Id64String }>,
  ): Promise<Array<{ modelId: number; categoryId: number; elementsCount: number }>> {
    const reader = this._queryExecutor.createQueryReader(
      {
        ctes: this._elementsClassNames.map(
          (elementsClassName, index) => `
          CategoryElements${index}(id, modelId, categoryId) AS (
            SELECT ECInstanceId, Model.Id, Category.Id
            FROM ${elementsClassName}
            WHERE
              Parent.Id IS NULL
              AND (
                ${input.map(({ modelId, categoryId }) => `Model.Id = ${modelId} AND Category.Id = ${categoryId}`).join(" OR ")}
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
            ${this._elementsClassNames
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

    const result = new Array<{ modelId: number; categoryId: number; elementsCount: number }>();
    for await (const row of reader) {
      result.push({ modelId: row.modelId, categoryId: row.categoryId, elementsCount: row.elementsCount });
    }
    return result;
  }

  public [Symbol.dispose]() {
    this._subscription.unsubscribe();
  }

  public async getCategoryElementsCount(modelId: Id64String, categoryId: Id64String): Promise<number> {
    const cacheKey: ModelCategoryKey = `${modelId}-${categoryId}`;
    let result = this._cache.get(cacheKey);
    if (result !== undefined) {
      return firstValueFrom(result);
    }

    result = new ReplaySubject(1);
    this._cache.set(cacheKey, result);
    this._requestsStream.next({ modelId, categoryId });
    return firstValueFrom(result);
  }
}
