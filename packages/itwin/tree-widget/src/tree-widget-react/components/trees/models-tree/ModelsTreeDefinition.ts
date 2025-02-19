/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, defer, from, lastValueFrom, map, merge, mergeAll, mergeMap, reduce, switchMap } from "rxjs";
import {
  createNodesQueryClauseFactory, createPredicateBasedHierarchyDefinition, NodeSelectClauseColumnNames, ProcessedHierarchyNode,
} from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql } from "@itwin/presentation-shared";
import { collect } from "../common/Rxjs.js";
import { FilterLimitExceededError } from "../common/TreeErrors.js";
import { createIdsSelector, parseIdsSelectorResult } from "../common/Utils.js";
import { releaseMainThreadOnItemsCount } from "./Utils.js";

import type { Id64String } from "@itwin/core-bentley";
import type { Observable } from "rxjs";
import type {
  ECClassHierarchyInspector,
  ECSchemaProvider,
  ECSqlBinding,
  ECSqlQueryDef,
  ECSqlQueryRow,
  IInstanceLabelSelectClauseFactory,
  InstanceKey,
} from "@itwin/presentation-shared";
import type {
  ClassGroupingNodeKey,
  createIModelHierarchyProvider,
  DefineHierarchyLevelProps,
  DefineInstanceNodeChildHierarchyLevelProps,
  DefineRootHierarchyLevelProps,
  GroupingHierarchyNode,
  HierarchyDefinition,
  HierarchyLevelDefinition,
  HierarchyNodesDefinition,
  LimitingECSqlQueryExecutor,
  NodesQueryClauseFactory,
} from "@itwin/presentation-hierarchies";
import type { ModelsTreeIdsCache } from "./internal/ModelsTreeIdsCache.js";

/** @beta */
export type ClassGroupingHierarchyNode = GroupingHierarchyNode & { key: ClassGroupingNodeKey };

const MAX_FILTERING_INSTANCE_KEY_COUNT = 100;

/**
 * Defines hierarchy configuration supported by `ModelsTree`.
 * @beta
 */
export interface ModelsTreeHierarchyConfiguration {
  /** Should element nodes be grouped by class. Defaults to `enable`. */
  elementClassGrouping: "enable" | "enableWithCounts" | "disable";
  /** Full class name of a `GeometricElement3d` sub-class that should be used to load element nodes. Defaults to `BisCore.GeometricElement3d` */
  elementClassSpecification: string;
  /** Should models without elements be shown. Defaults to `false` */
  showEmptyModels: boolean;
}

export const defaultHierarchyConfiguration: ModelsTreeHierarchyConfiguration = {
  elementClassGrouping: "enable",
  elementClassSpecification: "BisCore.GeometricElement3d",
  showEmptyModels: false,
};

interface ModelsTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  idsCache: ModelsTreeIdsCache;
  hierarchyConfig: ModelsTreeHierarchyConfiguration;
}

/** @beta */
export interface ElementsGroupInfo {
  parent:
    | {
        ids: Id64String[];
        type: "element";
      }
    | {
        ids: Id64String[];
        modelIds: Id64String[];
        type: "category";
      };
  groupingNode: ClassGroupingHierarchyNode;
}

interface ModelsTreeInstanceKeyPathsFromTargetItemsProps {
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  idsCache: ModelsTreeIdsCache;
  targetItems: Array<InstanceKey | ElementsGroupInfo>;
  hierarchyConfig: ModelsTreeHierarchyConfiguration;
  limit?: number | "unbounded";
}

interface ModelsTreeInstanceKeyPathsFromInstanceLabelProps {
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  idsCache: ModelsTreeIdsCache;
  label: string;
  hierarchyConfig: ModelsTreeHierarchyConfiguration;
  limit?: number | "unbounded";
}

export type ModelsTreeInstanceKeyPathsProps = ModelsTreeInstanceKeyPathsFromTargetItemsProps | ModelsTreeInstanceKeyPathsFromInstanceLabelProps;
type HierarchyProviderProps = Parameters<typeof createIModelHierarchyProvider>[0];
type HierarchyFilteringPaths = NonNullable<NonNullable<HierarchyProviderProps["filtering"]>["paths"]>;
type HierarchyFilteringPath = HierarchyFilteringPaths[number];

// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace ModelsTreeInstanceKeyPathsProps {
  export function isLabelProps(props: ModelsTreeInstanceKeyPathsProps): props is ModelsTreeInstanceKeyPathsFromInstanceLabelProps {
    return !!(props as ModelsTreeInstanceKeyPathsFromInstanceLabelProps).label;
  }
}

export class ModelsTreeDefinition implements HierarchyDefinition {
  private _impl: HierarchyDefinition;
  private _idsCache: ModelsTreeIdsCache;
  private _hierarchyConfig: ModelsTreeHierarchyConfiguration;
  private _selectQueryFactory: NodesQueryClauseFactory;
  private _nodeLabelSelectClauseFactory: IInstanceLabelSelectClauseFactory;
  private _queryExecutor: LimitingECSqlQueryExecutor;
  private _isSupported?: Promise<boolean>;

  public constructor(props: ModelsTreeDefinitionProps) {
    this._impl = createPredicateBasedHierarchyDefinition({
      classHierarchyInspector: props.imodelAccess,
      hierarchy: {
        rootNodes: async (requestProps) => this.createRootHierarchyLevelDefinition(requestProps),
        childNodes: [
          {
            parentInstancesNodePredicate: "BisCore.Subject",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createSubjectChildrenQuery(requestProps),
          },
          {
            parentInstancesNodePredicate: "BisCore.ISubModeledElement",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createISubModeledElementChildrenQuery(requestProps),
          },
          {
            parentInstancesNodePredicate: "BisCore.GeometricModel3d",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createGeometricModel3dChildrenQuery(requestProps),
          },
          {
            parentInstancesNodePredicate: "BisCore.SpatialCategory",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createSpatialCategoryChildrenQuery(requestProps),
          },
          {
            parentInstancesNodePredicate: "BisCore.GeometricElement3d",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createGeometricElement3dChildrenQuery(requestProps),
          },
        ],
      },
    });
    this._idsCache = props.idsCache;
    this._queryExecutor = props.imodelAccess;
    this._hierarchyConfig = props.hierarchyConfig;
    this._nodeLabelSelectClauseFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
    this._selectQueryFactory = createNodesQueryClauseFactory({
      imodelAccess: props.imodelAccess,
      instanceLabelSelectClauseFactory: this._nodeLabelSelectClauseFactory,
    });
  }

  public async postProcessNode(node: ProcessedHierarchyNode): Promise<ProcessedHierarchyNode> {
    if (ProcessedHierarchyNode.isGroupingNode(node)) {
      return {
        ...node,
        label: this._hierarchyConfig.elementClassGrouping === "enableWithCounts" ? `${node.label} (${node.children.length})` : node.label,
        extendedData: {
          ...node.extendedData,
          // add `modelId` and `categoryId` from the first grouped element
          ...node.children[0].extendedData,
          // `imageId` is assigned to instance nodes at query time, but grouping ones need to
          // be handled during post-processing
          imageId: "icon-ec-class",
        },
      };
    }
    return node;
  }

  public async defineHierarchyLevel(props: DefineHierarchyLevelProps) {
    if (this._isSupported === undefined) {
      this._isSupported = this.isSupported();
    }

    if ((await this._isSupported) === false) {
      return [];
    }

    return this._impl.defineHierarchyLevel(props);
  }

