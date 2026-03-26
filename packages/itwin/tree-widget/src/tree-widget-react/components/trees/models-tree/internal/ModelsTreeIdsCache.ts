/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, filter, forkJoin, from, map, merge, mergeAll, mergeMap, of, reduce, shareReplay } from "rxjs";
import { assert, Guid, Id64 } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import { BaseIdsCacheImpl } from "../../common/internal/caches/BaseIdsCache.js";
import {
  CLASS_NAME_GeometricModel3d,
  CLASS_NAME_InformationPartitionElement,
  CLASS_NAME_SpatialCategory,
  CLASS_NAME_Subject,
} from "../../common/internal/ClassNameDefinitions.js";
import { catchBeSQLiteInterrupts } from "../../common/internal/UseErrorState.js";
import { fromWithRelease, pushToMap } from "../../common/internal/Utils.js";
import { createGeometricElementInstanceKeyPaths } from "../ModelsTreeDefinition.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchyNodeIdentifiersPath, LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { EC, InstanceKey } from "@itwin/presentation-shared";
import type { BaseIdsCacheImplProps } from "../../common/internal/caches/BaseIdsCache.js";
import type { CategoryId, ModelId, SubjectId } from "../../common/internal/Types.js";
import type { ModelsTreeHierarchyConfiguration } from "../ModelsTreeDefinition.js";

/**
 * Hierarchy config props needed for ids cache.
 * @internal
 */
export type HierarchyConfigForModelsCache = Pick<ModelsTreeHierarchyConfiguration, "elementClassSpecification" | "hideRootSubject" | "showEmptyModels">;

interface ModelsTreeIdsCacheProps extends BaseIdsCacheImplProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  hierarchyConfig: HierarchyConfigForModelsCache;
}

interface SubjectInfo {
  parentSubjectId: Id64String | undefined;
  hideInHierarchy: boolean;
  childSubjectIds: Id64Set;
  childModelIds: Id64Set;
}

/** @internal */
export class ModelsTreeIdsCache extends BaseIdsCacheImpl {
  #subjectInfos: Observable<Map<SubjectId, SubjectInfo>> | undefined;
  #parentSubjectIds: Observable<Id64Array> | undefined; // the list should contain a subject id if its node should be shown as having children
  #queryExecutor: LimitingECSqlQueryExecutor;
  #showEmptyModels: boolean;
  #hideRootSubject: boolean;
  #elementClassName: EC.FullClassName;
  #componentId: GuidString;
  #componentName: string;

  constructor(props: ModelsTreeIdsCacheProps) {
    super(props);
    this.#queryExecutor = props.queryExecutor;
    this.#showEmptyModels = props.hierarchyConfig.showEmptyModels;
    this.#hideRootSubject = props.hierarchyConfig.hideRootSubject;
    this.#elementClassName = props.hierarchyConfig.elementClassSpecification;
    this.#componentId = Guid.createValue();
    this.#componentName = "ModelsTreeIdsCache";
  }

