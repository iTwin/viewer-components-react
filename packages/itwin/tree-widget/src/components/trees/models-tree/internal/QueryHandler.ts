/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Observable } from "rxjs";
import { defer, EMPTY, expand, filter, first, from, isObservable, last, map, mergeMap, of, reduce, shareReplay, tap } from "rxjs";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { KeySet } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { QueryRowProxy } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { GroupingNodeKey } from "@itwin/presentation-common";

interface GroupedElementIds {
  modelId: string;
  categoryId: string;
  elementIds: Observable<string>;
}

interface SubjectsInfo {
  subjectsHierarchy: Map<string, Id64Set>;
  subjectModels: Map<string, Id64Set>;
}

/**
 * @internal
 */
export interface IQueryHandler {
  querySubjectModels(subjectId: Id64String): Observable<Id64String>;
  queryModelCategories(id: Id64String): Observable<Id64String>;
  queryModelElementsCount(modelId: Id64String): Observable<number>;
  queryModelElements(modelId: Id64String, elementIds?: Id64Set): Observable<Id64String>;
  queryCategoryElements(categoryId: Id64String, modelId: Id64String | undefined): Observable<Id64String>;
  queryElementChildren(props: { elementId: Id64String; categoryId: Id64String; modelId: Id64String }): Observable<Id64String>;
  queryGroupingNodeChildren(node: GroupingNodeKey): Observable<GroupedElementIds>;
  invalidateCache(): void;
}

/**
 * @internal
 */
export function createQueryHandler(iModel: IModelConnection, rulesetId: string): IQueryHandler {
  return new QueryHandlerImplementation(iModel, rulesetId);
}

class QueryHandlerImplementation implements IQueryHandler {
  private readonly _modelCategoriesCache = new Map<string, Observable<Id64String>>();
  private readonly _modelElementsCache = new Map<string, Id64Set | Observable<Id64String>>();
  private readonly _categoryElementsCache = new Map<string, Observable<Id64String>>();
  private readonly _elementHierarchyCache = new Map<string, Id64Set>();
  private readonly _groupedElementIdsCache = new Map<string, Observable<GroupedElementIds>>();
  private _subjectsInfo?: Observable<SubjectsInfo>;

  constructor(
    private readonly _iModel: IModelConnection,
    private readonly _rulesetId: string,
  ) {}

  public invalidateCache(): void {
    this._modelCategoriesCache.clear();
    this._modelElementsCache.clear();
    this._categoryElementsCache.clear();
    this._elementHierarchyCache.clear();
    this._groupedElementIdsCache.clear();
    this._subjectsInfo = undefined;
  }

  public querySubjectModels(subjectId: string): Observable<string> {
    return (this._subjectsInfo ??= this.getSubjectsInfoObs()).pipe(
      map((state) => ({ ...state, modelIds: new Array<string>(), subjectId })),
      expand((state) => {
        const subjectModelIds = state.subjectModels.get(state.subjectId);
        subjectModelIds && state.modelIds.push(...subjectModelIds);

        const childSubjectIds = state.subjectsHierarchy.get(state.subjectId);
        return childSubjectIds ? from(childSubjectIds).pipe(map((cs) => ({ ...state, subjectId: cs }))) : EMPTY;
      }),
      last(),
      mergeMap(({ modelIds }) => modelIds),
    );
  }

  private getSubjectsInfoObs(): Observable<SubjectsInfo> {
    return this.runSubjectsQuery().pipe(
      reduce(
        (acc, subject) => {
          if (subject.parentId) {
            pushToMap(acc.subjectsHierarchy, subject.parentId, subject.id);
          }

          if (subject.targetPartitionId) {
            pushToMap(acc.targetPartitionSubjects, subject.targetPartitionId, subject.id);
          }
          return acc;
        },
        { subjectsHierarchy: new Map<Id64String, Set<Id64String>>(), targetPartitionSubjects: new Map<Id64String, Set<Id64String>>() },
      ),
      mergeMap((state) =>
        this.runModelsQuery().pipe(
          reduce(
            (acc, model) => {
              const subjectIds = acc.targetPartitionSubjects.get(model.id) ?? new Set();
              subjectIds.add(model.parentId);
              subjectIds.forEach((subjectId) => {
                pushToMap(acc.subjectModels, subjectId, model.id);
              });
              return acc;
            },
            { ...state, subjectModels: new Map<Id64String, Set<Id64String>>() },
          ),
        ),
      ),
      map(({ subjectModels, subjectsHierarchy }) => ({ subjectModels, subjectsHierarchy })),
      shareReplay(),
    );
  }