  private async createRootHierarchyLevelDefinition(props: DefineRootHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: props.instanceFilter,
      contentClass: { fullName: "BisCore.Subject", alias: "this" },
    });
    return [
      {
        fullClassName: "BisCore.Subject",
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: "BisCore.Subject",
                  }),
                },
                extendedData: {
                  imageId: "icon-imodel-hollow-2",
                  isSubject: true,
                },
                autoExpand: true,
                supportsFiltering: true,
              })}
            FROM ${instanceFilterClauses.from} this
            ${instanceFilterClauses.joins}
            WHERE
              this.Parent.Id IS NULL
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
        },
      },
    ];
  }

  private async createSubjectChildrenQuery({
    parentNodeInstanceIds: subjectIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const [subjectFilterClauses, modelFilterClauses] = await Promise.all([
      this._selectQueryFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: "BisCore.Subject", alias: "this" },
      }),
      this._selectQueryFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: "BisCore.GeometricModel3d", alias: "this" },
      }),
    ]);
    const [childSubjectIds, childModelIds] = await Promise.all([
      this._idsCache.getChildSubjectIds(subjectIds),
      this._idsCache.getChildSubjectModelIds(subjectIds),
    ]);
    const defs = new Array<HierarchyNodesDefinition>();
    childSubjectIds.length &&
      defs.push({
        fullClassName: "BisCore.Subject",
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: "BisCore.Subject",
                  }),
                },
                hideIfNoChildren: true,
                hasChildren: { selector: `InVirtualSet(?, this.ECInstanceId)` },
                grouping: { byLabel: { action: "merge", groupId: "subject" } },
                extendedData: {
                  imageId: "icon-folder",
                  isSubject: true,
                },
                supportsFiltering: true,
              })}
            FROM ${subjectFilterClauses.from} this
            ${subjectFilterClauses.joins}
            WHERE
              this.ECInstanceId IN (${childSubjectIds.map(() => "?").join(",")})
              ${subjectFilterClauses.where ? `AND ${subjectFilterClauses.where}` : ""}
          `,
          bindings: [
            { type: "idset", value: await this._idsCache.getParentSubjectIds() },
            ...childSubjectIds.map((id): ECSqlBinding => ({ type: "id", value: id })),
          ],
        },
      });
    childModelIds.length &&
      defs.push({
        fullClassName: "BisCore.GeometricModel3d",
        query: {
          ecsql: `
            SELECT model.ECInstanceId AS ECInstanceId, model.*
            FROM (
              SELECT
                ${await this._selectQueryFactory.createSelectClause({
                  ecClassId: { selector: "m.ECClassId" },
                  ecInstanceId: { selector: "m.ECInstanceId" },
                  nodeLabel: {
                    selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                      classAlias: "partition",
                      className: "BisCore.InformationPartitionElement",
                    }),
                  },
                  hideNodeInHierarchy: {
                    selector: `
                      CASE
                        WHEN (
                          json_extract([partition].JsonProperties, '$.PhysicalPartition.Model.Content') IS NOT NULL
                          OR json_extract([partition].JsonProperties, '$.GraphicalPartition3d.Model.Content') IS NOT NULL
                        ) THEN 1
                        ELSE 0
                      END
                    `,
                  },
                  hasChildren: this._hierarchyConfig.showEmptyModels
                    ? {
                        selector: `
                          IFNULL((
                            SELECT 1
                            FROM ${this._hierarchyConfig.elementClassSpecification} e
                            WHERE e.Model.Id = m.ECInstanceId
                            LIMIT 1
                          ), 0)
                        `,
                      }
                    : true,
                  extendedData: {
                    imageId: "icon-model",
                    isModel: true,
                  },
                  supportsFiltering: true,
                })}
              FROM Bis.GeometricModel3d m
              JOIN bis.InformationPartitionElement [partition] ON [partition].ECInstanceId = m.ModeledElement.Id
              WHERE
                m.ECInstanceId IN (${childModelIds.map(() => "?").join(",")})
            ) model
            JOIN ${modelFilterClauses.from} this ON this.ECInstanceId = model.ECInstanceId
            ${modelFilterClauses.joins}
            ${modelFilterClauses.where ? `AND (model.${NodeSelectClauseColumnNames.HideNodeInHierarchy} OR ${modelFilterClauses.where})` : ""}
          `,
          bindings: childModelIds.map((id): ECSqlBinding => ({ type: "id", value: id })),
        },
      });
    return defs;
  }

  private async createISubModeledElementChildrenQuery({
    parentNodeInstanceIds: elementIds,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    // note: we do not apply hierarchy level filtering on this hierarchy level, because it's always
    // hidden - the filter will get applied on the child hierarchy levels
    return [
      {
        fullClassName: "BisCore.GeometricModel3d",
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: "", // doesn't matter - the node is always hidden
                hideNodeInHierarchy: true,
              })}
            FROM BisCore.GeometricModel3d this
            WHERE
              this.ModeledElement.Id IN (${elementIds.map(() => "?").join(",")})
              AND NOT this.IsPrivate
              AND this.ECInstanceId IN (SELECT Model.Id FROM ${this._hierarchyConfig.elementClassSpecification})
          `,
          bindings: [...elementIds.map((id): ECSqlBinding => ({ type: "id", value: id }))],
        },
      },
    ];
  }

  private async createGeometricModel3dChildrenQuery({
    parentNodeInstanceIds: modelIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: "BisCore.SpatialCategory", alias: "this" },
    });
    return [
      {
        fullClassName: "BisCore.SpatialCategory",
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: "BisCore.SpatialCategory",
                  }),
                },
                grouping: { byLabel: { action: "merge", groupId: "category" } },
                hasChildren: true,
                extendedData: {
                  imageId: "icon-layers",
                  isCategory: true,
                  modelIds: { selector: createIdsSelector(modelIds) },
                },
                supportsFiltering: true,
              })}
            FROM ${instanceFilterClauses.from} this
            ${instanceFilterClauses.joins}
            WHERE
              EXISTS (
                SELECT 1
                FROM ${this._hierarchyConfig.elementClassSpecification} element
                WHERE
                  element.Model.Id IN (${modelIds.map(() => "?").join(",")})
                  AND element.Category.Id = +this.ECInstanceId
                  AND element.Parent.Id IS NULL
              )
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
          bindings: modelIds.map((id) => ({ type: "id", value: id })),
        },
      },
    ];
  }

  private async createSpatialCategoryChildrenQuery({
    parentNodeInstanceIds: categoryIds,
    parentNode,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const modelIds = parseIdsSelectorResult(parentNode.extendedData?.modelIds);
    if (modelIds.length === 0) {
      throw new Error(`Invalid category node "${parentNode.label}" - missing model information.`);
    }
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: this._hierarchyConfig.elementClassSpecification, alias: "this" },
    });
    const elementWhereClause = parentNode.extendedData?.childElements ?
      `this.ECInstanceId IN (${parentNode.extendedData.childElements})` :
      `
        this.Category.Id IN (${categoryIds.map(() => "?").join(",")})
        AND this.Model.Id IN (${modelIds.map(() => "?").join(",")})
        AND this.Parent.Id IS NULL
      `;
    return [
      {
        fullClassName: this._hierarchyConfig.elementClassSpecification,
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: this._hierarchyConfig.elementClassSpecification,
                  }),
                },
                grouping: {
                  byClass: this._hierarchyConfig.elementClassGrouping !== "disable",
                },
                hasChildren: {
                  selector: `
                    IFNULL((
                      SELECT 1
                      FROM (
                        SELECT Parent.Id ParentId FROM ${this._hierarchyConfig.elementClassSpecification}
                        UNION ALL
                        SELECT ModeledElement.Id ParentId FROM bis.GeometricModel3d
                      )
                      WHERE ParentId = this.ECInstanceId
                      LIMIT 1
                    ), 0)
                  `,
                },
                extendedData: {
                  modelId: { selector: "IdToHex(this.Model.Id)" },
                  categoryId: { selector: "IdToHex(this.Category.Id)" },
                  imageId: "icon-item",
                },
                supportsFiltering: true,
              })}
            FROM ${instanceFilterClauses.from} this
            ${instanceFilterClauses.joins}
            WHERE
              ${elementWhereClause}
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
          bindings: parentNode.extendedData?.childElements === undefined ? [...categoryIds.map((id) => ({ type: "id", value: id })), ...modelIds.map((id) => ({ type: "id", value: id }))] as ECSqlBinding[] : undefined,
        },
      },
    ];
  }

  private async createGeometricElement3dChildrenQuery({
    parentNodeInstanceIds: elementIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const categoryInstanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: "BisCore.SpatialCategory", alias: "this" },
    });
    const elementInstanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: this._hierarchyConfig.elementClassSpecification, alias: "this" },
    });
    const ctes = [
      `ParentElementCategory(Id) AS (
        SELECT this.Category.Id FROM ${this._hierarchyConfig.elementClassSpecification} this WHERE this.ECInstanceId IN (${elementIds.join(", ")})
      )`
    ]
    return [
      {
        fullClassName: "BisCore.Element",
        query: {
          ctes,
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: "BisCore.SpatialCategory",
                  }),
                },
                grouping: { byLabel: { action: "merge", groupId: "category" } },
                hasChildren: true,
                extendedData: {
                  imageId: "icon-layers",
                  isCategory: true,
                  modelIds: { selector: "json_array(json_array(CAST(IdToHex(el.Model.Id) AS TEXT)))" },
                  childElements: {selector: `(SELECT STRING_AGG(CAST(geo.ECInstanceId AS TEXT), ', ') from ${this._hierarchyConfig.elementClassSpecification} geo WHERE geo.Category.Id = this.ECInstanceId AND geo.Parent.Id IN(${elementIds.join(", ")}))`}
                },
                supportsFiltering: true,
              })}
            FROM ${categoryInstanceFilterClauses.from} this
            JOIN ${this._hierarchyConfig.elementClassSpecification} el ON el.Category.Id = this.ECInstanceId
            ${categoryInstanceFilterClauses.joins}
            WHERE
              el.Parent.Id IN(${elementIds.join(", ")})
              AND this.ECInstanceId NOT IN(SELECT Id FROM ParentElementCategory)
              ${categoryInstanceFilterClauses.where ? `AND ${categoryInstanceFilterClauses.where}` : ""}
            GROUP BY this.ECInstanceId
          `,
        },
      },
      {
        fullClassName: this._hierarchyConfig.elementClassSpecification,
        query: {
          ctes,
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: this._hierarchyConfig.elementClassSpecification,
                  }),
                },
                grouping: {
                  byClass: this._hierarchyConfig.elementClassGrouping !== "disable",
                },
                hasChildren: {
                  selector: `
                    IFNULL((
                      SELECT 1
                      FROM (
                        SELECT Parent.Id ParentId FROM ${this._hierarchyConfig.elementClassSpecification}
                        UNION ALL
                        SELECT ModeledElement.Id ParentId FROM bis.GeometricModel3d
                      )
                      WHERE ParentId = this.ECInstanceId
                      LIMIT 1
                    ), 0)
                  `,
                },
                extendedData: {
                  modelId: { selector: "IdToHex(this.Model.Id)" },
                  categoryId: { selector: "IdToHex(this.Category.Id)" },
                  imageId: "icon-item",
                },
                supportsFiltering: true,
              })}
            FROM ${elementInstanceFilterClauses.from} this
            ${elementInstanceFilterClauses.joins}
            WHERE
              this.Parent.Id IN (${elementIds.map(() => "?").join(",")})
              AND this.Category.Id IN(SELECT Id FROM ParentElementCategory)
              ${elementInstanceFilterClauses.where ? `AND ${elementInstanceFilterClauses.where}` : ""}
          `,
          bindings: elementIds.map((id) => ({ type: "id", value: id })),
        },
      },
    ];
  }

  public static async createInstanceKeyPaths(props: ModelsTreeInstanceKeyPathsProps) {
    if (ModelsTreeInstanceKeyPathsProps.isLabelProps(props)) {
      const labelsFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
      return createInstanceKeyPathsFromInstanceLabel({ ...props, labelsFactory });
    }
    return createInstanceKeyPathsFromTargetItems(props);
  }

  private async isSupported() {
    const [schemaName, className] = this._hierarchyConfig.elementClassSpecification.split(/[\.:]/);
    if (!schemaName || !className) {
      throw new Error(
        `Provided class specification ${this._hierarchyConfig.elementClassSpecification} should be in format {SchemaName}:{ClassName} or {SchemaName}.{ClassName}`,
      );
    }

    const query: ECSqlQueryDef = {
      ecsql: `
        SELECT 1
        FROM ECDbMeta.ECSchemaDef s
        JOIN ECDbMeta.ECClassDef c ON c.Schema.Id = s.ECInstanceId
        WHERE s.Name = ? AND c.Name = ? AND c.ECInstanceId IS (BisCore.GeometricElement3d)
      `,
      bindings: [
        { type: "string", value: schemaName },
        { type: "string", value: className },
      ],
    };

    for await (const _row of this._queryExecutor.createQueryReader(query)) {
      return true;
    }
    return false;
  }
}

