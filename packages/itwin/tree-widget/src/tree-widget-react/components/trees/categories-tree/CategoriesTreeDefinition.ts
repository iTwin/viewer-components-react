/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, from, lastValueFrom, map, mergeMap, toArray } from "rxjs";
import { createNodesQueryClauseFactory, createPredicateBasedHierarchyDefinition } from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql } from "@itwin/presentation-shared";
import { FilterLimitExceededError } from "../common/TreeErrors.js";
import { getClassesByView } from "./internal/CategoriesTreeIdsCache.js";
import { DEFINITION_CONTAINER_CLASS, DEFINITION_ELEMENT_CLASS, SUB_CATEGORY_CLASS } from "./internal/ClassNameDefinitions.js";

import type { Observable } from "rxjs";
import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { ECClassHierarchyInspector, ECSchemaProvider, IInstanceLabelSelectClauseFactory, InstanceKey } from "@itwin/presentation-shared";
import type { CategoriesTreeIdsCache } from "./internal/CategoriesTreeIdsCache.js";
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

const MAX_FILTERING_INSTANCE_KEY_COUNT = 100;

interface CategoriesTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  viewType: "2d" | "3d";
  idsCache: CategoriesTreeIdsCache;
}

interface CategoriesTreeInstanceKeyPathsFromInstanceLabelProps {
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  label: string;
  viewType: "2d" | "3d";
  limit?: number | "unbounded";
  idsCache: CategoriesTreeIdsCache;
}

export class CategoriesTreeDefinition implements HierarchyDefinition {
  private _impl: Promise<HierarchyDefinition> | undefined;
  private _selectQueryFactory: NodesQueryClauseFactory;
  private _nodeLabelSelectClauseFactory: IInstanceLabelSelectClauseFactory;
  private _idsCache: CategoriesTreeIdsCache;
  private _viewType: "2d" | "3d";
  private _iModelAccess: ECSchemaProvider & ECClassHierarchyInspector & LimitingECSqlQueryExecutor;

  public constructor(props: CategoriesTreeDefinitionProps) {
    this._iModelAccess = props.imodelAccess;
    this._viewType = props.viewType;
    this._idsCache = props.idsCache;
    this._nodeLabelSelectClauseFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
    this._selectQueryFactory = createNodesQueryClauseFactory({
      imodelAccess: props.imodelAccess,
      instanceLabelSelectClauseFactory: this._nodeLabelSelectClauseFactory,
    });
  }

  private async getHierarchyDefinition(): Promise<HierarchyDefinition> {
    this._impl ??= (async () => {
      const isDefinitionContainerSupported = await this._idsCache.getIsDefinitionContainerSupported();
      return createPredicateBasedHierarchyDefinition({
        classHierarchyInspector: this._iModelAccess,
        hierarchy: {
          rootNodes: async (requestProps: DefineRootHierarchyLevelProps) =>
            this.createDefinitionContainersAndCategoriesQuery({ ...requestProps, viewType: this._viewType }),
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
                        viewType: this._viewType,
                      }),
                  },
                ]
              : []),
          ],
        },
      });
    })();
    return this._impl;
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
    const { definitionContainers, categories } =
      parentNodeInstanceIds === undefined
        ? await this._idsCache.getRootDefinitionContainersAndCategories()
        : await this._idsCache.getDirectChildDefinitionContainersAndCategories(parentNodeInstanceIds);
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
        this._selectQueryFactory.createFilterClauses({
          filter: instanceFilter,
          contentClass: { fullName: className, alias: "this" },
        }),
      ),
    );

    const definitionContainersQuery =
      definitionContainers.length > 0
        ? `
          SELECT
            ${await this._selectQueryFactory.createSelectClause({
              ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
              ecInstanceId: { selector: "this.ECInstanceId" },
              nodeLabel: {
                selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
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
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
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
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: SUB_CATEGORY_CLASS, alias: "this" },
    });
    return [
      {
        fullClassName: SUB_CATEGORY_CLASS,
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
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
    return createInstanceKeyPathsFromInstanceLabel({ ...props, labelsFactory, cache: props.idsCache });
  }
}

async function createInstanceKeyPathsFromInstanceLabel(
  props: CategoriesTreeInstanceKeyPathsFromInstanceLabelProps & { labelsFactory: IInstanceLabelSelectClauseFactory; cache: CategoriesTreeIdsCache },
): Promise<HierarchyFilteringPath[]> {
  const { definitionContainers, categories } = await props.cache.getAllDefinitionContainersAndCategories();
  if (categories.length === 0) {
    return [];
  }

  const { categoryClass } = getClassesByView(props.viewType);
  const adjustedLabel = props.label.replace(/[%_\\]/g, "\\$&");

  const CATEGORIES_WITH_LABELS_CTE = "CategoriesWithLabels";
  const SUBCATEGORIES_WITH_LABELS_CTE = "SubCategoriesWithLabels";
  const DEFINITION_CONTAINERS_WITH_LABELS_CTE = "DefinitionContainersWithLabels";
  const [categoryLabelSelectClause, subCategoryLabelSelectClause, definitionContainerLabelSelectClause] = await Promise.all(
    [categoryClass, SUB_CATEGORY_CLASS, ...(definitionContainers.length > 0 ? [DEFINITION_CONTAINER_CLASS] : [])].map(async (className) =>
      props.labelsFactory.createSelectClause({ classAlias: "this", className }),
    ),
  );
  return lastValueFrom(
    defer(() => {
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
        ${props.limit === undefined ? `LIMIT ${MAX_FILTERING_INSTANCE_KEY_COUNT + 1}` : props.limit !== "unbounded" ? `LIMIT ${props.limit}` : ""}
      `;
      const bindings = [
        { type: "string" as const, value: adjustedLabel },
        { type: "string" as const, value: adjustedLabel },
        ...(definitionContainers.length > 0 ? [{ type: "string" as const, value: adjustedLabel }] : []),
      ];
      return props.imodelAccess.createQueryReader(
        { ctes, ecsql, bindings },
        { restartToken: "tree-widget/categories-tree/filter-by-label-query", limit: props.limit },
      );
    }).pipe(
      map(
        (row): InstanceKey => ({
          className: row.ClassName === "c" ? categoryClass : row.ClassName === "sc" ? SUB_CATEGORY_CLASS : DEFINITION_CONTAINER_CLASS,
          id: row.ECInstanceId,
        }),
      ),
      toArray(),
      mergeMap((targetItems): Observable<HierarchyFilteringPath> => createInstanceKeyPathsFromTargetItems({ ...props, targetItems })),
      toArray(),
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
    mergeMap(async (targetItem) => {
      if (targetItem.className === SUB_CATEGORY_CLASS) {
        return { path: await idsCache.getInstanceKeyPaths({ subCategoryId: targetItem.id }), options: { autoExpand: true } };
      }
      if (targetItem.className === categoryClass) {
        return { path: await idsCache.getInstanceKeyPaths({ categoryId: targetItem.id }), options: { autoExpand: true } };
      }
      return { path: await idsCache.getInstanceKeyPaths({ definitionContainerId: targetItem.id }), options: { autoExpand: true } };
    }),
  );
}
