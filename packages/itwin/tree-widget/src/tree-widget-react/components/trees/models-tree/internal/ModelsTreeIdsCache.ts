/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, filter, forkJoin, map, mergeMap, of, reduce, shareReplay } from "rxjs";
import { assert, Guid, Id64 } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import { BaseIdsCacheImpl } from "../../common/internal/caches/BaseIdsCache.js";
import { CLASS_NAME_GeometricModel3d, CLASS_NAME_InformationPartitionElement, CLASS_NAME_Subject } from "../../common/internal/ClassNameDefinitions.js";
import { catchBeSQLiteInterrupts } from "../../common/internal/UseErrorState.js";
import { createWhereClause, getOrCreate } from "../../common/internal/Utils.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchyNodeIdentifiersPath, LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { EC, InstanceKey } from "@itwin/presentation-shared";
import type { BaseIdsCacheImplProps } from "../../common/internal/caches/BaseIdsCache.js";
import type { ModelId, SubjectId } from "../../common/internal/Types.js";
import type { ModelsTreeHierarchyConfiguration } from "../ModelsTreeDefinition.js";

/**
 * Hierarchy config props needed for ids cache.
 * @internal
 */
export type HierarchyConfigForModelsCache = Pick<
  ModelsTreeHierarchyConfiguration,
  "elementClassSpecification" | "hideRootSubject" | "showEmptyModels" | "omittedElementClassNames"
>;

interface ModelsTreeIdsCacheProps extends BaseIdsCacheImplProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  hierarchyConfig: HierarchyConfigForModelsCache;
}

interface SubjectInfo {
  parentSubjectId: Id64String | undefined;
  hideInHierarchy: boolean;
  childSubjectIds: Id64Set;
  childModelIds: Id64Set;
  childModelsWithElementsFromNonOmittedClasses: Id64Set;
  hasElementsFromNonOmittedClasses: boolean;
}