function createGeometricElementInstanceKeyPaths(
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor,
  idsCache: ModelsTreeIdsCache,
  hierarchyConfig: ModelsTreeHierarchyConfiguration,
  targetItems: Array<Id64String | ElementsGroupInfo>,
): Observable<HierarchyFilteringPath> {
  const elementIds = targetItems.filter((info): info is Id64String => typeof info === "string");
  const groupInfos = targetItems.filter((info): info is ElementsGroupInfo => typeof info !== "string");
  const separator = ";";

  return defer(() => {
    const targetElementsInfoQuery =
      elementIds.length > 0
        ? `
          SELECT e.ECInstanceId, e.ECClassId, e.Parent.Id, e.Model.Id, e.Category.Id, -1
          FROM ${hierarchyConfig.elementClassSpecification} e
           WHERE e.ECInstanceId IN (${elementIds.join(",")})
            `
        : undefined;

    const targetGroupingNodesElementInfoQueries = groupInfos.map(
      ({ parent, groupingNode }, index) => `
        SELECT e.ECInstanceId, e.ECClassId, e.Parent.Id, e.Model.Id, e.Category.Id, ${index}
        FROM ${hierarchyConfig.elementClassSpecification} e
        WHERE
          e.ECClassId IS (${groupingNode.key.className})
          AND ${parent.type === "element" ? `e.Parent.Id IN (${parent.ids.join(",")})` : `e.Parent.Id IS NULL AND e.Category.Id IN (${parent.ids.join(",")}) AND e.Model.Id IN (${parent.modelIds.join(",")})`}
        `,
    );

    const ctes = [
      `InstanceElementsWithClassGroupingNodes(ECInstanceId, ECClassId, ParentId, ModelId, CategoryId, GroupingNodeIndex) AS (
        ${[...(targetElementsInfoQuery ? [targetElementsInfoQuery] : []), ...targetGroupingNodesElementInfoQueries].join(" UNION ALL ")}
      )`,
      `ModelsCategoriesElementsHierarchy(ECInstanceId, ParentId, ModelId, GroupingNodeIndex, Path) AS (
        SELECT
          e.ECInstanceId,
          e.ParentId,
          e.ModelId,
          e.GroupingNodeIndex,
          IIF(e.ParentId IS NULL,
            'm${separator}' || CAST(IdToHex([m].[ECInstanceId]) AS TEXT) || '${separator}c${separator}' || CAST(IdToHex([c].[ECInstanceId]) AS TEXT) || '${separator}e${separator}' || CAST(IdToHex([e].[ECInstanceId]) AS TEXT),
            'e${separator}' || CAST(IdToHex([e].[ECInstanceId]) AS TEXT)
          )

        FROM InstanceElementsWithClassGroupingNodes e
         LEFT JOIN bis.GeometricModel3d m ON (e.ParentId IS NULL AND m.ECInstanceId = e.ModelId)
         LEFT JOIN bis.SpatialCategory c ON (e.ParentId IS NULL AND c.ECInstanceId = e.CategoryId)

        UNION ALL

        SELECT
          pe.ECInstanceId,
          pe.Parent.Id,
          pe.Model.Id,
          ce.GroupingNodeIndex,
          IIF(pe.Parent.Id IS NULL,
            'm${separator}' || CAST(IdToHex([m].[ECInstanceId]) AS TEXT) || '${separator}c${separator}' || CAST(IdToHex([c].[ECInstanceId]) AS TEXT) || '${separator}e${separator}' || CAST(IdToHex([pe].[ECInstanceId]) AS TEXT) || '${separator}' || ce.Path,
            'e${separator}' || CAST(IdToHex([pe].[ECInstanceId]) AS TEXT) || '${separator}' || ce.Path
          )
        FROM ModelsCategoriesElementsHierarchy ce
        JOIN ${hierarchyConfig.elementClassSpecification} pe ON (pe.ECInstanceId = ce.ParentId OR pe.ECInstanceId = ce.ModelId AND ce.ParentId IS NULL)
        LEFT JOIN bis.GeometricModel3d m ON (pe.Parent.Id IS NULL AND m.ECInstanceId = pe.Model.Id)
        LEFT JOIN bis.SpatialCategory c ON (pe.Parent.Id IS NULL AND c.ECInstanceId = pe.Category.Id)
      )`,
    ];
    const ecsql = `
      SELECT mce.ModelId, mce.Path, mce.GroupingNodeIndex
      FROM ModelsCategoriesElementsHierarchy mce
      WHERE mce.ParentId IS NULL
    `;

    return imodelAccess.createQueryReader({ ctes, ecsql }, { rowFormat: "Indexes", limit: "unbounded" });
  }).pipe(
    releaseMainThreadOnItemsCount(300),
    map((row) => parseQueryRow(row, groupInfos, separator, hierarchyConfig.elementClassSpecification)),
    mergeMap(({ modelId, elementHierarchyPath, groupingNode }) =>
      from(idsCache.createModelInstanceKeyPaths(modelId)).pipe(
        mergeAll(),
        map((modelPath) => {
          // We dont want to modify the original path, we create a copy that we can modify
          const newModelPath = [...modelPath];
          newModelPath.pop(); // model is already included in the element hierarchy path
          const path = [...newModelPath, ...elementHierarchyPath];
          if (!groupingNode) {
            return path;
          }
          return {
            path,
            options: {
              autoExpand: {
                key: groupingNode.key,
                depth: groupingNode.parentKeys.length,
              },
            },
          };
        }),
      ),
    ),
  );
}

