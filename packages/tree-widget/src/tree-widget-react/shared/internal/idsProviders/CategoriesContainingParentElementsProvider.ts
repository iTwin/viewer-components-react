/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, map, reduce, shareReplay } from "rxjs";
import { CLASS_NAMES } from "../ClassNameDefinitions.js";
import { catchBeSQLiteInterrupts } from "../hooks/UseErrorState.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId } from "../Types.js";

interface CategoriesContainingParentElementsProviderProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  componentId: GuidString;
  elementClassName: string;
}

/**
 * Provides categories that contain elements, which have child elements.
 * @internal
 */
export class CategoriesContainingParentElementsProvider {
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  #componentName: string;
  #elementClassName: string;
  #categoriesContainingParentElements: Observable<Set<CategoryId>> | undefined;

  constructor(props: CategoriesContainingParentElementsProviderProps) {
    this.#queryExecutor = props.queryExecutor;
    this.#componentId = props.componentId;
    this.#elementClassName = props.elementClassName;
    this.#componentName = "CategoriesContainingParentElementsProvider";
  }

  private queryCategoriesContainingParentElements(): Observable<CategoryId> {
    return defer(() => {
      // Child elements are read from `BisCore.Element` and filtered by class, so that their geometry rows aren't loaded.
      const query = `
        SELECT DISTINCT p.Category.Id categoryId
        FROM ${CLASS_NAMES.Element} ce
        JOIN ${this.#elementClassName} p ON p.ECInstanceId = ce.Parent.Id
        JOIN ${CLASS_NAMES.Model} m ON m.ECInstanceId = p.Model.Id
        WHERE ce.ECClassId IS (${this.#elementClassName}) AND m.IsPrivate = false AND m.IsTemplate = false
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql: query },
        {
          rowFormat: "ECSqlPropertyNames",
          limit: "unbounded",
          restartToken: `${this.#componentName}/${this.#componentId}/categories-containing-parent-elements`,
        },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row): CategoryId => row.categoryId),
    );
  }

  /** Returns categories that contain elements, which have child elements. */
  public getCategoriesContainingParentElements(): Observable<Set<CategoryId>> {
    this.#categoriesContainingParentElements ??= this.queryCategoriesContainingParentElements().pipe(
      reduce((acc, categoryId) => acc.add(categoryId), new Set<CategoryId>()),
      shareReplay(),
    );
    return this.#categoriesContainingParentElements;
  }

  /** Returns whether the specified category contains elements that have child elements. */
  public categoryHasParentElements({ categoryId }: { categoryId: Id64String }): Observable<boolean> {
    return this.getCategoriesContainingParentElements().pipe(map((categoriesContainingParentElements) => categoriesContainingParentElements.has(categoryId)));
  }
}
