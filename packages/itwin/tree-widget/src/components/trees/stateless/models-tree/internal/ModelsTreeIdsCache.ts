/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { pushToMap } from "../../common/Utils";

import type { Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CacheLike } from "../../../common/Utils";

interface SubjectInfo {
  subjectsHierarchy: Map<Id64String, Id64Set>;
  subjectModels: Map<Id64String, Id64Set>;
  hideInHierarchy: Map<Id64String, boolean>;
}

/** @internal */
export class ModelsTreeIdsCache implements CacheLike {
  private readonly _categoryElementCounts = new Map<Id64String, number>();
  private _subjectInfo: Promise<SubjectInfo> | undefined;
  private _parentSubjectIds: Promise<Id64Array> | undefined; // the list should contain a subject id if its node should be shown as having children
  private _modelInfos: Promise<Map<Id64String, { categories: Id64Array; elementCount: number }>> | undefined;

  constructor(private _queryExecutor: LimitingECSqlQueryExecutor) {}

  public invalidate(): void {
    this._subjectInfo = undefined;
    this._parentSubjectIds = undefined;
    this._modelInfos = undefined;
    this._categoryElementCounts.clear();
  }

  public dispose(): void {
    this.invalidate();
  }

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

  private async getSubjectInfo() {
    this._subjectInfo ??= (async () => {
      const targetPartitionSubjects = new Map<Id64String, Set<Id64String>>();
      const subjectsHierarchy = new Map<Id64String, Set<Id64String>>();
      const hideInHierarchy = new Map<Id64String, boolean>();

      await Promise.all([
        (async () => {
          for await (const subject of this.querySubjects()) {
            hideInHierarchy.set(subject.id, subject.hideInHierarchy);
            if (subject.parentId) {
              pushToMap(subjectsHierarchy, subject.parentId, subject.id);
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

      const subjectModels = new Map<Id64String, Set<Id64String>>();
      for (const [partitionId, subjectIds] of targetPartitionSubjects) {
        subjectIds.forEach((subjectId) => {
          pushToMap(subjectModels, subjectId, partitionId);
        });
      }

      return {
        subjectsHierarchy,
        hideInHierarchy,
        subjectModels,
      };
    })();
    return this._subjectInfo;
  }

  public async getParentSubjectIds(): Promise<Id64String[]> {
    this._parentSubjectIds ??= (async () => {
      const { subjectsHierarchy, subjectModels } = await this.getSubjectInfo();
      const hasChildModels = (subjectId: Id64String) => {
        if ((subjectModels.get(subjectId)?.size ?? 0) > 0) {
          return true;
        }
        const childSubjectIds = subjectsHierarchy.get(subjectId);
        return childSubjectIds && [...childSubjectIds].some(hasChildModels);
      };
      const parentSubjectIds = new Set<Id64String>();
      const addIfHasChildren = (subjectId: Id64String) => {
        if (hasChildModels(subjectId)) {
          parentSubjectIds.add(subjectId);
        }
      };
      subjectsHierarchy.forEach((childSubjectIds, parentSubjectId) => {
        addIfHasChildren(parentSubjectId);
        childSubjectIds.forEach(addIfHasChildren);
      });
      return [...parentSubjectIds];
    })();
    return this._parentSubjectIds;
  }

  public async getChildSubjectIds(parentSubjectIds: Id64String[]): Promise<Id64String[]> {
    const childSubjectIds = new Array<Id64String>();
    const { subjectsHierarchy, hideInHierarchy } = await this.getSubjectInfo();

    parentSubjectIds.forEach((subjectId) => {
      forEachChildSubject(subjectsHierarchy, subjectId, (childSubjectId) => {
        const isHidden = hideInHierarchy.get(childSubjectId)!;
        if (!isHidden) {
          childSubjectIds.push(childSubjectId);
          return "break";
        }
        return "continue";
      });
    });
    return childSubjectIds;
  }

  public async getSubjectModelIds(parentSubjectIds: Id64String[]): Promise<Id64String[]> {
    const { subjectsHierarchy, subjectModels, hideInHierarchy } = await this.getSubjectInfo();

    const hiddenSubjectIds = new Array<Id64String>();
    parentSubjectIds.forEach((subjectId) => {
      forEachChildSubject(subjectsHierarchy, subjectId, (childSubjectId) => {
        const isHidden = hideInHierarchy.get(childSubjectId)!;
        if (isHidden) {
          hiddenSubjectIds.push(childSubjectId);
          return "continue";
        }
        return "break";
      });
    });

    const modelIds = new Array<Id64String>();
    [...parentSubjectIds, ...hiddenSubjectIds].forEach((subjectId) => {
      const subjectModelIds = subjectModels.get(subjectId);
      subjectModelIds && modelIds.push(...subjectModelIds);
    });
    return modelIds;
  }

  private async *queryModelElementCounts() {
    const query = /* sql */ `
      SELECT Model.Id modelId, COUNT(*) elementCount
      FROM bis.GeometricElement3d
      GROUP BY Model.Id
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { modelId: row.modelId, elementCount: row.elementCount };
    }
  }

  private async *queryModelCategories() {
    const query = /* sql */ `
      SELECT Model.Id modelId, Category.Id categoryId
      FROM bis.GeometricElement3d
      GROUP BY modelId, categoryId
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { modelId: row.modelId, categoryId: row.categoryId };
    }
  }

  private async getModelInfos() {
    this._modelInfos ??= (async () => {
      const modelInfos = new Map<Id64String, { categories: Id64Array; elementCount: number }>();

      await Promise.all([
        (async () => {
          for await (const { modelId, categoryId } of this.queryModelCategories()) {
            const entry = modelInfos.get(modelId);
            if (entry) {
              entry.categories.push(categoryId);
            } else {
              modelInfos.set(modelId, { categories: [categoryId], elementCount: 0 });
            }
          }
        })(),
        (async () => {
          for await (const { modelId, elementCount } of this.queryModelElementCounts()) {
            const entry = modelInfos.get(modelId);
            if (entry) {
              entry.elementCount = elementCount;
            } else {
              modelInfos.set(modelId, { categories: [], elementCount });
            }
          }
        })(),
      ]);

      return modelInfos;
    })();

    return this._modelInfos;
  }

  public async getModelCategories(modelId: Id64String): Promise<Id64Array> {
    const modelInfos = await this.getModelInfos();
    return modelInfos.get(modelId)!.categories;
  }

  public async getModelElementCount(modelId: Id64String): Promise<number> {
    const modelInfos = await this.getModelInfos();
    return modelInfos.get(modelId)!.elementCount;
  }

  private async queryCategoryElementsCount(modelId: Id64String, categoryId: Id64String): Promise<number> {
    const reader = this._queryExecutor.createQueryReader(
      {
        ctes: [
          `
            CategoryElements(id) AS (
              SELECT ECInstanceId id
              FROM bis.GeometricElement3d
              WHERE Model.Id = ? AND Category.Id = ?

              UNION ALL

              SELECT c.ECInstanceId id
              FROM bis.GeometricElement3d c
              JOIN CategoryElements p ON c.Parent.Id = p.id
            )
          `,
        ],
        ecsql: `SELECT COUNT(*) FROM CategoryElements`,
        bindings: [
          { type: "id", value: modelId },
          { type: "id", value: categoryId },
        ],
      },
      { rowFormat: "Indexes", limit: "unbounded" },
    );

    return (await reader.next()).value[0];
  }

  public async getCategoryElementsCount(modelId: Id64String, categoryId: Id64String): Promise<number> {
    const cacheKey = `${modelId}${categoryId}`;
    let result = this._categoryElementCounts.get(cacheKey);
    if (result !== undefined) {
      return result;
    }

    result = await this.queryCategoryElementsCount(modelId, categoryId);
    this._categoryElementCounts.set(cacheKey, result);
    return result;
  }
}

function forEachChildSubject(
  subjectsHierarchy: Map<Id64String, Id64Set>,
  parentSubjectId: Id64String,
  cb: (childSubjectId: Id64String) => "break" | "continue",
) {
  const childSubjectIds = subjectsHierarchy.get(parentSubjectId);
  childSubjectIds &&
    childSubjectIds.forEach((childSubjectId) => {
      if (cb(childSubjectId) === "break") {
        return;
      }
      forEachChildSubject(subjectsHierarchy, childSubjectId, cb);
    });
}