function parseQueryRow(row: ECSqlQueryRow, groupInfos: ElementsGroupInfo[], separator: string, elementClassName: string) {
  const rowElements: string[] = row[1].split(separator);
  const path = new Array<InstanceKey>();
  for (let i = 0; i < rowElements.length; i += 2) {
    switch (rowElements[i]) {
      case "e":
        path.push({ className: elementClassName, id: rowElements[i + 1] });
        break;
      case "c":
        path.push({ className: "BisCore.SpatialCategory", id: rowElements[i + 1] });
        break;
      case "m":
        path.push({ className: "BisCore.GeometricModel3d", id: rowElements[i + 1] });
        break;
    }
  }
  return {
    modelId: row[0],
    elementHierarchyPath: path,
    groupingNode: row[2] === -1 ? undefined : groupInfos[row[2]].groupingNode,
  };
}

async function createInstanceKeyPathsFromTargetItems({
  targetItems,
  imodelAccess,
  hierarchyConfig,
  idsCache,
  limit,
}: ModelsTreeInstanceKeyPathsFromTargetItemsProps): Promise<HierarchyFilteringPath[]> {
  if (limit !== "unbounded" && targetItems.length > (limit ?? MAX_FILTERING_INSTANCE_KEY_COUNT)) {
    throw new FilterLimitExceededError(limit ?? MAX_FILTERING_INSTANCE_KEY_COUNT);
  }

  return lastValueFrom(
    from(targetItems).pipe(
      releaseMainThreadOnItemsCount(2000),
      mergeMap(async (key): Promise<{ key: string; type: number } | { key: ElementsGroupInfo; type: 0 }> => {
        if ("parent" in key) {
          return { key, type: 0 };
        }

        if (await imodelAccess.classDerivesFrom(key.className, "BisCore.Subject")) {
          return { key: key.id, type: 1 };
        }

        if (await imodelAccess.classDerivesFrom(key.className, "BisCore.Model")) {
          return { key: key.id, type: 2 };
        }

        if (await imodelAccess.classDerivesFrom(key.className, "BisCore.SpatialCategory")) {
          return { key: key.id, type: 3 };
        }

        return { key: key.id, type: 0 };
      }, 2),
      reduce(
        (acc, value) => {
          if (value.type === 1) {
            acc.subjects.push(value.key);
            return acc;
          }
          if (value.type === 2) {
            acc.models.push(value.key);
            return acc;
          }
          if (value.type === 3) {
            acc.categories.push(value.key);
            return acc;
          }
          acc.elements.push(value.key);
          return acc;
        },
        {
          models: new Array<Id64String>(),
          categories: new Array<Id64String>(),
          subjects: new Array<Id64String>(),
          elements: new Array<Id64String | ElementsGroupInfo>(),
        },
      ),
      switchMap(async (ids) => {
        const elementsLength = ids.elements.length;
        return collect(
          merge(
            from(ids.subjects).pipe(mergeMap((id) => from(idsCache.createSubjectInstanceKeysPath(id)))),
            from(ids.models).pipe(mergeMap((id) => from(idsCache.createModelInstanceKeyPaths(id)).pipe(mergeAll()))),
            from(ids.categories).pipe(mergeMap((id) => from(idsCache.createCategoryInstanceKeyPaths(id)).pipe(mergeAll()))),
            from(ids.elements).pipe(
              bufferCount(Math.ceil(elementsLength / Math.ceil(elementsLength / 5000))),
              releaseMainThreadOnItemsCount(1),
              mergeMap((block) => createGeometricElementInstanceKeyPaths(imodelAccess, idsCache, hierarchyConfig, block), 10),
            ),
          ),
        );
      }),
    ),
  );
}

