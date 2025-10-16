/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { assert, Id64 } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import {
  CLASS_NAME_GeometricModel3d,
  CLASS_NAME_InformationPartitionElement,
  CLASS_NAME_SpatialCategory,
  CLASS_NAME_Subject,
} from "../../common/internal/ClassNameDefinitions.js";
import { pushToMap } from "../../common/internal/Utils.js";

import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchyNodeIdentifiersPath, LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { ITreeWidgetIdsCache, TreeWidgetIdsCache } from "../../common/internal/TreeWidgetIdsCache.js";
import type { CategoryId, ModelId, SubjectId } from "../../common/internal/Types.js";
import type { ModelsTreeDefinition } from "../ModelsTreeDefinition.js";

interface SubjectInfo {
  parentSubjectId: Id64String | undefined;
  hideInHierarchy: boolean;
  childSubjectIds: Id64Set;
  childModelIds: Id64Set;
}

type ModelsTreeHierarchyConfiguration = ConstructorParameters<typeof ModelsTreeDefinition>[0]["hierarchyConfig"];

/** @internal */
export class ModelsTreeIdsCache implements Disposable, ITreeWidgetIdsCache {
  #subjectInfos: Promise<Map<SubjectId, SubjectInfo>> | undefined;
  #parentSubjectIds: Promise<Id64Array> | undefined;
  #modelKeyPaths: Map<ModelId, Promise<HierarchyNodeIdentifiersPath[]>>;
  #subjectKeyPaths: Map<SubjectId, Promise<HierarchyNodeIdentifiersPath>>;
  #categoryKeyPaths: Map<CategoryId, Promise<HierarchyNodeIdentifiersPath[]>>;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #hierarchyConfig: ModelsTreeHierarchyConfiguration;
  #treeWidgetIdsCache: TreeWidgetIdsCache;
  #shouldDisposeTreeWidgetIdsCache = false;

  constructor(
    queryExecutor: LimitingECSqlQueryExecutor,
    hierarchyConfig: ModelsTreeHierarchyConfiguration,
    treeWidgetIdsCacheInfo: { cache: TreeWidgetIdsCache; shouldDispose: boolean },
  ) {
    this.#modelKeyPaths = new Map();
    this.#subjectKeyPaths = new Map();
    this.#categoryKeyPaths = new Map();
    this.#queryExecutor = queryExecutor;
    this.#hierarchyConfig = hierarchyConfig;
    this.#treeWidgetIdsCache = treeWidgetIdsCacheInfo.cache;
    this.#shouldDisposeTreeWidgetIdsCache = treeWidgetIdsCacheInfo.shouldDispose;
  }

  public [Symbol.dispose]() {
    if (this.#shouldDisposeTreeWidgetIdsCache) {
      this.#treeWidgetIdsCache[Symbol.dispose]();
    }
  }

