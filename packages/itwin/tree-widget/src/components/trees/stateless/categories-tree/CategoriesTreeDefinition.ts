/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createClassBasedHierarchyDefinition, createNodesQueryClauseFactory } from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql } from "@itwin/presentation-shared";

import type { ECClassHierarchyInspector, ECSchemaProvider, IInstanceLabelSelectClauseFactory } from "@itwin/presentation-shared";
import type {
  DefineHierarchyLevelProps,
  DefineInstanceNodeChildHierarchyLevelProps,
  DefineRootHierarchyLevelProps,
  HierarchyDefinition,
  HierarchyLevelDefinition,
  HierarchyNodeIdentifiersPath,
  LimitingECSqlQueryExecutor,
  NodesQueryClauseFactory,
} from "@itwin/presentation-hierarchies";

interface CategoriesTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & ECClassHierarchyInspector;
  view2d: boolean;
}

interface CategoriesTreeInstanceKeyPathsFromInstanceLabelProps {
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  label: string;
  view2d: boolean;
}

export class CategoriesTreeDefinition implements HierarchyDefinition {
  private _impl: HierarchyDefinition;
  private _selectQueryFactory: NodesQueryClauseFactory;
  private _nodeLabelSelectClauseFactory: IInstanceLabelSelectClauseFactory;

  public constructor(props: CategoriesTreeDefinitionProps) {
    this._impl = createClassBasedHierarchyDefinition({
      classHierarchyInspector: props.imodelAccess,
      hierarchy: {
        rootNodes: async (requestProps) => this.createRootHierarchyLevelDefinition({ ...requestProps, view2d: props.view2d }),
        childNodes: [
          {
            parentNodeClassName: "BisCore.Category",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createSubcategoryQuery(requestProps),
          },
        ],
      },
    });
    this._selectQueryFactory = createNodesQueryClauseFactory({ imodelAccess: props.imodelAccess });
    this._nodeLabelSelectClauseFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
  }

  public async defineHierarchyLevel(props: DefineHierarchyLevelProps) {
    return this._impl.defineHierarchyLevel(props);
  }

  private async createRootHierarchyLevelDefinition(props: DefineRootHierarchyLevelProps & { view2d: boolean }): Promise<HierarchyLevelDefinition> {
    const { categoryClass, relationshipClass } = getClassesByView(props.view2d);
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
                        SELECT COUNT(TargetECInstanceId) AS ChildCount
                        FROM BisCore.CategoryOwnsSubCategories
                        WHERE SourceECInstanceId = this.ECInstanceId
                      )
                      WHERE ChildCount > 1
                    ), 0)
                  `,
                },
                extendedData: {
                  description: { selector: "printf('%s', this.Description)" },
                },
                supportsFiltering: true,
              })}
            FROM ${instanceFilterClauses.from} this
            ${instanceFilterClauses.joins}
            JOIN BisCore.Model m ON m.ECInstanceId = this.Model.Id
            WHERE
              NOT this.IsPrivate
              AND (NOT m.IsPrivate OR m.ECClassId IS (BisCore.DictionaryModel))
              AND EXISTS (SELECT 1 FROM ${relationshipClass} r WHERE r.TargetECInstanceId = this.ECInstanceId)
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
                  categoryId: { selector: "printf('0x%x', cosc.SourceECInstanceId)" },
                },
                supportsFiltering: false,
              })}
            FROM ${instanceFilterClauses.from} this
            ${instanceFilterClauses.joins}
            JOIN BisCore.CategoryOwnsSubCategories cosc ON cosc.TargetECInstanceId = this.ECInstanceId
            WHERE
              NOT this.IsPrivate AND cosc.SourceECInstanceId IN (${elementIds.map(() => "?").join(",")})
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

function getClassesByView(view2d: boolean) {
  return view2d
    ? { categoryClass: "BisCore.DrawingCategory", relationshipClass: "BisCore:GeometricElement2dIsInCategory" }
    : { categoryClass: "BisCore.SpatialCategory", relationshipClass: "BisCore:GeometricElement3dIsInCategory" };
}

async function createInstanceKeyPathsFromInstanceLabel(
  props: CategoriesTreeInstanceKeyPathsFromInstanceLabelProps & { labelsFactory: IInstanceLabelSelectClauseFactory },
) {
  const { categoryClass, relationshipClass } = getClassesByView(props.view2d);
  const reader = props.imodelAccess.createQueryReader(
    {
      ctes: [
        `RootCategories(ClassName, ECInstanceId, ChildCount) as (
          SELECT
            ec_classname(this.ECClassId, 's.c'),
            this.ECInstanceId,
            COUNT(cosc.TargetECInstanceId)
          FROM ${categoryClass} this
          JOIN BisCore.Model m ON m.ECInstanceId = this.Model.Id
          JOIN BisCore.CategoryOwnsSubCategories cosc ON cosc.SourceECInstanceId = this.ECInstanceId
          WHERE
            NOT this.IsPrivate
            AND (NOT m.IsPrivate OR m.ECClassId IS (BisCore.DictionaryModel))
            AND EXISTS (SELECT 1 FROM ${relationshipClass} r WHERE r.TargetECInstanceId = this.ECInstanceId)
          GROUP BY this.ECInstanceId
        )`,
        `SubCategoriesWithLabels(ClassName, ECInstanceId, DisplayLabel) as (
          SELECT
            ec_classname(this.ECClassId, 's.c'),
            this.ECInstanceId,
            ${await props.labelsFactory.createSelectClause({
              classAlias: "this",
              className: "BisCore.SubCategory",
            })}
          FROM BisCore.SubCategory this
          WHERE NOT this.IsPrivate
        )`,
      ],
      ecsql: `
        SELECT
          c.ClassName AS CategoryClass,
          c.ECInstanceId AS CategoryId,
          IIF(c.ChildCount > 1, sc.ClassName, NULL) AS SubcategoryClass,
          IIF(c.ChildCount > 1, sc.ECInstanceId, NULL) AS SubcategoryId
        FROM RootCategories c
        JOIN BisCore.CategoryOwnsSubCategories cosc ON cosc.SourceECInstanceId = c.ECInstanceId
        JOIN SubCategoriesWithLabels sc ON sc.ECInstanceId = cosc.TargetECInstanceId
        WHERE sc.DisplayLabel LIKE '%' || ? || '%'
      `,
      bindings: [{ type: "string", value: props.label }],
    },
    { restartToken: "FilterByLabelQuery" },
  );
  const paths = new Array<HierarchyNodeIdentifiersPath>();
  for await (const row of reader) {
    const path = [{ className: row.CategoryClass, id: row.CategoryId }];
    row.SubcategoryId && path.push({ className: row.SubcategoryClass, id: row.SubcategoryId });
    paths.push(path);
  }
  return paths;
}