async function createInstanceKeyPathsFromInstanceLabel(
  props: ModelsTreeInstanceKeyPathsFromInstanceLabelProps & { labelsFactory: IInstanceLabelSelectClauseFactory },
) {
  const elementLabelSelectClause = await props.labelsFactory.createSelectClause({
    classAlias: "e",
    className: "BisCore.Element",
    // eslint-disable-next-line @typescript-eslint/unbound-method
    selectorsConcatenator: ECSql.createConcatenatedValueStringSelector,
  });
  const targetsReader = props.imodelAccess.createQueryReader(
    {
      ecsql: `
        SELECT *
        FROM (
          SELECT
            ec_classname(e.ECClassId, 's.c'),
            e.ECInstanceId,
            ${elementLabelSelectClause} Label
          FROM BisCore.Element e
          WHERE e.ECClassId IS (BisCore.Subject, BisCore.SpatialCategory, ${props.hierarchyConfig.elementClassSpecification})

          UNION ALL

          SELECT
            ec_classname(m.ECClassId, 's.c'),
            m.ECInstanceId,
            ${elementLabelSelectClause} Label
          FROM BisCore.GeometricModel3d m
          JOIN BisCore.Element e ON e.ECInstanceId = m.ModeledElement.Id
          WHERE NOT m.IsPrivate
            ${props.hierarchyConfig.showEmptyModels ? "" : `AND EXISTS (SELECT 1 FROM ${props.hierarchyConfig.elementClassSpecification} WHERE Model.Id = m.ECInstanceId)`}
            AND json_extract(e.JsonProperties, '$.PhysicalPartition.Model.Content') IS NULL
            AND json_extract(e.JsonProperties, '$.GraphicalPartition3d.Model.Content') IS NULL
        )
        WHERE Label LIKE '%' || ? || '%' ESCAPE '\\'
        LIMIT ${MAX_FILTERING_INSTANCE_KEY_COUNT + 1}
      `,
      bindings: [{ type: "string", value: props.label.replace(/[%_\\]/g, "\\$&") }],
    },
    { rowFormat: "Indexes", restartToken: "tree-widget/models-tree/filter-by-label-query", limit: props.limit },
  );

  const targetKeys = new Array<InstanceKey>();
  for await (const row of targetsReader) {
    targetKeys.push({ className: row[0], id: row[1] });
  }

  return createInstanceKeyPathsFromTargetItems({ ...props, targetItems: targetKeys });
}
