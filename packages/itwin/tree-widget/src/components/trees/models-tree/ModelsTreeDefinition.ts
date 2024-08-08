/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, from, map, merge, mergeAll, mergeMap } from "rxjs";
import {
  createClassBasedHierarchyDefinition, createNodesQueryClauseFactory, HierarchyNode, NodeSelectClauseColumnNames,
} from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql } from "@itwin/presentation-shared";
import { collect } from "../common/Rxjs";
import { FilterLimitExceededError } from "../common/TreeErrors";
import { createIdsSelector, parseIdsSelectorResult } from "../common/Utils";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { Observable } from "rxjs";
import type {
  createHierarchyProvider,
  DefineHierarchyLevelProps,
  DefineInstanceNodeChildHierarchyLevelProps,
  DefineRootHierarchyLevelProps,
  HierarchyDefinition,
  HierarchyLevelDefinition,
  HierarchyNodeIdentifiersPath,
  HierarchyNodesDefinition,
  LimitingECSqlQueryExecutor,
  NodesQueryClauseFactory,
  ProcessedHierarchyNode,
} from "@itwin/presentation-hierarchies";
import type {
  ECClassHierarchyInspector,
  ECSchemaProvider,
  ECSqlBinding,
  ECSqlQueryDef,
  IInstanceLabelSelectClauseFactory,
  InstanceKey,
} from "@itwin/presentation-shared";
import type { ModelsTreeIdsCache } from "./internal/ModelsTreeIdsCache";
import type { ClassGroupingHierarchyNode } from "../common/FocusedInstancesContext";

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

interface ModelsTreeInstanceKeyPathsFromInstanceKeysProps {
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  idsCache: ModelsTreeIdsCache;
  focusedItems: Array<InstanceKey | ElementsGroupInfo>;
  hierarchyConfig: ModelsTreeHierarchyConfiguration;
}

interface ModelsTreeInstanceKeyPathsFromInstanceLabelProps {
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  idsCache: ModelsTreeIdsCache;
  label: string;
  hierarchyConfig: ModelsTreeHierarchyConfiguration;
}

export type ModelsTreeInstanceKeyPathsProps = ModelsTreeInstanceKeyPathsFromInstanceKeysProps | ModelsTreeInstanceKeyPathsFromInstanceLabelProps;
type HierarchyProviderProps = Parameters<typeof createHierarchyProvider>[0];
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
    this._impl = createClassBasedHierarchyDefinition({
      classHierarchyInspector: props.imodelAccess,
      hierarchy: {
        rootNodes: async (requestProps) => this.createRootHierarchyLevelDefinition(requestProps),
        childNodes: [
          {
            parentNodeClassName: "BisCore.Subject",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createSubjectChildrenQuery(requestProps),
          },
          {
            parentNodeClassName: "BisCore.ISubModeledElement",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createISubModeledElementChildrenQuery(requestProps),
          },
          {
            parentNodeClassName: "BisCore.GeometricModel3d",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createGeometricModel3dChildrenQuery(requestProps),
          },
          {
            parentNodeClassName: "BisCore.SpatialCategory",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createSpatialCategoryChildrenQuery(requestProps),
          },
          {
            parentNodeClassName: "BisCore.GeometricElement3d",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createGeometricElement3dChildrenQuery(requestProps),
          },
        ],
      },
    });
    this._idsCache = props.idsCache;
    this._queryExecutor = props.imodelAccess;
    this._hierarchyConfig = props.hierarchyConfig;
    this._selectQueryFactory = createNodesQueryClauseFactory({ imodelAccess: props.imodelAccess });
    this._nodeLabelSelectClauseFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
  }

  public async postProcessNode(node: ProcessedHierarchyNode): Promise<ProcessedHierarchyNode> {
    if (HierarchyNode.isClassGroupingNode(node)) {
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
              this.Parent IS NULL
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
                  AND element.Parent IS NULL
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
              this.Category.Id IN (${categoryIds.map(() => "?").join(",")})
              AND this.Model.Id IN (${modelIds.map(() => "?").join(",")})
              AND this.Parent IS NULL
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
          bindings: [...categoryIds.map((id) => ({ type: "id", value: id })), ...modelIds.map((id) => ({ type: "id", value: id }))] as ECSqlBinding[],
        },
      },
    ];
  }

  private async createGeometricElement3dChildrenQuery({
    parentNodeInstanceIds: elementIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: this._hierarchyConfig.elementClassSpecification, alias: "this" },
    });
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
              this.Parent.Id IN (${elementIds.map(() => "?").join(",")})
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
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
    return createInstanceKeyPathsFromFilteredItems(props);
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