  private querySubjects(): Observable<{ id: SubjectId; parentId?: SubjectId; targetPartitionId?: ModelId; hideInHierarchy: boolean }> {
    return defer(() => {
      const subjectsQuery = `
        SELECT
          s.ECInstanceId id,
          s.Parent.Id parentId,
          (
            SELECT m.ECInstanceId
            FROM ${CLASS_NAME_GeometricModel3d} m
            WHERE m.ECInstanceId = HexToId(json_extract(s.JsonProperties, '$.Subject.Model.TargetPartition'))
              AND NOT m.IsPrivate
              AND EXISTS (SELECT 1 FROM ${this.#elementClassName} WHERE Model.Id = m.ECInstanceId)
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
      return this.#queryExecutor.createQueryReader(
        { ecsql: subjectsQuery },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/subjects` },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row) => {
        return { id: row.id, parentId: row.parentId, targetPartitionId: row.targetPartitionId, hideInHierarchy: !!row.hideInHierarchy };
      }),
    );
  }

  private queryModels(): Observable<{ id: ModelId; parentId: SubjectId }> {
    return defer(() => {
      const modelsQuery = `
        SELECT p.ECInstanceId id, p.Parent.Id parentId
        FROM ${CLASS_NAME_InformationPartitionElement} p
        INNER JOIN ${CLASS_NAME_GeometricModel3d} m ON m.ModeledElement.Id = p.ECInstanceId
        WHERE
          NOT m.IsPrivate
          ${this.#showEmptyModels ? "" : `AND EXISTS (SELECT 1 FROM ${this.#elementClassName} WHERE Model.Id = m.ECInstanceId)`}
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: modelsQuery },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/models` },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row) => {
        return { id: row.id, parentId: row.parentId };
      }),
    );
  }

  private getSubjectInfos() {
    this.#subjectInfos ??= forkJoin({
      subjectInfos: this.querySubjects().pipe(
        reduce((acc, subject) => {
          const subjectInfo: SubjectInfo = {
            parentSubjectId: subject.parentId,
            hideInHierarchy: subject.hideInHierarchy,
            childSubjectIds: new Set(),
            childModelIds: new Set(),
          };
          if (subject.targetPartitionId) {
            subjectInfo.childModelIds.add(subject.targetPartitionId);
          }
          acc.set(subject.id, subjectInfo);
          return acc;
        }, new Map<SubjectId, SubjectInfo>()),
        map((subjectInfos) => {
          for (const [subjectId, { parentSubjectId: parentSubjectId }] of subjectInfos) {
            if (parentSubjectId) {
              const parentSubjectInfo = subjectInfos.get(parentSubjectId);
              assert(!!parentSubjectInfo);
              parentSubjectInfo.childSubjectIds.add(subjectId);
            }
          }
          return subjectInfos;
        }),
      ),
      targetPartitionSubjects: this.queryModels().pipe(
        reduce((acc, model) => {
          pushToMap(acc, model.id, model.parentId);
          return acc;
        }, new Map<ModelId, Set<Id64String>>()),
      ),
    }).pipe(
      map(({ subjectInfos, targetPartitionSubjects }) => {
        for (const [partitionId, subjectIds] of targetPartitionSubjects) {
          for (const subjectId of subjectIds) {
            const subjectInfo = subjectInfos.get(subjectId);
            assert(!!subjectInfo);
            subjectInfo.childModelIds.add(partitionId);
          }
        }
        return subjectInfos;
      }),
      shareReplay(),
    );
    return this.#subjectInfos;
  }

  /** Returns ECInstanceIDs of Subjects that either have direct Model or at least one child Subject with a Model. */
  public getParentSubjectIds(): Observable<Id64Array> {
    this.#parentSubjectIds ??= this.getSubjectInfos().pipe(
      map((subjectInfos) => {
        const parentSubjectIds = new Set<SubjectId>();
        for (const [subjectId, subjectInfo] of subjectInfos) {
          if (subjectInfo.childModelIds.size > 0) {
            parentSubjectIds.add(subjectId);
            let currParentId = subjectInfo.parentSubjectId;
            while (currParentId) {
              parentSubjectIds.add(currParentId);
              currParentId = subjectInfos.get(currParentId)?.parentSubjectId;
            }
          }
        }
        return [...parentSubjectIds];
      }),
      shareReplay(),
    );
    return this.#parentSubjectIds;
  }

  /**
   * Returns child subjects of the specified parent subjects as they're displayed in the hierarchy - taking into
   * account `hideInHierarchy` flag.
   */
  public getChildSubjectIds(parentSubjectIds: Id64Arg): Observable<Id64Array> {
    return this.getSubjectInfos().pipe(
      map((subjectInfos) => {
        const childSubjectIds = new Array<SubjectId>();
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
      }),
    );
  }

  /** Returns ECInstanceIDs of all Models under specific parent Subjects, including their child Subjects, etc. */
  public getSubjectModelIds(subjectIds: Id64Arg): Observable<Id64Array> {
    return this.getSubjectInfos().pipe(
      mergeMap((subjectInfos) => {
        const result = new Array<ModelId>();
        const childSubjects = new Array<SubjectId>();
        for (const subjectId of Id64.iterable(subjectIds)) {
          const subjectInfo = subjectInfos.get(subjectId);
          if (!subjectInfo) {
            continue;
          }
          for (const modelId of subjectInfo.childModelIds) {
            result.push(modelId);
          }
          for (const childSubjectId of subjectInfo.childSubjectIds) {
            childSubjects.push(childSubjectId);
          }
        }
        if (childSubjects.length === 0) {
          return of(result);
        }
        return this.getSubjectModelIds(childSubjects).pipe(
          map((modelsOfChildSubjects) => {
            for (const modelId of modelsOfChildSubjects) {
              result.push(modelId);
            }
            return result;
          }),
        );
      }),
    );
  }

  /** Returns ECInstanceIDs of Models under specific parent Subjects as they are displayed in the hierarchy. */
  public getChildSubjectModelIds(parentSubjectIds: Id64Arg): Observable<Id64Array> {
    return this.getSubjectInfos().pipe(
      map((subjectInfos) => {
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
        const addModelsForExistingSubject = (subjectId: Id64String) => {
          const subjectInfo = subjectInfos.get(subjectId);
          if (!subjectInfo) {
            return;
          }
          for (const modelId of subjectInfo.childModelIds) {
            modelIds.push(modelId);
          }
        };
        for (const subjectId of Id64.iterable(parentSubjectIds)) {
          addModelsForExistingSubject(subjectId);
        }

        for (const subjectId of hiddenSubjectIds) {
          addModelsForExistingSubject(subjectId);
        }
        return modelIds;
      }),
    );
  }

  public createSubjectInstanceKeysPath(targetSubjectId: Id64String): Observable<HierarchyNodeIdentifiersPath> {
    return this.getSubjectInfos().pipe(
      map((subjectInfos) => {
        const result = new Array<InstanceKey>();
        let currParentId: SubjectId | undefined = targetSubjectId;
        while (currParentId) {
          if (this.#hideRootSubject && currParentId === IModel.rootSubjectId) {
            break;
          }
          const parentInfo = subjectInfos.get(currParentId);
          if (!parentInfo?.hideInHierarchy) {
            result.push({ className: CLASS_NAME_Subject, id: currParentId });
          }
          currParentId = parentInfo?.parentSubjectId;
        }
        return result.reverse();
      }),
    );
  }

  public createModelInstanceKeyPaths(modelId: Id64String): Observable<HierarchyNodeIdentifiersPath> {
    return this.getSubjectInfos().pipe(
      mergeMap((subjectInfos) => subjectInfos.entries()),
      filter(([_, subjectInfo]) => subjectInfo.childModelIds.has(modelId)),
      mergeMap(([modelSubjectId]) =>
        this.createSubjectInstanceKeysPath(modelSubjectId).pipe(map((path) => [...path, { className: CLASS_NAME_GeometricModel3d, id: modelId }])),
      ),
    );
  }

  public createCategoryInstanceKeyPaths({ categoryIds }: { categoryIds: Id64Array }): Observable<HierarchyNodeIdentifiersPath> {
    const pathsWithSubModels = fromWithRelease({ source: categoryIds, releaseOnCount: 200 }).pipe(
      mergeMap((id) => forkJoin({ id: of(id), subModels: this.getModels({ subModels: "only", categoryId: id, includeOnlyIfCategoryOfTopMostElement: true }) })),
      reduce((acc, { id, subModels }) => {
        for (const subModelId of subModels) {
          const entry = acc.get(subModelId);
          if (!entry) {
            acc.set(subModelId, new Set([id]));
            continue;
          }
          entry.add(id);
        }
        return acc;
      }, new Map<ModelId, Set<CategoryId>>()),
      mergeMap((subModelCategoriesMap) => {
        if (subModelCategoriesMap.size === 0) {
          return EMPTY;
        }
        return createGeometricElementInstanceKeyPaths({
          queryExecutor: this.#queryExecutor,
          idsCache: this,
          elementClassName: this.#elementClassName,
          targetItems: [...subModelCategoriesMap.keys()],
          componentId: Guid.createValue(),
          componentName: "ModelsTreeIdsCache-categoryInstanceKeyPaths",
          chunkIndex: -1,
        }).pipe(
          map((normalizedPath) => {
            const categories = subModelCategoriesMap.get(normalizedPath.path[normalizedPath.path.length - 1].id);
            const paths = new Array<HierarchyNodeIdentifiersPath>();
            for (const categoryId of categories ?? []) {
              // Paths for modeled elements are created, but category is under sub-model, so need to
              // add sub-model and category to the path.
              paths.push([
                ...normalizedPath.path,
                { className: CLASS_NAME_GeometricModel3d, id: normalizedPath.path[normalizedPath.path.length - 1].id },
                { className: CLASS_NAME_SpatialCategory, id: categoryId },
              ]);
            }
            return paths;
          }),
          mergeAll(),
        );
      }),
    );
    const pathsWithoutSubModels = from(categoryIds).pipe(
      mergeMap((categoryId) =>
        this.getModels({ categoryId, subModels: "exclude", includeOnlyIfCategoryOfTopMostElement: true }).pipe(
          mergeAll(),
          mergeMap((categoryModelId) => this.createModelInstanceKeyPaths(categoryModelId)),
          map((modelPath) => [...modelPath, { className: CLASS_NAME_SpatialCategory, id: categoryId }]),
        ),
      ),
    );
    return merge(pathsWithSubModels, pathsWithoutSubModels);
  }
}

function forEachChildSubject(
  subjectInfos: Map<SubjectId, SubjectInfo>,
  parentSubject: SubjectId | SubjectInfo,
  cb: (childSubjectId: SubjectId, childSubjectInfo: SubjectInfo) => "break" | "continue",
) {
  const parentSubjectInfo = typeof parentSubject === "string" ? subjectInfos.get(parentSubject) : parentSubject;
  if (!parentSubjectInfo) {
    return;
  }
  for (const childSubjectId of parentSubjectInfo.childSubjectIds) {
    const childSubjectInfo = subjectInfos.get(childSubjectId)!;
    if (cb(childSubjectId, childSubjectInfo) === "break") {
      continue;
    }
    forEachChildSubject(subjectInfos, childSubjectInfo, cb);
  }
}
