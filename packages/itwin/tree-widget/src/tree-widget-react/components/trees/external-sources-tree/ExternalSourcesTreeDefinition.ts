/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Guid } from "@itwin/core-bentley";
import { createPredicateBasedHierarchyDefinition, HierarchyNode } from "@itwin/presentation-hierarchies";
import { ECSql } from "@itwin/presentation-shared";
import { CLASS_NAME_GeometricElement } from "../common/internal/ClassNameDefinitions.js";

import type { GuidString } from "@itwin/core-bentley";
import type {
  DefineGenericNodeChildHierarchyLevelProps,
  DefineHierarchyLevelProps,
  DefineInstanceNodeChildHierarchyLevelProps,
  DefineRootHierarchyLevelProps,
  HierarchyDefinition,
  HierarchyLevelDefinition,
  LimitingECSqlQueryExecutor,
  NodePostProcessor,
} from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector, ECSchemaProvider, IInstanceLabelSelectClauseFactory } from "@itwin/presentation-shared";

interface ExternalSourcesTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  componentId?: GuidString;
}

/** @internal */
export class ExternalSourcesTreeDefinition implements HierarchyDefinition {
  #impl: HierarchyDefinition;
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
    this.#componentId = props.componentId ?? Guid.createValue();
    this.#componentName = "ExternalSourcesTreeDefinition";
  }

  public postProcessNode: NodePostProcessor = async ({ node }) => {
    if (HierarchyNode.isClassGroupingNode(node)) {
      // `imageId` is assigned to instance nodes at query time, but grouping ones need to be handled during post-processing
      return { ...node, extendedData: { ...node.extendedData, imageId: "icon-ec-class" } };
    }
    return node;
  };

  public async defineHierarchyLevel(props: DefineHierarchyLevelProps) {
    if (this.#isSupported === undefined) {
      this.#isSupported = this.isSupported();
    }

    if ((await this.#isSupported) === false) {
      return [];
    }

    return this.#impl.defineHierarchyLevel(props);
  }

  private async createRootHierarchyLevelDefinition({
    instanceFilter,
    nodeSelectClauseFactory,
    instanceLabelSelectClauseFactory,
  }: DefineRootHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await nodeSelectClauseFactory.createFilterClauses({
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
              ${await nodeSelectClauseFactory.createSelectClause({
                ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.createCompositeLabelSelectClause({
                    externalSourceAlias: "this",
                    repositoryLinkAlias: "rl",
                    instanceLabelSelectClauseFactory,
                  }),
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
    nodeSelectClauseFactory,
    instanceLabelSelectClauseFactory,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await nodeSelectClauseFactory.createFilterClauses({
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
              ${await nodeSelectClauseFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.createCompositeLabelSelectClause({
                    externalSourceAlias: "this",
                    repositoryLinkAlias: "rl",
                    instanceLabelSelectClauseFactory,
                  }),
                },
                extendedData: {
                  imageId: "icon-document",
                },
                supportsFiltering: { selector: this.createExternalSourceSupportsFilteringSelector("this") },
              })}
            FROM ${instanceFilterClauses.from} this
            JOIN BisCore.ExternalSourceGroupGroupsSources esggs ON esggs.TargetECInstanceId = this.ECInstanceId
            JOIN IdSet(?) groupIdSet ON esggs.SourceECInstanceId = groupIdSet.id
            LEFT JOIN BisCore.RepositoryLink rl ON rl.ECInstanceId = this.Repository.Id
            ${instanceFilterClauses.joins}
            ${instanceFilterClauses.where ? `WHERE ${instanceFilterClauses.where}` : ""}
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `,
          bindings: [{ type: "idset", value: groupIds }],
        },
      },
    ];
    // cspell:enable
  }

  private async createExternalSourceChildrenQuery({
    parentNodeInstanceIds: sourceIds,
    instanceFilter,
    nodeSelectClauseFactory,
    instanceLabelSelectClauseFactory,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await nodeSelectClauseFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: "BisCore.ExternalSource", alias: "this" },
    });
    return [
      {
        fullClassName: "BisCore.ExternalSource",
        query: {
          ecsql: `
            SELECT
              ${await nodeSelectClauseFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.createCompositeLabelSelectClause({
                    externalSourceAlias: "this",
                    repositoryLinkAlias: "rl",
                    instanceLabelSelectClauseFactory,
                  }),
                },
                extendedData: {
                  imageId: "icon-document",
                },
                supportsFiltering: { selector: this.createExternalSourceSupportsFilteringSelector("this") },
              })}
            FROM ${instanceFilterClauses.from} this
            JOIN BisCore.ExternalSourceAttachment esa ON esa.Attaches.Id = this.ECInstanceId
            JOIN IdSet(?) sourceIdSet ON sourceIdSet.id = esa.Parent.Id
            LEFT JOIN BisCore.RepositoryLink rl ON rl.ECInstanceId = this.Repository.Id
            ${instanceFilterClauses.joins}
            ${instanceFilterClauses.where ? `WHERE ${instanceFilterClauses.where}` : ""}
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `,
          bindings: [{ type: "idset", value: sourceIds }],
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

  private async createElementsNodeChildrenQuery({
    parentNode,
    instanceFilter,
    nodeSelectClauseFactory,
    instanceLabelSelectClauseFactory,
  }: DefineGenericNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const sourceIds: string[] = parentNode.extendedData?.sourceIds;
    const instanceFilterClauses = await nodeSelectClauseFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: CLASS_NAME_GeometricElement, alias: "this" },
    });
    return [
      {
        fullClassName: CLASS_NAME_GeometricElement,
        query: {
          ecsql: `
            SELECT
              ${await nodeSelectClauseFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await instanceLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: CLASS_NAME_GeometricElement,
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
            JOIN IdSet(?) sourceIdSet ON sourceIdSet.id = esa.Source.Id
            ${instanceFilterClauses.joins}
            ${instanceFilterClauses.where ? `WHERE ${instanceFilterClauses.where}` : ""}
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `,
          bindings: [{ type: "idset", value: sourceIds }],
        },
      },
    ];
  }

  private async createCompositeLabelSelectClause({
    externalSourceAlias,
    repositoryLinkAlias,
    instanceLabelSelectClauseFactory,
  }: {
    externalSourceAlias: string;
    repositoryLinkAlias: string;
    instanceLabelSelectClauseFactory: IInstanceLabelSelectClauseFactory;
  }) {
    return ECSql.createConcatenatedValueJsonSelector([
      {
        selector: `IIF(
          ${repositoryLinkAlias}.ECInstanceId IS NOT NULL,
          ${ECSql.createConcatenatedValueJsonSelector([
            {
              selector: await instanceLabelSelectClauseFactory.createSelectClause({
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
        selector: await instanceLabelSelectClauseFactory.createSelectClause({
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
