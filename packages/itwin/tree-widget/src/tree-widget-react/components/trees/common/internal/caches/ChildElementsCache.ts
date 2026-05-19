/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, from, map, mergeMap, of } from "rxjs";
import { assert, Guid } from "@itwin/core-bentley";
import { BatchingCache } from "./BatchingCache.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Array, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ElementId, ModelId } from "../Types.js";

interface ChildElementsBaseRequest {
  modelId: ModelId;
  childCategoryIds: CategoryId[];
}

interface ChildElementsCategoryRequest extends ChildElementsBaseRequest {
  categoryId: CategoryId;
  parentElementId?: ElementId; // undefined = root level
}

interface ChildElementsElementRequest extends ChildElementsBaseRequest {
  parentElementId: ElementId;
  categoryId?: undefined;
}

type ChildElementsRequest = ChildElementsCategoryRequest | ChildElementsElementRequest;

interface ChildElementsCacheProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  elementClassName: string;
  componentId: GuidString;
}

interface WhereClause {
  whereClause: string;
  type: "element" | "category";
  childCategoryIds: Set<CategoryId>;
}

interface Row {
  modelId: ModelId;
  reqParent: ElementId | undefined;
  reqCategory: CategoryId | undefined;
  ownCategory: CategoryId;
  id: ElementId;
}

/**
 * Cache for retrieving descendant element IDs grouped by category.
 *
 * Cache makes requests in batches of 20ms.
 * Uses incremental caching per childCategoryId: only queries child categories not yet cached/batched.
 * @internal
 */
export class ChildElementsCache extends BatchingCache<ChildElementsRequest, Id64Array, WhereClause, Row> {
  #cachedValues = new Map<ModelId, Map<ElementId | undefined, Map<CategoryId | undefined, Map<CategoryId, Id64Array>>>>();
  #queryExecutor: LimitingECSqlQueryExecutor;
  #elementClassName: string;
  #componentId: GuidString;
  #componentName: string;

  public constructor(props: ChildElementsCacheProps) {
    super();
    this.#queryExecutor = props.queryExecutor;
    this.#elementClassName = props.elementClassName;
    this.#componentId = props.componentId;
    this.#componentName = "ChildElementsCache";
  }

  protected getCachedValue(request: ChildElementsRequest): Id64Array | undefined {
    const { modelId, parentElementId, categoryId, childCategoryIds } = request;
    const cachedEntry = this.#cachedValues.get(modelId)?.get(parentElementId)?.get(categoryId);
    if (!cachedEntry) {
      return undefined;
    }
    const result = new Array<Id64String>();
    for (const childCategoryId of childCategoryIds) {
      const ids = cachedEntry.get(childCategoryId);
      if (!ids) {
        return undefined;
      }
      result.push(...ids);
    }
    return result;
  }

  protected getValuesNotInBatch(
    request: ChildElementsRequest,
    batch: ChildElementsRequest[],
  ): { valuesNotInBatch: ChildElementsRequest; batchContainsValues: boolean } | { valuesNotInBatch: undefined; batchContainsValues: true } {
    const { modelId, parentElementId, categoryId, childCategoryIds } = request;
    let missingIds: CategoryId[] = childCategoryIds;
    const batchedChildCategoryIds = batch.filter((r) => r.modelId === modelId && r.parentElementId === parentElementId && r.categoryId === categoryId);
    if (batchedChildCategoryIds.length === 0) {
      return { valuesNotInBatch: { ...request, childCategoryIds: missingIds }, batchContainsValues: false };
    }
    const lengthBefore = missingIds.length;
    missingIds = missingIds.filter((id) => !batchedChildCategoryIds.some((r) => r.childCategoryIds.includes(id)));
    if (missingIds.length === 0) {
      // All childCategoryIds are either cached or in-flight, so no need to request any more - just wait for the batch to complete and get from cache then
      return { valuesNotInBatch: undefined, batchContainsValues: true };
    }

    return { valuesNotInBatch: { ...request, childCategoryIds: missingIds }, batchContainsValues: lengthBefore !== missingIds.length };
  }

  protected getQueryData(batch: ChildElementsRequest[]): Observable<WhereClause> {
    const groupedValues = new Map<ModelId, Map<ElementId | undefined, Map<CategoryId | undefined, Set<CategoryId>>>>();
    for (const { modelId, parentElementId, categoryId, childCategoryIds } of batch) {
      let modelEntry = groupedValues.get(modelId);
      if (!modelEntry) {
        modelEntry = new Map();
        groupedValues.set(modelId, modelEntry);
      }
      let parentEntry = modelEntry.get(parentElementId);
      if (!parentEntry) {
        parentEntry = new Map();
        modelEntry.set(parentElementId, parentEntry);
      }
      let categoryEntry = parentEntry.get(categoryId);
      if (!categoryEntry) {
        categoryEntry = new Set();
        parentEntry.set(categoryId, categoryEntry);
      }
      for (const childCategoryId of childCategoryIds) {
        categoryEntry.add(childCategoryId);
      }
    }

    return from(groupedValues.entries()).pipe(
      mergeMap(([modelId, parentMap]) =>
        from(parentMap.entries()).pipe(
          mergeMap(([parentElementId, categoryMap]) => {
            const clauses: WhereClause[] = [];
            const undefinedEntry = categoryMap.get(undefined);
            if (undefinedEntry) {
              assert(parentElementId !== undefined);
              clauses.push({ whereClause: `Model.Id = ${modelId} AND Parent.Id = ${parentElementId}`, type: "element", childCategoryIds: undefinedEntry });
            }
            const allChildCategoryIds = new Set<CategoryId>();
            const categoryMapKeys = new Array<Id64String>();
            for (const [categoryId, categoryChildCategoryIds] of categoryMap) {
              if (categoryId !== undefined) {
                categoryMapKeys.push(categoryId);
                for (const childCategoryId of categoryChildCategoryIds) {
                  allChildCategoryIds.add(childCategoryId);
                }
              }
            }
            if (categoryMapKeys.length > 0) {
              clauses.push({
                whereClause: `Model.Id = ${modelId} AND Category.Id IN (${categoryMapKeys.join(", ")}) ${parentElementId === undefined ? "AND Parent.Id IS NULL" : `AND Parent.Id = ${parentElementId}`}`,
                type: "category",
                childCategoryIds: allChildCategoryIds,
              });
            }
            return from(clauses);
          }),
        ),
      ),
    );
  }