/** @internal */
export class ModelsTreeIdsCache extends BaseIdsCacheImpl {
  #subjectInfos: Observable<Map<SubjectId, SubjectInfo>> | undefined;
  #upToModelInstanceKeyPaths: Map<ModelId, Observable<HierarchyNodeIdentifiersPath>> = new Map();
  #parentSubjectIds: Observable<Id64Array> | undefined; // the list should contain a subject id if its node should be shown as having children
  #parentSubjectIdsWithoutOmittedChildren: Observable<Id64Array> | undefined;
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
            ${createWhereClause({
              conditions: [
                "m.ECInstanceId = HexToId(json_extract(s.JsonProperties, '$.Subject.Model.TargetPartition'))",
                "NOT m.IsPrivate",
                `EXISTS (SELECT 1 FROM ${this.#elementClassName} WHERE Model.Id = m.ECInstanceId)`,
              ],
            })}
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
        SELECT
          p.ECInstanceId id,
          p.Parent.Id parentId
        FROM ${CLASS_NAME_InformationPartitionElement} p
        INNER JOIN ${CLASS_NAME_GeometricModel3d} m ON m.ModeledElement.Id = p.ECInstanceId
        ${createWhereClause({ conditions: ["NOT m.IsPrivate", !this.#showEmptyModels && `EXISTS (SELECT 1 FROM ${this.#elementClassName} WHERE Model.Id = m.ECInstanceId)`] })}
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
    this.#subjectInfos ??= this.getModelsContainingNonOmittedElements().pipe(
      mergeMap((modelsContainingTopMostNonOmittedElements) =>
        forkJoin({
          subjectInfos: this.querySubjects().pipe(
            reduce((acc, subject) => {
              const subjectInfo: SubjectInfo = {
                parentSubjectId: subject.parentId,
                hideInHierarchy: subject.hideInHierarchy,
                childSubjectIds: new Set(),
                childModelIds: new Set(),
                childModelsWithElementsFromNonOmittedClasses: new Set(),
                hasElementsFromNonOmittedClasses: false,
              };
              if (subject.targetPartitionId) {
                subjectInfo.childModelIds.add(subject.targetPartitionId);
                if (modelsContainingTopMostNonOmittedElements.has(subject.targetPartitionId)) {
                  subjectInfo.hasElementsFromNonOmittedClasses = true;
                  subjectInfo.childModelsWithElementsFromNonOmittedClasses.add(subject.targetPartitionId);
                }
              }
              acc.set(subject.id, subjectInfo);
              return acc;
            }, new Map<SubjectId, SubjectInfo>()),
            map((subjectInfos) => {
              for (const [subjectId, { parentSubjectId: parentSubjectId, hasElementsFromNonOmittedClasses }] of subjectInfos) {
                if (parentSubjectId) {
                  const parentSubjectInfo = subjectInfos.get(parentSubjectId);
                  assert(!!parentSubjectInfo);
                  parentSubjectInfo.childSubjectIds.add(subjectId);
                  if (hasElementsFromNonOmittedClasses) {
                    this.setHasElementsFromNonOmittedClasses({ subjectId: parentSubjectId, subjectInfos });
                  }
                }
              }
              return subjectInfos;
            }),
          ),
          modelInfos: this.queryModels().pipe(
            reduce((acc, model) => {
              const entry = getOrCreate({
                map: acc,
                key: model.id,
                createFunc: () => ({
                  subjects: new Set<SubjectId>(),
                  hasElementsFromNonOmittedClasses: modelsContainingTopMostNonOmittedElements.has(model.id),
                }),
              });
              entry.subjects.add(model.parentId);
              return acc;
            }, new Map<ModelId, { subjects: Set<SubjectId>; hasElementsFromNonOmittedClasses: boolean }>()),
          ),
        }),
      ),
      map(({ subjectInfos, modelInfos }) => {
        for (const [modelId, { subjects, hasElementsFromNonOmittedClasses }] of modelInfos) {
          for (const subjectId of subjects) {
            const subjectInfo = subjectInfos.get(subjectId);
            assert(!!subjectInfo);
            subjectInfo.childModelIds.add(modelId);
            if (hasElementsFromNonOmittedClasses) {
              subjectInfo.childModelsWithElementsFromNonOmittedClasses.add(modelId);
              this.setHasElementsFromNonOmittedClasses({ subjectId, subjectInfos });
            }
          }
        }
        return subjectInfos;
      }),
      shareReplay(),
    );
    return this.#subjectInfos;
  }

  private setHasElementsFromNonOmittedClasses({ subjectId, subjectInfos }: { subjectId: SubjectId; subjectInfos: Map<SubjectId, SubjectInfo> }) {
    const subjectInfo = subjectInfos.get(subjectId);
    assert(!!subjectInfo);
    if (subjectInfo.hasElementsFromNonOmittedClasses) {
      return;
    }
    subjectInfo.hasElementsFromNonOmittedClasses = true;
    if (subjectInfo.parentSubjectId) {
      this.setHasElementsFromNonOmittedClasses({ subjectId: subjectInfo.parentSubjectId, subjectInfos });
    }
  }

  /** Returns ECInstanceIDs of Subjects that either have direct Model or at least one child Subject with a Model. */
  public getParentSubjectIds(props?: { excludeIfOnlyOmittedClasses?: boolean }): Observable<Id64Array> {
    const { excludeIfOnlyOmittedClasses } = props ?? {};
    if (excludeIfOnlyOmittedClasses) {
      this.#parentSubjectIdsWithoutOmittedChildren ??= this.getSubjectInfos().pipe(
        map((subjectInfos) => this.createParentSubjectIds({ excludeIfOnlyOmittedClasses, subjectInfos })),
        shareReplay(),
      );
      return this.#parentSubjectIdsWithoutOmittedChildren;
    }
    this.#parentSubjectIds ??= this.getSubjectInfos().pipe(
      map((subjectInfos) => this.createParentSubjectIds({ excludeIfOnlyOmittedClasses, subjectInfos })),
      shareReplay(),
    );
    return this.#parentSubjectIds;
  }

  private createParentSubjectIds({
    excludeIfOnlyOmittedClasses,
    subjectInfos,
  }: {
    excludeIfOnlyOmittedClasses?: boolean;
    subjectInfos: Map<SubjectId, SubjectInfo>;
  }): Id64Array {
    const parentSubjectIds = new Set<SubjectId>();
    for (const [subjectId, subjectInfo] of subjectInfos) {
      if ((excludeIfOnlyOmittedClasses ? subjectInfo.childModelsWithElementsFromNonOmittedClasses : subjectInfo.childModelIds).size > 0) {
        parentSubjectIds.add(subjectId);
        let currParentId = subjectInfo.parentSubjectId;
        while (currParentId) {
          parentSubjectIds.add(currParentId);
          currParentId = subjectInfos.get(currParentId)?.parentSubjectId;
        }
      }
    }
    return [...parentSubjectIds];
  }

