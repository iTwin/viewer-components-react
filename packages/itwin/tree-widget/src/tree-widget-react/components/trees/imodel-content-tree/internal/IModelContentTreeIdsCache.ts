/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import {
  GEOMETRIC_ELEMENT_2D_CLASS_NAME,
  GEOMETRIC_ELEMENT_3D_CLASS_NAME,
  INFORMATION_PARTITION_ELEMENT_CLASS_NAME,
  MODEL_CLASS_NAME,
  SUBJECT_CLASS_NAME,
} from "../../common/internal/ClassNameDefinitions.js";
import { pushToMap } from "../../common/internal/Utils.js";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ModelId, SubjectId } from "../../common/internal/Types.js";

interface SubjectInfo {
  parentSubject: Id64String | undefined;
  hideInHierarchy: boolean;
  childSubjects: Id64Set;
  childModels: Id64Set;
}

interface ModelInfo {
  categories: Id64Set;
}

/** @internal */
export class IModelContentTreeIdsCache {
  private _subjectInfos: Promise<Map<SubjectId, SubjectInfo>> | undefined;
  private _parentSubjectIds: Promise<Array<SubjectId>> | undefined; // the list should contain a subject id if its node should be shown as having children
  private _modelInfos: Promise<Map<ModelId, ModelInfo>> | undefined;

  constructor(private _queryExecutor: LimitingECSqlQueryExecutor) {}

