/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, expand, first, forkJoin, from, last, map, mergeMap, shareReplay, tap, toArray } from "rxjs";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { KeySet } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";

import type { Observable } from "rxjs";
import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { QueryRowProxy } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { GroupingNodeKey } from "@itwin/presentation-common";

interface GroupedElementIds {
  modelId: string;
  categoryId: string;
  elementIds: Observable<Id64String>;
}

interface InitialInfo {
  subjectsHierarchy: Map<Id64String, Id64Set>;
  subjectModels: Map<Id64String, Id64Set>;
  modelCategories: Map<Id64String, Id64Set>;
}

/**
 * @internal
 */
export interface ElementsQueryProps {
  modelId?: Id64String;
  categoryId?: Id64String;
  rootElementId?: Id64String;
  elementIds?: Id64Set;
}

/**
 * @internal
 */
export interface IQueryHandler {
  querySubjectModels(subjectId: Id64String): Observable<Id64String>;
  queryModelCategories(modelId: Id64String): Observable<Id64String>;
  queryElementChildren(elementId: Id64String): Observable<Id64String>;
  queryGroupingNodeChildren(node: GroupingNodeKey): Observable<GroupedElementIds>;
  queryElements(props: ElementsQueryProps): Observable<Id64String>;
  queryElementsCount(props: ElementsQueryProps): Observable<number>;
  invalidateCache(): void;
}

/**
 * @internal
 */
export function createQueryHandler(iModel: IModelConnection): IQueryHandler {
  return new QueryHandlerImplementation(iModel);
}

const EMPTY_ID_SET = new Set<Id64String>();

class QueryHandlerImplementation implements IQueryHandler {
  private readonly _elementHierarchyCache = new Map<string, Id64Set>();
  private readonly _groupedElementIdsCache = new Map<string, Observable<GroupedElementIds>>();
  private _initialInfoObs?: Observable<InitialInfo>;

  constructor(private readonly _iModel: IModelConnection) {}

  public invalidateCache(): void {
    this._elementHierarchyCache.clear();
    this._groupedElementIdsCache.clear();
    this._initialInfoObs = undefined;
  }

  public querySubjectModels(subjectId: string): Observable<string> {
    return this.initialInfoObs.pipe(
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

  private get initialInfoObs(): Observable<InitialInfo> {
    return (this._initialInfoObs ??= forkJoin({
      subjects: this.runSubjectsQuery().pipe(toArray()),
      models: this.runModelsQuery().pipe(toArray()),
      modelCategories: this.runModelCategoriesQuery().pipe(toArray()),
    }).pipe(
      map((info) => {
        const subjectsHierarchy = new Map<Id64String, Id64Set>();
        const targetPartitionSubjects = new Map<Id64String, Id64Set>();
        info.subjects.forEach((subject) => {
          if (subject.parentId) {
            pushToMap(subjectsHierarchy, subject.parentId, subject.id);
          }

          if (subject.targetPartitionId) {
            pushToMap(targetPartitionSubjects, subject.targetPartitionId, subject.id);
          }
        });

        const subjectModels = new Map<Id64String, Id64Set>();
        info.models.forEach((model) => {
          const subjectIds = targetPartitionSubjects.get(model.id) ?? new Set();
          subjectIds.add(model.parentId);
          subjectIds.forEach((subjectId) => {
            pushToMap(subjectModels, subjectId, model.id);
          });
        });

        const modelCategories = new Map<Id64String, Id64Set>();
        info.modelCategories.forEach(({ modelId, categoryId }) => {
          pushToMap(modelCategories, modelId, categoryId);
        });

        return { subjectsHierarchy, subjectModels, modelCategories };
      }),
      shareReplay(),
    ));
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

  private runModelCategoriesQuery(): Observable<{ modelId: Id64String; categoryId: string }> {
    const bindings = new Array<QueryBindable>();
    const query = /* sql */ `
      SELECT Model.Id modelId, Category.Id categoryId
      FROM bis.GeometricElement3d e
      GROUP BY modelId, categoryId
    `;
    return this.runQuery(query, bindings, (row) => ({ categoryId: row.categoryId, modelId: row.modelId }));
  }

  public queryModelCategories(modelId: Id64String): Observable<Id64String> {
    return this.initialInfoObs.pipe(mergeMap(({ modelCategories }) => modelCategories.get(modelId) ?? EMPTY_ID_SET));
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

    const elementIds = from(
      Presentation.presentation.getContentInstanceKeys({
        imodel: this._iModel,
        rulesetOrId: {
          id: "ModelsTree/AssemblyElements",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "SelectedNodeInstances",
                },
                {
                  specType: "ContentRelatedInstances",
                  relationshipPaths: [
                    {
                      relationship: {
                        schemaName: "BisCore",
                        className: "ElementOwnsChildElements",
                      },
                      direction: "Forward",
                      count: "*",
                    },
                  ],
                },
              ],
            },
          ],
        },
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

  public queryElements(props: ElementsQueryProps): Observable<string> {
    return this.runElementsQuery({
      ...props,
      type: "ids",
    });
  }

  public queryElementsCount(props: ElementsQueryProps): Observable<number> {
    return this.runElementsQuery({
      ...props,
      type: "count",
    });
  }

  private runElementsQuery(
    props: ElementsQueryProps & {
      type: "ids";
    },
  ): Observable<Id64String>;
  private runElementsQuery(
    props: ElementsQueryProps & {
      type: "count";
    },
  ): Observable<number>;
  private runElementsQuery(
    props: ElementsQueryProps & {
      type: "ids" | "count";
    },
  ): Observable<Id64String | number> {
    const bindings = new Array<QueryBindable>();
    const conditions = new Array<string>();
    props.modelId && conditions.push(bind("Model.Id", props.modelId, bindings));
    props.categoryId && conditions.push(bind("Category.Id", props.categoryId, bindings));
    props.rootElementId && conditions.push(bind("Parent.Id", props.rootElementId, bindings));

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = /* sql */ `
      WITH RECURSIVE
        RootElements(id) AS (
          SELECT e.ECInstanceId AS id
          FROM bis.GeometricElement3d e
          ${whereClause}
        ),
        ChildElements(id) AS (
          SELECT * FROM RootElements

          UNION ALL

          SELECT e.ECInstanceId AS id
          FROM bis.GeometricElement3d e
          INNER JOIN ChildElements ce ON e.Parent.Id = ce.id
        )
        SELECT ${props.type === "ids" ? "*" : "COUNT(*)"} FROM ChildElements
        ${props.elementIds ? `WHERE ${bind("id", props.elementIds, bindings)}` : ""}
    `;
    return this.runQuery(query, bindings, (row) => row[0]);
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

function bind(key: string, value: QueryBindable, bindings: Array<QueryBindable>) {
  if (typeof value === "string") {
    bindings.push(value);
    return `${key} = ?`;
  }

  const maxBindings = 1000;
  if (value.size < maxBindings) {
    const values = [...value];
    bindings.push(...values);
    return `${key} IN (${values.join(",")})`;
  }

  bindings.push(value);
  return `inVirtualSet(?, ${key})`;
}

function bindNamed(key: string, value: Id64String, bindings: Map<string, Id64String>, bindingName: string) {
  bindings.set(bindingName, value);
  return `${key} = :${bindingName}`;
}

// istanbul ignore next
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

function pushToMap<TKey, TValue>(targetMap: Map<TKey, Set<TValue>>, key: TKey, value: TValue) {
  let set = targetMap.get(key);
  if (!set) {
    set = new Set();
    targetMap.set(key, set);
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
