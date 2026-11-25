/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, map, reduce, shareReplay, toArray } from "rxjs";
import { catchBeSQLiteInterrupts } from "../hooks/UseErrorState.js";
import { getClassesByPerspective } from "../Utils.js";

import type { Observable } from "rxjs";
import type { GuidString } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ModelId } from "../Types.js";

interface ModelsAndCategoriesProviderProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  componentId: GuidString;
  perspective: "2d" | "3d";
}

/** @internal */
export interface ModelInfo {
  id: ModelId;
  isPlanProjection: boolean;
}

/**
 * Provides and caches all models and categories of the given perspective.
 *
 * Unlike `SharedIdsProvider` model and category data, this doesn't look at elements, so the queries are cheap even on large iModels.
 * As a result, returned models and categories may not contain any elements.
 * @internal
 */
export class ModelsAndCategoriesProvider {
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  #componentName: string;
  #perspective: "2d" | "3d";
  #models: Observable<Array<ModelInfo>> | undefined;
  #categories: Observable<ReadonlySet<CategoryId>> | undefined;

  constructor(props: ModelsAndCategoriesProviderProps) {
    this.#queryExecutor = props.queryExecutor;
    this.#componentId = props.componentId;
    this.#perspective = props.perspective;
    this.#componentName = "ModelsAndCategoriesProvider";
  }

  /** Returns all non-private and non-template models of the perspective. */
  public getAllModels(): Observable<Array<ModelInfo>> {
    this.#models ??= defer(() => {
      const query = `
        SELECT
          this.ECInstanceId id,
          ${this.#perspective === "3d" ? "IIF(this.$->IsPlanProjection?, 1, 0)" : "0"} isPlanProjection
        FROM ${getClassesByPerspective(this.#perspective).modelClass} this
        WHERE NOT this.IsPrivate AND NOT this.IsTemplate
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: query },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/models` },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row): ModelInfo => ({ id: row.id, isPlanProjection: !!row.isPlanProjection })),
      toArray(),
      shareReplay(),
    );
    return this.#models;
  }

  /** Returns all categories of the perspective. */
  public getAllCategories(): Observable<ReadonlySet<CategoryId>> {
    this.#categories ??= defer(() => {
      const query = `
        SELECT this.ECInstanceId id
        FROM ${getClassesByPerspective(this.#perspective).categoryClass} this
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: query },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/categories` },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      reduce((acc, row) => acc.add(row.id), new Set<CategoryId>()),
      shareReplay(),
    );
    return this.#categories;
  }
}
