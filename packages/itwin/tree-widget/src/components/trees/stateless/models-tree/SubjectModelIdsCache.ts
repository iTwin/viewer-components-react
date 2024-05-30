/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";

/** @internal */
export class SubjectModelIdsCache {
  private _subjectsHierarchy: Map<Id64String, Set<Id64String>> | undefined;
  private _subjectModels: Map<Id64String, Set<Id64String>> | undefined;
  private _subjectInfos: Map<Id64String, { hideInHierarchy: boolean }> | undefined;
  private _parentSubjectIds: Promise<Id64String[]> | undefined; // the list should contain a subject id if its node should be shown as having children
  private _init: Promise<void> | undefined;

  constructor(private _queryExecutor: LimitingECSqlQueryExecutor) {}

  private async *querySubjects(): AsyncIterableIterator<{ id: Id64String; parentId?: Id64String; targetPartitionId?: Id64String; hideInHierarchy: boolean }> {
    const subjectsQuery = `
      SELECT
        ECInstanceId id,
        Parent.Id parentId,
        json_extract(JsonProperties, '$.Subject.Model.TargetPartition') targetPartitionId,
        CASE
          WHEN (
            json_extract(JsonProperties, '$.Subject.Job.Bridge') IS NOT NULL
            OR json_extract(JsonProperties, '$.Subject.Model.Type') = 'Hierarchy'
          ) THEN 1
          ELSE 0
        END hideInHierarchy
      FROM bis.Subject
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: subjectsQuery }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { id: row.id, parentId: row.parentId, targetPartitionId: row.targetPartitionId, hideInHierarchy: !!row.hideInHierarchy };
    }
  }

  private async *queryModels(): AsyncIterableIterator<{ id: Id64String; parentId: Id64String }> {
    const modelsQuery = `
      SELECT p.ECInstanceId id, p.Parent.Id parentId
      FROM bis.InformationPartitionElement p
      INNER JOIN bis.GeometricModel3d m ON m.ModeledElement.Id = p.ECInstanceId
      WHERE NOT m.IsPrivate AND EXISTS (SELECT 1 FROM bis.GeometricElement3d WHERE Model.Id = m.ECInstanceId)
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: modelsQuery }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { id: row.id, parentId: row.parentId };
    }
  }

  private async initSubjectModels() {
    this._subjectsHierarchy = new Map();
    this._subjectModels = new Map();
    this._subjectInfos = new Map();
    const targetPartitionSubjects = new Map<Id64String, Set<Id64String>>();
    await Promise.all([
      (async () => {
        for await (const subject of this.querySubjects()) {
          this._subjectInfos!.set(subject.id, { hideInHierarchy: subject.hideInHierarchy });
          if (subject.parentId) {
            pushToMap(this._subjectsHierarchy!, subject.parentId, subject.id);
          }
          if (subject.targetPartitionId) {
            pushToMap(targetPartitionSubjects, subject.targetPartitionId, subject.id);
          }
        }
      })(),
      (async () => {
        for await (const model of this.queryModels()) {
          pushToMap(targetPartitionSubjects, model.id, model.parentId);
        }
      })(),
    ]);
    for (const [partitionId, subjectIds] of targetPartitionSubjects) {
      subjectIds.forEach((subjectId) => {
        pushToMap(this._subjectModels!, subjectId, partitionId);
      });
    }
  }

  private async initCache() {
    if (!this._init) {
      this._init = this.initSubjectModels();
    }
    return this._init;
  }

  private forEachChildSubject(parentSubjectId: Id64String, cb: (childSubjectId: Id64String) => "break" | "continue") {
    const childSubjectIds = this._subjectsHierarchy!.get(parentSubjectId);
    childSubjectIds &&
      childSubjectIds.forEach((childSubjectId) => {
        if (cb(childSubjectId) === "break") {
          return;
        }
        this.forEachChildSubject(childSubjectId, cb);
      });
  }

  public async getParentSubjectIds(): Promise<Id64String[]> {
    this._parentSubjectIds ??= (async () => {
      await this.initCache();
      const hasChildModels = (subjectId: Id64String) => {
        if ((this._subjectModels!.get(subjectId)?.size ?? 0) > 0) {
          return true;
        }
        const childSubjectIds = this._subjectsHierarchy!.get(subjectId);
        return childSubjectIds && [...childSubjectIds].some(hasChildModels);
      };
      const parentSubjectIds = new Set<Id64String>();
      const addIfHasChildren = (subjectId: Id64String) => {
        if (hasChildModels(subjectId)) {
          parentSubjectIds.add(subjectId);
        }
      };
      this._subjectsHierarchy!.forEach((childSubjectIds, parentSubjectId) => {
        addIfHasChildren(parentSubjectId);
        childSubjectIds.forEach(addIfHasChildren);
      });
      return [...parentSubjectIds];
    })();
    return this._parentSubjectIds;
  }

  public async getChildSubjectIds(parentSubjectIds: Id64String[]): Promise<Id64String[]> {
    await this.initCache();
    const childSubjectIds = new Array<Id64String>();
    parentSubjectIds.forEach((subjectId) => {
      this.forEachChildSubject(subjectId, (childSubjectId) => {
        const { hideInHierarchy } = this._subjectInfos!.get(childSubjectId)!;
        if (!hideInHierarchy) {
          childSubjectIds.push(childSubjectId);
          return "break";
        }
        return "continue";
      });
    });
    return childSubjectIds;
  }

  public async getSubjectModelIds(parentSubjectIds: Id64String[]): Promise<Id64String[]> {
    await this.initCache();

    const hiddenSubjectIds = new Array<Id64String>();
    parentSubjectIds.forEach((subjectId) => {
      this.forEachChildSubject(subjectId, (childSubjectId) => {
        const { hideInHierarchy } = this._subjectInfos!.get(childSubjectId)!;
        if (hideInHierarchy) {
          hiddenSubjectIds.push(childSubjectId);
          return "continue";
        }
        return "break";
      });
    });

    const modelIds = new Array<Id64String>();
    [...parentSubjectIds, ...hiddenSubjectIds].forEach((subjectId) => {
      const subjectModelIds = this._subjectModels!.get(subjectId);
      subjectModelIds && modelIds.push(...subjectModelIds);
    });
    return modelIds;
  }
}

function pushToMap<TKey, TValue>(map: Map<TKey, Set<TValue>>, key: TKey, value: TValue) {
  let list = map.get(key);
  if (!list) {
    list = new Set();
    map.set(key, list);
  }
  list.add(value);
}
