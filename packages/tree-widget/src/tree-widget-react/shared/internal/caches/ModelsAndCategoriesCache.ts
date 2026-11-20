/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, map, reduce, shareReplay, toArray } from "rxjs";
import { catchBeSQLiteInterrupts } from "../hooks/UseErrorState.js";
import { getClassesByView } from "../Utils.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Set } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, ModelId } from "../Types.js";

interface ModelsAndCategoriesCacheProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  componentId: GuidString;
  type: "2d" | "3d";
}

/** @internal */
export interface ModelInfo {
  id: ModelId;
  isPlanProjection: boolean;
}

/**
 * Caches all models and categories of the given view type.
 *
 * Unlike `ElementModelCategoriesCache`, this cache doesn't look at elements, so the queries are cheap even on large iModels.
 * As a result, returned models and categories may not contain any elements.
 * @internal
 */
export class ModelsAndCategoriesCache {
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  #componentName: string;
  #type: "2d" | "3d";
  #models: Observable<Array<ModelInfo>> | undefined;
  #categories: Observable<Id64Set> | undefined;

  constructor(props: ModelsAndCategoriesCacheProps) {
    this.#queryExecutor = props.queryExecutor;
    this.#componentId = props.componentId;
    this.#type = props.type;
    this.#componentName = "ModelsAndCategoriesCache";
  }

  /** Returns all non-private and non-template models of the view type. */
  public getAllModelsOfViewType(): Observable<Array<ModelInfo>> {
    this.#models ??= defer(() => {
      const query = `
        SELECT
          this.ECInstanceId id,
          ${this.#type === "3d" ? "IIF(this.$->IsPlanProjection?, 1, 0)" : "0"} isPlanProjection
        FROM ${getClassesByView(this.#type).modelClass} this
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

  /** Returns all categories of the view type. */
  public getAllCategoriesOfViewType(): Observable<Id64Set> {
    this.#categories ??= defer(() => {
      const query = `
        SELECT this.ECInstanceId id
        FROM ${getClassesByView(this.#type).categoryClass} this
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
