/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { pushToMap } from "../../common/Utils";

import type { ModelsTreeDefinition } from "../ModelsTreeDefinition";
import type { Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";

interface SubjectInfo {
  parentSubject: Id64String | undefined;
  hideInHierarchy: boolean;
  childSubjects: Id64Set;
  childModels: Id64Set;
}

interface ModelInfo {
  categories: Id64Set;
  elementCount: number;
}

type ModelsTreeHierarchyConfiguration = ConstructorParameters<typeof ModelsTreeDefinition>[0]["hierarchyConfig"];

/** @internal */
export class ModelsTreeIdsCache {
  private readonly _categoryElementCounts = new Map<Id64String, number>();
  private _subjectInfos: Promise<Map<Id64String, SubjectInfo>> | undefined;
  private _parentSubjectIds: Promise<Id64Array> | undefined; // the list should contain a subject id if its node should be shown as having children
  private _modelInfos: Promise<Map<Id64String, ModelInfo>> | undefined;

  constructor(
    private _queryExecutor: LimitingECSqlQueryExecutor,
    private _hierarchyConfig: ModelsTreeHierarchyConfiguration,
  ) {}

  private async *querySubjects(): AsyncIterableIterator<{ id: Id64String; parentId?: Id64String; targetPartitionId?: Id64String; hideInHierarchy: boolean }> {
    const subjectsQuery = `
      SELECT
        s.ECInstanceId id,
        s.Parent.Id parentId,
        (
          SELECT m.ECInstanceId
          FROM bis.GeometricModel3d m
          WHERE m.ECInstanceId = HexToId(json_extract(s.JsonProperties, '$.Subject.Model.TargetPartition'))
            AND NOT m.IsPrivate
            AND EXISTS (SELECT 1 FROM ${this._hierarchyConfig.elementClassSpecification} WHERE Model.Id = m.ECInstanceId)
        ) targetPartitionId,
        CASE
          WHEN (
            json_extract(s.JsonProperties, '$.Subject.Job.Bridge') IS NOT NULL
            OR json_extract(s.JsonProperties, '$.Subject.Model.Type') = 'Hierarchy'
          ) THEN 1
          ELSE 0
        END hideInHierarchy
      FROM bis.Subject s
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
      WHERE
        NOT m.IsPrivate
        ${this._hierarchyConfig.showEmptyModels ? "" : `AND EXISTS (SELECT 1 FROM ${this._hierarchyConfig.elementClassSpecification} WHERE Model.Id = m.ECInstanceId)`}
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: modelsQuery }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { id: row.id, parentId: row.parentId };
    }
  }

  private async getSubjectInfos() {
    this._subjectInfos ??= (async () => {
      const [subjectInfos, targetPartitionSubjects] = await Promise.all([
        (async () => {
          const result = new Map<Id64String, SubjectInfo>();
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
          const result = new Map<Id64String, Set<Id64String>>();
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
  public async getParentSubjectIds(): Promise<Id64String[]> {
    this._parentSubjectIds ??= (async () => {
      const subjectInfos = await this.getSubjectInfos();
      const parentSubjectIds = new Set<Id64String>();
      subjectInfos.forEach((subjectInfo, subjectId) => {
        if (subjectInfo.childModels.size > 0) {
          parentSubjectIds.add(subjectId);
          let currParentId = subjectInfo.parentSubject;
          while (currParentId) {
            parentSubjectIds.add(currParentId);
            currParentId = subjectInfos.get(currParentId)?.parentSubject;
          }
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
  public async getChildSubjectIds(parentSubjectIds: Id64String[]): Promise<Id64String[]> {
    const childSubjectIds = new Array<Id64String>();
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

  /** Returns ECInstanceIDs of all Models under specific parent Subjects, including their child Subjects, etc. */
  public async getSubjectModelIds(subjectIds: Id64Array): Promise<Id64Array> {
    const subjectInfos = await this.getSubjectInfos();
    const subjectStack = [...subjectIds];
    const result = new Array<Id64String>();
    while (true) {
      const subjectId = subjectStack.pop();
      if (subjectId === undefined) {
        break;
      }
      const subjectInfo = subjectInfos.get(subjectId);
      if (!subjectInfo) {
        continue;
      }
      result.push(...subjectInfo.childModels);
      subjectStack.push(...subjectInfo.childSubjects);
    }
    return result;
  }

  /** Returns ECInstanceIDs of Models under specific parent Subjects as they are displayed in the hierarchy. */
  public async getChildSubjectModelIds(parentSubjectIds: Id64String[]): Promise<Id64String[]> {
    const subjectInfos = await this.getSubjectInfos();

    const hiddenSubjectIds = new Array<Id64String>();
    parentSubjectIds.forEach((subjectId) => {
      forEachChildSubject(subjectInfos, subjectId, (childSubjectId, childSubjectInfo) => {
        if (childSubjectInfo.hideInHierarchy) {
          hiddenSubjectIds.push(childSubjectId);
          return "continue";
        }
        return "break";
      });
    });

    const modelIds = new Array<Id64String>();
    [...parentSubjectIds, ...hiddenSubjectIds].forEach((subjectId) => {
      const subjectInfo = subjectInfos.get(subjectId);
      subjectInfo && modelIds.push(...subjectInfo.childModels);
    });
    return modelIds;
  }

  /**
   * Returns a list of Subject ancestor ECInstanceIds from root to target Subject as displayed in the
   * hierarchy  - taking into account `hideInHierarchy` flag.
   */
  public async getSubjectAncestorsPath(targetSubjectId: Id64String): Promise<Id64Array> {
    const subjectInfos = await this.getSubjectInfos();
    const result = new Array<Id64String>();
    let currParentId: Id64String | undefined = targetSubjectId;
    while (currParentId) {
      const parentInfo = subjectInfos.get(currParentId);
      if (!parentInfo?.hideInHierarchy) {
        result.push(currParentId);
      }
      currParentId = parentInfo?.parentSubject;
    }
    return result.reverse();
  }

  private async *queryModelElementCounts() {
    const query = /* sql */ `
      SELECT Model.Id modelId, COUNT(*) elementCount
      FROM ${this._hierarchyConfig.elementClassSpecification}
      GROUP BY Model.Id
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { modelId: row.modelId, elementCount: row.elementCount };
    }
  }

  private async *queryModelCategories() {
    const query = /* sql */ `
      SELECT Model.Id modelId, Category.Id categoryId
      FROM ${this._hierarchyConfig.elementClassSpecification}
      WHERE Parent.Id IS NULL
      GROUP BY modelId, categoryId
    `;
    for await (const row of this._queryExecutor.createQueryReader({ ecsql: query }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { modelId: row.modelId, categoryId: row.categoryId };
    }
  }

  private async getModelInfos() {
    this._modelInfos ??= (async () => {
      const modelInfos = new Map<Id64String, { categories: Id64Set; elementCount: number }>();
      await Promise.all([
        (async () => {
          for await (const { modelId, categoryId } of this.queryModelCategories()) {
            const entry = modelInfos.get(modelId);
            if (entry) {
              entry.categories.add(categoryId);
            } else {
              modelInfos.set(modelId, { categories: new Set([categoryId]), elementCount: 0 });
            }
          }
        })(),
        (async () => {
          for await (const { modelId, elementCount } of this.queryModelElementCounts()) {
            const entry = modelInfos.get(modelId);
            if (entry) {
              entry.elementCount = elementCount;
            } else {
              modelInfos.set(modelId, { categories: new Set(), elementCount });
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
    const categories = modelInfos.get(modelId)?.categories;
    return categories ? [...categories] : [];
  }

  public async getModelElementCount(modelId: Id64String): Promise<number> {
    const modelInfos = await this.getModelInfos();
    return modelInfos.get(modelId)?.elementCount ?? 0;
  }

  public async getModelSubjects(modelId: Id64String): Promise<Id64Array> {
    const result = new Array<Id64String>();
    const subjectInfos = await this.getSubjectInfos();
    subjectInfos.forEach((subjectInfo, subjectId) => {
      if (subjectInfo.childModels.has(modelId)) {
        result.push(subjectId);
      }
    });
    return result;
  }

  private async queryCategoryElementsCount(modelId: Id64String, categoryId: Id64String): Promise<number> {
    const reader = this._queryExecutor.createQueryReader(
      {
        ctes: [
          /* sql */ `
            CategoryElements(id) AS (
              SELECT ECInstanceId id
              FROM ${this._hierarchyConfig.elementClassSpecification}
              WHERE
                Model.Id = ?
                AND Category.Id = ?
                AND Parent.Id IS NULL

              UNION ALL

              SELECT c.ECInstanceId id
              FROM ${this._hierarchyConfig.elementClassSpecification} c
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

  public async getCategoryModels(categoryId: Id64String): Promise<Id64Array> {
    const result = new Set<Id64String>();
    const modelInfos = await this.getModelInfos();
    modelInfos?.forEach((modelInfo, modelId) => {
      if (modelInfo.categories.has(categoryId)) {
        result.add(modelId);
      }
    });
    return [...result];
  }
}

function forEachChildSubject(
  subjectInfos: Map<Id64String, SubjectInfo>,
  parentSubject: Id64String | SubjectInfo,
  cb: (childSubjectId: Id64String, childSubjectInfo: SubjectInfo) => "break" | "continue",
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
