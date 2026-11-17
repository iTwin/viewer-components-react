/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { forkJoin, map, mergeMap, of } from "rxjs";
import { createModelsTreeIdsProvider as createTreeDefinitionsModelsTreeIdsProvider } from "@itwin/presentation-tree-definitions";
import { toObservable } from "../../../shared/internal/Rxjs.js";
import { extendObject } from "../../../shared/internal/Utils.js";

import type { Observable } from "rxjs";
import type { Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { ECSchemaProvider } from "@itwin/presentation-shared";
import type { ModelsTreeIdsProvider as TreeDefinitionsModelsTreeIdsProvider } from "@itwin/presentation-tree-definitions";
import type { SharedIdsProvider } from "../../../shared/internal/idsProviders/SharedIdsProvider.js";
import type { ModelId } from "../../../shared/internal/Types.js";
import type { RequiredModelsTreeHierarchyConfiguration } from "../ModelsTreeDefinition.js";

type ReadonlyId64Arg = Id64String | ReadonlyArray<Id64String> | ReadonlySet<Id64String>;

/**
 * Provides subject and model IDs and search paths for models tree hierarchy, as well as additional data required by tree widget.
 * @internal
 */
export interface ModelsTreeIdsProvider extends TreeDefinitionsModelsTreeIdsProvider {
  /** Returns IDs of all models under the given subjects, including models of their child subjects. */
  getSubjectModelIds(subjectIds: ReadonlyId64Arg): Observable<ModelId[]>;
}

/**
 * Creates models tree ids provider, which uses data of the given `SharedIdsProvider`.
 * @internal
 */
export function createModelsTreeIdsProvider(props: {
  imodelAccess: ECSchemaProvider & LimitingECSqlQueryExecutor;
  hierarchyConfig: Pick<RequiredModelsTreeHierarchyConfiguration, "elements" | "subjects" | "models">;
  sharedIdsProvider: SharedIdsProvider;
}): ModelsTreeIdsProvider {
  const treeDefinitionsIdsProvider = createTreeDefinitionsModelsTreeIdsProvider({
    imodelAccess: props.imodelAccess,
    hierarchyConfig: props.hierarchyConfig,
    sharedIdsProvider: props.sharedIdsProvider,
  });

  function getSubjectModelIds(subjectIds: ReadonlyId64Arg): Observable<ModelId[]> {
    return forkJoin({
      // includes models of the given subjects and their hidden child subjects
      modelIds: toObservable(treeDefinitionsIdsProvider.getChildSubjectModelIds(subjectIds)),
      // includes the closest visible child subjects
      childSubjectIds: toObservable(treeDefinitionsIdsProvider.getChildSubjectIds(subjectIds)),
    }).pipe(
      mergeMap(({ modelIds, childSubjectIds }) => {
        if (childSubjectIds.length === 0) {
          return of([...modelIds]);
        }
        return getSubjectModelIds(childSubjectIds).pipe(map((childModelIds) => [...modelIds, ...childModelIds]));
      }),
    );
  }

  return extendObject({ base: treeDefinitionsIdsProvider, extension: { getSubjectModelIds } });
}
