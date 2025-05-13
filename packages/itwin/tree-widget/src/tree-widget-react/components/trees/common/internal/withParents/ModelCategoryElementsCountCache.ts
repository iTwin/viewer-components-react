/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferTime, filter, firstValueFrom, mergeAll, mergeMap, ReplaySubject, Subject } from "rxjs";
import { assert } from "@itwin/core-bentley";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { Subscription } from "rxjs";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ModelId, ParentId } from "../Types.js";

type ModelParentCategoryKey = `${ModelId}-${ParentId}-${CategoryId}`;

/** @internal */
export class ModelCategoryElementsCountCache implements Disposable {
  private _cache = new Map<ModelParentCategoryKey, Subject<number>>();
  private _requestsStream = new Subject<{ modelId: Id64String; categoryId: Id64String; parentElementIds?: Id64Array }>();
  private _subscription: Subscription;

  public constructor(
    private _queryExecutor: LimitingECSqlQueryExecutor,
    private _elementsClassName: string,
  ) {
    this._subscription = this._requestsStream
      .pipe(
        bufferTime(20),
        filter((requests) => requests.length > 0),
        mergeMap(async (requests) => this.queryCategoryElementCounts(requests)),
        mergeAll(),
      )
      .subscribe({
        next: ([key, elementsCount]) => {
          const subject = this._cache.get(key);
          assert(!!subject);
          subject.next(elementsCount);
        },
      });
  }

  private async queryCategoryElementCounts(
    input: Array<{ modelId: Id64String; categoryId: Id64String; parentElementIds?: Id64Array }>,
  ): Promise<Map<ModelParentCategoryKey, number>> {
    const result = new Map<ModelParentCategoryKey, number>();
    if (input.length === 0) {
      return result;
    }
    const reader = this._queryExecutor.createQueryReader(
      {
        ecsql: `
          SELECT COUNT(*) elementsCount, e.Category.Id categoryId, e.Model.Id modelId, e.Parent.Id parentId
          FROM ${this._elementsClassName} e
          WHERE
            ${input
              .map(
                ({ modelId, categoryId, parentElementIds }) => `(
                  e.Parent.Id ${parentElementIds ? `IN (${parentElementIds.join(", ")})` : "IS NULL"}
                  AND e.Model.Id = ${modelId}
                  AND e.Category.Id = ${categoryId}
                )`,
              )
              .join(" OR ")}
          GROUP BY e.Model.Id, e.Category.Id, e.Parent.Id
        `,
      },
      { rowFormat: "ECSqlPropertyNames", limit: "unbounded" },
    );

    for await (const row of reader) {
      const key: ModelParentCategoryKey = `${row.modelId}-${row.parentId ?? ""}-${row.categoryId}`;
      result.set(key, row.elementsCount);
    }
    return result;
  }

  public [Symbol.dispose]() {
    this._subscription.unsubscribe();
  }

  public async getCategoryElementsCount(modelId: Id64String, categoryId: Id64String, parentElementIds?: Id64Array): Promise<number> {
    let cacheKey: ModelParentCategoryKey = `${modelId}--${categoryId}`;
    let result: Subject<number> | undefined;
    for (const parentElementId of parentElementIds ?? [undefined]) {
      cacheKey = `${modelId}-${parentElementId ?? ""}-${categoryId}`;
      result = this._cache.get(cacheKey);
      if (result !== undefined) {
        return firstValueFrom(result);
      }
    }

    result = new ReplaySubject(1);
    this._cache.set(cacheKey, result);
    this._requestsStream.next({ modelId, categoryId, parentElementIds });
    return firstValueFrom(result);
  }
}
