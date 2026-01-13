/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, filter, forkJoin, from, map, mergeAll, mergeMap, of, reduce, shareReplay, toArray } from "rxjs";
import { assert, Guid, Id64 } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import {
  CLASS_NAME_GeometricModel3d,
  CLASS_NAME_InformationPartitionElement,
  CLASS_NAME_Model,
  CLASS_NAME_SpatialCategory,
  CLASS_NAME_SubCategory,
  CLASS_NAME_Subject,
} from "../../common/internal/ClassNameDefinitions.js";
import { ModelCategoryElementsCountCache } from "../../common/internal/ModelCategoryElementsCountCache.js";
import { catchBeSQLiteInterrupts } from "../../common/internal/UseErrorState.js";
import { pushToMap } from "../../common/internal/Utils.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchyNodeIdentifiersPath, LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId, SubCategoryId, SubjectId } from "../../common/internal/Types.js";
import type { ModelsTreeDefinition } from "../ModelsTreeDefinition.js";

interface SubjectInfo {
  parentSubjectId: Id64String | undefined;
  hideInHierarchy: boolean;
  childSubjectIds: Id64Set;
  childModelIds: Id64Set;
}

interface ModelInfo {
  isModelPrivate: boolean;
  categories: Map<CategoryId, { isRootElementCategory: boolean }>;
}

type ModelsTreeHierarchyConfiguration = ConstructorParameters<typeof ModelsTreeDefinition>[0]["hierarchyConfig"];

/** @internal */
export class ModelsTreeIdsCache implements Disposable {
  readonly #categoryElementCounts: ModelCategoryElementsCountCache;
  #categorySubCategories: Observable<Map<CategoryId, Array<SubCategoryId>>> | undefined;
  #subjectInfos: Observable<Map<SubjectId, SubjectInfo>> | undefined;
  #parentSubjectIds: Observable<Id64Array> | undefined; // the list should contain a subject id if its node should be shown as having children
  #modelInfos: Observable<Map<ModelId, ModelInfo>> | undefined;
  #modelWithCategoryModeledElements: Observable<Map<ModelId, Map<CategoryId, Set<ElementId>>>> | undefined;
  #modelKeyPaths: Map<ModelId, Observable<HierarchyNodeIdentifiersPath[]>>;
  #subjectKeyPaths: Map<SubjectId, Observable<HierarchyNodeIdentifiersPath>>;
  #categoryKeyPaths: Map<CategoryId, Observable<HierarchyNodeIdentifiersPath[]>>;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #hierarchyConfig: ModelsTreeHierarchyConfiguration;
  #componentId: GuidString;
  #componentName: string;

  constructor(queryExecutor: LimitingECSqlQueryExecutor, hierarchyConfig: ModelsTreeHierarchyConfiguration, componentId?: GuidString) {
    this.#queryExecutor = queryExecutor;
    this.#hierarchyConfig = hierarchyConfig;
    this.#componentId = componentId ?? Guid.createValue();
    this.#componentName = "ModelsTreeIdsCache";
    this.#categoryElementCounts = new ModelCategoryElementsCountCache(
      this.#queryExecutor,
      [this.#hierarchyConfig.elementClassSpecification],
      this.#componentId,
    );
    this.#modelKeyPaths = new Map();
    this.#subjectKeyPaths = new Map();
    this.#categoryKeyPaths = new Map();
  }

  public [Symbol.dispose]() {
    this.#categoryElementCounts[Symbol.dispose]();
  }

