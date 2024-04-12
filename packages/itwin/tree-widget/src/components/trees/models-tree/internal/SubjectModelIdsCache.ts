/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { EMPTY, expand, from, map, mergeMap } from "rxjs";
import { QueryRowFormat } from "@itwin/core-common";

import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Observable } from "rxjs";

/** @internal */
export class SubjectModelIdsCache {
  private _subjectsHierarchy?: Map<Id64String, Set<Id64String>>;
  private _subjectModels?: Map<Id64String, Set<Id64String>>;
  private _init?: Promise<void>;

  constructor(private readonly _imodel: IModelConnection) {}

  private async *querySubjects(): AsyncIterableIterator<{ id: Id64String; parentId?: Id64String; targetPartitionId?: Id64String }> {
    const subjectsQuery = `
      SELECT ECInstanceId id, Parent.Id parentId, json_extract(JsonProperties, '$.Subject.Model.TargetPartition') targetPartitionId
      FROM bis.Subject
    `;
    return this._imodel.createQueryReader(subjectsQuery, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames });
  }

  private async *queryModels(): AsyncIterableIterator<{ id: Id64String; parentId: Id64String }> {
    const modelsQuery = `
      SELECT p.ECInstanceId id, p.Parent.Id parentId
      FROM bis.InformationPartitionElement p
      INNER JOIN bis.GeometricModel3d m ON m.ModeledElement.Id = p.ECInstanceId
      WHERE NOT m.IsPrivate
    `;
    return this._imodel.createQueryReader(modelsQuery, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames });
  }

  private async initSubjectModels() {
    this._subjectsHierarchy = new Map();
    const targetPartitionSubjects = new Map<Id64String, Set<Id64String>>();
    for await (const subject of this.querySubjects()) {
      // istanbul ignore else
      if (subject.parentId) {
        pushToMap(this._subjectsHierarchy, subject.parentId, subject.id);
      }
      // istanbul ignore if
      if (subject.targetPartitionId) {
        pushToMap(targetPartitionSubjects, subject.targetPartitionId, subject.id);
      }
    }

    this._subjectModels = new Map();
    for await (const model of this.queryModels()) {
      const subjectIds = targetPartitionSubjects.get(model.id) ?? new Set();
      subjectIds.add(model.parentId);
      subjectIds.forEach((subjectId) => {
        pushToMap(this._subjectModels!, subjectId, model.id);
      });
    }
  }

  private async initCache() {
    if (!this._init) {
      this._init = this.initSubjectModels().then(() => {});
    }
    return this._init;
  }

  public getSubjectModelIdObs(subjectId: Id64String): Observable<Id64String> {
    return from(this.initCache()).pipe(
      map(() => ({ modelIds: new Array<Id64String>(), childSubjectId: subjectId })),
      expand(({ modelIds, childSubjectId }) => {
        const subjectModelIds = this._subjectModels!.get(childSubjectId);
        subjectModelIds && modelIds.push(...subjectModelIds);

        const childSubjectIds = this._subjectsHierarchy!.get(childSubjectId);
        return childSubjectIds ? from(childSubjectIds).pipe(map((cs) => ({ modelIds, childSubjectId: cs }))) : EMPTY;
      }),
      mergeMap(({ modelIds }) => modelIds),
    );
  }
}

function pushToMap<TKey, TValue>(_map: Map<TKey, Set<TValue>>, key: TKey, value: TValue) {
  let set = _map.get(key);
  if (!set) {
    set = new Set();
    _map.set(key, set);
  }
  set.add(value);
}