  private runSubjectsQuery(): Observable<{ id: Id64String; parentId?: Id64String; targetPartitionId?: Id64String }> {
    const query = /* sql */ `
      SELECT ECInstanceId id, Parent.Id parentId, json_extract(JsonProperties, '$.Subject.Model.TargetPartition') targetPartitionId
      FROM bis.Subject
    `;
    return this.runQuery(query, undefined, (row) => ({ id: row.id, parentId: row.parentId, targetPartitionId: row.targetPartitionId }));
  }

  private runModelsQuery(): Observable<{ id: Id64String; parentId: Id64String }> {
    const query = /* sql */ `
      SELECT p.ECInstanceId id, p.Parent.Id parentId
      FROM bis.InformationPartitionElement p
      INNER JOIN bis.GeometricModel3d m ON m.ModeledElement.Id = p.ECInstanceId
      WHERE NOT m.IsPrivate
    `;
    return this.runQuery(query, undefined, (row) => ({ id: row.id, parentId: row.parentId }));
  }

  public queryModelCategories(id: Id64String): Observable<Id64String> {
    let obs = this._modelCategoriesCache.get(id);
    if (!obs) {
      obs = this.runModelCategoriesQuery(id).pipe(shareReplay());
      this._modelCategoriesCache.set(id, obs);
    }
    return obs;
  }

  private runModelCategoriesQuery(id: Id64String): Observable<Id64String> {
    const bindings = new Array<QueryBindable>();
    const query = /* sql */ `
      SELECT ECInstanceId id
      FROM bis.SpatialCategory c
      WHERE EXISTS (
        SELECT 1
        FROM bis.GeometricElement3d e
        WHERE
          ${bind("e.model.id", id, bindings)}
          AND e.Category.Id = c.ECInstanceId
          AND e.Parent IS NULL
      )
    `;
    return this.runQuery(query, [id], (row) => row.id);
  }

  public queryModelElementsCount(id: Id64String): Observable<number> {
    const modelsElements = this._modelElementsCache.get(id);
    if (modelsElements && !isObservable(modelsElements)) {
      return of(modelsElements.size);
    }

    const bindings = new Array<QueryBindable>();
    const query = /* sql */ `
      SELECT COUNT(*)
      FROM bis.GeometricElement3d e
      WHERE ${bind("e.Model.Id", id, bindings)}
    `;
    return this.runQuery(query, bindings, (row) => row[0]);
  }

  public queryModelElements(modelId: Id64String, elementIds?: Id64Set): Observable<Id64String> {
    const cachedResult = this._modelElementsCache.get(modelId);

    if (cachedResult) {
      if (!isObservable(cachedResult)) {
        if (!elementIds) {
          return from(cachedResult);
        }

        return from(elementIds).pipe(filter((x) => cachedResult.has(x)));
      }

      return elementIds ? cachedResult.pipe(filter((x) => elementIds.has(x))) : cachedResult;
    }

    if (elementIds) {
      // Cache or no cache ???
      return this.queryModelElementsImpl(modelId, elementIds);
    }

    const idSet = new Set<Id64String>();
    const obs = this.queryModelElementsImpl(modelId).pipe(
      tap({
        next: (id) => idSet.add(id),
        complete: () => this._modelElementsCache.set(modelId, idSet),
      }),
      shareReplay(),
    );
    this._modelElementsCache.set(modelId, obs);
    return obs;
  }

  private queryModelElementsImpl(modelId: Id64String, elementsFilter?: Id64Set): Observable<Id64String> {
    const bindings = new Array<QueryBindable>();
    const query = /* sql */ `
      SELECT ECInstanceId id
      FROM bis.GeometricElement3d e
      WHERE ${bind("e.Model.Id", modelId, bindings)}
      ${elementsFilter ? `AND ${bind("e.ECInstanceId", elementsFilter, bindings)}` : ""}
    `;
    return this.runQuery(query, bindings, (row) => row.id);
  }

