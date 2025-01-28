/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createNodesQueryClauseFactory, createPredicateBasedHierarchyDefinition } from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql } from "@itwin/presentation-shared";
import { FilterLimitExceededError } from "../common/TreeErrors.js";

import type { ECClassHierarchyInspector, ECSchemaProvider, IInstanceLabelSelectClauseFactory } from "@itwin/presentation-shared";
import type {
  DefineHierarchyLevelProps,
  DefineInstanceNodeChildHierarchyLevelProps,
  DefineRootHierarchyLevelProps,
  HierarchyDefinition,
  HierarchyFilteringPath,
  HierarchyLevelDefinition,
  LimitingECSqlQueryExecutor,
  NodesQueryClauseFactory,
} from "@itwin/presentation-hierarchies";

const MAX_FILTERING_INSTANCE_KEY_COUNT = 100;

interface CategoriesTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & ECClassHierarchyInspector;
  viewType: "2d" | "3d";
}

interface CategoriesTreeInstanceKeyPathsFromInstanceLabelProps {
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  label: string;
  viewType: "2d" | "3d";
}

export class CategoriesTreeDefinition implements HierarchyDefinition {
  private _impl: HierarchyDefinition;
  private _selectQueryFactory: NodesQueryClauseFactory;
  private _nodeLabelSelectClauseFactory: IInstanceLabelSelectClauseFactory;

  public constructor(props: CategoriesTreeDefinitionProps) {
    this._impl = createPredicateBasedHierarchyDefinition({
      classHierarchyInspector: props.imodelAccess,
      hierarchy: {
        rootNodes: async (requestProps) => this.createRootHierarchyLevelDefinition({ ...requestProps, viewType: props.viewType }),
        childNodes: [
          {
            parentInstancesNodePredicate: "BisCore.Category",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createSubcategoryQuery(requestProps),
          },
        ],
      },
    });
    this._nodeLabelSelectClauseFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
    this._selectQueryFactory = createNodesQueryClauseFactory({
      imodelAccess: props.imodelAccess,
      instanceLabelSelectClauseFactory: this._nodeLabelSelectClauseFactory,
    });
  }

  public async defineHierarchyLevel(props: DefineHierarchyLevelProps) {
    return this._impl.defineHierarchyLevel(props);
  }

