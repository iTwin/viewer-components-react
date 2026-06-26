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
    if (request.categoryId && request.parentElementId === undefined) {
      // This is a root category request.
      // When multiple root category requests are made under different models, then request will include all models and all categories.
      // E.g.
      // request1: { modelId: "model1", categoryId: "category1" }, request2: { modelId: "model2", categoryId: "category2" }
      // Query: SELECT ... WHERE Model.Id IN (model1, model2) AND Category.Id IN (category1, category2) AND Parent.Id IS NULL
      let hasRootModelRequest = false;
      let hasRootCategoryRequest = false;
      for (const r of batch) {
        hasRootModelRequest ||= r.modelId === request.modelId && r.parentElementId === undefined;
        hasRootCategoryRequest ||= r.categoryId === request.categoryId && r.parentElementId === undefined;
        // batch has a request for the same model and category, no need to add them to the batch.
        if (hasRootModelRequest && hasRootCategoryRequest) {
          return { valuesNotInBatch: undefined, batchContainsValues: true };
        }
      }
    } else if (batch.some((r) => r.modelId === request.modelId && r.parentElementId === request.parentElementId && r.categoryId === request.categoryId)) {
      return { valuesNotInBatch: undefined, batchContainsValues: true };
    }
    return { valuesNotInBatch: request, batchContainsValues: false };
  }

  protected getQueryData(batch: DescendantsCountRequest[]): Observable<WhereClause> {
    const groupedCategoryIds = new Map<ElementId, Set<CategoryId>>();
    const rootCategoryIds = new Set<CategoryId>();
    const rootCategoryModels = new Set<ModelId>();
    const elementIds = new Set<ElementId>();
    for (const batchEntry of batch) {
      if (batchEntry.categoryId === undefined) {
        elementIds.add(batchEntry.parentElementId);
        continue;
      }
      const { parentElementId, categoryId, modelId } = batchEntry;
      if (!parentElementId) {
        rootCategoryIds.add(categoryId);
        rootCategoryModels.add(modelId);
        continue;
      }
      const parentEntry = getOrCreate({ map: groupedCategoryIds, key: parentElementId, createFunc: () => new Set<CategoryId>() });
      parentEntry.add(categoryId);
    }
    return merge(
      from(groupedCategoryIds.entries()).pipe(
        map(([parentElementId, categoryIds], idx): WhereClause => {
          return {
            whereClause: `Category.Id IN (SELECT categoryIdSet${idx}.id FROM IdSet(?) categoryIdSet${idx}) AND Parent.Id = ${parentElementId}`,
            type: "category" as const,
            bindings: [{ type: "idset" as const, value: [...categoryIds] }],
          };
        }),
      ),
      rootCategoryIds.size && rootCategoryModels.size > 0
        ? of({
            whereClause:
              "Model.Id IN (SELECT modelIdSet.id FROM IdSet(?) modelIdSet) AND Category.Id IN (SELECT categoryIdSet.id FROM IdSet(?) categoryIdSet) AND Parent.Id IS NULL",
            type: "category" as const,
            bindings: [
              { type: "idset" as const, value: [...rootCategoryModels] },
              { type: "idset" as const, value: [...rootCategoryIds] },
            ],
          })
        : EMPTY,
      elementIds.size > 0
        ? of({
            whereClause: `Parent.Id IN (SELECT elementIdSet.id FROM IdSet(?) elementIdSet)`,
            type: "element" as const,
            bindings: [{ type: "idset" as const, value: [...elementIds] }],
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
              ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
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
    const rootCategoryIds = new Set<CategoryId>();
    const rootCategoryModels = new Set<ModelId>();
    for (const { modelId, categoryId, parentElementId } of batch) {
      if (parentElementId === undefined && categoryId !== undefined) {
        rootCategoryIds.add(categoryId);
        rootCategoryModels.add(modelId);
        continue;
      }
      const modelEntry = getOrCreate({ map: this.#cachedValues, key: modelId, createFunc: () => new Map() });
      const parentEntry = getOrCreate({ map: modelEntry, key: parentElementId, createFunc: () => new Map() });
      if (!parentEntry.has(categoryId)) {
        parentEntry.set(categoryId, categoryId === undefined ? [] : [{ categoryId, count: 0 }]);
      }
    }
    // Make sure that default entry exists for all model - root category pairs.
    for (const modelId of rootCategoryModels) {
      const modelEntry = getOrCreate({ map: this.#cachedValues, key: modelId, createFunc: () => new Map() });
      const parentEntry = getOrCreate({ map: modelEntry, key: undefined, createFunc: () => new Map() });
      for (const categoryId of rootCategoryIds) {
        if (!parentEntry.has(categoryId)) {
          parentEntry.set(categoryId, categoryId === undefined ? [] : [{ categoryId, count: 0 }]);
        }
      }
    }
  }

  public getDescendantsCounts(props: DescendantsCountRequest): Observable<DescendantsCountResult> {
    return this.get(props);
  }
}
