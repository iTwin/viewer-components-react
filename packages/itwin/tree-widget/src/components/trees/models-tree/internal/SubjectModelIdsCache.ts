/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { EMPTY, expand, from, last, map, mergeMap, reduce, shareReplay } from "rxjs";

import type { Id64String } from "@itwin/core-bentley";
import type { Observable } from "rxjs";
import type { IQueryHandler } from "./QueryHandler";

export interface SubjectModelIdsCache {
  getSubjectModelIdObs(subjectId: Id64String): Observable<Id64String>;
}

export function createSubjectModelIdsCache(queryProvider: IQueryHandler): SubjectModelIdsCache {
  const cachedState = queryProvider.queryAllSubjects().pipe(
    reduce(
      (acc, subject) => {
        if (subject.parentId) {
          pushToMap(acc.subjectsHierarchy, subject.parentId, subject.id);
        }

        if (subject.targetPartitionId) {
          pushToMap(acc.targetPartitionSubjects, subject.targetPartitionId, subject.id);
        }
        return acc;
      },
      { subjectsHierarchy: new Map<Id64String, Set<Id64String>>(), targetPartitionSubjects: new Map<Id64String, Set<Id64String>>() },
    ),
    mergeMap((state) =>
      queryProvider.queryAllModels().pipe(
        reduce(
          (acc, model) => {
            const subjectIds = acc.targetPartitionSubjects.get(model.id) ?? new Set();
            subjectIds.add(model.parentId);
            subjectIds.forEach((subjectId) => {
              pushToMap(acc.subjectModels, subjectId, model.id);
            });
            return acc;
          },
          { ...state, subjectModels: new Map<Id64String, Set<Id64String>>() },
        ),
      ),
    ),
    map(({ subjectModels, subjectsHierarchy }) => ({ subjectModels, subjectsHierarchy })),
    shareReplay(),
  );

  return {
    getSubjectModelIdObs(subjectId: Id64String) {
      return cachedState.pipe(
        map((state) => ({ ...state, modelIds: new Array<string>(), subjectId })),
        expand((state) => {
          const subjectModelIds = state.subjectModels.get(state.subjectId);
          subjectModelIds && state.modelIds.push(...subjectModelIds);

          const childSubjectIds = state.subjectsHierarchy.get(state.subjectId);
          return childSubjectIds ? from(childSubjectIds).pipe(map((cs) => ({ ...state, subjectId: cs }))) : EMPTY;
        }),
        last(),
        mergeMap(({ modelIds }) => modelIds),
      );
    },
  };
}

function pushToMap<TKey, TValue>(_map: Map<TKey, Set<TValue>>, key: TKey, value: TValue) {
  let set = _map.get(key);
  if (!set) {
    set = new Set();
    _map.set(key, set);
  }
  set.add(value);
}
