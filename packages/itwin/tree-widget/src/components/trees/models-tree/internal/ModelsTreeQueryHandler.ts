/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, expand, first, forkJoin, from, last, map, mergeMap, shareReplay, toArray } from "rxjs";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { KeySet } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { pushToMap } from "./Utils";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { Observable } from "rxjs";
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

export interface ModelElementsQueryProps {
  modelId: Id64String;
}

export interface CategoryElementsQueryProps {
  categoryId: Id64String;
  modelId: Id64String;
}

export interface ElementsByParentQueryProps {
  rootElementId: Id64String;
}

/**
 * @internal
 */
export type ElementsQueryProps = ModelElementsQueryProps | CategoryElementsQueryProps | ElementsByParentQueryProps;

export type FilterableQueryProps<TProps extends {} = ElementsQueryProps> = TProps & {
  elementIdFilter?: Id64Set;
};

export interface ElementInfo {
  parentId?: Id64String;
  elementId: Id64String;
  modelId: Id64String;
  categoryId: Id64String;
}

/**
 * @internal
 */
export interface ModelsTreeQueryHandler {
  /** Retrieves all models under a given subject */
  querySubjectModels(subjectId: Id64String): Observable<Id64String>;
  /** Retrieves all unique categories of elements under a given model */
  queryModelCategories(modelId: Id64String): Observable<Id64String>;
  /** Retrieves elements of a class grouping node */
  queryGroupingNodeChildren(node: GroupingNodeKey): Observable<GroupedElementIds>;
  /**
   * Retrieves all elements that match given model, category and root (parent) element IDs,
   * then recursively retrieves all children of those elements by the "ElementOwnsChildElements" relationship.
   */
  queryElements(props: FilterableQueryProps): Observable<Id64String>;
  /** Analogous to `queryElements` but returns a count instead of values */
  queryElementsCount(props: FilterableQueryProps): Observable<number>;
  /** Returns information about given elements */
  queryElementInfo(elementIds: Id64Set): Observable<ElementInfo>;
  /** Clears cached query results */
  invalidateCache(): void;
}

const EMPTY_ID_SET = new Set<Id64String>();

/**
 * @internal
 */
export function createModelsTreeQueryHandler(iModel: IModelConnection): ModelsTreeQueryHandler {
  return new QueryHandlerImplementation(iModel);
}

class QueryHandlerImplementation implements ModelsTreeQueryHandler {
  private readonly _groupedElementIdsCache = new Map<string, Observable<GroupedElementIds>>();
  private readonly _elementsCountCache = new Map<string, Observable<number>>();
  private _initialInfoObs?: Observable<InitialInfo>;

  constructor(private readonly _iModel: IModelConnection) {}

  public invalidateCache(): void {
    this._groupedElementIdsCache.clear();
    this._elementsCountCache.clear();
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
    return this.runQuery(query, undefined, ["id", "parentId", "targetPartitionId"]);
  }

  private runModelsQuery(): Observable<{ id: Id64String; parentId: Id64String }> {
    const query = /* sql */ `
      SELECT p.ECInstanceId id, p.Parent.Id parentId
      FROM bis.InformationPartitionElement p
      INNER JOIN bis.GeometricModel3d m ON m.ModeledElement.Id = p.ECInstanceId
      WHERE NOT m.IsPrivate
    `;
    return this.runQuery(query, undefined, ["id", "parentId"]);
  }

  private runModelCategoriesQuery(): Observable<{ modelId: Id64String; categoryId: string }> {
    const bindings = new Array<QueryBindable>();
    const query = /* sql */ `
      SELECT Model.Id modelId, Category.Id categoryId
      FROM bis.GeometricElement3d e
      GROUP BY modelId, categoryId
    `;
    return this.runQuery(query, bindings, ["modelId", "categoryId"]);
  }