  public queryCategoryElements(categoryId: Id64String, modelId: Id64String | undefined): Observable<Id64String> {
    const cacheKey = `${categoryId}${modelId ?? ""}`;
    let obs = this._categoryElementsCache.get(cacheKey);
    if (obs) {
      return obs;
    }

    obs = this.runCategoryElementsRecursiveQuery(categoryId, modelId).pipe(this.populateElementHierarchyCacheOperator(), shareReplay());
    this._categoryElementsCache.set(cacheKey, obs);
    return obs;
  }

  private populateElementHierarchyCacheOperator() {
    return (elementObs: Observable<{ id: Id64String; parentId?: Id64String }>) => {
      // Make sure that the entire element hierarchy is loaded and then cache it.
      // If cache is populated asynchronously then element children query might produce invalid results.
      const hierarchySubset = new Map<Id64String, Id64Set>();
      return elementObs.pipe(
        tap({
          next({ id, parentId }) {
            if (parentId) {
              pushToMap(hierarchySubset, parentId, id);
            }
          },
          complete: () => mergeMaps(this._elementHierarchyCache, hierarchySubset),
        }),
        map(({ id }) => id),
      );
    };
  }

  private runCategoryElementsRecursiveQuery(categoryId: Id64String, modelId: Id64String | undefined): Observable<{ id: Id64String; parentId?: Id64String }> {
    const bindings = new Map<string, Id64String>();
    const commonWhereClause = `
      ${bindNamed("e.Category.Id", categoryId, bindings, "categoryId")}
      ${modelId ? `AND ${bindNamed("e.Model.Id", modelId, bindings, "modelId")}` : ""}
    `;
    const query = /* sql */ `
      WITH RECURSIVE ChildElements(id, parentId) AS (
        SELECT e.ECInstanceId AS id, NULL as parentId
        FROM bis.GeometricElement3d e
        WHERE
          ${commonWhereClause}
          AND e.Parent IS NULL

        UNION ALL

        SELECT e.ECInstanceId AS id, e.Parent.Id as parentId
        FROM bis.GeometricElement3d e
        JOIN ChildElements ce
          ON e.Parent.Id = ce.id
        WHERE
          ${commonWhereClause}
          AND e.Parent.RelECClassId IS (bis.ElementOwnsChildElements)
      )
      SELECT * FROM ChildElements
    `;
    return this.runQuery(query, bindings, (row) => ({ id: row.id, parentId: row.parentId }));
  }

  public queryElementChildren({
    elementId,
    categoryId,
    modelId,
  }: {
    elementId: Id64String;
    categoryId: Id64String;
    modelId: Id64String;
  }): Observable<Id64String> {
    const cachedChildren = this._elementHierarchyCache.get(elementId);
    if (cachedChildren) {
      return from(cachedChildren).pipe(
        expand((id) => {
          const res = this._elementHierarchyCache.get(id);
          return res ? from(res) : EMPTY;
        }),
      );
    }

    // This scenario is unlikely because element categories recursive children have to be already queried
    // Nevertheless, we can try to populate the cache from this query.
    return this.runElementChildrenRecursiveQuery(elementId, categoryId, modelId).pipe(this.populateElementHierarchyCacheOperator());
  }

  private runElementChildrenRecursiveQuery(elementId: string, categoryId: string, modelId: string): Observable<{ id: string; parentId?: string | undefined }> {
    const bindings = new Map<string, Id64String>();
    const commonWhereClause = `
      ${bindNamed("e.Category.Id", categoryId, bindings, "categoryId")}
      AND ${bindNamed("e.Model.Id", modelId, bindings, "modelId")}
    `;
    const query = /* sql */ `
      WITH RECURSIVE ChildElements(id, parentId) AS (
        SELECT e.ECInstanceId AS id, NULL as parentId
        FROM bis.GeometricElement3d e
        WHERE
          ${commonWhereClause}
          AND ${bindNamed("e.Parent.Id", elementId, bindings, "rootParentId")}
          AND e.Parent.RelECClassId IS (bis.ElementOwnsChildElements)

        UNION ALL

        SELECT e.ECInstanceId AS id, e.Parent.Id as parentId
        FROM bis.GeometricElement3d e
        JOIN ChildElements ce
          ON e.Parent.Id = ce.id
        WHERE
          ${commonWhereClause}
          AND e.Parent.RelECClassId IS (bis.ElementOwnsChildElements)
      )
      SELECT * FROM ChildElements
    `;
    return this.runQuery(query, bindings, (row) => ({ id: row.id, parentId: row.parentId }));
  }

