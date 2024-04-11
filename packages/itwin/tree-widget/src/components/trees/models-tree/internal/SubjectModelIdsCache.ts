/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { QueryRowFormat } from "@itwin/core-common";

import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";

/** @internal */
export class SubjectModelIdsCache {
  private _imodel: IModelConnection;
  private _subjectsHierarchy: Map<Id64String, Id64String[]> | undefined;
  private _subjectModels: Map<Id64String, Id64String[]> | undefined;
  private _init: Promise<void> | undefined;

  constructor(imodel: IModelConnection) {
    this._imodel = imodel;
  }

  private async initSubjectModels() {
    const querySubjects = async (): Promise<Array<{ id: Id64String; parentId?: Id64String; targetPartitionId?: Id64String }>> => {
      const subjectsQuery = `
        SELECT ECInstanceId id, Parent.Id parentId, json_extract(JsonProperties, '$.Subject.Model.TargetPartition') targetPartitionId
        FROM bis.Subject
      `;
      return this._imodel.createQueryReader(subjectsQuery, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }).toArray();
    };
    const queryModels = async (): Promise<Array<{ id: Id64String; parentId: Id64String }>> => {
      const modelsQuery = `
        SELECT p.ECInstanceId id, p.Parent.Id parentId
        FROM bis.InformationPartitionElement p
        INNER JOIN bis.GeometricModel3d m ON m.ModeledElement.Id = p.ECInstanceId
        WHERE NOT m.IsPrivate
      `;
      return this._imodel.createQueryReader(modelsQuery, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }).toArray();
    };

    function pushToMap<TKey, TValue>(map: Map<TKey, TValue[]>, key: TKey, value: TValue) {
      let list = map.get(key);
      if (!list) {
        list = [];
        map.set(key, list);
      }
      list.push(value);
    }

    this._subjectsHierarchy = new Map();
    const targetPartitionSubjects = new Map<Id64String, Id64String[]>();
    for (const subject of await querySubjects()) {
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
    for (const model of await queryModels()) {
      // istanbul ignore next
      const subjectIds = targetPartitionSubjects.get(model.id) ?? [];
      // istanbul ignore else
      if (!subjectIds.includes(model.parentId)) {
        subjectIds.push(model.parentId);
      }

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

  private appendSubjectModelsRecursively(modelIds: Id64String[], subjectId: Id64String) {
    const subjectModelIds = this._subjectModels!.get(subjectId);
    if (subjectModelIds) {
      modelIds.push(...subjectModelIds);
    }

    const childSubjectIds = this._subjectsHierarchy!.get(subjectId);
    if (childSubjectIds) {
      childSubjectIds.forEach((cs) => this.appendSubjectModelsRecursively(modelIds, cs));
    }
  }

  public async getSubjectModelIds(subjectId: Id64String): Promise<Id64String[]> {
    await this.initCache();
    const modelIds = new Array<Id64String>();
    this.appendSubjectModelsRecursively(modelIds, subjectId);
    return modelIds;
  }
}
