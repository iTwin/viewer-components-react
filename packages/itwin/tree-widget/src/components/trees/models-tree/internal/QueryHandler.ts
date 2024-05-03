/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Observable } from "rxjs";
import { count, defer, EMPTY, expand, filter, first, from, isObservable, last, map, mergeMap, of, reduce, shareReplay, tap } from "rxjs";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { KeySet } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { reduceWhile } from "../../common/Rxjs";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { QueryRowProxy } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { GroupingNodeKey, Ruleset } from "@itwin/presentation-common";
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
  queryElementChildren(elementId: Id64String): Observable<Id64String>;
  queryGroupingNodeChildren(node: GroupingNodeKey): Observable<GroupedElementIds>;
  invalidateCache(): void;
}

/**
 * @internal
 */
export function createQueryHandler(iModel: IModelConnection, rulesetOrId: Ruleset | string): IQueryHandler {
  return new QueryHandlerImplementation(iModel, rulesetOrId);
}

const EMPTY_ID_SET = new Set<Id64String>();

class QueryHandlerImplementation implements IQueryHandler {
  private readonly _modelCategoriesCache = new Map<string, Id64Set | Observable<Id64String>>();
  private readonly _categoryElementsCache = new Map<string, Id64Set | Observable<Id64String>>();
  private readonly _elementHierarchyCache = new Map<string, Id64Set>();
  private readonly _groupedElementIdsCache = new Map<string, Observable<GroupedElementIds>>();
  private _subjectsInfo?: Observable<SubjectsInfo>;

  constructor(
    private readonly _iModel: IModelConnection,
    private readonly _rulesetOrId: Ruleset | string,
  ) {}

  public invalidateCache(): void {
    this._modelCategoriesCache.clear();
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
    return this.getObservableOrInsertToCache({
      cache: this._modelCategoriesCache,
      cacheKey: id,
      factory: () => this.runModelCategoriesQuery(id),
    });
  }

  private runModelCategoriesQuery(id: Id64String): Observable<Id64String> {
    const bindings = new Array<Id64String>();
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
    return this.queryModelCategories(id).pipe(
      mergeMap((categoryId) => {
        const categoryElements = this._categoryElementsCache.get(`${categoryId}${id}`);
        if (categoryElements) {
          return isObservable(categoryElements) ? categoryElements.pipe(count()) : of(categoryElements.size);
        }
        return of(undefined);
      }),
      reduceWhile(
        ({ allDefined }) => allDefined,
        (acc, x) => {
          if (x === undefined) {
            acc.allDefined = false;
            return acc;
          }
          acc.result += x;
          return acc;
        },
        { allDefined: true, result: 0 },
      ),
      mergeMap((acc) => {
        // istanbul ignore if
        if (!acc) {
          return of(0);
        }
        return acc.allDefined ? of(acc.result) : this.runModelElementCountQuery(id);
      }),
    );
  }

  private runModelElementCountQuery(modelId: string): Observable<number> {
    const bindings = new Array<string>();
    const query = `SELECT COUNT(*) FROM bis.GeometricElement3d WHERE ${bind("Model.Id", modelId, bindings)}`;
    return this.runQuery(query, bindings, (row) => row[0]);
  }

  public queryModelElements(modelId: Id64String, elementIds?: Id64Set): Observable<Id64String> {
    return this.queryModelCategories(modelId).pipe(
      mergeMap((categoryId) => {
        return this.queryCategoryElements(categoryId, modelId);
      }),
      filter((id) => !elementIds || elementIds.has(id)),
    );
  }

  public queryCategoryElements(categoryId: Id64String, modelId: Id64String | undefined): Observable<Id64String> {
    const cacheKey = `${categoryId}${modelId ?? ""}`;
    return this.getObservableOrInsertToCache({
      cache: this._categoryElementsCache,
      cacheKey,
      factory: () => this.runCategoryChildrenRecursiveQuery({ categoryId, modelId }).pipe(this.populateElementHierarchyCacheOperator()),
    });
  }

  private runCategoryChildrenRecursiveQuery(props: { categoryId: string; modelId?: string }): Observable<{ id: string; parentId?: string | undefined }> {
    const { categoryId, modelId } = props;
    const bindings = new Map<string, Id64String>();
    const query = /* sql */ `
      WITH RECURSIVE
        ParentCategoryElements(id) AS (
          SELECT ECInstanceId id
          FROM bis.GeometricElement3d
          WHERE
            ${bindNamed("Category.Id", categoryId, bindings, "categoryId")}
            ${modelId ? `AND ${bindNamed("Model.Id", modelId, bindings, "modelId")}` : ""}
        ),
        ChildCategoryElements(id, parentId) AS (
          SELECT id, NULL AS parentId
          FROM ParentCategoryElements

          UNION ALL

          SELECT e.ECInstanceId AS id, e.Parent.Id AS parentId
          FROM bis.GeometricElement3d e
          JOIN ChildCategoryElements ce ON e.Parent.Id = ce.id
        )
      SELECT * FROM ChildCategoryElements
    `;
    return this.runQuery(query, bindings, (row) => ({ id: row.id, parentId: row.parentId }));
  }

