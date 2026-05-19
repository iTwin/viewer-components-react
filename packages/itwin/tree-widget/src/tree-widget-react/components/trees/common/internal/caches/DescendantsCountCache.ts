/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, from, map, merge, mergeMap } from "rxjs";
import { Guid } from "@itwin/core-bentley";
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
export class DescendantsCountCache extends BatchingCache<DescendantsCountRequest, DescendantsCountResult, WhereClause, Row> {
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

  protected getValuesNotInBatch(
    request: DescendantsCountRequest,
    batch: DescendantsCountRequest[],
  ): { valuesNotInBatch: DescendantsCountRequest; batchContainsValues: boolean } | { valuesNotInBatch: undefined; batchContainsValues: true } {
    if (batch.some((r) => r.modelId === request.modelId && r.parentElementId === request.parentElementId && r.categoryId === request.categoryId)) {
      return { valuesNotInBatch: undefined, batchContainsValues: true };
    }
    return { valuesNotInBatch: request, batchContainsValues: false };
  }

  protected getQueryData(batch: DescendantsCountRequest[]): Observable<WhereClause> {
    const groupedCategoryValues = new Map<ModelId, Map<ElementId | undefined, Set<CategoryId>>>();
    const groupedElementValues = new Map<ModelId, Set<ElementId>>();
    for (const batchEntry of batch) {
      if (batchEntry.categoryId === undefined) {
        let groupedElementsModelEntry = groupedElementValues.get(batchEntry.modelId);
        if (!groupedElementsModelEntry) {
          groupedElementsModelEntry = new Set();
          groupedElementValues.set(batchEntry.modelId, groupedElementsModelEntry);
        }
        groupedElementsModelEntry.add(batchEntry.parentElementId);
        continue;
      }
      const { modelId, parentElementId, categoryId } = batchEntry;
      let modelEntry = groupedCategoryValues.get(modelId);
      if (!modelEntry) {
        modelEntry = new Map();
        groupedCategoryValues.set(modelId, modelEntry);
      }
      let parentEntry = modelEntry.get(parentElementId);
      if (!parentEntry) {
        parentEntry = new Set();
        modelEntry.set(parentElementId, parentEntry);
      }
      parentEntry.add(categoryId);
    }
    return merge(
      groupedCategoryValues.size > 0
        ? from(groupedCategoryValues.entries()).pipe(
            mergeMap(([modelId, parentMap]) =>
              from(parentMap.entries()).pipe(
                map(([parentElementId, categoryIds]) => {
                  return {
                    whereClause: `Model.Id = ${modelId} AND Category.Id IN (${[...categoryIds].join(", ")}) ${parentElementId === undefined ? "AND Parent.Id IS NULL" : `AND Parent.Id = ${parentElementId}`}`,
                    type: "category" as const,
                  };
                }),
              ),
            ),
          )
        : EMPTY,
      groupedElementValues.size > 0
        ? from(groupedElementValues.entries()).pipe(
            map(([modelId, parentElementIds]) => {
              return {
                whereClause: `Model.Id = ${modelId} AND Parent.Id IN (${[...parentElementIds].join(", ")})`,
                type: "element" as const,
              };
            }),
          )
        : EMPTY,
    );
  }

  protected executeQuery(clauses: WhereClause[]): Observable<Row> {
    const categoryWhereClauses = clauses.filter((c) => c.type === "category").map((c) => c.whereClause);
    const elementWhereClauses = clauses.filter((c) => c.type === "element").map((c) => c.whereClause);

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

  protected ensureDefaultCacheEntries(batch: DescendantsCountRequest[]): void {
    for (const { modelId, categoryId, parentElementId } of batch) {
      let modelEntry = this.#cachedValues.get(modelId);
      if (!modelEntry) {
        modelEntry = new Map();
        this.#cachedValues.set(modelId, modelEntry);
      }
      let parentEntry = modelEntry.get(parentElementId);
      if (!parentEntry) {
        parentEntry = new Map();
        modelEntry.set(parentElementId, parentEntry);
      }
      if (!parentEntry.has(categoryId)) {
        parentEntry.set(categoryId, categoryId === undefined ? [] : [{ categoryId, count: 0 }]);
      }
    }
  }

  public getDescendantsCounts(props: DescendantsCountRequest): Observable<DescendantsCountResult> {
    return this.get(props);
  }

  /** Pre-warms the cache by queuing a request into the next batch without subscribing to results. */
  public storeRequest(request: DescendantsCountRequest): void {
    return this.store(request);
  }
}
