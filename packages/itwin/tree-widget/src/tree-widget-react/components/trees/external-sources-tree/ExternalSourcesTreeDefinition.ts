/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Guid } from "@itwin/core-bentley";
import { createNodesQueryClauseFactory, createPredicateBasedHierarchyDefinition, HierarchyNode } from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql } from "@itwin/presentation-shared";

import type { GuidString } from "@itwin/core-bentley";
import type {
  DefineGenericNodeChildHierarchyLevelProps,
  DefineHierarchyLevelProps,
  DefineInstanceNodeChildHierarchyLevelProps,
  DefineRootHierarchyLevelProps,
  HierarchyDefinition,
  HierarchyLevelDefinition,
  LimitingECSqlQueryExecutor,
  NodesQueryClauseFactory,
  ProcessedHierarchyNode,
} from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector, ECSchemaProvider, IInstanceLabelSelectClauseFactory } from "@itwin/presentation-shared";

interface ExternalSourcesTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  componentId?: GuidString;
}

export class ExternalSourcesTreeDefinition implements HierarchyDefinition {
  #impl: HierarchyDefinition;
  #selectQueryFactory: NodesQueryClauseFactory;
  #nodeLabelSelectClauseFactory: IInstanceLabelSelectClauseFactory;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #isSupported?: Promise<boolean>;
  #componentId: GuidString;
  #componentName: string;