  private async *querySubjects(): AsyncIterableIterator<{ id: SubjectId; parentId?: SubjectId; targetPartitionId?: ModelId; hideInHierarchy: boolean }> {
    const subjectsQuery = `
      SELECT
        s.ECInstanceId id,
        s.Parent.Id parentId,
        (
          SELECT m.ECInstanceId
          FROM ${MODEL_CLASS_NAME} m
          WHERE
            m.ECInstanceId = HexToId(json_extract(s.JsonProperties, '$.Subject.Model.TargetPartition'))
            AND NOT m.IsPrivate
        ) targetPartitionId,
        CASE
          WHEN (
            json_extract(s.JsonProperties, '$.Subject.Job.Bridge') IS NOT NULL
            OR json_extract(s.JsonProperties, '$.Subject.Model.Type') = 'Hierarchy'
          ) THEN 1
          ELSE 0
        END hideInHierarchy
      FROM ${SUBJECT_CLASS_NAME} s
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: subjectsQuery }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { id: row.id, parentId: row.parentId, targetPartitionId: row.targetPartitionId, hideInHierarchy: !!row.hideInHierarchy };
    }
  }

  private async *queryModels(): AsyncIterableIterator<{ id: ModelId; parentId: SubjectId }> {
    const modelsQuery = `
      SELECT p.ECInstanceId id, p.Parent.Id parentId
      FROM ${INFORMATION_PARTITION_ELEMENT_CLASS_NAME} p
      INNER JOIN ${MODEL_CLASS_NAME} m ON m.ModeledElement.Id = p.ECInstanceId
      WHERE NOT m.IsPrivate
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: modelsQuery }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { id: row.id, parentId: row.parentId };
    }
  }

  private async getSubjectInfos() {
    this._subjectInfos ??= (async () => {
      const [subjectInfos, targetPartitionSubjects] = await Promise.all([
        (async () => {
          const result = new Map<SubjectId, SubjectInfo>();
          for await (const subject of this.querySubjects()) {
            const subjectInfo: SubjectInfo = {
              parentSubject: subject.parentId,
              hideInHierarchy: subject.hideInHierarchy,
              childSubjects: new Set(),
              childModels: new Set(),
            };
            if (subject.targetPartitionId) {
              subjectInfo.childModels.add(subject.targetPartitionId);
            }
            result.set(subject.id, subjectInfo);
          }
          return result;
        })(),
        (async () => {
          const result = new Map<ModelId, Set<SubjectId>>();
          for await (const model of this.queryModels()) {
            pushToMap(result, model.id, model.parentId);
          }
          return result;
        })(),
      ]);

      for (const [subjectId, { parentSubject: parentSubjectId }] of subjectInfos.entries()) {
        if (parentSubjectId) {
          const parentSubjectInfo = subjectInfos.get(parentSubjectId);
          assert(!!parentSubjectInfo);
          parentSubjectInfo.childSubjects.add(subjectId);
        }
      }

      for (const [partitionId, subjectIds] of targetPartitionSubjects) {
        subjectIds.forEach((subjectId) => {
          const subjectInfo = subjectInfos.get(subjectId);
          assert(!!subjectInfo);
          subjectInfo.childModels.add(partitionId);
        });
      }

      return subjectInfos;
    })();
    return this._subjectInfos;
  }

  /** Returns ECInstanceIDs of Subjects that either have direct Model or at least one child Subject with a Model. */
  public async getParentSubjectIds(): Promise<Array<SubjectId>> {
    this._parentSubjectIds ??= (async () => {
      const subjectInfos = await this.getSubjectInfos();
      const parentSubjectIds = new Set<SubjectId>();
      subjectInfos.forEach((subjectInfo, subjectId) => {
        if (subjectInfo.childModels.size === 0 && subjectInfo.childSubjects.size === 0) {
          return;
        }
        parentSubjectIds.add(subjectId);
        let currParentId = subjectInfo.parentSubject;
        while (currParentId) {
          parentSubjectIds.add(currParentId);
          currParentId = subjectInfos.get(currParentId)?.parentSubject;
        }
      });
      return [...parentSubjectIds];
    })();
    return this._parentSubjectIds;
  }

  /**
   * Returns child subjects of the specified parent subjects as they're displayed in the hierarchy - taking into
   * account `hideInHierarchy` flag.
   */
  public async getChildSubjectIds(parentSubjectIds: Array<SubjectId>): Promise<Array<SubjectId>> {
    const childSubjectIds = new Array<SubjectId>();
    const subjectInfos = await this.getSubjectInfos();
    parentSubjectIds.forEach((subjectId) => {
      forEachChildSubject(subjectInfos, subjectId, (childSubjectId, childSubjectInfo) => {
        if (!childSubjectInfo.hideInHierarchy) {
          childSubjectIds.push(childSubjectId);
          return "break";
        }
        return "continue";
      });
    });
    return childSubjectIds;
  }

  /** Returns ECInstanceIDs of Models under specific parent Subjects as they are displayed in the hierarchy. */
  public async getChildSubjectModelIds(parentSubjectIds: Array<SubjectId>): Promise<Array<ModelId>> {
    const subjectInfos = await this.getSubjectInfos();

    const hiddenSubjectIds = new Array<SubjectId>();
    parentSubjectIds.forEach((subjectId) => {
      forEachChildSubject(subjectInfos, subjectId, (childSubjectId, childSubjectInfo) => {
        if (childSubjectInfo.hideInHierarchy) {
          hiddenSubjectIds.push(childSubjectId);
          return "continue";
        }
        return "break";
      });
    });

    const modelIds = new Array<ModelId>();
    [...parentSubjectIds, ...hiddenSubjectIds].forEach((subjectId) => {
      const subjectInfo = subjectInfos.get(subjectId);
      subjectInfo && modelIds.push(...subjectInfo.childModels);
    });
    return modelIds;
  }

  private async *queryModelCategories(): AsyncIterableIterator<{ modelId: ModelId; categoryId: CategoryId }> {
    const query = `
      SELECT Model.Id modelId, Category.Id categoryId
      FROM ${GEOMETRIC_ELEMENT_3D_CLASS_NAME}
      WHERE Parent.Id IS NULL
      GROUP BY Model.Id, Category.Id
      UNION ALL
      SELECT Model.Id modelId, Category.Id categoryId
      FROM ${GEOMETRIC_ELEMENT_2D_CLASS_NAME}
      WHERE Parent.Id IS NULL
      GROUP BY Model.Id, Category.Id
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { modelId: row.modelId, categoryId: row.categoryId };
    }
  }

  private async getModelInfos() {
    this._modelInfos ??= (async () => {
      const modelInfos = new Map<ModelId, { categories: Set<CategoryId>; elementCount: number }>();
      for await (const { modelId, categoryId } of this.queryModelCategories()) {
        const entry = modelInfos.get(modelId);
        if (entry) {
          entry.categories.add(categoryId);
        } else {
          modelInfos.set(modelId, { categories: new Set([categoryId]), elementCount: 0 });
        }
      }
      return modelInfos;
    })();
    return this._modelInfos;
  }

  public async getModelCategories(modelIds: Array<ModelId>): Promise<Array<CategoryId>> {
    const modelInfos = await this.getModelInfos();
    return modelIds.map((modelId) => modelInfos.get(modelId)?.categories).flatMap((categories) => (categories ? [...categories] : []));
  }
}

function forEachChildSubject(
  subjectInfos: Map<SubjectId, SubjectInfo>,
  parentSubject: SubjectId | SubjectInfo,
  cb: (childSubjectId: SubjectId, childSubjectInfo: SubjectInfo) => "break" | "continue",
) {
  const parentSubjectInfo = typeof parentSubject === "string" ? subjectInfos.get(parentSubject) : parentSubject;
  parentSubjectInfo &&
    parentSubjectInfo.childSubjects.forEach((childSubjectId) => {
      const childSubjectInfo = subjectInfos.get(childSubjectId)!;
      if (cb(childSubjectId, childSubjectInfo) === "break") {
        return;
      }
      forEachChildSubject(subjectInfos, childSubjectInfo, cb);
    });
}