  /**
   * Returns child subjects of the specified parent subjects as they're displayed in the hierarchy - taking into
   * account `hideInHierarchy` flag.
   */
  public getChildSubjectIds({
    parentSubjectIds,
    excludeIfOnlyOmittedClasses,
  }: {
    parentSubjectIds: Id64Arg;
    excludeIfOnlyOmittedClasses?: boolean;
  }): Observable<Id64Array> {
    return this.getSubjectInfos().pipe(
      map((subjectInfos) => {
        const childSubjectIds = new Array<SubjectId>();
        for (const subjectId of Id64.iterable(parentSubjectIds)) {
          forEachChildSubject(subjectInfos, subjectId, (childSubjectId, childSubjectInfo) => {
            if (excludeIfOnlyOmittedClasses && !childSubjectInfo.hasElementsFromNonOmittedClasses) {
              return "break";
            }
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
  public getChildSubjectModelIds({
    parentSubjectIds,
    excludeIfOnlyOmittedClasses,
  }: {
    parentSubjectIds: Id64Arg;
    excludeIfOnlyOmittedClasses: boolean;
  }): Observable<Id64Array> {
    return this.getSubjectInfos().pipe(
      map((subjectInfos) => {
        const hiddenSubjectIds = new Array<SubjectId>();
        for (const subjectId of Id64.iterable(parentSubjectIds)) {
          forEachChildSubject(subjectInfos, subjectId, (childSubjectId, childSubjectInfo) => {
            if (excludeIfOnlyOmittedClasses && !childSubjectInfo.hasElementsFromNonOmittedClasses) {
              return "break";
            }
            if (childSubjectInfo.hideInHierarchy) {
              hiddenSubjectIds.push(childSubjectId);
              return "continue";
            }
            return "break";
          });
        }
        const modelIds = new Array<ModelId>();

        for (const subjectId of Id64.iterable(parentSubjectIds)) {
          this.addModelsFromExistingSubject({ subjectId, subjectInfos, modelIds, excludeIfOnlyOmittedClasses });
        }

        for (const subjectId of hiddenSubjectIds) {
          this.addModelsFromExistingSubject({ subjectId, subjectInfos, modelIds, excludeIfOnlyOmittedClasses });
        }
        return modelIds;
      }),
    );
  }
  private addModelsFromExistingSubject({
    subjectId,
    subjectInfos,
    modelIds,
    excludeIfOnlyOmittedClasses,
  }: {
    subjectId: Id64String;
    subjectInfos: Map<SubjectId, SubjectInfo>;
    modelIds: ModelId[];
    excludeIfOnlyOmittedClasses?: boolean;
  }) {
    const subjectInfo = subjectInfos.get(subjectId);
    if (!subjectInfo) {
      return;
    }
    for (const modelId of excludeIfOnlyOmittedClasses ? subjectInfo.childModelsWithElementsFromNonOmittedClasses : subjectInfo.childModelIds) {
      modelIds.push(modelId);
    }
  }

  public createSubjectInstanceKeysPath({
    targetSubjectId,
    excludeIfOnlyOmittedClasses,
  }: {
    targetSubjectId: Id64String;
    excludeIfOnlyOmittedClasses?: boolean;
  }): Observable<HierarchyNodeIdentifiersPath> {
    return this.getSubjectInfos().pipe(
      map((subjectInfos) => {
        const result = new Array<InstanceKey>();
        let currParentId: SubjectId | undefined = targetSubjectId;
        while (currParentId) {
          if (this.#hideRootSubject && currParentId === IModel.rootSubjectId) {
            break;
          }
          const parentInfo = subjectInfos.get(currParentId);
          if (excludeIfOnlyOmittedClasses && !parentInfo?.hasElementsFromNonOmittedClasses) {
            break;
          }
          if (!parentInfo?.hideInHierarchy) {
            result.push({ className: CLASS_NAME_Subject, id: currParentId });
          }
          currParentId = parentInfo?.parentSubjectId;
        }
        return result.reverse();
      }),
    );
  }

  public createUpToModelInstanceKeyPaths({
    modelId,
    excludeIfOnlyOmittedClasses,
  }: {
    modelId: Id64String;
    excludeIfOnlyOmittedClasses?: boolean;
  }): Observable<HierarchyNodeIdentifiersPath> {
    return getOrCreate({
      map: this.#upToModelInstanceKeyPaths,
      key: modelId,
      createFunc: () =>
        this.getSubjectInfos().pipe(
          mergeMap((subjectInfos) => subjectInfos.entries()),
          filter(([_, subjectInfo]) =>
            excludeIfOnlyOmittedClasses ? subjectInfo.childModelsWithElementsFromNonOmittedClasses.has(modelId) : subjectInfo.childModelIds.has(modelId),
          ),
          mergeMap(([modelSubjectId]) => this.createSubjectInstanceKeysPath({ targetSubjectId: modelSubjectId, excludeIfOnlyOmittedClasses })),
          shareReplay(),
        ),
    });
  }

  public getSearchPathsUpToRootCategory({ categoryId }: { categoryId: Id64String }): Observable<HierarchyNodeIdentifiersPath> {
    return this.getModels({ categoryId, excludeSubModels: true, includeOnlyTopMostElementCategory: true, excludeIfOnlyOmittedClasses: true }).pipe(
      mergeMap((categoryModelId) =>
        this.createUpToModelInstanceKeyPaths({ modelId: categoryModelId, excludeIfOnlyOmittedClasses: true }).pipe(
          map((modelPath) => [...modelPath, { className: CLASS_NAME_GeometricModel3d, id: categoryModelId }]),
        ),
      ),
    );
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
