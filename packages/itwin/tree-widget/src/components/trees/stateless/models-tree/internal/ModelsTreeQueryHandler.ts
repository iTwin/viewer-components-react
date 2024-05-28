/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, expand, forkJoin, from, last, map, mergeMap, shareReplay, toArray } from "rxjs";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { pushToMap } from "../../../models-tree/Utils";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { Observable } from "rxjs";
import type { QueryRowProxy } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";

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
  rootElementIds: Id64String | Id64Set;
}

/**
 * @internal
 */
export type ElementsQueryProps = ModelElementsQueryProps | CategoryElementsQueryProps | ElementsByParentQueryProps;

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
  /**
   * Retrieves all elements that match given model, category and root (parent) element IDs,
   * then recursively retrieves all children of those elements by the "ElementOwnsChildElements" relationship.
   */
  queryElements(props: ElementsQueryProps): Observable<Id64String>;
  /** Analogous to `queryElements` but returns a count instead of values */
  queryElementsCount(props: ElementsQueryProps): Observable<number>;
  /** Returns information about given elements */
  queryElementInfo(props: { elementIds: Id64String | Id64Set; recursive?: boolean }): Observable<ElementInfo>;
  /** Clears cached query results */
  invalidateCache(): void;
}

/**
 * @internal
 */
export function createModelsTreeQueryHandler(iModel: IModelConnection): ModelsTreeQueryHandler {
  return new QueryHandlerImplementation(iModel);
}

class QueryHandlerImplementation implements ModelsTreeQueryHandler {
  private readonly _groupedElementIdsCache = new Map<string, Observable<Id64String>>();
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
    return this.initialInfoObs.pipe(mergeMap(({ modelCategories }) => modelCategories.get(modelId) ?? /* istanbul ignore next */ new Set<Id64String>()));
  }

  public queryElements(props: ElementsQueryProps): Observable<string> {
    return this.runElementsQuery({
      ...props,
      recursive: true,
      type: "ids",
    });
  }

  public queryElementsCount(props: ElementsQueryProps): Observable<number> {
    const runQuery = () =>
      this.runElementsQuery({
        ...props,
        recursive: false,
        type: "count",
      });

    if ("rootElementIds" in props) {
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
    props: ElementsQueryProps & {
      recursive: boolean;
      type: "ids";
    },
  ): Observable<Id64String>;
  private runElementsQuery(
    props: ElementsQueryProps & {
      recursive: boolean;
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
    "modelId" in props && props.modelId && conditions.push(bind("Model.Id", props.modelId, bindings));
    "categoryId" in props && conditions.push(bind("Category.Id", props.categoryId, bindings));
    "rootElementIds" in props && conditions.push(bind("Parent.Id", props.rootElementIds, bindings));

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : /* istanbul ignore next */ "";
    const query = /* sql */ `
      WITH RECURSIVE
        InitialElements(id) AS (
          SELECT e.ECInstanceId id
          FROM bis.GeometricElement3d e
          ${whereClause}
        ),
        Elements(id) AS (
          SELECT * FROM InitialElements

          UNION ALL

          SELECT c.ECInstanceId id
          FROM Elements e
          JOIN bis.GeometricElement3d c ON c.Parent.Id = e.id
        )
        SELECT ${props.type === "ids" ? "*" : "COUNT(*)"}
        FROM Elements
    `;
    return this.runQuery(query, bindings, (row) => row[0]);
  }

  public queryElementInfo(props: { elementIds: Id64String | Id64Set; recursive?: boolean }): Observable<ElementInfo> {
    const bindings = new Array<QueryBindable>();
    const initialQuery = /* sql */ `
      SELECT
        ECInstanceId ElementId,
        Model.Id ModelId,
        Category.Id CategoryId,
        Parent.Id ParentId
      FROM bis.GeometricElement3d
      WHERE ${bind("ECInstanceId", props.elementIds, bindings)}
    `;
    const query = props.recursive
      ? /* sql */ `
      WITH RECURSIVE
        InitialElementInfo(ElementId, ModelId, CategoryId, ParentId) AS (
          ${initialQuery}
        ),
        ElementInfo(ElementId, ModelId, CategoryId, ParentId) AS (
          SELECT * FROM InitialElementInfo

          UNION ALL

          SELECT
            e.ElementId,
            e.ModelId,
            p.Category.Id CategoryId,
            p.Parent.Id ParentId
          FROM bis.GeometricElement3d p
          JOIN ElementInfo e ON p.ECInstanceId = e.ParentId
        )
        SELECT ElementId, ModelId, CategoryId
        FROM ElementInfo
        WHERE ParentId IS NULL
    `
      : initialQuery;
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
  if (value.size < maxBindings) {
    const values = [...value];
    bindings.push(...values);
    return `${key} IN (${values.map(() => "?").join(",")})`;
  }

  bindings.push(value);
  return `InVirtualSet(?, ${key})`;
}

function createBinder(bindings: Array<QueryBindable>): QueryBinder | undefined {
  const binder = new QueryBinder();
  bindings.forEach((idOrIdSet, idx) => {
    // Binder expect index to start from 1
    idx++;
    if (typeof idOrIdSet === "string") {
      binder.bindId(idx, idOrIdSet);
      return;
    }

    binder.bindIdSet(idx, idOrIdSet);
  });
  return binder;
}