  public queryElementChildren(elementId: string): Observable<Id64String> {
    const cachedChildren = this._elementHierarchyCache.get(elementId);
    if (cachedChildren) {
      return from(cachedChildren).pipe(
        expand((id) => {
          const res = this._elementHierarchyCache.get(id);
          return res ? from(res) : EMPTY;
        }),
      );
    }
    return this.runElementChildrenRecursiveQuery(elementId).pipe(this.populateElementHierarchyCacheOperator(elementId));
  }

  private populateElementHierarchyCacheOperator(rootElementId?: Id64String) {
    return (elementObs: Observable<{ id: Id64String; parentId?: Id64String }>) => {
      const hierarchySubset = new Map<Id64String, Id64Set>();
      const elementSet = new Set<Id64String>();
      return elementObs.pipe(
        tap({
          next({ id, parentId }) {
            if (parentId) {
              pushToMap(hierarchySubset, parentId, id);
            }
            elementSet.add(id);
          },
          complete: () => {
            for (const id of elementSet) {
              if (!hierarchySubset.has(id)) {
                hierarchySubset.set(id, EMPTY_ID_SET);
              }
            }

            if (hierarchySubset.size) {
              mergeMaps(this._elementHierarchyCache, hierarchySubset);
            } else {
              rootElementId && this._elementHierarchyCache.set(rootElementId, EMPTY_ID_SET);
            }
          },
        }),
        map(({ id }) => id),
      );
    };
  }

  private runElementChildrenRecursiveQuery(elementId: string): Observable<{ id: string; parentId?: string | undefined }> {
    const bindings = new Map<string, Id64String>();
    const query = /* sql */ `
      WITH RECURSIVE ChildElements(id, parentId) AS (
        SELECT e.ECInstanceId AS id, e.Parent.Id AS parentId
        FROM bis.GeometricElement3d e
        WHERE ${bindNamed("e.Parent.Id", elementId, bindings, "parentId")}

        UNION ALL

        SELECT e.ECInstanceId AS id, e.Parent.Id as parentId
        FROM bis.GeometricElement3d e
        INNER JOIN ChildElements ce ON e.Parent.Id = ce.id
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

    const rulesetId = this._rulesetOrId;
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
    bindings: Array<Id64String> | Map<string, Id64String> | undefined,
    resultMapper: (row: QueryRowProxy) => TResult,
  ): Observable<TResult> {
    return defer(() => {
      const reader = this._iModel.createQueryReader(query, bindings && createBinder(bindings), {
        rowFormat: QueryRowFormat.UseJsPropertyNames,
      });
      return from(reader).pipe(map(resultMapper));
    });
  }

  private getObservableOrInsertToCache(props: {
    cache: Map<string, Id64Set | Observable<Id64String>>;
    cacheKey: string;
    factory: () => Observable<Id64String>;
  }): Observable<Id64String> {
    const res = this.getOrInsertToCache(props);
    return isObservable(res) ? res : from(res);
  }

  private getOrInsertToCache(props: {
    cache: Map<string, Id64Set | Observable<Id64String>>;
    cacheKey: string;
    factory: () => Observable<Id64String>;
  }): Id64Set | Observable<Id64String> {
    const { cache, cacheKey, factory } = props;
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const idSet = new Set<Id64String>();
    const obs = factory().pipe(
      tap({
        next: (id) => idSet.add(id),
        complete: () => cache.set(cacheKey, idSet),
      }),
      shareReplay(),
    );
    cache.set(cacheKey, obs);
    return obs;
  }
}

function bind(key: string, value: Id64String, bindings: Array<Id64String>) {
  bindings.push(value);
  return `${key} = ?`;
}

function bindNamed(key: string, value: Id64String, bindings: Map<string, Id64String>, bindingName: string) {
  bindings.set(bindingName, value);
  return `${key} = :${bindingName}`;
}

// istanbul ignore next
function createBinder(bindings: Array<Id64String> | Map<string, Id64String>): QueryBinder | undefined {
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

function mergeMaps<TKey, TValue>(dest: Map<TKey, Set<TValue>>, src: Map<TKey, Set<TValue>>) {
  for (const [key, srcSet] of src) {
    const destSet = dest.get(key);
    // istanbul ignore if
    if (destSet) {
      srcSet.forEach((x) => destSet.add(x));
    } else {
      dest.set(key, srcSet);
    }
  }
}
