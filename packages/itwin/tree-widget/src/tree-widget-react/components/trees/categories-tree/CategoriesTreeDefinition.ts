/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defaultIfEmpty, EMPTY, firstValueFrom, from, fromEvent, identity, lastValueFrom, map, mergeMap, takeUntil, toArray } from "rxjs";
import { Guid } from "@itwin/core-bentley";
import { createNodesQueryClauseFactory, createPredicateBasedHierarchyDefinition } from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql } from "@itwin/presentation-shared";
import { FilterLimitExceededError } from "../common/TreeErrors.js";
import { getClassesByView } from "./internal/CategoriesTreeIdsCache.js";
import { DEFINITION_CONTAINER_CLASS, DEFINITION_ELEMENT_CLASS, SUB_CATEGORY_CLASS } from "./internal/ClassNameDefinitions.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64Array, Id64String } from "@itwin/core-bentley";
import type {
  DefineHierarchyLevelProps,
  DefineInstanceNodeChildHierarchyLevelProps,
  DefineRootHierarchyLevelProps,
  GenericInstanceFilter,
  HierarchyDefinition,
  HierarchyFilteringPath,
  HierarchyLevelDefinition,
  LimitingECSqlQueryExecutor,
  NodesQueryClauseFactory,
} from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector, ECSchemaProvider, IInstanceLabelSelectClauseFactory, InstanceKey } from "@itwin/presentation-shared";
import type { CategoriesTreeIdsCache } from "./internal/CategoriesTreeIdsCache.js";

const MAX_FILTERING_INSTANCE_KEY_COUNT = 100;

interface CategoriesTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  viewType: "2d" | "3d";
  idsCache: CategoriesTreeIdsCache;
  hierarchyConfig: CategoriesTreeHierarchyConfiguration;
}

interface CategoriesTreeInstanceKeyPathsFromInstanceLabelProps {
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  label: string;
  viewType: "2d" | "3d";
  limit?: number | "unbounded";
  idsCache: CategoriesTreeIdsCache;
  hierarchyConfig?: CategoriesTreeHierarchyConfiguration;
  abortSignal?: AbortSignal;
  componentId?: GuidString;
}

/**
 * Defines hierarchy configuration supported by `CategoriesTree`.
 * @beta
 */
export interface CategoriesTreeHierarchyConfiguration {
  /** Should categories without elements be shown. Defaults to `false`. */
  showEmptyCategories: boolean;
}

/** @internal */
export const defaultHierarchyConfiguration: CategoriesTreeHierarchyConfiguration = {
  showEmptyCategories: false,
};

/** @internal */
export class CategoriesTreeDefinition implements HierarchyDefinition {
  #impl: Promise<HierarchyDefinition> | undefined;
  #selectQueryFactory: NodesQueryClauseFactory;
  #nodeLabelSelectClauseFactory: IInstanceLabelSelectClauseFactory;
  #idsCache: CategoriesTreeIdsCache;
  #hierarchyConfig: CategoriesTreeHierarchyConfiguration;
  #viewType: "2d" | "3d";
  #iModelAccess: ECSchemaProvider & ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  static #componentName = "CategoriesTreeDefinition";

