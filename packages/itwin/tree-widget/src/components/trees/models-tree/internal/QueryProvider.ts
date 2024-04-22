/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, from, map } from "rxjs";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";

import type { Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { QueryRowProxy } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Observable } from "rxjs";

/**
 * @internal
 */
export interface IQueryProvider {
  queryAllSubjects(): Observable<{ id: Id64String; parentId?: Id64String; targetPartitionId?: Id64String }>;
  queryAllModels(): Observable<{ id: Id64String; parentId: Id64String }>;
  queryModelCategories(id: Id64String): Observable<Id64String>;
  queryModelElements(modelId: Id64String, elementIds?: Id64Array | Id64Set): Observable<Id64String>;
  queryCategoryElements(id: Id64String, modelId: Id64String | undefined): Observable<{ id: Id64String; hasChildren: boolean }>;
  queryElementChildren(id: Id64String): Observable<{ id: Id64String; hasChildren: boolean }>;
}

type QueryBindable = Id64String | Id64Array | Id64Set;

/* istanbul ignore next */
class QueryProviderImplementation implements IQueryProvider {
  constructor(private readonly _iModel: IModelConnection) {}

  public queryAllSubjects(): Observable<{ id: Id64String; parentId?: Id64String; targetPartitionId?: Id64String }> {
    const query = /* sql */ `
      SELECT ECInstanceId id, Parent.Id parentId, json_extract(JsonProperties, '$.Subject.Model.TargetPartition') targetPartitionId
      FROM bis.Subject
    `;
    return this.runQuery(query, undefined, (row) => ({ id: row.ecInstanceId, parentId: row.parentId, targetPartitionId: row.targetPartitionId }));
  }

  public queryAllModels(): Observable<{ id: Id64String; parentId: Id64String }> {
    const query = /* sql */ `
      SELECT p.ECInstanceId id, p.Parent.Id parentId
      FROM bis.InformationPartitionElement p
      INNER JOIN bis.GeometricModel3d m ON m.ModeledElement.Id = p.ECInstanceId
      WHERE NOT m.IsPrivate
    `;
    return this.runQuery(query, undefined, (row) => ({ id: row.id, parentId: row.parentId }));
  }

  public queryModelCategories(id: Id64String): Observable<Id64String> {
    const bindings = new Array<QueryBindable>();
    const query = /* sql */ `
      SELECT ECInstanceId
      FROM bis.SpatialCategory c
      WHERE EXISTS (
        SELECT 1
        FROM bis.GeometricElement3d e
        WHERE
          ${this.bind("e.model.id", id, bindings)}
          AND e.Category.Id = c.ECInstanceId
          AND e.Parent IS NULL
      )
    `;
    return this.runQuery(query, [id], (row) => row.ecInstanceId);
  }

  private createHasChildrenClause = (alias: string) => /* sql */ `
  IFNULL ((
    SELECT 1
    FROM (
      SELECT Parent.Id ParentId FROM bis.GeometricElement3d
      UNION ALL
      SELECT ModeledElement.Id ParentId FROM bis.GeometricModel3d
    )
    WHERE ParentId = ${alias}.ECInstanceId
    LIMIT 1
  ), 0) AS HasChildren
`;

  public queryCategoryElements(id: Id64String, modelId: Id64String | undefined): Observable<{ id: Id64String; hasChildren: boolean }> {
    const bindings = new Array<QueryBindable>();
    const query = /* sql */ `
      SELECT ECInstanceId, ${this.createHasChildrenClause("e")}
      FROM bis.GeometricElement3d e
      WHERE
        ${this.bind("e.ECInstanceId", id, bindings)}
        ${modelId ? `AND ${this.bind("e.Model.Id", modelId, bindings)}` : ""}
        AND e.Parent IS NULL
    `;
    return this.runQuery(query, bindings, (row) => ({ id: row.ecInstanceId, hasChildren: !!row.hasChildren }));
  }

  public queryElementChildren(id: Id64String): Observable<{ id: Id64String; hasChildren: boolean }> {
    const bindings = new Array<QueryBindable>();
    const query = /* sql */ `
      SELECT ECInstanceId, ${this.createHasChildrenClause("e")}
      FROM bis.GeometricElement3d e
      WHERE ${this.bind("e.Parent.Id", id, bindings)}
    `;
    return this.runQuery(query, bindings, (row) => ({ id: row.ecInstanceId, hasChildren: !!row.hasChildren }));
  }

  public queryModelElements(modelId: Id64String, elementIds?: Id64Array | Id64Set): Observable<Id64String> {
    const bindings = new Array<QueryBindable>();
    const query = /* sql */ `
      SELECT ECInstanceId
      FROM bis.GeometricElement3d e
      WHERE
        ${this.bind("e.Model.Id", modelId, bindings)}
        ${elementIds ? `AND ${this.bind("e.ECInstanceId", elementIds, bindings)}` : ""}
    `;
    return this.runQuery(query, bindings, (row) => row.ecInstanceId);
  }

  private bind(key: string, value: QueryBindable, bindings: Array<QueryBindable>) {
    const MAX_ALLOWED_BINDINGS = 1000;

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

  private createBinder(bindings: Array<QueryBindable>): QueryBinder | undefined {
    const binder = new QueryBinder();
    bindings.forEach((x, idx) => {
      idx++;
      if (typeof x === "string") {
        binder.bindId(idx, x);
        return;
      }

      binder.bindIdSet(idx, Array.isArray(x) ? new Set(x) : x);
    });
    return binder;
  }

  private runQuery<TResult>(query: string, bindings: Array<QueryBindable> | undefined, resultMapper: (row: QueryRowProxy) => TResult): Observable<TResult> {
    return defer(() => {
      const reader = this._iModel.createQueryReader(query, bindings && this.createBinder(bindings), {
        rowFormat: QueryRowFormat.UseJsPropertyNames,
      });
      return from(reader).pipe(map(resultMapper));
    });
  }
}

/**
 * @internal
 */
/* istanbul ignore next */
export function createQueryProvider(iModel: IModelConnection): IQueryProvider {
  return new QueryProviderImplementation(iModel);
}