  public queryModelCategories(modelId: Id64String): Observable<Id64String> {
    return this.initialInfoObs.pipe(mergeMap(({ modelCategories }) => modelCategories.get(modelId) ?? /* istanbul ignore next */ EMPTY_ID_SET));
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
        return this.runQuery(query, bindings, (row) => ({ modelId: row.modelId, categoryId: row.categoryId, elementIds }));
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

  public queryElementsCount(props: FilterableQueryProps): Observable<number> {
    const runQuery = () =>
      this.runElementsQuery({
        ...props,
        type: "count",
      });

    if ("rootElementId" in props || props.elementIdFilter !== undefined) {
      return runQuery();
    }

    const cacheKey = `${props.modelId}${"categoryId" in props ? props.categoryId : ""}`;
    let obs = this._elementsCountCache.get(cacheKey);
    if (obs) {
      return obs;
    }

    obs = runQuery().pipe(shareReplay());
    this._elementsCountCache.set(cacheKey, obs);
    return obs;
  }

  private runElementsQuery(
    props: FilterableQueryProps & {
      type: "ids";
    },
  ): Observable<Id64String>;
  private runElementsQuery(
    props: FilterableQueryProps & {
      type: "count";
    },
  ): Observable<number>;
  private runElementsQuery(
    props: FilterableQueryProps & {
      type: "ids" | "count";
    },
  ): Observable<Id64String | number> {
    const bindings = new Array<QueryBindable>();
    const conditions = new Array<string>();
    "modelId" in props && props.modelId && conditions.push(bind("Model.Id", props.modelId, bindings));
    "categoryId" in props && conditions.push(bind("Category.Id", props.categoryId, bindings));
    "rootElementId" in props && conditions.push(bind("Parent.Id", props.rootElementId, bindings));

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : /* istanbul ignore next */ "";

    const query = /* sql */ `
      WITH RECURSIVE
        RootElements(id) AS (
          SELECT e.ECInstanceId id
          FROM bis.GeometricElement3d e
          ${whereClause}
        ),
        ChildElements(id) AS (
          SELECT * FROM RootElements

          UNION ALL

          SELECT c.ECInstanceId id
          FROM ChildElements e
          JOIN bis.GeometricElement3d c ON c.Parent.Id = e.id
        )
        SELECT ${props.type === "ids" ? "*" : "COUNT(*)"} FROM ChildElements
        ${props.elementIdFilter ? `WHERE ${bind("id", props.elementIdFilter, bindings)}` : ""}
    `;
    return this.runQuery(query, bindings, (row) => row[0]);
  }

  public queryElementInfo(elementIds: Id64Set): Observable<ElementInfo> {
    const bindings = new Array<QueryBindable>();
    const query = /* sql */ `
      WITH RECURSIVE
        ElementInfo(Id, ModelId, CategoryId, ParentId) AS (
          SELECT
            ECInstanceId Id,
            Model.Id ModelId,
            Category.Id CategoryId,
            Parent.Id ParentId
          FROM bis.GeometricElement3d
          WHERE ${bind("ECInstanceId", elementIds, bindings)}

          UNION ALL

          SELECT
            e.Id,
            e.ModelId,
            p.Category.Id CategoryId,
            p.Parent.Id ParentId
          FROM bis.GeometricElement3d p
          JOIN ElementInfo e ON p.ECInstanceId = e.ParentId
        )
      SELECT Id, ModelId, CategoryId
      FROM ElementInfo
      WHERE ParentId IS NULL
    `;
    return this.runQuery(query, bindings, ["elementId", "modelId", "categoryId", "parentId"]);
  }

  private runQuery<TResult extends {}>(
    query: string,
    bindings: Array<QueryBindable> | undefined,
    mapperOrProps: ((row: QueryRowProxy) => TResult) | Array<keyof TResult>,
  ): Observable<TResult> {
    return defer(() => {
      const reader = this._iModel.createQueryReader(query, bindings && createBinder(bindings), {
        rowFormat: QueryRowFormat.UseJsPropertyNames,
      });

      let mapper: (row: QueryRowProxy) => TResult;
      if (typeof mapperOrProps === "function") {
        mapper = mapperOrProps;
      } else {
        mapper = (row) => Object.fromEntries(mapperOrProps.map((key) => [key, row[key as string]])) as TResult;
      }

      return from(reader).pipe(map(mapper));
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
  // istanbul ignore else
  if (value.size < maxBindings) {
    const values = [...value];
    bindings.push(...values);
    return `${key} IN (${values.join(",")})`;
  }

  // istanbul ignore next
  bindings.push(value);
  return `inVirtualSet(?, ${key})`;
}

// istanbul ignore next
function createBinder(bindings: Array<QueryBindable>): QueryBinder | undefined {
  const binder = new QueryBinder();
  bindings.forEach((x, idx) => {
    // Binder expect index to start from 1
    idx++;
    if (typeof x === "string") {
      binder.bindId(idx, x);
      return;
    }

    binder.bindIdSet(idx, Array.isArray(x) ? new Set(x) : x);
  });
  return binder;
}
