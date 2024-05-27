/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type {
  DefineCustomNodeChildHierarchyLevelProps,
  DefineHierarchyLevelProps,
  DefineInstanceNodeChildHierarchyLevelProps,
  DefineRootHierarchyLevelProps,
  HierarchyDefinition,
  HierarchyLevelDefinition,
  NodesQueryClauseFactory,
  ProcessedHierarchyNode,
} from "@itwin/presentation-hierarchies";
import { createClassBasedHierarchyDefinition, createNodesQueryClauseFactory, HierarchyNode } from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql } from "@itwin/presentation-shared";

import type { ECClassHierarchyInspector, ECSchemaProvider, IInstanceLabelSelectClauseFactory } from "@itwin/presentation-shared";
interface ExternalSourcesTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & ECClassHierarchyInspector;
}

export class ExternalSourcesTreeDefinition implements HierarchyDefinition {
  private _impl: HierarchyDefinition;
  private _selectQueryFactory: NodesQueryClauseFactory;
  private _nodeLabelSelectClauseFactory: IInstanceLabelSelectClauseFactory;

  public constructor(props: ExternalSourcesTreeDefinitionProps) {
    this._impl = createClassBasedHierarchyDefinition({
      classHierarchyInspector: props.imodelAccess,
      hierarchy: {
        rootNodes: async (requestProps) => this.createRootHierarchyLevelDefinition(requestProps),
        childNodes: [
          {
            parentNodeClassName: "BisCore.ExternalSourceGroup",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createExternalSourcesGroupChildrenQuery(requestProps),
          },
          {
            parentNodeClassName: "BisCore.ExternalSource",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createExternalSourceChildrenQuery(requestProps),
          },
          {
            customParentNodeKey: "ElementsNode",
            definitions: async (requestProps: DefineCustomNodeChildHierarchyLevelProps) => this.createElementsNodeChildrenQuery(requestProps),
          },
        ],
      },
    });
    this._selectQueryFactory = createNodesQueryClauseFactory({ imodelAccess: props.imodelAccess });
    this._nodeLabelSelectClauseFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
  }

  public async postProcessNode(node: ProcessedHierarchyNode): Promise<ProcessedHierarchyNode> {
    if (HierarchyNode.isClassGroupingNode(node)) {
      // `imageId` is assigned to instance nodes at query time, but grouping ones need to be handled during post-processing
      return { ...node, extendedData: { ...node.extendedData, imageId: "icon-ec-class" } };
    }
    return node;
  }

  public async defineHierarchyLevel(props: DefineHierarchyLevelProps) {
    return this._impl.defineHierarchyLevel(props);
  }