  public queryGroupingNodeChildren(node: GroupingNodeKey): Observable<GroupedElementIds> {
    const cacheKey = JSON.stringify(node);
    let obs = this._groupedElementIdsCache.get(cacheKey);
    if (obs) {
      return obs;
    }

    const rulesetId = this._rulesetId;
    const elementIds = from(
      Presentation.presentation.getContentInstanceKeys({
        imodel: this._iModel,
        rulesetOrId: rulesetId,
        displayType: "AssemblyElementsRequest",
        keys: new KeySet([node]),
      }),
    ).pipe(
      mergeMap((x) => x.items()),
      map((x) => x.id),
      shareReplay(),
    );

    obs = elementIds.pipe(
      first(),
      mergeMap((id) => {
        const bindings = new Array<string>();
        const query = `
          SELECT Model.Id AS modelId, Category.Id AS categoryId
          FROM bis.GeometricElement3d
          WHERE ${bind("ECInstanceId", id, bindings)}
          LIMIT 1
        `;
        return from(this.runQuery(query, bindings, (row) => ({ modelId: row.modelId, categoryId: row.categoryId, elementIds })));
      }),
      shareReplay(),
    );
    this._groupedElementIdsCache.set(cacheKey, obs);
    return obs;
  }

  private runQuery<TResult>(
    query: string,
    bindings: Array<QueryBindable> | Map<string, Id64String> | undefined,
    resultMapper: (row: QueryRowProxy) => TResult,
  ): Observable<TResult> {
    return defer(() => {
      const reader = this._iModel.createQueryReader(query, bindings && createBinder(bindings), {
        rowFormat: QueryRowFormat.UseJsPropertyNames,
      });
      return from(reader).pipe(map(resultMapper));
    });
  }
}

type QueryBindable = Id64String | Id64Set;
const MAX_ALLOWED_BINDINGS = 1000;

function bind(key: string, value: QueryBindable, bindings: Array<QueryBindable>) {
  if (typeof value === "string") {
    bindings.push(value);
    return `${key} = ?`;
  }

  const length = Array.isArray(value) ? value.length : value.size;
  if (length < MAX_ALLOWED_BINDINGS) {
    bindings.push(...value);
    return `${key} IN (${[...value].map(() => "?").join(",")})`;
  }

  bindings.push(value);
  return `InVirtualSet(?, ${key})`;
}

function bindNamed(key: string, value: Id64String, bindings: Map<string, QueryBindable>, bindingName: string) {
  bindings.set(bindingName, value);
  return `${key} = :${bindingName}`;
}

function createBinder(bindings: Array<QueryBindable> | Map<string, Id64String>): QueryBinder | undefined {
  const binder = new QueryBinder();
  bindings.forEach((x, idx) => {
    // Binder expect index to start from 1
    typeof idx === "number" && idx++;
    if (typeof x === "string") {
      binder.bindId(idx, x);
      return;
    }

    binder.bindIdSet(idx, Array.isArray(x) ? new Set(x) : x);
  });
  return binder;
}

function pushToMap<TKey, TValue>(_map: Map<TKey, Set<TValue>>, key: TKey, value: TValue) {
  let set = _map.get(key);
  if (!set) {
    set = new Set();
    _map.set(key, set);
  }
  set.add(value);
}

// istanbul ignore next
function mergeMaps<TKey, TValue>(dest: Map<TKey, Set<TValue>>, src: Map<TKey, Set<TValue>>) {
  for (const [key, srcSet] of src) {
    const destSet = dest.get(key);
    if (destSet) {
      srcSet.forEach((x) => destSet.add(x));
    } else {
      dest.set(key, srcSet);
    }
  }
}