  public constructor(props: ExternalSourcesTreeDefinitionProps) {
    this.#impl = createPredicateBasedHierarchyDefinition({
      classHierarchyInspector: props.imodelAccess,
      hierarchy: {
        rootNodes: async (requestProps) => this.createRootHierarchyLevelDefinition(requestProps),
        childNodes: [
          {
            parentInstancesNodePredicate: "BisCore.ExternalSourceGroup",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createExternalSourcesGroupChildrenQuery(requestProps),
          },
          {
            parentInstancesNodePredicate: "BisCore.ExternalSource",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createExternalSourceChildrenQuery(requestProps),
          },
          {
            parentGenericNodePredicate: async ({ id }) => id === "ElementsNode",
            definitions: async (requestProps: DefineGenericNodeChildHierarchyLevelProps) => this.createElementsNodeChildrenQuery(requestProps),
          },
        ],
      },
    });
    this.#queryExecutor = props.imodelAccess;
    this.#nodeLabelSelectClauseFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
    this.#selectQueryFactory = createNodesQueryClauseFactory({
      imodelAccess: props.imodelAccess,
      instanceLabelSelectClauseFactory: this.#nodeLabelSelectClauseFactory,
    });
    this.#componentId = props.componentId ?? Guid.createValue();
    this.#componentName = "ExternalSourcesTreeDefinition";
  }

  public async postProcessNode(node: ProcessedHierarchyNode): Promise<ProcessedHierarchyNode> {
    if (HierarchyNode.isClassGroupingNode(node)) {
      // `imageId` is assigned to instance nodes at query time, but grouping ones need to be handled during post-processing
      return { ...node, extendedData: { ...node.extendedData, imageId: "icon-ec-class" } };
    }
    return node;
  }

  public async defineHierarchyLevel(props: DefineHierarchyLevelProps) {
    if (this.#isSupported === undefined) {
      this.#isSupported = this.isSupported();
    }

    if ((await this.#isSupported) === false) {
      return [];
    }

    return this.#impl.defineHierarchyLevel(props);
  }

  private async createRootHierarchyLevelDefinition(props: DefineRootHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this.#selectQueryFactory.createFilterClauses({
      filter: props.instanceFilter,
      contentClass: { fullName: "BisCore.ExternalSource", alias: "this" },
    });

    // cspell:disable
    return [
      {
        fullClassName: "BisCore.ExternalSource",
        query: {
          ecsql: `
            SELECT
              ${await this.#selectQueryFactory.createSelectClause({
                ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.createCompositeLabelSelectClause({ externalSourceAlias: "this", repositoryLinkAlias: "rl" }),
                },
                extendedData: {
                  imageId: "icon-document",
                },
                autoExpand: true,
                supportsFiltering: { selector: this.createExternalSourceSupportsFilteringSelector("this") },
              })}
            FROM ${instanceFilterClauses.from} this
            ${instanceFilterClauses.joins}
            JOIN BisCore.SynchronizationConfigSpecifiesRootSources scsrs ON scsrs.TargetECInstanceId = this.ECInstanceId
            LEFT JOIN BisCore.RepositoryLink rl ON rl.ECInstanceId = this.Repository.Id
            ${instanceFilterClauses.where ? `WHERE ${instanceFilterClauses.where}` : ""}
          `,
        },
      },
    ];
    // cspell:enable
  }

  private async createExternalSourcesGroupChildrenQuery({
    parentNodeInstanceIds: groupIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this.#selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: "BisCore.ExternalSource", alias: "this" },
    });
    // cspell:disable
    return [
      {
        fullClassName: "BisCore.ExternalSource",
        query: {
          ecsql: `
            SELECT
              ${await this.#selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.createCompositeLabelSelectClause({ externalSourceAlias: "this", repositoryLinkAlias: "rl" }),
                },
                extendedData: {
                  imageId: "icon-document",
                },
                supportsFiltering: { selector: this.createExternalSourceSupportsFilteringSelector("this") },
              })}
            FROM ${instanceFilterClauses.from} this
            JOIN BisCore.ExternalSourceGroupGroupsSources esggs ON esggs.TargetECInstanceId = this.ECInstanceId
            LEFT JOIN BisCore.RepositoryLink rl ON rl.ECInstanceId = this.Repository.Id
            ${instanceFilterClauses.joins}
            WHERE
              esggs.SourceECInstanceId IN (${groupIds.map(() => "?").join(",")})
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
          bindings: groupIds.map((id) => ({ type: "id", value: id })),
        },
      },
    ];
    // cspell:enable
  }

  private async createExternalSourceChildrenQuery({
    parentNodeInstanceIds: sourceIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this.#selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: "BisCore.ExternalSource", alias: "this" },
    });
    return [
      {
        fullClassName: "BisCore.ExternalSource",
        query: {
          ecsql: `
            SELECT
              ${await this.#selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.createCompositeLabelSelectClause({ externalSourceAlias: "this", repositoryLinkAlias: "rl" }),
                },
                extendedData: {
                  imageId: "icon-document",
                },
                supportsFiltering: { selector: this.createExternalSourceSupportsFilteringSelector("this") },
              })}
            FROM ${instanceFilterClauses.from} this
            JOIN BisCore.ExternalSourceAttachment esa ON esa.Attaches.Id = this.ECInstanceId
            LEFT JOIN BisCore.RepositoryLink rl ON rl.ECInstanceId = this.Repository.Id
            ${instanceFilterClauses.joins}
            WHERE
              esa.Parent.Id IN (${sourceIds.map(() => "?").join(",")})
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

  private createExternalSourceSupportsFilteringSelector(alias: string) {
    return `
      IFNULL((
        SELECT 1
        FROM (
          SELECT 1 FROM BisCore.ExternalSourceGroupGroupsSources WHERE SourceECInstanceId = ${alias}.ECInstanceId
          UNION ALL
          SELECT 1 FROM BisCore.ExternalSourceAttachment WHERE Parent.Id = ${alias}.ECInstanceId
        )
        LIMIT 1
      ), 0)
    `;
  }

  private async createElementsNodeChildrenQuery({ parentNode, instanceFilter }: DefineGenericNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const sourceIds: string[] = parentNode.extendedData?.sourceIds;
    const instanceFilterClauses = await this.#selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: "BisCore.GeometricElement", alias: "this" },
    });
    return [
      {
        fullClassName: "BisCore.GeometricElement",
        query: {
          ecsql: `
            SELECT
              ${await this.#selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: "BisCore.GeometricElement",
                  }),
                },
                extendedData: {
                  imageId: "icon-item",
                },
                grouping: { byClass: true },
                hasChildren: false,
              })}
            FROM ${instanceFilterClauses.from} this
            JOIN BisCore.ExternalSourceAspect esa ON esa.Element.Id = this.ECInstanceId
            ${instanceFilterClauses.joins}
            WHERE
              esa.Source.Id IN (${sourceIds.map(() => "?").join(",")})
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
          bindings: sourceIds.map((id) => ({ type: "id", value: id })),
        },
      },
    ];
  }

  private async createCompositeLabelSelectClause({ externalSourceAlias, repositoryLinkAlias }: { externalSourceAlias: string; repositoryLinkAlias: string }) {
    return ECSql.createConcatenatedValueJsonSelector([
      {
        selector: `IIF(
          ${repositoryLinkAlias}.ECInstanceId IS NOT NULL,
          ${ECSql.createConcatenatedValueJsonSelector([
            {
              selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
                classAlias: repositoryLinkAlias,
                className: "BisCore.RepositoryLink",
              }),
            },
            {
              type: "String",
              value: " - ",
            },
          ])},
          ''
        )`,
      },
      {
        selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
          classAlias: externalSourceAlias,
          className: "BisCore.ExternalSource",
        }),
      },
    ]);
  }

  private async isSupported() {
    const query = `
      SELECT 1
      FROM ECDbMeta.ECSchemaDef
      WHERE Name = 'BisCore' AND (VersionMajor > 1 OR (VersionMajor = 1 AND VersionMinor > 12))
    `;

    for await (const _row of this.#queryExecutor.createQueryReader(
      { ecsql: query },
      { restartToken: `${this.#componentName}/${this.#componentId}/is-external-source-supported` },
    )) {
      return true;
    }
    return false;
  }
}