  protected executeQuery(clauses: WhereClause[]): Observable<Row> {
    const categoryWhereClauses = clauses.filter((c) => c.type === "category").map((c) => c.whereClause);
    const elementWhereClauses = clauses.filter((c) => c.type === "element").map((c) => c.whereClause);
    const allChildCategoryIds = new Set<CategoryId>();
    for (const { childCategoryIds } of clauses) {
      for (const childCategoryId of childCategoryIds) {
        allChildCategoryIds.add(childCategoryId);
      }
    }

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
            // Note: allChildCategoryIds is joined from multiple requests in the batch, so there can be cases where counts for non-requested childCategoryIds are returned. E.g:
            // Request1: { modelId, categoryId, parentElementId: undefined, childCategoryIds: [childCategoryId1] }
            // Request2: { modelId, parentElementId: element1, childCategoryIds: [childCategoryId2] }
            // Hierarchy: modelId -> undefined (root) -> categoryId -> element1 -> childCategoryId1 -> element1_1
            //                                                                  -> childCategoryId2 -> element1_2
            // In this case, the query will include allChildCategoryIds = [childCategoryId1, childCategoryId2], and return such rows:
            // 1. { modelId, reqParent: undefined, reqCategory: categoryId, ownCategory: childCategoryId1, id: element1_1 } -> Request1
            // 2. { modelId, reqParent: undefined, reqCategory: categoryId, ownCategory: childCategoryId2, id: element1_2 } -> not requested
            // 3. { modelId, reqParent: element1, reqCategory: undefined, ownCategory: childCategoryId1, id: element1_1 } -> not requested
            // 4. { modelId, reqParent: element1, reqCategory: undefined, ownCategory: childCategoryId2, id: element1_2 } -> Request2
            // The saved counts will be correct, and returned results from the public functions will also be correct, but there will be additional data cached.
            ecsql: `
              SELECT d.modelId modelId, d.reqParent reqParent, d.reqCategory reqCategory, d.ownCategory ownCategory, d.id id
              FROM Descendants d
              JOIN IdSet(?) allChildCategoryIdSet ON d.ownCategory = allChildCategoryIdSet.id
              ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
            `,
            bindings: [{ type: "idset", value: [...allChildCategoryIds] }],
          },
          {
            rowFormat: "ECSqlPropertyNames",
            limit: "unbounded",
            restartToken: `${this.#componentName}/${this.#componentId}/child-elements/${Guid.createValue()}`,
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
      categoryEntry = new Map();
      parentEntry.set(reqCategory, categoryEntry);
    }

    let ids = categoryEntry.get(row.ownCategory);
    if (!ids) {
      ids = [];
      categoryEntry.set(row.ownCategory, ids);
    }
    ids.push(row.id);
  }

  protected ensureDefaultCacheEntries(batch: ChildElementsRequest[]): void {
    for (const { modelId, categoryId, parentElementId, childCategoryIds } of batch) {
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
      let categoryEntry = parentEntry.get(categoryId);
      if (!categoryEntry) {
        categoryEntry = new Map();
        parentEntry.set(categoryId, categoryEntry);
      }
      for (const childCategoryId of childCategoryIds) {
        if (!categoryEntry.has(childCategoryId)) {
          categoryEntry.set(childCategoryId, []);
        }
      }
    }
  }

  private getNotCachedRequestValues(request: ChildElementsRequest): { cached?: ChildElementsRequest; notCached?: ChildElementsRequest } {
    const { modelId, parentElementId, categoryId, childCategoryIds } = request;
    const cachedEntry = this.#cachedValues.get(modelId)?.get(parentElementId)?.get(categoryId);
    if (!cachedEntry) {
      return request.childCategoryIds.length > 0 ? { notCached: request } : {};
    }
    const missingCategories = new Array<CategoryId>();
    const cachedCategories = new Array<CategoryId>();
    for (const childCategoryId of childCategoryIds) {
      if (cachedEntry.has(childCategoryId)) {
        cachedCategories.push(childCategoryId);
      } else {
        missingCategories.push(childCategoryId);
      }
    }
    return {
      ...(cachedCategories.length > 0 ? { cached: { ...request, childCategoryIds: cachedCategories } } : {}),
      ...(missingCategories.length > 0 ? { notCached: { ...request, childCategoryIds: missingCategories } } : {}),
    };
  }

  public getChildElements(props: ChildElementsRequest): Observable<Id64Array> {
    const { cached, notCached } = this.getNotCachedRequestValues(props);
    const cachedResult = cached ? this.getCachedValue(cached) : undefined;
    if (!notCached) {
      return of(cachedResult ?? []);
    }
    return this.get(notCached).pipe(
      map((notCachedValuesResult) => {
        return [...(cachedResult ?? []), ...notCachedValuesResult];
      }),
    );
  }
}
