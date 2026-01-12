/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert, Guid } from "@itwin/core-bentley";
import {
  CLASS_NAME_GeometricElement2d,
  CLASS_NAME_GeometricElement3d,
  CLASS_NAME_InformationPartitionElement,
  CLASS_NAME_Model,
  CLASS_NAME_Subject,
} from "../../common/internal/ClassNameDefinitions.js";
import { isBeSqliteInterruptError } from "../../common/internal/UseErrorState.js";
import { pushToMap } from "../../common/internal/Utils.js";

import type { GuidString, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { ModelId, SubjectId } from "../../common/internal/Types.js";

interface SubjectInfo {
  parentSubjectId: Id64String | undefined;
  hideInHierarchy: boolean;
  childSubjectIds: Id64Set;
  childModelIds: Id64Set;
}

interface ModelInfo {
  categoryIds: Id64Set;
}

/** @internal */
export class IModelContentTreeIdsCache {
  #subjectInfos: Promise<Map<SubjectId, SubjectInfo>> | undefined;
  #parentSubjectIds: Promise<Id64Array> | undefined; // the list should contain a subject id if its node should be shown as having children
  #modelInfos: Promise<Map<ModelId, ModelInfo>> | undefined;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  #componentName: string;

  constructor(queryExecutor: LimitingECSqlQueryExecutor, componentId?: GuidString) {
    this.#queryExecutor = queryExecutor;
    this.#componentId = componentId ?? Guid.createValue();
    this.#componentName = "IModelContentTreeIdsCache";
  }

  private async *querySubjects(): AsyncIterableIterator<{ id: SubjectId; parentId?: SubjectId; targetPartitionId?: ModelId; hideInHierarchy: boolean }> {
    try {
      const subjectsQuery = `
        SELECT
          s.ECInstanceId id,
          s.Parent.Id parentId,
          (
            SELECT m.ECInstanceId
            FROM ${CLASS_NAME_Model} m
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
        FROM ${CLASS_NAME_Subject} s
      `;
      for await (const row of this.#queryExecutor.createQueryReader(
        { ecsql: subjectsQuery },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/subjects` },
      )) {
        yield { id: row.id, parentId: row.parentId, targetPartitionId: row.targetPartitionId, hideInHierarchy: !!row.hideInHierarchy };
      }
    } catch (error) {
      if (!isBeSqliteInterruptError(error)) {
        throw error;
      }
    }
  }

  private async *queryModels(): AsyncIterableIterator<{ id: ModelId; parentId: SubjectId }> {
    try {
      const modelsQuery = `
        SELECT p.ECInstanceId id, p.Parent.Id parentId
        FROM ${CLASS_NAME_InformationPartitionElement} p
        INNER JOIN ${CLASS_NAME_Model} m ON m.ModeledElement.Id = p.ECInstanceId
        WHERE NOT m.IsPrivate
      `;
      for await (const row of this.#queryExecutor.createQueryReader(
        { ecsql: modelsQuery },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/models` },
      )) {
        yield { id: row.id, parentId: row.parentId };
      }
    } catch (error) {
      if (!isBeSqliteInterruptError(error)) {
        throw error;
      }
    }
  }

  private async getSubjectInfos() {
    this.#subjectInfos ??= (async () => {
      const [subjectInfos, targetPartitionSubjects] = await Promise.all([
        (async () => {
          const result = new Map<SubjectId, SubjectInfo>();
          for await (const subject of this.querySubjects()) {
            const subjectInfo: SubjectInfo = {
              parentSubjectId: subject.parentId,
              hideInHierarchy: subject.hideInHierarchy,
              childSubjectIds: new Set(),
              childModelIds: new Set(),
            };
            if (subject.targetPartitionId) {
              subjectInfo.childModelIds.add(subject.targetPartitionId);
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

      for (const [subjectId, { parentSubjectId }] of subjectInfos.entries()) {
        if (parentSubjectId) {
          const parentSubjectInfo = subjectInfos.get(parentSubjectId);
          assert(!!parentSubjectInfo);
          parentSubjectInfo.childSubjectIds.add(subjectId);
        }
      }

      for (const [partitionId, subjectIds] of targetPartitionSubjects) {
        subjectIds.forEach((subjectId) => {
          const subjectInfo = subjectInfos.get(subjectId);
          assert(!!subjectInfo);
          subjectInfo.childModelIds.add(partitionId);
        });
      }

      return subjectInfos;
    })();
    return this.#subjectInfos;
  }

  /** Returns ECInstanceIDs of Subjects that either have direct Model or at least one child Subject with a Model. */
  public async getParentSubjectIds(): Promise<Id64Array> {
    this.#parentSubjectIds ??= (async () => {
      const subjectInfos = await this.getSubjectInfos();
      const parentSubjectIds = new Set<SubjectId>();
      subjectInfos.forEach((subjectInfo, subjectId) => {
        if (subjectInfo.childModelIds.size === 0 && subjectInfo.childSubjectIds.size === 0) {
          return;
        }
        parentSubjectIds.add(subjectId);
        let currParentId = subjectInfo.parentSubjectId;
        while (currParentId) {
          parentSubjectIds.add(currParentId);
          currParentId = subjectInfos.get(currParentId)?.parentSubjectId;
        }
      });
      return [...parentSubjectIds];
    })();
    return this.#parentSubjectIds;
  }

  /**
   * Returns child subjects of the specified parent subjects as they're displayed in the hierarchy - taking into
   * account `hideInHierarchy` flag.
   */
  public async getChildSubjectIds(parentSubjectIds: Id64Array): Promise<Id64Array> {
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
  public async getChildSubjectModelIds(parentSubjectIds: Id64Array): Promise<Id64Array> {
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
      subjectInfo && modelIds.push(...subjectInfo.childModelIds);
    });
    return modelIds;
  }

  private async *queryModelCategories(): AsyncIterableIterator<{ modelId: Id64String; categoryId: Id64String }> {
    try {
      const query = `
        SELECT Model.Id modelId, Category.Id categoryId
        FROM ${CLASS_NAME_GeometricElement3d}
        WHERE Parent.Id IS NULL
        GROUP BY Model.Id, Category.Id
        UNION ALL
        SELECT Model.Id modelId, Category.Id categoryId
        FROM ${CLASS_NAME_GeometricElement2d}
        WHERE Parent.Id IS NULL
        GROUP BY Model.Id, Category.Id
      `;
      for await (const row of this.#queryExecutor.createQueryReader(
        { ecsql: query },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/model-categories` },
      )) {
        yield { modelId: row.modelId, categoryId: row.categoryId };
      }
    } catch (error) {
      if (!isBeSqliteInterruptError(error)) {
        throw error;
      }
    }
  }

  private async getModelInfos() {
    this.#modelInfos ??= (async () => {
      const modelInfos = new Map<ModelId, { categoryIds: Id64Set; elementCount: number }>();
      for await (const { modelId, categoryId } of this.queryModelCategories()) {
        const entry = modelInfos.get(modelId);
        if (entry) {
          entry.categoryIds.add(categoryId);
        } else {
          modelInfos.set(modelId, { categoryIds: new Set([categoryId]), elementCount: 0 });
        }
      }
      return modelInfos;
    })();
    return this.#modelInfos;
  }

  public async getModelCategoryIds(modelIds: Id64Array): Promise<Id64Array> {
    const modelInfos = await this.getModelInfos();
    return modelIds.map((modelId) => modelInfos.get(modelId)?.categoryIds).flatMap((categories) => (categories ? [...categories] : []));
  }
}

function forEachChildSubject(
  subjectInfos: Map<SubjectId, SubjectInfo>,
  parentSubject: SubjectId | SubjectInfo,
  cb: (childSubjectId: Id64String, childSubjectInfo: SubjectInfo) => "break" | "continue",
) {
  const parentSubjectInfo = typeof parentSubject === "string" ? subjectInfos.get(parentSubject) : parentSubject;
  parentSubjectInfo &&
    parentSubjectInfo.childSubjectIds.forEach((childSubjectId) => {
      const childSubjectInfo = subjectInfos.get(childSubjectId)!;
      if (cb(childSubjectId, childSubjectInfo) === "break") {
        return;
      }
      forEachChildSubject(subjectInfos, childSubjectInfo, cb);
    });
}
