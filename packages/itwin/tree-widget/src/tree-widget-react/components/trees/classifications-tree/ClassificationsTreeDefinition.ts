/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createNodesQueryClauseFactory, createPredicateBasedHierarchyDefinition } from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql, parseFullClassName } from "@itwin/presentation-shared";
import {
  CLASS_NAME_Classification,
  CLASS_NAME_ClassificationSystem,
  CLASS_NAME_ClassificationTable,
  CLASS_NAME_Element,
  CLASS_NAME_ElementHasClassifications,
  CLASS_NAME_GeometricElement,
  CLASS_NAME_GeometricElement2d,
  CLASS_NAME_GeometricElement3d,
} from "../common/internal/ClassNameDefinitions.js";

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
import type { ClassificationId, ClassificationsTreeIdsCache, ClassificationTableId } from "./internal/ClassificationsTreeIdsCache.js";

interface ClassificationsTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  idsCache: ClassificationsTreeIdsCache;
  hierarchyConfig: ClassificationsTreeHierarchyConfiguration;
}

/** @alpha */
export interface ClassificationsTreeHierarchyConfiguration {
  /**
   * The classifications' hierarchy starts at the root `ClassificationSystem` element. This attribute identifiers that
   * root `ClassificationSystem`.
   */
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
              system.CodeValue = '${this._props.hierarchyConfig.rootClassificationSystemCode}'
              AND NOT this.IsPrivate
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
        },
      },
    ];
  }

  async #createClassificationTableChildrenQuery(props: {
    parentNodeInstanceIds: ClassificationTableId[];
    instanceFilter?: GenericInstanceFilter;
  }): Promise<HierarchyLevelDefinition> {
    const { parentNodeInstanceIds: classificationTableIds, instanceFilter } = props;
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: CLASS_NAME_Classification, alias: "this" },
    });
    const classificationIds = await this._props.idsCache.getDirectChildClassifications(classificationTableIds);
    return classificationIds.length
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
                  this.ECInstanceId IN (${classificationIds.join(",")})
                  ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
              `,
            },
          },
        ]
      : [];
  }

  async #createClassificationChildrenQuery(props: {
    parentNodeInstanceIds: ClassificationId[];
    instanceFilter?: GenericInstanceFilter;
  }): Promise<HierarchyLevelDefinition> {
    const { parentNodeInstanceIds: parentClassificationIds, instanceFilter } = props;
    const classificationIds = await this._props.idsCache.getDirectChildClassifications(parentClassificationIds);
    return [
      // load child classifications
      ...(classificationIds.length
        ? [
            await (async () => {
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
                      this.ECInstanceId IN (${classificationIds.join(",")})
                      ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
                  `,
                },
              };
            })(),
          ]
        : []),
      // load classification elements
      ...(await Promise.all(
        [CLASS_NAME_GeometricElement2d, CLASS_NAME_GeometricElement3d].map(async (elementClassName) => {
          const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
            filter: instanceFilter,
            contentClass: { fullName: elementClassName, alias: "this" },
          });
          return {
            fullClassName: elementClassName,
            query: {
              ecsql: `
                SELECT ${await this.#createElementSelectClause(elementClassName)}
                FROM ${instanceFilterClauses.from} this
                JOIN ${CLASS_NAME_ElementHasClassifications} ehc ON ehc.SourceECInstanceId = this.ECInstanceId
                ${instanceFilterClauses.joins}
                WHERE
                  ehc.TargetECInstanceId IN (${parentClassificationIds.join(",")})
                  AND this.Parent.Id IS NULL
                  ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
              `,
            },
          };
        }),
      )),
    ];
  }

  async #createGeometricElementChildrenQuery({
    parentNodeInstanceIds: parentElementIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    return Promise.all(
      [CLASS_NAME_GeometricElement2d, CLASS_NAME_GeometricElement3d].map(async (elementClassName) => {
        const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
          filter: instanceFilter,
          contentClass: { fullName: elementClassName, alias: "this" },
        });
        return {
          fullClassName: elementClassName,
          query: {
            ecsql: `
              SELECT ${await this.#createElementSelectClause(elementClassName)}
              FROM ${instanceFilterClauses.from} this
              ${instanceFilterClauses.joins}
              WHERE
                this.Parent.Id IN (${parentElementIds.join(",")})
                ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
            `,
          },
        };
      }),
    );
  }

  async #createElementSelectClause(elementFullClassName: string): Promise<string> {
    const { className: elementClassName } = parseFullClassName(elementFullClassName);
    return this._selectQueryFactory.createSelectClause({
      ecClassId: { selector: "this.ECClassId" },
      ecInstanceId: { selector: "this.ECInstanceId" },
      nodeLabel: {
        selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
          classAlias: "this",
          className: elementFullClassName,
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
        type: elementClassName,
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
