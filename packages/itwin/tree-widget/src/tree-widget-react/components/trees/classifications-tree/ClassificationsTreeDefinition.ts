/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createNodesQueryClauseFactory, createPredicateBasedHierarchyDefinition } from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql } from "@itwin/presentation-shared";
import {
  CLASS_NAME_Category,
  CLASS_NAME_Classification,
  CLASS_NAME_ClassificationSystem,
  CLASS_NAME_ClassificationTable,
  CLASS_NAME_Element,
  CLASS_NAME_ElementHasClassifications,
  CLASS_NAME_GeometricElement,
  CLASS_NAME_GeometricElement2d,
  CLASS_NAME_GeometricElement3d,
  CLASS_NAME_SpatialCategory,
} from "../common/internal/ClassNameDefinitions.js";
import { createIdsSelector, parseIdsSelectorResult } from "../common/internal/Utils.js";

import type { Id64Array } from "@itwin/core-bentley";
import type {
  DefineHierarchyLevelProps,
  DefineInstanceNodeChildHierarchyLevelProps,
  DefineRootHierarchyLevelProps,
  GenericInstanceFilter,
  HierarchyDefinition,
  HierarchyLevelDefinition,
  LimitingECSqlQueryExecutor,
  NodesQueryClauseFactory,
} from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector, ECSchemaProvider, IInstanceLabelSelectClauseFactory } from "@itwin/presentation-shared";
import type { ClassificationsTreeIdsCache } from "./internal/ClassificationsTreeIdsCache.js";

interface ClassificationsTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  idsCache: ClassificationsTreeIdsCache;
  rootClassificationSystemCode: string;
}

/** @internal */
export class ClassificationsTreeDefinition implements HierarchyDefinition {
  private _impl: HierarchyDefinition;
  private _selectQueryFactory: NodesQueryClauseFactory;
  private _nodeLabelSelectClauseFactory: IInstanceLabelSelectClauseFactory;