  public constructor(props: CategoriesTreeDefinitionProps) {
    this.#iModelAccess = props.imodelAccess;
    this.#viewType = props.viewType;
    this.#idsCache = props.idsCache;
    this.#nodeLabelSelectClauseFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
    this.#selectQueryFactory = createNodesQueryClauseFactory({
      imodelAccess: props.imodelAccess,
      instanceLabelSelectClauseFactory: this.#nodeLabelSelectClauseFactory,
    });
    this.#hierarchyConfig = props.hierarchyConfig;
  }

  private async getHierarchyDefinition(): Promise<HierarchyDefinition> {
    this.#impl ??= (async () => {
      const isDefinitionContainerSupported = await firstValueFrom(this.#idsCache.getIsDefinitionContainerSupported());
      return createPredicateBasedHierarchyDefinition({
        classHierarchyInspector: this.#iModelAccess,
        hierarchy: {
          rootNodes: async (requestProps: DefineRootHierarchyLevelProps) =>
            this.createDefinitionContainersAndCategoriesQuery({ ...requestProps, viewType: this.#viewType }),
          childNodes: [
            {
              parentInstancesNodePredicate: "BisCore.Category",
              definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createSubcategoryQuery(requestProps),
            },
            ...(isDefinitionContainerSupported
              ? [
                  {
                    parentInstancesNodePredicate: DEFINITION_CONTAINER_CLASS,
                    definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) =>
                      this.createDefinitionContainersAndCategoriesQuery({
                        ...requestProps,
                        viewType: this.#viewType,
                      }),
                  },
                ]
              : []),
          ],
        },
      });
    })();
    return this.#impl;
  }

  public async defineHierarchyLevel(props: DefineHierarchyLevelProps) {
    return (await this.getHierarchyDefinition()).defineHierarchyLevel(props);
  }

  private async createDefinitionContainersAndCategoriesQuery(props: {
    parentNodeInstanceIds?: Id64Array;
    instanceFilter?: GenericInstanceFilter;
    viewType: "2d" | "3d";
  }): Promise<HierarchyLevelDefinition> {
    const { parentNodeInstanceIds, instanceFilter, viewType } = props;
    const { definitionContainers, categories } = await firstValueFrom(
      parentNodeInstanceIds === undefined
        ? this.#idsCache.getRootDefinitionContainersAndCategories({ includeEmpty: this.#hierarchyConfig.showEmptyCategories })
        : this.#idsCache.getDirectChildDefinitionContainersAndCategories({
            parentDefinitionContainerIds: parentNodeInstanceIds,
            includeEmpty: this.#hierarchyConfig.showEmptyCategories,
          }),
    );

    if (categories.length === 0 && definitionContainers.length === 0) {
      return [];
    }

    const categoriesWithSingleChild = new Array<Id64String>();
    const categoriesWithMultipleChildren = new Array<Id64String>();
    categories.forEach((category) => {
      if (category.childCount > 1) {
        categoriesWithMultipleChildren.push(category.id);
      } else {
        categoriesWithSingleChild.push(category.id);
      }
    });
    const dataToDetermineHasChildren =
      categoriesWithSingleChild.length > categoriesWithMultipleChildren.length
        ? { ids: categoriesWithMultipleChildren, ifTrue: 1, ifFalse: 0 }
        : { ids: categoriesWithSingleChild, ifTrue: 0, ifFalse: 1 };

    const { categoryClass } = getClassesByView(viewType);

    const [categoriesInstanceFilterClauses, definitionContainersInstanceFilterClauses] = await Promise.all(
      [categoryClass, ...(definitionContainers.length > 0 ? [DEFINITION_CONTAINER_CLASS] : [])].map(async (className) =>
        this.#selectQueryFactory.createFilterClauses({
          filter: instanceFilter,
          contentClass: { fullName: className, alias: "this" },
        }),
      ),
    );

    const definitionContainersQuery =
      definitionContainers.length > 0
        ? `
          SELECT
            ${await this.#selectQueryFactory.createSelectClause({
              ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
              ecInstanceId: { selector: "this.ECInstanceId" },
              nodeLabel: {
                selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
                  classAlias: "this",
                  className: DEFINITION_CONTAINER_CLASS,
                }),
              },
              extendedData: {
                isDefinitionContainer: true,
                imageId: "icon-definition-container",
              },
              hasChildren: true,
              supportsFiltering: true,
            })}
          FROM
            ${definitionContainersInstanceFilterClauses.from} this
            ${definitionContainersInstanceFilterClauses.joins}
          WHERE
            this.ECInstanceId IN (${definitionContainers.join(", ")})
            ${definitionContainersInstanceFilterClauses.where ? `AND ${definitionContainersInstanceFilterClauses.where}` : ""}
        `
        : undefined;

    const categoriesQuery =
      categories.length > 0
        ? `
          SELECT
              ${await this.#selectQueryFactory.createSelectClause({
                ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: categoryClass,
                  }),
                },
                ...(dataToDetermineHasChildren.ids.length > 0
                  ? {
                      hasChildren: {
                        selector: `
                            IIF(this.ECInstanceId IN (${dataToDetermineHasChildren.ids.join(",")}),
                              ${dataToDetermineHasChildren.ifTrue},
                              ${dataToDetermineHasChildren.ifFalse}
                            )
                          `,
                      },
                    }
                  : { hasChildren: !!dataToDetermineHasChildren.ifFalse }),
                extendedData: {
                  description: { selector: "this.Description" },
                  isCategory: true,
                  imageId: "icon-layers",
                },
                supportsFiltering: true,
              })}
            FROM
              ${categoriesInstanceFilterClauses.from} this
              ${categoriesInstanceFilterClauses.joins}
            WHERE
              this.ECInstanceId IN (${categories.map((category) => category.id).join(", ")})
              ${categoriesInstanceFilterClauses.where ? `AND ${categoriesInstanceFilterClauses.where}` : ""}
        `
        : undefined;
    const queries = [categoriesQuery, definitionContainersQuery].filter((query) => query !== undefined);
    return [
      {
        fullClassName: DEFINITION_ELEMENT_CLASS,
        query: {
          ecsql: queries.join(" UNION ALL "),
        },
      },
    ];
  }

  private async createSubcategoryQuery({
    parentNodeInstanceIds: elementIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this.#selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: SUB_CATEGORY_CLASS, alias: "this" },
    });
    return [
      {
        fullClassName: SUB_CATEGORY_CLASS,
        query: {
          ecsql: `
            SELECT
              ${await this.#selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: SUB_CATEGORY_CLASS,
                  }),
                },
                extendedData: {
                  categoryId: { selector: "printf('0x%x', this.Parent.Id)" },
                  isSubCategory: true,
                  imageId: "icon-layers-isolate",
                },
                supportsFiltering: false,
              })}
            FROM ${instanceFilterClauses.from} this
            ${instanceFilterClauses.joins}
            WHERE
              NOT this.IsPrivate AND this.Parent.Id IN (${elementIds.map(() => "?").join(",")})
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
          bindings: elementIds.map((id) => ({ type: "id", value: id })),
        },
      },
    ];
  }

  public static async createInstanceKeyPaths(props: CategoriesTreeInstanceKeyPathsFromInstanceLabelProps): Promise<HierarchyFilteringPath[]> {
    const labelsFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
    const hierarchyConfig = props.hierarchyConfig ?? defaultHierarchyConfiguration;
    return createInstanceKeyPathsFromInstanceLabel({
      ...props,
      labelsFactory,
      cache: props.idsCache,
      componentId: props.componentId ?? Guid.createValue(),
      componentName: this.#componentName,
      hierarchyConfig,
    });
  }
}

async function createInstanceKeyPathsFromInstanceLabel(
  props: Omit<CategoriesTreeInstanceKeyPathsFromInstanceLabelProps, "componentId" | "hierarchyConfig"> & {
    labelsFactory: IInstanceLabelSelectClauseFactory;
    cache: CategoriesTreeIdsCache;
    componentName: string;
    componentId: GuidString;
    hierarchyConfig: CategoriesTreeHierarchyConfiguration;
  },
): Promise<HierarchyFilteringPath[]> {
  const { cache, abortSignal, label, viewType, labelsFactory, limit, imodelAccess, componentId, componentName } = props;
  const { categoryClass } = getClassesByView(viewType);

  const adjustedLabel = label.replace(/[%_\\]/g, "\\$&");

  const CATEGORIES_WITH_LABELS_CTE = "CategoriesWithLabels";
  const SUBCATEGORIES_WITH_LABELS_CTE = "SubCategoriesWithLabels";
  const DEFINITION_CONTAINERS_WITH_LABELS_CTE = "DefinitionContainersWithLabels";
  return lastValueFrom(
    cache
      .getAllDefinitionContainersAndCategories({
        includeEmpty: props.hierarchyConfig.showEmptyCategories,
      })
      .pipe(
        mergeMap(async ({ definitionContainers, categories }) => {
          if (categories.length === 0) {
            return undefined;
          }
          const [categoryLabelSelectClause, subCategoryLabelSelectClause, definitionContainerLabelSelectClause] = await Promise.all(
            [categoryClass, SUB_CATEGORY_CLASS, ...(definitionContainers.length > 0 ? [DEFINITION_CONTAINER_CLASS] : [])].map(async (className) =>
              labelsFactory.createSelectClause({ classAlias: "this", className }),
            ),
          );
          const ctes = [
            `${CATEGORIES_WITH_LABELS_CTE}(ClassName, ECInstanceId, ChildCount, DisplayLabel) AS (
                SELECT
                  'c',
                  this.ECInstanceId,
                  COUNT(sc.ECInstanceId),
                  ${categoryLabelSelectClause}
                FROM
                  ${categoryClass} this
                  JOIN ${SUB_CATEGORY_CLASS} sc ON sc.Parent.Id = this.ECInstanceId
                WHERE
                  this.ECInstanceId IN (${categories.join(", ")})
                  GROUP BY this.ECInstanceId
              )`,
            `${SUBCATEGORIES_WITH_LABELS_CTE}(ClassName, ECInstanceId, ParentId, DisplayLabel) AS (
                SELECT
                  'sc',
                  this.ECInstanceId,
                  this.Parent.Id,
                  ${subCategoryLabelSelectClause}
                FROM
                  ${SUB_CATEGORY_CLASS} this
                WHERE
                  NOT this.IsPrivate
                  AND this.Parent.Id IN (${categories.join(", ")})
              )`,
            ...(definitionContainers.length > 0
              ? [
                  `${DEFINITION_CONTAINERS_WITH_LABELS_CTE}(ClassName, ECInstanceId, DisplayLabel) AS (
                    SELECT
                      'dc',
                      this.ECInstanceId,
                      ${definitionContainerLabelSelectClause}
                    FROM
                      ${DEFINITION_CONTAINER_CLASS} this
                    WHERE
                      this.ECInstanceId IN (${definitionContainers.join(", ")})
                  )`,
                ]
              : []),
          ];
          const ecsql = `
            SELECT * FROM (
                SELECT
                  sc.ClassName AS ClassName,
                  sc.ECInstanceId AS ECInstanceId
                FROM
                  ${CATEGORIES_WITH_LABELS_CTE} c
                  JOIN ${SUBCATEGORIES_WITH_LABELS_CTE} sc ON sc.ParentId = c.ECInstanceId
                WHERE
                  c.ChildCount > 1
                  AND sc.DisplayLabel LIKE '%' || ? || '%' ESCAPE '\\'

                UNION ALL

                SELECT
                  c.ClassName AS ClassName,
                  c.ECInstanceId AS ECInstanceId
                FROM
                  ${CATEGORIES_WITH_LABELS_CTE} c
                WHERE
                  c.DisplayLabel LIKE '%' || ? || '%' ESCAPE '\\'

                ${
                  definitionContainers.length > 0
                    ? `
                      UNION ALL
                      SELECT
                        dc.ClassName AS ClassName,
                        dc.ECInstanceId AS ECInstanceId
                      FROM
                        ${DEFINITION_CONTAINERS_WITH_LABELS_CTE} dc
                      WHERE
                        dc.DisplayLabel LIKE '%' || ? || '%' ESCAPE '\\'
                    `
                    : ""
                }
            )
            ${limit === undefined ? `LIMIT ${MAX_FILTERING_INSTANCE_KEY_COUNT + 1}` : limit !== "unbounded" ? `LIMIT ${limit}` : ""}
          `;
          const bindings = [
            { type: "string" as const, value: adjustedLabel },
            { type: "string" as const, value: adjustedLabel },
            ...(definitionContainers.length > 0 ? [{ type: "string" as const, value: adjustedLabel }] : []),
          ];
          return { ctes, ecsql, bindings };
        }),
        mergeMap((queryProps) => {
          if (!queryProps) {
            return EMPTY;
          }
          return imodelAccess.createQueryReader(queryProps, { restartToken: `${componentName}/${componentId}/filter-by-label`, limit });
        }),
        map(
          (row): InstanceKey => ({
            className: row.ClassName === "c" ? categoryClass : row.ClassName === "sc" ? SUB_CATEGORY_CLASS : DEFINITION_CONTAINER_CLASS,
            id: row.ECInstanceId,
          }),
        ),
        toArray(),
        mergeMap((targetItems): Observable<HierarchyFilteringPath> => createInstanceKeyPathsFromTargetItems({ ...props, targetItems })),
        toArray(),
        abortSignal ? takeUntil(fromEvent(abortSignal, "abort")) : identity,
        defaultIfEmpty([]),
      ),
  );
}

function createInstanceKeyPathsFromTargetItems(
  props: Pick<CategoriesTreeInstanceKeyPathsFromInstanceLabelProps, "idsCache" | "limit" | "viewType"> & {
    targetItems: InstanceKey[];
  },
): Observable<HierarchyFilteringPath> {
  const { limit, targetItems, viewType, idsCache } = props;
  if (limit !== "unbounded" && targetItems.length > (limit ?? MAX_FILTERING_INSTANCE_KEY_COUNT)) {
    throw new FilterLimitExceededError(limit ?? MAX_FILTERING_INSTANCE_KEY_COUNT);
  }

  if (targetItems.length === 0) {
    return EMPTY;
  }

  const { categoryClass } = getClassesByView(viewType);
  return from(targetItems).pipe(
    mergeMap((targetItem) => {
      if (targetItem.className === SUB_CATEGORY_CLASS) {
        return idsCache.getInstanceKeyPaths({ subCategoryId: targetItem.id });
      }
      if (targetItem.className === categoryClass) {
        return idsCache.getInstanceKeyPaths({ categoryId: targetItem.id });
      }
      return idsCache.getInstanceKeyPaths({ definitionContainerId: targetItem.id });
    }),
    map((path) => {
      return { path, options: { autoExpand: true } };
    }),
  );
}