  private async *querySubjects(): AsyncIterableIterator<{ id: SubjectId; parentId?: SubjectId; targetPartitionId?: ModelId; hideInHierarchy: boolean }> {
    const subjectsQuery = `
      SELECT
        s.ECInstanceId id,
        s.Parent.Id parentId,
        (
          SELECT m.ECInstanceId
          FROM ${CLASS_NAME_GeometricModel3d} m
          WHERE m.ECInstanceId = HexToId(json_extract(s.JsonProperties, '$.Subject.Model.TargetPartition'))
            AND NOT m.IsPrivate
            AND EXISTS (SELECT 1 FROM ${this.#hierarchyConfig.elementClassSpecification} WHERE Model.Id = m.ECInstanceId)
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
    for await (const row of this.#queryExecutor.createQueryReader({ ecsql: subjectsQuery }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { id: row.id, parentId: row.parentId, targetPartitionId: row.targetPartitionId, hideInHierarchy: !!row.hideInHierarchy };
    }
  }

  private async *queryModels(): AsyncIterableIterator<{ id: ModelId; parentId: SubjectId }> {
    const modelsQuery = `
      SELECT p.ECInstanceId id, p.Parent.Id parentId
      FROM ${CLASS_NAME_InformationPartitionElement} p
      INNER JOIN ${CLASS_NAME_GeometricModel3d} m ON m.ModeledElement.Id = p.ECInstanceId
      WHERE
        NOT m.IsPrivate
        ${this.#hierarchyConfig.showEmptyModels ? "" : `AND EXISTS (SELECT 1 FROM ${this.#hierarchyConfig.elementClassSpecification} WHERE Model.Id = m.ECInstanceId)`}
    `;
    for await (const row of this.#queryExecutor.createQueryReader({ ecsql: modelsQuery }, { rowFormat: "ECSqlPropertyNames", limit: "unbounded" })) {
      yield { id: row.id, parentId: row.parentId };
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
        if (subjectInfo.childModelIds.size > 0) {
          parentSubjectIds.add(subjectId);
          let currParentId = subjectInfo.parentSubjectId;
          while (currParentId) {
            parentSubjectIds.add(currParentId);
            currParentId = subjectInfos.get(currParentId)?.parentSubjectId;
          }
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
  public async getChildSubjectIds(parentSubjectIds: Id64Arg): Promise<Id64Array> {
    const childSubjectIds = new Array<SubjectId>();
    const subjectInfos = await this.getSubjectInfos();
    for (const subjectId of Id64.iterable(parentSubjectIds)) {
      forEachChildSubject(subjectInfos, subjectId, (childSubjectId, childSubjectInfo) => {
        if (!childSubjectInfo.hideInHierarchy) {
          childSubjectIds.push(childSubjectId);
          return "break";
        }
        return "continue";
      });
    }
    return childSubjectIds;
  }

  /** Returns ECInstanceIDs of all Models under specific parent Subjects, including their child Subjects, etc. */
  public async getSubjectModelIds(subjectIds: Id64Arg): Promise<Id64Array> {
    const subjectInfos = await this.getSubjectInfos();
    const result = new Array<ModelId>();
    const childSubjects = new Array<SubjectId>();
    for (const subjectId of Id64.iterable(subjectIds)) {
      const subjectInfo = subjectInfos.get(subjectId);
      if (!subjectInfo) {
        continue;
      }
      result.push(...subjectInfo.childModelIds);
      childSubjects.push(...subjectInfo.childSubjectIds);
    }
    if (childSubjects.length > 0) {
      result.push(...(await this.getSubjectModelIds(childSubjects)));
    }
    return result;
  }

  /** Returns ECInstanceIDs of Models under specific parent Subjects as they are displayed in the hierarchy. */
  public async getChildSubjectModelIds(parentSubjectIds: Id64Arg): Promise<Id64Array> {
    const subjectInfos = await this.getSubjectInfos();

    const hiddenSubjectIds = new Array<SubjectId>();

    for (const subjectId of Id64.iterable(parentSubjectIds)) {
      forEachChildSubject(subjectInfos, subjectId, (childSubjectId, childSubjectInfo) => {
        if (childSubjectInfo.hideInHierarchy) {
          hiddenSubjectIds.push(childSubjectId);
          return "continue";
        }
        return "break";
      });
    }

    const modelIds = new Array<ModelId>();
    [...parentSubjectIds, ...hiddenSubjectIds].forEach((subjectId) => {
      const subjectInfo = subjectInfos.get(subjectId);
      subjectInfo && modelIds.push(...subjectInfo.childModelIds);
    });
    return modelIds;
  }

  public async createSubjectInstanceKeysPath(targetSubjectId: Id64String): Promise<HierarchyNodeIdentifiersPath> {
    let entry = this.#subjectKeyPaths.get(targetSubjectId);
    if (!entry) {
      entry = (async () => {
        const subjectInfos = await this.getSubjectInfos();
        const result = new Array<InstanceKey>();
        let currParentId: SubjectId | undefined = targetSubjectId;
        while (currParentId) {
          if (this.#hierarchyConfig.hideRootSubject && currParentId === IModel.rootSubjectId) {
            break;
          }
          const parentInfo = subjectInfos.get(currParentId);
          if (!parentInfo?.hideInHierarchy) {
            result.push({ className: CLASS_NAME_Subject, id: currParentId });
          }
          currParentId = parentInfo?.parentSubjectId;
        }
        return result.reverse();
      })();
      this.#subjectKeyPaths.set(targetSubjectId, entry);
    }
    return entry;
  }

  public async createModelInstanceKeyPaths(modelId: Id64String): Promise<HierarchyNodeIdentifiersPath[]> {
    let entry = this.#modelKeyPaths.get(modelId);
    if (!entry) {
      entry = (async () => {
        const result = new Array<HierarchyNodeIdentifiersPath>();
        const subjectInfos = (await this.getSubjectInfos()).entries();
        for (const [modelSubjectId, subjectInfo] of subjectInfos) {
          if (subjectInfo.childModelIds.has(modelId)) {
            const subjectPath = await this.createSubjectInstanceKeysPath(modelSubjectId);
            result.push([...subjectPath, { className: "BisCore.GeometricModel3d", id: modelId }]);
          }
        }
        return result;
      })();

      this.#modelKeyPaths.set(modelId, entry);
    }
    return entry;
  }

  public getAllCategoriesThatContainElements() {
    return this.#treeWidgetIdsCache.getAllCategoriesThatContainElements();
  }

  public getCategories(props: Parameters<ITreeWidgetIdsCache["getCategories"]>[0]) {
    return this.#treeWidgetIdsCache.getCategories(props);
  }

  public hasSubModel(props: Parameters<ITreeWidgetIdsCache["hasSubModel"]>[0]) {
    return this.#treeWidgetIdsCache.hasSubModel(props);
  }

  public getElementsCount(props: Parameters<ITreeWidgetIdsCache["getElementsCount"]>[0]) {
    return this.#treeWidgetIdsCache.getElementsCount(props);
  }

  public getModels(props: Parameters<ITreeWidgetIdsCache["getModels"]>[0]) {
    return this.#treeWidgetIdsCache.getModels(props);
  }

  public getSubCategories(props: Parameters<ITreeWidgetIdsCache["getSubCategories"]>[0]) {
    return this.#treeWidgetIdsCache.getSubCategories(props);
  }

  public getSubModels(props: Parameters<ITreeWidgetIdsCache["getSubModels"]>[0]) {
    return this.#treeWidgetIdsCache.getSubModels(props);
  }

  public async createCategoryInstanceKeyPaths(categoryId: Id64String): Promise<HierarchyNodeIdentifiersPath[]> {
    let entry = this.#categoryKeyPaths.get(categoryId);
    if (!entry) {
      entry = (async () => {
        const categoryPaths = new Array<HierarchyNodeIdentifiersPath>();
        const { models } = await firstValueFrom(this.#treeWidgetIdsCache.getModels({ categoryIds: categoryId, type: "3d", onlyIfRootCategory: true }));
        if (!models) {
          return categoryPaths;
        }
        for (const categoryModelId of Id64.iterable(models)) {
          const modelPaths = await this.createModelInstanceKeyPaths(categoryModelId);
          for (const modelPath of modelPaths) {
            categoryPaths.push([...modelPath, { className: CLASS_NAME_SpatialCategory, id: categoryId }]);
          }
        }
        return categoryPaths;
      })();
      this.#categoryKeyPaths.set(categoryId, entry);
    }
    return entry;
  }
}

function forEachChildSubject(
  subjectInfos: Map<SubjectId, SubjectInfo>,
  parentSubject: SubjectId | SubjectInfo,
  cb: (childSubjectId: SubjectId, childSubjectInfo: SubjectInfo) => "break" | "continue",
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