  public constructor(private _props: ClassificationsTreeDefinitionProps) {
    this._nodeLabelSelectClauseFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: this._props.imodelAccess });
    this._selectQueryFactory = createNodesQueryClauseFactory({
      imodelAccess: this._props.imodelAccess,
      instanceLabelSelectClauseFactory: this._nodeLabelSelectClauseFactory,
    });
    this._impl = createPredicateBasedHierarchyDefinition({
      classHierarchyInspector: this._props.imodelAccess,
      hierarchy: {
        rootNodes: async (requestProps: DefineRootHierarchyLevelProps) => this.#createClassificationTablesQuery(requestProps),
        childNodes: [
          {
            parentInstancesNodePredicate: CLASS_NAME_ClassificationTable,
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.#createClassificationTableChildrenQuery(requestProps),
          },
          {
            parentInstancesNodePredicate: CLASS_NAME_Classification,
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.#createClassificationChildrenQuery(requestProps),
          },
          {
            parentInstancesNodePredicate: CLASS_NAME_Category,
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.#createCategoryChildrenQuery(requestProps),
          },
          {
            parentInstancesNodePredicate: CLASS_NAME_GeometricElement,
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.#createGeometricElementChildrenQuery(requestProps),
          },
        ],
      },
    });
  }

  public async defineHierarchyLevel(props: DefineHierarchyLevelProps) {
    return this._impl.defineHierarchyLevel(props);
  }

  async #createClassificationTablesQuery(props: { instanceFilter?: GenericInstanceFilter }): Promise<HierarchyLevelDefinition> {
    const { instanceFilter } = props;
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: CLASS_NAME_ClassificationTable, alias: "this" },
    });
    return [
      {
        fullClassName: CLASS_NAME_ClassificationTable,
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: CLASS_NAME_ClassificationTable,
                  }),
                },
                hasChildren: {
                  selector: `
                    IFNULL((
                      SELECT 1
                      FROM ${CLASS_NAME_Classification} classification
                      WHERE classification.Model.Id = this.ECInstanceId
                      LIMIT 1
                    ), 0)
                  `,
                },
                extendedData: {
                  type: "ClassificationTable",
                },
                supportsFiltering: true,
              })}
            FROM
              ${instanceFilterClauses.from} this
            JOIN ${CLASS_NAME_ClassificationSystem} system ON system.ECInstanceId = this.Parent.Id
            ${instanceFilterClauses.joins}
            WHERE
              system.CodeValue = '${this._props.rootClassificationSystemCode}'
              AND NOT this.IsPrivate
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
        },
      },
    ];
  }

  async #createClassificationTableChildrenQuery(props: {
    parentNodeInstanceIds: Id64Array;
    instanceFilter?: GenericInstanceFilter;
  }): Promise<HierarchyLevelDefinition> {
    const { parentNodeInstanceIds: classificationTableIds, instanceFilter } = props;
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: CLASS_NAME_Classification, alias: "this" },
    });
    const childrenInfo = await this._props.idsCache.getDirectCategoriesAndClassifications(classificationTableIds);
    return childrenInfo.classificationIds.length
      ? [
          {
            fullClassName: CLASS_NAME_Classification,
            query: {
              ecsql: `
                SELECT
                  ${await this._selectQueryFactory.createSelectClause({
                    ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
                    ecInstanceId: { selector: "this.ECInstanceId" },
                    nodeLabel: {
                      selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                        classAlias: "this",
                        className: CLASS_NAME_Classification,
                      }),
                    },
                    hasChildren: {
                      selector: createClassificationHasChildrenSelector("this"),
                    },
                    extendedData: {
                      type: "Classification",
                    },
                    supportsFiltering: true,
                  })}
                FROM
                  ${instanceFilterClauses.from} this
                ${instanceFilterClauses.joins}
                WHERE
                  this.ECInstanceId IN (${childrenInfo.classificationIds.join(",")})
                  ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
              `,
            },
          },
        ]
      : [];
  }

  async #createClassificationChildrenQuery(props: {
    parentNodeInstanceIds: Id64Array;
    instanceFilter?: GenericInstanceFilter;
  }): Promise<HierarchyLevelDefinition> {
    const { parentNodeInstanceIds: classificationIds, instanceFilter } = props;
    const childrenInfo = await this._props.idsCache.getDirectCategoriesAndClassifications(classificationIds);
    return [
      // load child classifications
      ...(childrenInfo.classificationIds.length
        ? [
            await(async () => {
              const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
                filter: instanceFilter,
                contentClass: { fullName: CLASS_NAME_Classification, alias: "this" },
              });
              return {
                fullClassName: CLASS_NAME_Classification,
                query: {
                  ecsql: `
                    SELECT
                      ${await this._selectQueryFactory.createSelectClause({
                        ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
                        ecInstanceId: { selector: "this.ECInstanceId" },
                        nodeLabel: {
                          selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                            classAlias: "this",
                            className: CLASS_NAME_Classification,
                          }),
                        },
                        hasChildren: {
                          selector: createClassificationHasChildrenSelector("this"),
                        },
                        extendedData: {
                          type: "Classification",
                        },
                        supportsFiltering: true,
                      })}
                    FROM
                      ${instanceFilterClauses.from} this
                    ${instanceFilterClauses.joins}
                    WHERE
                      this.ECInstanceId IN (${childrenInfo.classificationIds.join(",")})
                      ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
                  `,
                },
              };
            })(),
          ]
        : []),
      // load referenced categories
      ...(childrenInfo.categoryIds.length
        ? [
            await(async () => {
              const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
                filter: instanceFilter,
                contentClass: { fullName: CLASS_NAME_Category, alias: "this" },
              });
              return {
                fullClassName: CLASS_NAME_Category,
                query: {
                  ecsql: `
                    SELECT
                      ${await this._selectQueryFactory.createSelectClause({
                        ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
                        ecInstanceId: { selector: "this.ECInstanceId" },
                        nodeLabel: {
                          selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                            classAlias: "this",
                            className: CLASS_NAME_Category,
                          }),
                        },
                        hasChildren: true, // we won't get the category if it doesn't have elements, and if it has elements, it will have children
                        extendedData: {
                          type: { selector: `IIF(ec_classname(this.ECClassId, 'c') = 'SpatialCategory', 'SpatialCategory', 'DrawingCategory')` },
                          classificationIds: { selector: createIdsSelector(classificationIds) },
                        },
                        supportsFiltering: true,
                      })}
                    FROM
                      ${instanceFilterClauses.from} this
                    ${instanceFilterClauses.joins}
                    WHERE
                      this.ECInstanceId IN (${childrenInfo.categoryIds.join(",")})
                      ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
                  `,
                },
              };
            })(),
          ]
        : []),
    ];
  }

  async #createCategoryChildrenQuery({
    parentNode,
    parentNodeClassName,
    parentNodeInstanceIds: categoryIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const elementsClassName = parentNodeClassName === CLASS_NAME_SpatialCategory ? CLASS_NAME_GeometricElement3d : CLASS_NAME_GeometricElement2d;
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: elementsClassName, alias: "this" },
    });
    const classificationIds = parseIdsSelectorResult(parentNode.extendedData?.classificationIds);
    if (classificationIds.length === 0) {
      return [];
    }
    return [
      {
        fullClassName: elementsClassName,
        query: {
          ecsql: `
            SELECT ${await this.#createGeometricElementSelectClause(parentNodeClassName)}
            FROM ${instanceFilterClauses.from} this
            JOIN ${CLASS_NAME_ElementHasClassifications} ehc ON ehc.SourceECInstanceId = this.ECInstanceId
            ${instanceFilterClauses.joins}
            WHERE
              this.Category.Id IN (${categoryIds.join(",")})
              AND ehc.TargetECInstanceId IN (${classificationIds.join(",")})
              AND this.Parent.Id IS NULL
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
        },
      },
    ];
  }

  async #createGeometricElementChildrenQuery({
    parentNodeClassName,
    parentNodeInstanceIds: parentElementIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: CLASS_NAME_Element, alias: "this" },
    });
    return [
      {
        fullClassName: CLASS_NAME_Element,
        query: {
          ecsql: `
            SELECT ${await this.#createGeometricElementSelectClause(parentNodeClassName)}
            FROM ${instanceFilterClauses.from} this
            ${instanceFilterClauses.joins}
            WHERE
              this.Parent.Id IN (${parentElementIds.join(",")})
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
        },
      },
    ];
  }

  async #createGeometricElementSelectClause(parentNodeClassName: string): Promise<string> {
    const elementsClassName = parentNodeClassName === CLASS_NAME_SpatialCategory ? "GeometricElement3d" : "GeometricElement2d";
    return this._selectQueryFactory.createSelectClause({
      ecClassId: { selector: "this.ECClassId" },
      ecInstanceId: { selector: "this.ECInstanceId" },
      nodeLabel: {
        selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
          classAlias: "this",
          className: `BisCore.${elementsClassName}`,
        }),
      },
      hasChildren: {
        selector: `
          IFNULL((
            SELECT 1
            FROM ${CLASS_NAME_Element} ce
            WHERE ce.Parent.Id = this.ECInstanceId
            LIMIT 1
          ), 0)
        `,
      },
      extendedData: {
        type: elementsClassName,
        modelId: { selector: "IdToHex(this.Model.Id)" },
        categoryId: { selector: "IdToHex(this.Category.Id)" },
      },
      supportsFiltering: true,
    });
  }
}

function createClassificationHasChildrenSelector(classificationAlias: string) {
  return `
    COALESCE((
        SELECT 1
        FROM ${CLASS_NAME_Classification} classification
        WHERE classification.Parent.Id = ${classificationAlias}.ECInstanceId
        LIMIT 1
      ), (
        SELECT 1
        FROM ${CLASS_NAME_ElementHasClassifications} ehc
        WHERE ehc.TargetECInstanceId = ${classificationAlias}.ECInstanceId
        LIMIT 1
      ),
      0
    )
  `;
}