  private querySubCategories(): Observable<{ id: SubCategoryId; parentId: CategoryId }> {
    return defer(() => {
      const definitionsQuery = `
        SELECT
          sc.ECInstanceId id,
          sc.Parent.Id categoryId
        FROM
          ${CLASS_NAME_SubCategory} sc
        WHERE
          NOT sc.IsPrivate
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: definitionsQuery },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/visible-sub-categories` },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row) => {
        return { id: row.id, parentId: row.categoryId };
      }),
    );
  }
  private getSubCategoriesInfo() {
    this.#categorySubCategories ??= this.querySubCategories()
      .pipe(
        reduce((acc, queriedSubCategory) => {
          const entry = acc.get(queriedSubCategory.parentId);
          if (entry) {
            entry.push(queriedSubCategory.id);
          } else {
            acc.set(queriedSubCategory.parentId, [queriedSubCategory.id]);
          }
          return acc;
        }, new Map<CategoryId, Array<SubCategoryId>>()),
      )
      .pipe(shareReplay());
    return this.#categorySubCategories;
  }

  public getSubCategories(categoryId: Id64String): Observable<Array<SubCategoryId>> {
    return this.getSubCategoriesInfo().pipe(map((categorySubCategories) => categorySubCategories.get(categoryId) ?? []));
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
          ${this.#hierarchyConfig.showEmptyModels ? "" : `AND EXISTS (SELECT 1 FROM ${this.#hierarchyConfig.elementClassSpecification} WHERE Model.Id = m.ECInstanceId)`}
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
          for (const [subjectId, { parentSubjectId: parentSubjectId }] of subjectInfos.entries()) {
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
          subjectIds.forEach((subjectId) => {
            const subjectInfo = subjectInfos.get(subjectId);
            assert(!!subjectInfo);
            subjectInfo.childModelIds.add(partitionId);
          });
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
          result.push(...subjectInfo.childModelIds);
          childSubjects.push(...subjectInfo.childSubjectIds);
        }
        if (childSubjects.length === 0) {
          return of(result);
        }
        return this.getSubjectModelIds(childSubjects).pipe(
          map((modelsOfChildSubjects) => {
            result.push(...modelsOfChildSubjects);
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
        [...parentSubjectIds, ...hiddenSubjectIds].forEach((subjectId) => {
          const subjectInfo = subjectInfos.get(subjectId);
          subjectInfo && modelIds.push(...subjectInfo.childModelIds);
        });
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
        }),
        shareReplay(),
      );
      this.#subjectKeyPaths.set(targetSubjectId, entry);
    }
    return entry;
  }

  private queryModelCategories(): Observable<{
    modelId: Id64String;
    categoryId: Id64String;
    isModelPrivate: boolean;
    isRootElementCategory: boolean;
  }> {
    return defer(() => {
      const query = `
        SELECT
          this.Model.Id modelId,
          this.Category.Id categoryId,
          m.IsPrivate isModelPrivate,
          MAX(IIF(this.Parent.Id IS NULL, 1, 0)) isRootElementCategory
        FROM ${CLASS_NAME_Model} m
        JOIN ${this.#hierarchyConfig.elementClassSpecification} this ON m.ECInstanceId = this.Model.Id
        GROUP BY modelId, categoryId, isModelPrivate
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: query },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/model-categories` },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row) => {
        return { modelId: row.modelId, categoryId: row.categoryId, isModelPrivate: !!row.isModelPrivate, isRootElementCategory: !!row.isRootElementCategory };
      }),
    );
  }

  private queryModeledElements(): Observable<{ modelId: Id64String; categoryId: Id64String; modeledElementId: Id64String }> {
    return defer(() => {
      const query = `
      SELECT
        pe.ECInstanceId modeledElementId,
        pe.Category.Id categoryId,
        pe.Model.Id modelId
      FROM ${CLASS_NAME_Model} m
      JOIN ${this.#hierarchyConfig.elementClassSpecification} pe ON pe.ECInstanceId = m.ModeledElement.Id
      WHERE
        m.IsPrivate = false
        AND m.ECInstanceId IN (SELECT Model.Id FROM ${this.#hierarchyConfig.elementClassSpecification})
    `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: query },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/modeled-elements` },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row) => {
        return { modelId: row.modelId, categoryId: row.categoryId, modeledElementId: row.modeledElementId };
      }),
    );
  }

  private getModelWithCategoryModeledElements() {
    this.#modelWithCategoryModeledElements ??= this.queryModeledElements().pipe(
      reduce((acc, { modelId, categoryId, modeledElementId }) => {
        let modelEntry = acc.get(modelId);
        if (!modelEntry) {
          modelEntry = new Map();
          acc.set(modelId, modelEntry);
        }
        const categoryEntry = modelEntry.get(categoryId);
        if (!categoryEntry) {
          modelEntry.set(categoryId, new Set([modeledElementId]));
        } else {
          categoryEntry.add(modeledElementId);
        }
        return acc;
      }, new Map<ModelId, Map<CategoryId, Set<ElementId>>>()),
      shareReplay(),
    );
    return this.#modelWithCategoryModeledElements;
  }

  private getModelInfos() {
    this.#modelInfos ??= this.queryModelCategories().pipe(
      reduce((acc, { modelId, categoryId, isModelPrivate, isRootElementCategory }) => {
        const entry = acc.get(modelId);
        if (entry) {
          entry.categories.set(categoryId, { isRootElementCategory });
          entry.isModelPrivate = isModelPrivate;
        } else {
          acc.set(modelId, { categories: new Map([[categoryId, { isRootElementCategory }]]), isModelPrivate });
        }
        return acc;
      }, new Map<ModelId, { categories: Map<CategoryId, { isRootElementCategory: boolean }>; isModelPrivate: boolean }>()),
      shareReplay(),
    );
    return this.#modelInfos;
  }

  public getAllCategories(): Observable<Id64Set> {
    return this.getModelInfos().pipe(
      mergeMap((modelInfos) => modelInfos.values()),
      mergeMap(({ categories }) => categories.keys()),
      reduce((acc, categoryId) => {
        acc.add(categoryId);
        return acc;
      }, new Set<Id64String>()),
    );
  }

  public getModelCategoryIds(modelId: Id64String): Observable<Id64Array> {
    return this.getModelInfos().pipe(
      mergeMap((modelInfos) => modelInfos.get(modelId)?.categories.keys() ?? []),
      toArray(),
    );
  }

  public hasSubModel(elementId: Id64String): Observable<boolean> {
    return this.getModelInfos().pipe(
      map((modelInfos) => {
        const modeledElementInfo = modelInfos.get(elementId);
        if (!modeledElementInfo) {
          return false;
        }
        return !modeledElementInfo.isModelPrivate;
      }),
    );
  }

  public getCategoriesModeledElements(modelId: Id64String, categoryIds: Id64Arg): Observable<Id64Array> {
    return this.getModelWithCategoryModeledElements().pipe(
      mergeMap((modelWithCategoryModeledElements) => {
        const result = new Array<ElementId>();
        const categoryMap = modelWithCategoryModeledElements.get(modelId);
        if (!categoryMap) {
          return of(result);
        }
        return from(Id64.iterable(categoryIds)).pipe(
          map((categoryId) => categoryMap.get(categoryId)),
          mergeMap((elementsSet) => (elementsSet ? from(elementsSet) : EMPTY)),
          toArray(),
        );
      }),
    );
  }

  public getCategoriesElementModels(categoryIds: Id64Arg): Observable<{ id: CategoryId; models: Array<ModelId> | undefined }> {
    return this.getModelInfos().pipe(
      mergeMap((modelInfos) =>
        from(Id64.iterable(categoryIds)).pipe(
          map((categoryId) => {
            const categoryModels = new Array<ModelId>();
            modelInfos.forEach(({ categories }, modelId) => {
              if (categories.has(categoryId)) {
                categoryModels.push(modelId);
              }
            });
            return { id: categoryId, models: categoryModels.length > 0 ? categoryModels : undefined };
          }),
        ),
      ),
    );
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

  public getCategoryElementsCount(modelId: Id64String, categoryId: Id64String): Observable<number> {
    return this.#categoryElementCounts.getCategoryElementsCount(modelId, categoryId);
  }

  public createCategoryInstanceKeyPaths(categoryId: Id64String): Observable<HierarchyNodeIdentifiersPath[]> {
    let entry = this.#categoryKeyPaths.get(categoryId);
    if (!entry) {
      entry = this.getModelInfos().pipe(
        mergeMap((modelInfos) => modelInfos.entries()),
        reduce((acc, [modelId, modelInfo]) => {
          const categoryEntry = modelInfo.categories.get(categoryId);
          if (categoryEntry?.isRootElementCategory) {
            acc.add(modelId);
          }
          return acc;
        }, new Set<ModelId>()),
        mergeMap((categoryModels) => from(categoryModels)),
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
  parentSubjectInfo &&
    parentSubjectInfo.childSubjectIds.forEach((childSubjectId) => {
      const childSubjectInfo = subjectInfos.get(childSubjectId)!;
      if (cb(childSubjectId, childSubjectInfo) === "break") {
        return;
      }
      forEachChildSubject(subjectInfos, childSubjectInfo, cb);
    });
}
