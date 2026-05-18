/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, from, mergeMap } from "rxjs";
import { assert, Guid } from "@itwin/core-bentley";
import { BatchingCache } from "./BatchingCache.js";

import type { Observable } from "rxjs";
import type { GuidString } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ElementId, ModelId } from "../Types.js";

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

type DescendantsCountRequest = DescendantsCountCategoryRequest | DescendantsCountElementRequest;
type DescendantsCountResult = Array<{ categoryId: CategoryId; count: number }>;
type Batch = Map<ModelId, Map<ElementId | undefined, Set<CategoryId | undefined>>>;
interface WhereClause {
  whereClause: string;
  type: "element" | "category";
}
interface Row {
  modelId: ModelId;
  reqParent: ElementId | undefined | null;
  reqCategory: CategoryId | undefined | null;
  ownCategory: CategoryId;
  cnt: number;
}

/**
 * Cache used to store count of descendants grouped by category.
 *
 * Cache makes requests in batches of 20ms.
 * @internal
 */
export class DescendantsCountCache extends BatchingCache<DescendantsCountRequest, Batch, DescendantsCountResult, WhereClause, Row> {
  #cachedValues = new Map<ModelId, Map<ElementId | undefined, Map<CategoryId | undefined, DescendantsCountResult>>>();
  #queryExecutor: LimitingECSqlQueryExecutor;
  #elementClassName: string;
  #componentId: GuidString;
  #componentName: string;

  public constructor(props: { queryExecutor: LimitingECSqlQueryExecutor; elementClassName: string; componentId: GuidString }) {
    super();
    this.#componentId = props.componentId;
    this.#queryExecutor = props.queryExecutor;
    this.#elementClassName = props.elementClassName;
    this.#componentName = "DescendantsCountCache";
  }

  protected getCachedValue(request: DescendantsCountRequest): DescendantsCountResult | undefined {
    return this.#cachedValues.get(request.modelId)?.get(request.parentElementId)?.get(request.categoryId);
  }

  protected getGuaranteedCachedValue(request: DescendantsCountRequest): DescendantsCountResult {
    const entry = this.#cachedValues.get(request.modelId)?.get(request.parentElementId)?.get(request.categoryId);
    assert(entry !== undefined);
    return entry;
  }

  protected getValuesToRequest(request: DescendantsCountRequest, batch: Batch): DescendantsCountRequest | undefined {
    if (batch.get(request.modelId)?.get(request.parentElementId)?.has(request.categoryId)) {
      return undefined;
    }
    return request;
  }

  protected createBatch(): Batch {
    return new Map();
  }

  protected addRequestToBatch(request: DescendantsCountRequest, batch: Batch): void {
    let modelEntry = batch.get(request.modelId);
    if (!modelEntry) {
      modelEntry = new Map();
      batch.set(request.modelId, modelEntry);
    }
    let parentEntry = modelEntry.get(request.parentElementId);
    if (!parentEntry) {
      parentEntry = new Set();
      modelEntry.set(request.parentElementId, parentEntry);
    }
    parentEntry.add(request.categoryId);
  }

  protected getIterable(batch: Batch): Observable<WhereClause> {
    return from(batch.entries()).pipe(
      mergeMap(([modelId, parentMap]) =>
        from(parentMap.entries()).pipe(
          mergeMap(([parentElementId, categoryIds]) => {
            const clauses = new Array<WhereClause>();
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
    );
  }

  protected executeQuery(items: WhereClause[]): Observable<Row> {
    const categoryWhereClauses = items.filter((c) => c.type === "category").map((c) => c.whereClause);
    const elementWhereClauses = items.filter((c) => c.type === "element").map((c) => c.whereClause);

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
      return EMPTY;
    }

    return defer(
      () =>
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
      // observable returns an ECSqlQueryRow, but the return type is known and can be cast as Row.
    ) as Observable<Row>;
  }

  protected insertRow(row: Row): void {
    const reqParent = row.reqParent ?? undefined;
    const reqCategory = row.reqCategory ?? undefined;
    let modelEntry = this.#cachedValues.get(row.modelId);
    if (!modelEntry) {
      modelEntry = new Map();
      this.#cachedValues.set(row.modelId, modelEntry);
    }
    let parentEntry = modelEntry.get(reqParent);
    if (!parentEntry) {
      parentEntry = new Map();
      modelEntry.set(reqParent, parentEntry);
    }
    let categoryEntry = parentEntry.get(reqCategory);
    if (!categoryEntry) {
      categoryEntry = [];
      parentEntry.set(reqCategory, categoryEntry);
    }
    categoryEntry.push({ categoryId: row.ownCategory, count: row.cnt });
  }

  protected ensureDefaultCacheEntries(batch: Batch): void {
    for (const [entryModelId, parentMap] of batch.entries()) {
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
  }

  public getDescendantsCounts(props: DescendantsCountRequest): Observable<DescendantsCountResult> {
    return this.get(props);
  }
}
