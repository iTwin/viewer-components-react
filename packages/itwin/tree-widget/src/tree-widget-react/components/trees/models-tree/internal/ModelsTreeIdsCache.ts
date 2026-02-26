/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, filter, forkJoin, map, mergeAll, mergeMap, of, reduce, shareReplay, toArray } from "rxjs";
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
import { pushToMap } from "../../common/internal/Utils.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchyNodeIdentifiersPath, LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { BaseIdsCacheImplProps } from "../../common/internal/caches/BaseIdsCache.js";
import type { CategoryId, ModelId, SubjectId } from "../../common/internal/Types.js";

interface ModelsTreeIdsCacheProps extends BaseIdsCacheImplProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  showEmptyModels: boolean;
  hideRootSubject: boolean;
  elementClassName: string;
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
  #modelKeyPaths: Map<ModelId, Observable<HierarchyNodeIdentifiersPath[]>>;
  #subjectKeyPaths: Map<SubjectId, Observable<HierarchyNodeIdentifiersPath>>;
  #categoryKeyPaths: Map<CategoryId, Observable<HierarchyNodeIdentifiersPath[]>>;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #showEmptyModels: boolean;
  #hideRootSubject: boolean;
  #elementClassName: string;
  #componentId: GuidString;
  #componentName: string;

  constructor(props: ModelsTreeIdsCacheProps) {
    super(props);
    this.#queryExecutor = props.queryExecutor;
    this.#showEmptyModels = props.showEmptyModels;
    this.#hideRootSubject = props.hideRootSubject;
    this.#elementClassName = props.elementClassName;
    this.#componentId = Guid.createValue();
    this.#componentName = "ModelsTreeIdsCache";
    this.#modelKeyPaths = new Map();
    this.#subjectKeyPaths = new Map();
    this.#categoryKeyPaths = new Map();
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
    let entry = this.#subjectKeyPaths.get(targetSubjectId);
    if (!entry) {
      entry = this.getSubjectInfos().pipe(
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
        shareReplay(),
      );
      this.#subjectKeyPaths.set(targetSubjectId, entry);
    }
    return entry;
  }

  public createModelInstanceKeyPaths(modelId: Id64String): Observable<HierarchyNodeIdentifiersPath[]> {
    let entry = this.#modelKeyPaths.get(modelId);
    if (!entry) {
      entry = this.getSubjectInfos().pipe(
        mergeMap((subjectInfos) => subjectInfos.entries()),
        filter(([_, subjectInfo]) => subjectInfo.childModelIds.has(modelId)),
        mergeMap(([modelSubjectId]) =>
          this.createSubjectInstanceKeysPath(modelSubjectId).pipe(map((path) => [...path, { className: CLASS_NAME_GeometricModel3d, id: modelId }])),
        ),
        toArray(),
        shareReplay(),
      );

      this.#modelKeyPaths.set(modelId, entry);
    }
    return entry;
  }

  public createCategoryInstanceKeyPaths(categoryId: Id64String): Observable<HierarchyNodeIdentifiersPath[]> {
    let entry = this.#categoryKeyPaths.get(categoryId);
    if (!entry) {
      entry = this.getModels({ categoryId, includeSubModels: true, includeOnlyIfCategoryOfTopMostElement: true }).pipe(
        mergeAll(),
        mergeMap((categoryModelId) => this.createModelInstanceKeyPaths(categoryModelId)),
        mergeAll(),
        reduce((acc, modelPath) => {
          acc.push([...modelPath, { className: CLASS_NAME_SpatialCategory, id: categoryId }]);
          return acc;
        }, new Array<HierarchyNodeIdentifiersPath>()),
        shareReplay(),
      );
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
