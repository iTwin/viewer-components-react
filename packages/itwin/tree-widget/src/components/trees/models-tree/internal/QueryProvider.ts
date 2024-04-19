/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, from, map } from "rxjs";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";

import type { Id64String } from "@itwin/core-bentley";
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
  queryCategoryElements(id: Id64String, modelId: Id64String | undefined): Observable<{ id: Id64String; hasChildren: boolean }>;
  queryElementChildren(id: Id64String): Observable<{ id: Id64String; hasChildren: boolean }>;
}

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
    const query = /* sql */ `
      SELECT ECInstanceId
      FROM bis.SpatialCategory c
      WHERE EXISTS (
        SELECT 1
        FROM bis.GeometricElement3d e
        WHERE
          e.Model.Id = ?
          AND e.Category.Id = c.ECInstanceId
          AND e.Parent IS NULL
      )
    `;
    return this.runQuery(query, [id], (row) => row.ecInstanceId);
  }

  private readonly hasChildrenClause = /* sql */ `
    IFNULL ((
      SELECT 1
      FROM (
        SELECT Parent.Id ParentId FROM bis.GeometricElement3d
        UNION ALL
        SELECT ModeledElement.Id ParentId FROM bis.GeometricModel3d
      )
      WHERE ParentId = this.ECInstanceId
      LIMIT 1
    ), 0) AS HasChildren
  `;

  public queryCategoryElements(id: Id64String, modelId: Id64String | undefined): Observable<{ id: Id64String; hasChildren: boolean }> {
    const query = /* sql */ `
      SELECT ECInstanceId, ${this.hasChildrenClause}
      FROM bis.GeometricElement3d this
      WHERE
        this.Category.Id = :categoryId
        ${modelId && "AND this.Model.Id = :modelId"}
        AND this.Parent IS NULL
    `;
    return this.runQuery(query, { categoryId: id, modelId }, (row) => ({ id: row.ecInstanceId, hasChildren: !!row.hasChildren }));
  }

  public queryElementChildren(id: Id64String): Observable<{ id: Id64String; hasChildren: boolean }> {
    const query = /* sql */ `
      SELECT ECInstanceId, ${this.hasChildrenClause}
      FROM bis.GeometricElement3d this
      WHERE this.Parent.Id = ?
    `;
    return this.runQuery(query, [id], (row) => ({ id: row.ecInstanceId, hasChildren: !!row.hasChildren }));
  }

  private runQuery<TResult>(
    query: string,
    bindings: Record<string, any> | Array<any> | undefined,
    resultMapper: (row: QueryRowProxy) => TResult,
  ): Observable<TResult> {
    return defer(() => {
      const reader = this._iModel.createQueryReader(query, bindings && QueryBinder.from(bindings), { rowFormat: QueryRowFormat.UseJsPropertyNames });
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