  private async createRootHierarchyLevelDefinition(props: DefineRootHierarchyLevelProps & { viewType: "2d" | "3d" }): Promise<HierarchyLevelDefinition> {
    const { categoryClass, categoryElementClass } = getClassesByView(props.viewType);
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: props.instanceFilter,
      contentClass: { fullName: categoryClass, alias: "this" },
    });
    return [
      {
        fullClassName: categoryClass,
        query: {
          ecsql: `
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
                hasChildren: {
                  selector: `
                    IFNULL((
                      SELECT 1
                      FROM (
                        SELECT COUNT(1) AS ChildCount
                        FROM BisCore.SubCategory sc
                        WHERE sc.Parent.Id = this.ECInstanceId
                      )
                      WHERE ChildCount > 1
                    ), 0)
                  `,
                },
                extendedData: {
                  description: { selector: "this.Description" },
                },
                supportsFiltering: true,
              })}
            FROM ${instanceFilterClauses.from} this
            ${instanceFilterClauses.joins}
            JOIN BisCore.Model m ON m.ECInstanceId = this.Model.Id
            WHERE
              NOT this.IsPrivate
              AND (NOT m.IsPrivate OR m.ECClassId IS (BisCore.DictionaryModel))
              AND EXISTS (SELECT 1 FROM ${categoryElementClass} e WHERE e.Category.Id = this.ECInstanceId)
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
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
      contentClass: { fullName: "BisCore.SubCategory", alias: "this" },
    });
    return [
      {
        fullClassName: "BisCore.SubCategory",
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: "BisCore.SubCategory",
                  }),
                },
                extendedData: {
                  categoryId: { selector: "printf('0x%x', this.Parent.Id)" },
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

  public static async createInstanceKeyPaths(props: CategoriesTreeInstanceKeyPathsFromInstanceLabelProps) {
    const labelsFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
    return createInstanceKeyPathsFromInstanceLabel({ ...props, labelsFactory });
  }
}

function getClassesByView(viewType: "2d" | "3d") {
  return viewType === "2d"
    ? { categoryClass: "BisCore.DrawingCategory", categoryElementClass: "BisCore:GeometricElement2d" }
    : { categoryClass: "BisCore.SpatialCategory", categoryElementClass: "BisCore:GeometricElement3d" };
}

async function createInstanceKeyPathsFromInstanceLabel(
  props: CategoriesTreeInstanceKeyPathsFromInstanceLabelProps & { labelsFactory: IInstanceLabelSelectClauseFactory },
) {
  const { categoryClass, categoryElementClass } = getClassesByView(props.viewType);
  const adjustedLabel = props.label.replace(/[%_\\]/g, "\\$&");
  const reader = props.imodelAccess.createQueryReader(
    {
      ctes: [
        `RootCategoriesWithLabels(ClassName, ECInstanceId, ChildCount, DisplayLabel) as (
          SELECT
            ec_classname(this.ECClassId, 's.c'),
            this.ECInstanceId,
            COUNT(sc.ECInstanceId),
            ${await props.labelsFactory.createSelectClause({
              classAlias: "this",
              className: categoryClass,
            })}
          FROM ${categoryClass} this
          JOIN BisCore.Model m ON m.ECInstanceId = this.Model.Id
          JOIN BisCore.SubCategory sc ON sc.Parent.Id = this.ECInstanceId
          WHERE
            NOT this.IsPrivate
            AND (NOT m.IsPrivate OR m.ECClassId IS (BisCore.DictionaryModel))
            AND EXISTS (SELECT 1 FROM ${categoryElementClass} e WHERE e.Category.Id = this.ECInstanceId)
          GROUP BY this.ECInstanceId
        )`,
        `SubCategoriesWithLabels(ClassName, ECInstanceId, ParentId, DisplayLabel) as (
          SELECT
            ec_classname(this.ECClassId, 's.c'),
            this.ECInstanceId,
            this.Parent.Id,
            ${await props.labelsFactory.createSelectClause({
              classAlias: "this",
              className: "BisCore.SubCategory",
            })}
          FROM BisCore.SubCategory this
          WHERE NOT this.IsPrivate
        )`,
      ],
      ecsql: `
      SELECT * FROM (
        SELECT
          c.ClassName AS CategoryClass,
          c.ECInstanceId AS CategoryId,
          sc.ClassName AS SubcategoryClass,
          sc.ECInstanceId AS SubcategoryId
        FROM RootCategoriesWithLabels c
        JOIN SubCategoriesWithLabels sc ON sc.ParentId = c.ECInstanceId
        WHERE c.ChildCount > 1 AND sc.DisplayLabel LIKE '%' || ? || '%' ESCAPE '\\'
        UNION ALL
        SELECT
          c.ClassName AS CategoryClass,
          c.ECInstanceId AS CategoryId,
          CAST(NULL AS TEXT) AS SubcategoryClass,
          CAST(NULL AS TEXT) AS SubcategoryId
        FROM RootCategoriesWithLabels c
        WHERE c.DisplayLabel LIKE '%' || ? || '%' ESCAPE '\\'
        )
        LIMIT ${MAX_FILTERING_INSTANCE_KEY_COUNT + 1}
      `,
      bindings: [
        { type: "string", value: adjustedLabel },
        { type: "string", value: adjustedLabel },
      ],
    },
    { restartToken: "tree-widget/categories-tree/filter-by-label-query" },
  );
  const paths: HierarchyFilteringPath[] = [];
  for await (const row of reader) {
    const path = { path: [{ className: row.CategoryClass, id: row.CategoryId }], options: { autoExpand: true } };
    row.SubcategoryId && path.path.push({ className: row.SubcategoryClass, id: row.SubcategoryId });
    paths.push(path);
  }
  if (paths.length > MAX_FILTERING_INSTANCE_KEY_COUNT) {
    throw new FilterLimitExceededError(MAX_FILTERING_INSTANCE_KEY_COUNT);
  }
  return paths;
}