  private async createRootHierarchyLevelDefinition(props: DefineRootHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: props.instanceFilter,
      contentClass: { fullName: "BisCore.ExternalSource", alias: "this" },
    });
    return [
      {
        fullClassName: "BisCore.ExternalSource",
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.createCompositeLabelSelectClause({ externalSourceAlias: "this", repositoryLinkAlias: "rl" }),
                },
                extendedData: {
                  imageId: "icon-document",
                },
                autoExpand: true,
                supportsFiltering: true,
              })}
            FROM ${instanceFilterClauses.from} this
            ${instanceFilterClauses.joins}
            JOIN BisCore.SynchronizationConfigSpecifiesRootSources scsrs ON scsrs.TargetECInstanceId = this.ECInstanceId
            JOIN BisCore.RepositoryLink rl ON rl.ECInstanceId = this.Repository.Id
            ${instanceFilterClauses.where ? `WHERE ${instanceFilterClauses.where}` : ""}
          `,
        },
      },
    ];
  }

  private async createExternalSourcesGroupChildrenQuery({
    parentNodeInstanceIds: groupIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: "BisCore.ExternalSource", alias: "this" },
    });
    return [
      {
        fullClassName: "BisCore.ExternalSource",
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.createCompositeLabelSelectClause({ externalSourceAlias: "this", repositoryLinkAlias: "rl" }),
                },
                hasChildren: {
                  selector: `
                    IFNULL((
                      SELECT 1
                      FROM BisCore.ExternalSourceAttachmentAttachesSource esaas
                      WHERE esaas.TargetECInstanceId = this.ECInstanceId
                      LIMIT 1
                    ), 0)
                  `,
                },
                extendedData: {
                  imageId: "icon-document",
                },
                supportsFiltering: true,
              })}
            FROM ${instanceFilterClauses.from} this
            JOIN BisCore.ExternalSourceGroupGroupsSources esggs ON esggs.TargetECInstanceId = this.ECInstanceId
            JOIN BisCore.RepositoryLink rl ON rl.ECInstanceId = this.Repository.Id
            ${instanceFilterClauses.joins}
            WHERE
              esggs.SourceECInstanceId IN (${groupIds.map(() => "?").join(",")})
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
          bindings: groupIds.map((id) => ({ type: "id", value: id })),
        },
      },
    ];
  }

  private async createExternalSourceChildrenQuery({
    parentNodeInstanceIds: sourceIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: "BisCore.ExternalSource", alias: "this" },
    });
    return [
      {
        fullClassName: "BisCore.ExternalSource",
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.createCompositeLabelSelectClause({ externalSourceAlias: "this", repositoryLinkAlias: "rl" }),
                },
                hasChildren: {
                  selector: `
                    IFNULL((
                      SELECT 1
                      FROM BisCore.ExternalSourceAttachmentAttachesSource esaas
                      WHERE esaas.TargetECInstanceId = this.ECInstanceId
                      LIMIT 1
                    ), 0)
                  `,
                },
                extendedData: {
                  imageId: "icon-document",
                },
                supportsFiltering: true,
              })}
            FROM ${instanceFilterClauses.from} this
            JOIN BisCore.ExternalSourceAttachmentAttachesSource esaas ON esaas.TargetECInstanceId = this.ECInstanceId
            JOIN BisCore.ExternalSourceAttachment a ON a.ECInstanceId = esaas.SourceECInstanceId
            JOIN BisCore.RepositoryLink rl ON rl.ECInstanceId = this.Repository.Id
            ${instanceFilterClauses.joins}
            WHERE
              a.Parent.Id IN (${sourceIds.map(() => "?").join(",")})
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
          bindings: sourceIds.map((id) => ({ type: "id", value: id })),
        },
      },
      {
        node: {
          key: "ElementsNode",
          label: "Elements",
          extendedData: {
            sourceIds,
            imageId: "icon-ec-schema",
          },
          supportsFiltering: true,
          processingParams: {
            hideIfNoChildren: true,
          },
        },
      },
    ];
  }

  private async createElementsNodeChildrenQuery({ parentNode, instanceFilter }: DefineCustomNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const sourceIds: string[] = parentNode.extendedData?.sourceIds;
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: "BisCore.GeometricElement", alias: "this" },
    });
    return [
      {
        fullClassName: "BisCore.GeometricElement",
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: "BisCore.GeometricElement",
                  }),
                },
                extendedData: {
                  imageId: "icon-item",
                },
                grouping: { byClass: true },
                supportsFiltering: true,
                hasChildren: false,
              })}
            FROM ${instanceFilterClauses.from} this
            JOIN BisCore.ExternalSourceAspect esa ON esa.Element.Id = this.ECInstanceId
            ${instanceFilterClauses.joins}
            WHERE
              esa.Source.Id = (${sourceIds.map(() => "?").join(",")})
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
          bindings: sourceIds.map((id) => ({ type: "id", value: id })),
        },
      },
    ];
  }

  private async createCompositeLabelSelectClause({ externalSourceAlias, repositoryLinkAlias }: { externalSourceAlias: string; repositoryLinkAlias: string }) {
    return ECSql.createConcatenatedValueStringSelector([
      {
        selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
          classAlias: repositoryLinkAlias,
          className: "BisCore.RepositoryLink",
        }),
      },
      {
        type: "String",
        value: " - ",
      },
      {
        selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
          classAlias: externalSourceAlias,
          className: "BisCore.ExternalSource",
        }),
      },
    ]);
  }
}
