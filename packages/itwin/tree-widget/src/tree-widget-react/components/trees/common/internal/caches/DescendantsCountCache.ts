/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, from, map, merge, of } from "rxjs";
import { Guid } from "@itwin/core-bentley";
import { getOrCreate } from "../Utils.js";
import { BatchingCache } from "./BatchingCache.js";

import type { Observable } from "rxjs";
import type { GuidString } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { ECSqlBinding } from "@itwin/presentation-shared";
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
  bindings?: ECSqlBinding[];
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
    const groupedCategoryValues = new Map<ElementId, Set<CategoryId>>();
    const rootCategoryValues = new Set<CategoryId>();
    const elementValues = new Set<ElementId>();
    // Requests contain modelId, but there is no need to include them in the query:
    // - When making element request: it can only exist within a single model;
    // - When making category request: if count for category under one model is requested, then it will be requested for other models also,
    // so there is no need to include them in the query.
    for (const batchEntry of batch) {
      if (batchEntry.categoryId === undefined) {
        elementValues.add(batchEntry.parentElementId);
        continue;
      }
      const { parentElementId, categoryId } = batchEntry;
      if (!parentElementId) {
        rootCategoryValues.add(categoryId);
        continue;
      }
      const parentEntry = getOrCreate({ map: groupedCategoryValues, key: parentElementId, createFunc: () => new Set<CategoryId>() });
      parentEntry.add(categoryId);
    }
    return merge(
      from(groupedCategoryValues.entries()).pipe(
        map(([parentElementId, categoryIds], idx): WhereClause => {
          return {
            whereClause: `Category.Id IN (SELECT categoryIdSet${idx}.id FROM IdSet(?) categoryIdSet${idx} ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES) AND Parent.Id = ${parentElementId}`,
            type: "category" as const,
            bindings: [{ type: "idset" as const, value: [...categoryIds] }],
          };
        }),
      ),
      rootCategoryValues.size > 0
        ? of({
            whereClause: "Category.Id IN (SELECT categoryIdSet.id FROM IdSet(?) categoryIdSet ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES) AND Parent.Id IS NULL",
            type: "category" as const,
            bindings: [{ type: "idset" as const, value: [...rootCategoryValues] }],
          })
        : EMPTY,
      elementValues.size > 0
        ? of({
            whereClause: `Parent.Id IN (SELECT elementIdSet.id FROM IdSet(?) elementIdSet ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES)`,
            type: "element" as const,
            bindings: [{ type: "idset" as const, value: [...elementValues] }],
          })
        : EMPTY,
    );
  }

  protected executeQuery(clauses: WhereClause[]): Observable<Row> {
    const categoryClauses = clauses.filter((c) => c.type === "category");
    const elementClauses = clauses.filter((c) => c.type === "element");

    const baseCases: string[] = [];

    if (categoryClauses.length > 0) {
      baseCases.push(`
        SELECT ECInstanceId, Model.Id, Parent.Id, Category.Id, Category.Id
        FROM ${this.#elementClassName}
        WHERE ${categoryClauses.map((c) => c.whereClause).join(" OR ")}
      `);
    }

    if (elementClauses.length > 0) {
      baseCases.push(`
        SELECT ECInstanceId, Model.Id, Parent.Id, CAST(NULL AS TEXT), Category.Id
        FROM ${this.#elementClassName}
        WHERE ${elementClauses.map((c) => c.whereClause).join(" OR ")}
      `);
    }

    if (baseCases.length === 0) {
      return EMPTY;
    }
    const bindings: ECSqlBinding[] = categoryClauses
      .map((c) => c.bindings ?? [])
      .flat()
      .concat(elementClauses.map((c) => c.bindings ?? []).flat());

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
            bindings: bindings.length > 0 ? bindings : undefined,
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
    const modelEntry = getOrCreate({ map: this.#cachedValues, key: row.modelId, createFunc: () => new Map() });
    const parentEntry = getOrCreate({ map: modelEntry, key: reqParent, createFunc: () => new Map() });
    const categoryEntry = getOrCreate({ map: parentEntry, key: reqCategory, createFunc: () => new Array<{ categoryId: CategoryId; count: number }>() });
    categoryEntry.push({ categoryId: row.ownCategory, count: row.cnt });
  }

  protected ensureDefaultCacheEntries(batch: DescendantsCountRequest[]): void {
    for (const { modelId, categoryId, parentElementId } of batch) {
      const modelEntry = getOrCreate({ map: this.#cachedValues, key: modelId, createFunc: () => new Map() });
      const parentEntry = getOrCreate({ map: modelEntry, key: parentElementId, createFunc: () => new Map() });
      if (!parentEntry.has(categoryId)) {
        parentEntry.set(categoryId, categoryId === undefined ? [] : [{ categoryId, count: 0 }]);
      }
    }
  }

  public getDescendantsCounts(props: DescendantsCountRequest): Observable<DescendantsCountResult> {
    return this.get(props);
  }
}
