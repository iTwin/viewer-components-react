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
export interface QueryProvider {
  queryModelElements(id: Id64String): Observable<{ id: Id64String; isCategory: boolean }>;
  queryAllSubjects(): Observable<{ id: Id64String; parentId?: Id64String; targetPartitionId?: Id64String }>;
  queryAllModels(): Observable<{ id: Id64String; parentId: Id64String }>;
}

// istanbul-ignore-next
class QueryProviderImplementation implements QueryProvider {
  constructor(private readonly _iModel: IModelConnection) {}

  public queryModelElements(id: Id64String): Observable<{ id: Id64String; isCategory: boolean }> {
    const query = /* sql */ `
      WITH
        Categories AS (
          SELECT ECInstanceId, TRUE as IsCategory
          FROM bis.Category c
          WHERE c.Model.Id = ?
        ),
        Elements AS (
          SELECT ECInstanceId, FALSE as IsCategory
          FROM bis.Element e LEFT JOIN Categories c ON (e.ECInstanceId = c.ECInstanceId)
        )
      SELECT * FROM Categories JOIN Elements
    `;
    return this.runQuery(query, [id], (row) => ({ id: row.ecInstanceId, isCategory: row.isCategory }));
  }

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
export function createQueryProvider(iModel: IModelConnection): QueryProvider {
  // istanbul-ignore-next
  return new QueryProviderImplementation(iModel);
}