function createSubjectInstanceKeysPath(subjectId: Id64String, idsCache: ModelsTreeIdsCache): Observable<HierarchyNodeIdentifiersPath> {
  return from(idsCache.getSubjectAncestorsPath(subjectId)).pipe(map((idsPath) => idsPath.map((id) => ({ className: "BisCore.Subject", id }))));
}

function createModelInstanceKeyPaths(modelId: Id64String, idsCache: ModelsTreeIdsCache): Observable<HierarchyNodeIdentifiersPath> {
  return from(idsCache.getModelSubjects(modelId)).pipe(
    mergeAll(),
    mergeMap((modelSubjectId) =>
      createSubjectInstanceKeysPath(modelSubjectId, idsCache).pipe(
        map((subjectPath) => [...subjectPath, { className: "BisCore.GeometricModel3d", id: modelId }]),
      ),
    ),
  );
}

function createCategoryInstanceKeyPaths(categoryId: Id64String, idsCache: ModelsTreeIdsCache): Observable<HierarchyNodeIdentifiersPath> {
  return from(idsCache.getCategoryModels(categoryId)).pipe(
    mergeAll(),
    mergeMap((categoryModelId) =>
      createModelInstanceKeyPaths(categoryModelId, idsCache).pipe(map((modelPath) => [...modelPath, { className: "BisCore.SpatialCategory", id: categoryId }])),
    ),
  );
}

function createGeometricElementInstanceKeyPaths(
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor,
  idsCache: ModelsTreeIdsCache,
  hierarchyConfig: ModelsTreeHierarchyConfiguration,
  focusedItems: Array<Id64String | ElementsGroupInfo>,
): Observable<HierarchyFilteringPath> {
  const elementIds = focusedItems.filter((info): info is Id64String => typeof info === "string");
  const groupInfos = focusedItems.filter((info): info is ElementsGroupInfo => typeof info !== "string");

  return defer(() => {
    const bindings = new Array<ECSqlBinding>();
    const bind = (selector: string, idSet: Id64Array) => {
      bindings.push(...idSet.map((id) => ({ type: "id" as const, value: id })));
      return `${selector} IN (${idSet.map(() => "?").join(",")})`;
    };

    const focusedElementsInfoQuery =
      elementIds.length > 0
        ? `
          SELECT e.ECInstanceId, e.ECClassId, e.Parent.Id, e.Model.Id, e.Category.Id, -1
          FROM ${hierarchyConfig.elementClassSpecification} e
          WHERE ${bind("e.ECInstanceId", elementIds)}
          `
        : undefined;

    const focusedGroupingNodesElementInfoQueries = groupInfos.map(
      ({ parent, groupingNode }, index) => `
        SELECT e.ECInstanceId, e.ECClassId, e.Parent.Id, e.Model.Id, e.Category.Id, ${index}
        FROM ${hierarchyConfig.elementClassSpecification} e
        WHERE
          e.ECClassId IS (${groupingNode.key.className})
          AND ${parent.type === "element" ? bind("e.Parent.Id", parent.ids) : `e.Parent IS NULL AND ${bind("e.Category.Id", parent.ids)} AND ${bind("e.Model.Id", parent.modelIds)}`}
        `,
    );

    const ctes = [
      `InstanceElementsWithClassGroupingNodes(ECInstanceId, ECClassId, ParentId, ModelId, CategoryId, GroupingNodeIndex) AS (
        ${[...(focusedElementsInfoQuery ? [focusedElementsInfoQuery] : []), ...focusedGroupingNodesElementInfoQueries].join("\n\nUNION ALL\n\n")}
      )`,
      `ModelsCategoriesElementsHierarchy(ECInstanceId, ParentId, ModelId, GroupingNodeIndex, Path) AS (
        SELECT
          e.ECInstanceId,
          e.ParentId,
          e.ModelId,
          e.GroupingNodeIndex,
          json_array(
            ${createECInstanceKeySelectClause({ alias: "e" })},
            IIF(e.ParentId IS NULL, ${createECInstanceKeySelectClause({ alias: "c" })}, NULL),
            IIF(e.ParentId IS NULL, ${createECInstanceKeySelectClause({ alias: "m" })}, NULL)
          )
        FROM InstanceElementsWithClassGroupingNodes e
        JOIN bis.GeometricModel3d m ON m.ECInstanceId = e.ModelId
        JOIN bis.SpatialCategory c ON c.ECInstanceId = e.CategoryId

        UNION ALL

        SELECT
          pe.ECInstanceId,
          pe.Parent.Id,
          pe.Model.Id,
          ce.GroupingNodeIndex,
          json_insert(
            ce.Path,
            '$[#]', ${createECInstanceKeySelectClause({ alias: "pe" })},
            '$[#]', IIF(pe.Parent.Id IS NULL, ${createECInstanceKeySelectClause({ alias: "c" })}, NULL),
            '$[#]', IIF(pe.Parent.Id IS NULL, ${createECInstanceKeySelectClause({ alias: "m" })}, NULL)
          )
        FROM ModelsCategoriesElementsHierarchy ce
        JOIN ${hierarchyConfig.elementClassSpecification} pe ON (pe.ECInstanceId = ce.ParentId OR pe.ECInstanceId = ce.ModelId AND ce.ParentId IS NULL)
        JOIN bis.GeometricModel3d m ON m.ECInstanceId = pe.Model.Id
        JOIN bis.SpatialCategory c ON c.ECInstanceId = pe.Category.Id
      )`,
    ];
    const ecsql = `
      SELECT mce.ModelId, mce.Path, mce.GroupingNodeIndex
      FROM ModelsCategoriesElementsHierarchy mce
      WHERE mce.ParentId IS NULL
    `;

    return imodelAccess.createQueryReader({ ctes, ecsql, bindings }, { rowFormat: "Indexes" });
  }).pipe(
    map((row) => ({
      modelId: row[0],
      elementHierarchyPath: flatten<InstanceKey | undefined>(JSON.parse(row[1])).reverse(),
      groupingNode: row[2] === -1 ? undefined : groupInfos[row[2]].groupingNode,
    })),
    mergeMap(({ modelId, elementHierarchyPath, groupingNode }) =>
      createModelInstanceKeyPaths(modelId, idsCache).pipe(
        map((modelPath) => {
          modelPath.pop(); // model is already included in the element hierarchy path
          const path = [...modelPath, ...elementHierarchyPath.filter((x): x is InstanceKey => !!x)];
          if (!groupingNode) {
            return path;
          }
          return {
            path,
            options: {
              autoExpand: { key: groupingNode.key, hierarchyDepth: groupingNode.hierarchyDepth },
            },
          };
        }),
      ),
    ),
  );
}

