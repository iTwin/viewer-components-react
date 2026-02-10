/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, map, reduce, shareReplay } from "rxjs";
import { Guid } from "@itwin/core-bentley";
import { CLASS_NAME_SubCategory } from "../ClassNameDefinitions.js";
import { catchBeSQLiteInterrupts } from "../UseErrorState.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64String } from "@itwin/core-bentley";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { CategoryId, SubCategoryId } from "../Types.js";

interface SubCategoriesCacheProps {
  queryExecutor: LimitingECSqlQueryExecutor;
  componentId?: GuidString;
}

/** @internal */
export class SubCategoriesCache {
  #queryExecutor: LimitingECSqlQueryExecutor;
  #componentId: GuidString;
  #componentName: string;
  #subCategoriesInfo:
    | Observable<{ subCategoryCategories: Map<SubCategoryId, CategoryId>; categorySubCategories: Map<CategoryId, Array<SubCategoryId>> }>
    | undefined;

  constructor(props: SubCategoriesCacheProps) {
    this.#queryExecutor = props.queryExecutor;
    this.#componentId = props.componentId ?? Guid.createValue();
    this.#componentName = "SubCategoriesCache";
  }

  private querySubCategories(): Observable<{ id: SubCategoryId; parentId: CategoryId }> {
    return defer(() => {
      const ecsql = `
        SELECT
          sc.ECInstanceId id,
          sc.Parent.Id categoryId
        FROM
          ${CLASS_NAME_SubCategory} sc
        WHERE
          NOT sc.IsPrivate
      `;
      return this.#queryExecutor.createQueryReader(
        { ecsql },
        { rowFormat: "ECSqlPropertyNames", limit: "unbounded", restartToken: `${this.#componentName}/${this.#componentId}/sub-categories` },
      );
    }).pipe(
      catchBeSQLiteInterrupts,
      map((row) => {
        return { id: row.id, parentId: row.categoryId };
      }),
    );
  }

  public getSubCategoriesInfo() {
    this.#subCategoriesInfo ??= this.querySubCategories()
      .pipe(
        reduce(
          (acc, queriedSubCategory) => {
            acc.subCategoryCategories.set(queriedSubCategory.id, queriedSubCategory.parentId);
            const entry = acc.categorySubCategories.get(queriedSubCategory.parentId);
            if (entry) {
              entry.push(queriedSubCategory.id);
            } else {
              acc.categorySubCategories.set(queriedSubCategory.parentId, [queriedSubCategory.id]);
            }
            return acc;
          },
          { subCategoryCategories: new Map<SubCategoryId, CategoryId>(), categorySubCategories: new Map<CategoryId, Array<SubCategoryId>>() },
        ),
      )
      .pipe(shareReplay());
    return this.#subCategoriesInfo;
  }

  public getSubCategories(categoryId: Id64String): Observable<Array<SubCategoryId>> {
    return this.getSubCategoriesInfo().pipe(map(({ categorySubCategories }) => categorySubCategories.get(categoryId) ?? []));
  }
}