async function createInstanceKeyPathsFromFilteredItems({
  focusedItems,
  imodelAccess,
  hierarchyConfig,
  idsCache,
}: ModelsTreeInstanceKeyPathsFromInstanceKeysProps): Promise<HierarchyFilteringPath[]> {
  if (focusedItems.length > MAX_FILTERING_INSTANCE_KEY_COUNT) {
    throw new FilterLimitExceededError(MAX_FILTERING_INSTANCE_KEY_COUNT);
  }
  const ids = {
    models: new Array<Id64String>(),
    categories: new Array<Id64String>(),
    subjects: new Array<Id64String>(),
    elements: new Array<Id64String | ElementsGroupInfo>(),
  };
  await Promise.all(
    focusedItems.map(async (key) => {
      if ("parent" in key) {
        ids.elements.push(key);
      } else if (await imodelAccess.classDerivesFrom(key.className, "BisCore.Subject")) {
        ids.subjects.push(key.id);
      } else if (await imodelAccess.classDerivesFrom(key.className, "BisCore.Model")) {
        ids.models.push(key.id);
      } else if (await imodelAccess.classDerivesFrom(key.className, "BisCore.SpatialCategory")) {
        ids.categories.push(key.id);
      } else {
        ids.elements.push(key.id);
      }
    }),
  );
  return collect(
    merge(
      from(ids.subjects).pipe(mergeMap((id) => createSubjectInstanceKeysPath(id, idsCache))),
      from(ids.models).pipe(mergeMap((id) => createModelInstanceKeyPaths(id, idsCache))),
      from(ids.categories).pipe(mergeMap((id) => createCategoryInstanceKeyPaths(id, idsCache))),
      ids.elements.length ? createGeometricElementInstanceKeyPaths(imodelAccess, idsCache, hierarchyConfig, ids.elements) : EMPTY,
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
    { rowFormat: "Indexes", restartToken: "tree-widget/models-tree/filter-by-label-query" },
  );

  const targetKeys = new Array<InstanceKey>();
  for await (const row of targetsReader) {
    targetKeys.push({ className: row[0], id: row[1] });
  }

  return createInstanceKeyPathsFromFilteredItems({ ...props, focusedItems: targetKeys });
}

function createECInstanceKeySelectClause(props: { alias: string }) {
  const classIdSelector = `[${props.alias}].[ECClassId]`;
  const instanceHexIdSelector = `IdToHex([${props.alias}].[ECInstanceId])`;
  return `json_object('className', ec_classname(${classIdSelector}, 's.c'), 'id', ${instanceHexIdSelector})`;
}

type ArrayOrValue<T> = T | Array<ArrayOrValue<T>>;
function flatten<T>(source: Array<ArrayOrValue<T>>): T[] {
  return source.reduce<T[]>((flat, item): T[] => {
    return [...flat, ...(Array.isArray(item) ? flatten(item) : [item])];
  }, new Array<T>());
}
