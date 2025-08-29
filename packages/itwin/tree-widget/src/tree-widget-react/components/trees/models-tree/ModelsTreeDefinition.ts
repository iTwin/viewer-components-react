/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  bufferCount,
  defaultIfEmpty,
  defer,
  firstValueFrom,
  from,
  fromEvent,
  identity,
  lastValueFrom,
  map,
  merge,
  mergeAll,
  mergeMap,
  reduce,
  switchMap,
  takeUntil,
  toArray,
} from "rxjs";
import { IModel } from "@itwin/core-common";
import {
  createNodesQueryClauseFactory,
  createPredicateBasedHierarchyDefinition,
  HierarchyFilteringPath,
  NodeSelectClauseColumnNames,
  ProcessedHierarchyNode,
} from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql } from "@itwin/presentation-shared";
import {
  CLASS_NAME_Element,
  CLASS_NAME_GeometricElement3d,
  CLASS_NAME_GeometricModel3d,
  CLASS_NAME_InformationPartitionElement,
  CLASS_NAME_ISubModeledElement,
  CLASS_NAME_Model,
  CLASS_NAME_SpatialCategory,
  CLASS_NAME_Subject,
} from "../common/internal/ClassNameDefinitions.js";
import { collect } from "../common/internal/Rxjs.js";
import { createIdsSelector, parseIdsSelectorResult, releaseMainThreadOnItemsCount } from "../common/internal/Utils.js";
import { FilterLimitExceededError } from "../common/TreeErrors.js";

import type { NormalizedHierarchyFilteringPath } from "../common/Utils.js";
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
  DefineHierarchyLevelProps,
  DefineInstanceNodeChildHierarchyLevelProps,
  GroupingHierarchyNode,
  HierarchyDefinition,
  HierarchyLevelDefinition,
  HierarchyNodesDefinition,
  LimitingECSqlQueryExecutor,
  NodesQueryClauseFactory,
} from "@itwin/presentation-hierarchies";
import type { ModelsTreeIdsCache } from "./internal/ModelsTreeIdsCache.js";
import type { ElementId } from "../common/internal/Types.js";

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
  /** Full class name of a `GeometricElement3d` sub-class that should be used to load element nodes. Defaults to `BisCore.GeometricElement3d`. */
  elementClassSpecification: string;
  /** Should models without elements be shown. Defaults to `false`. */
  showEmptyModels: boolean;
  /** Should the root Subject node be hidden. Defaults to `false`. */
  hideRootSubject: boolean;
  /** Should hierarchy level be filterable. Defaults to `enable` */
  hierarchyLevelFiltering: "enable" | "disable";
}

/** @internal */
export const defaultHierarchyConfiguration: ModelsTreeHierarchyConfiguration = {
  elementClassGrouping: "enable",
  elementClassSpecification: CLASS_NAME_GeometricElement3d,
  showEmptyModels: false,
  hideRootSubject: false,
  hierarchyLevelFiltering: "enable",
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

interface ModelsTreeInstanceKeyPathsBaseProps {
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  idsCache: ModelsTreeIdsCache;
  hierarchyConfig: ModelsTreeHierarchyConfiguration;
  limit?: number | "unbounded";
  abortSignal?: AbortSignal;
}

type ModelsTreeInstanceKeyPathsFromTargetItemsProps = {
  targetItems: Array<InstanceKey | ElementsGroupInfo>;
} & ModelsTreeInstanceKeyPathsBaseProps;

type ModelsTreeInstanceKeyPathsFromInstanceLabelProps = {
  label: string;
} & ModelsTreeInstanceKeyPathsBaseProps;

/** @internal */
export type ModelsTreeInstanceKeyPathsProps = ModelsTreeInstanceKeyPathsFromTargetItemsProps | ModelsTreeInstanceKeyPathsFromInstanceLabelProps;

// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace ModelsTreeInstanceKeyPathsProps {
  export function isLabelProps(props: ModelsTreeInstanceKeyPathsProps): props is ModelsTreeInstanceKeyPathsFromInstanceLabelProps {
    return !!(props as ModelsTreeInstanceKeyPathsFromInstanceLabelProps).label;
  }
}

/** @internal */
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
        rootNodes: async (requestProps) =>
          this.createSubjectChildrenQuery({ ...requestProps, parentNodeInstanceIds: this._hierarchyConfig.hideRootSubject ? [IModel.rootSubjectId] : [] }),
        childNodes: [
          {
            parentInstancesNodePredicate: CLASS_NAME_Subject,
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createSubjectChildrenQuery(requestProps),
          },
          {
            parentInstancesNodePredicate: CLASS_NAME_ISubModeledElement,
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createISubModeledElementChildrenQuery(requestProps),
          },
          {
            parentInstancesNodePredicate: CLASS_NAME_GeometricModel3d,
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createGeometricModel3dChildrenQuery(requestProps),
          },
          {
            parentInstancesNodePredicate: CLASS_NAME_SpatialCategory,
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createSpatialCategoryChildrenQuery(requestProps),
          },
          {
            parentInstancesNodePredicate: CLASS_NAME_GeometricElement3d,
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

  private async createSubjectChildrenQuery({
    parentNodeInstanceIds: parentSubjectIds,
    instanceFilter,
  }: Pick<DefineInstanceNodeChildHierarchyLevelProps, "parentNodeInstanceIds" | "instanceFilter">): Promise<HierarchyLevelDefinition> {
    const [subjectFilterClauses, modelFilterClauses] = await Promise.all([
      this._selectQueryFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: CLASS_NAME_Subject, alias: "this" },
      }),
      this._selectQueryFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: CLASS_NAME_GeometricModel3d, alias: "this" },
      }),
    ]);
    const [childSubjectIds, childModelIds] = parentSubjectIds.length
      ? await Promise.all([this._idsCache.getChildSubjectIds(parentSubjectIds), this._idsCache.getChildSubjectModelIds(parentSubjectIds)])
      : [[IModel.rootSubjectId], []];
    const defs = new Array<HierarchyNodesDefinition>();
    childSubjectIds.length &&
      defs.push({
        fullClassName: CLASS_NAME_Subject,
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: CLASS_NAME_Subject,
                  }),
                },
                hideIfNoChildren: true,
                hasChildren: { selector: `InVirtualSet(?, this.ECInstanceId)` },
                grouping: { byLabel: { action: "merge", groupId: "subject" } },
                extendedData: {
                  imageId: { selector: `IIF(this.ECInstanceId = ${IModel.rootSubjectId}, 'icon-imodel-hollow-2', 'icon-folder')` },
                  isSubject: true,
                },
                autoExpand: { selector: `IIF(this.ECInstanceId = ${IModel.rootSubjectId}, true, false)` },
                supportsFiltering: this.supportsFiltering(),
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
        fullClassName: CLASS_NAME_GeometricModel3d,
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
                      className: CLASS_NAME_InformationPartitionElement,
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
                  supportsFiltering: this.supportsFiltering(),
                })}
              FROM ${CLASS_NAME_GeometricModel3d} m
              JOIN ${CLASS_NAME_InformationPartitionElement} [partition] ON [partition].ECInstanceId = m.ModeledElement.Id
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
        fullClassName: CLASS_NAME_GeometricModel3d,
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: "", // doesn't matter - the node is always hidden
                hideNodeInHierarchy: true,
              })}
            FROM ${CLASS_NAME_GeometricModel3d} this
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
      contentClass: { fullName: CLASS_NAME_SpatialCategory, alias: "this" },
    });
    return [
      {
        fullClassName: CLASS_NAME_SpatialCategory,
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: CLASS_NAME_SpatialCategory,
                  }),
                },
                grouping: { byLabel: { action: "merge", groupId: "category" } },
                hasChildren: true,
                extendedData: {
                  imageId: "icon-layers",
                  isCategory: true,
                  modelIds: { selector: createIdsSelector(modelIds) },
                },
                supportsFiltering: this.supportsFiltering(),
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
    const modeledElements = await firstValueFrom(
      from(modelIds).pipe(
        mergeMap(async (modelId) => this._idsCache.getCategoriesModeledElements(modelId, categoryIds)),
        reduce((acc, foundModeledElements) => {
          return acc.concat(foundModeledElements);
        }, new Array<ElementId>()),
      ),
    );
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
                    IIF(
                      ${modeledElements.length ? `this.ECInstanceId IN (${modeledElements.join(",")})` : `FALSE`},
                      1,
                      IFNULL((
                        SELECT 1
                        FROM ${this._hierarchyConfig.elementClassSpecification} ce
                        WHERE ce.Parent.Id = this.ECInstanceId
                        LIMIT 1
                      ), 0)
                    )
                  `,
                },
                extendedData: {
                  modelId: { selector: "IdToHex(this.Model.Id)" },
                  categoryId: { selector: "IdToHex(this.Category.Id)" },
                  imageId: "icon-item",
                },
                supportsFiltering: this.supportsFiltering(),
              })}
            FROM ${instanceFilterClauses.from} this
            ${instanceFilterClauses.joins}
            WHERE
              this.Category.Id IN (${categoryIds.map(() => "?").join(",")})
              AND this.Model.Id IN (${modelIds.map(() => "?").join(",")})
              AND this.Parent.Id IS NULL
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
                      FROM ${this._hierarchyConfig.elementClassSpecification} ce
                      JOIN ${CLASS_NAME_Model} m ON ce.Model.Id = m.ECInstanceId
                      WHERE ce.Parent.Id = this.ECInstanceId OR (ce.Model.Id = this.ECInstanceId AND m.IsPrivate = false)
                      LIMIT 1
                    ), 0)
                  `,
                },
                extendedData: {
                  modelId: { selector: "IdToHex(this.Model.Id)" },
                  categoryId: { selector: "IdToHex(this.Category.Id)" },
                  imageId: "icon-item",
                },
                supportsFiltering: this.supportsFiltering(),
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

  public static async createInstanceKeyPaths(props: ModelsTreeInstanceKeyPathsProps): Promise<NormalizedHierarchyFilteringPath[]> {
    return lastValueFrom(
      defer(() => {
        if (ModelsTreeInstanceKeyPathsProps.isLabelProps(props)) {
          const labelsFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
          return createInstanceKeyPathsFromInstanceLabelObs({ ...props, labelsFactory });
        }
        return createInstanceKeyPathsFromTargetItemsObs(props);
      }).pipe(props.abortSignal ? takeUntil(fromEvent(props.abortSignal, "abort")) : identity, defaultIfEmpty([])),
    );
  }

  private supportsFiltering() {
    return this._hierarchyConfig.hierarchyLevelFiltering === "enable";
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
): Observable<NormalizedHierarchyFilteringPath> {
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
         LEFT JOIN ${CLASS_NAME_GeometricModel3d} m ON (e.ParentId IS NULL AND m.ECInstanceId = e.ModelId)
         LEFT JOIN ${CLASS_NAME_SpatialCategory} c ON (e.ParentId IS NULL AND c.ECInstanceId = e.CategoryId)

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
        LEFT JOIN ${CLASS_NAME_GeometricModel3d} m ON (pe.Parent.Id IS NULL AND m.ECInstanceId = pe.Model.Id)
        LEFT JOIN ${CLASS_NAME_SpatialCategory} c ON (pe.Parent.Id IS NULL AND c.ECInstanceId = pe.Category.Id)
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
          // We don't want to modify the original path, we create a copy that we can modify
          const newModelPath = [...modelPath];
          newModelPath.pop(); // model is already included in the element hierarchy path
          const path = [...newModelPath, ...elementHierarchyPath];
          if (!groupingNode) {
            return { path };
          }
          return {
            path,
            options: {
              autoExpand: {
                depthInHierarchy: groupingNode.parentKeys.length,
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
        path.push({ className: CLASS_NAME_SpatialCategory, id: rowElements[i + 1] });
        break;
      case "m":
        path.push({ className: CLASS_NAME_GeometricModel3d, id: rowElements[i + 1] });
        break;
    }
  }
  return {
    modelId: row[0],
    elementHierarchyPath: path,
    groupingNode: row[2] === -1 ? undefined : groupInfos[row[2]].groupingNode,
  };
}

function createInstanceKeyPathsFromTargetItemsObs({
  targetItems,
  imodelAccess,
  hierarchyConfig,
  idsCache,
  limit,
}: Omit<ModelsTreeInstanceKeyPathsFromTargetItemsProps, "abortSignal">): Observable<NormalizedHierarchyFilteringPath[]> {
  if (limit !== "unbounded" && targetItems.length > (limit ?? MAX_FILTERING_INSTANCE_KEY_COUNT)) {
    throw new FilterLimitExceededError(limit ?? MAX_FILTERING_INSTANCE_KEY_COUNT);
  }

  return from(targetItems).pipe(
    releaseMainThreadOnItemsCount(2000),
    mergeMap(async (key): Promise<{ key: Id64String; type: number } | { key: ElementsGroupInfo; type: 0 }> => {
      if ("parent" in key) {
        return { key, type: 0 };
      }

      if (await imodelAccess.classDerivesFrom(key.className, CLASS_NAME_Subject)) {
        return { key: key.id, type: 1 };
      }

      if (await imodelAccess.classDerivesFrom(key.className, CLASS_NAME_Model)) {
        return { key: key.id, type: 2 };
      }

      if (await imodelAccess.classDerivesFrom(key.className, CLASS_NAME_SpatialCategory)) {
        return { key: key.id, type: 3 };
      }

      return { key: key.id, type: 0 };
    }, 2),
    reduce(
      (acc, value) => {
        if (value.type === 1) {
          acc.subjectIds.push(value.key);
          return acc;
        }
        if (value.type === 2) {
          acc.modelIds.push(value.key);
          return acc;
        }
        if (value.type === 3) {
          acc.categoryIds.push(value.key);
          return acc;
        }
        acc.elementIds.push(value.key);
        return acc;
      },
      {
        modelIds: new Array<Id64String>(),
        categoryIds: new Array<Id64String>(),
        subjectIds: new Array<Id64String>(),
        elementIds: new Array<Id64String | ElementsGroupInfo>(),
      },
    ),
    switchMap(async (ids) => {
      const elementsLength = ids.elementIds.length;
      return collect(
        merge(
          from(ids.subjectIds).pipe(mergeMap((id) => from(idsCache.createSubjectInstanceKeysPath(id)).pipe(map(HierarchyFilteringPath.normalize)))),
          from(ids.modelIds).pipe(mergeMap((id) => from(idsCache.createModelInstanceKeyPaths(id)).pipe(mergeAll(), map(HierarchyFilteringPath.normalize)))),
          from(ids.categoryIds).pipe(
            mergeMap((id) => from(idsCache.createCategoryInstanceKeyPaths(id)).pipe(mergeAll(), map(HierarchyFilteringPath.normalize))),
          ),
          from(ids.elementIds).pipe(
            bufferCount(Math.ceil(elementsLength / Math.ceil(elementsLength / 5000))),
            releaseMainThreadOnItemsCount(1),
            mergeMap((block) => createGeometricElementInstanceKeyPaths(imodelAccess, idsCache, hierarchyConfig, block), 10),
          ),
        ),
      );
    }),
  );
}

function createInstanceKeyPathsFromInstanceLabelObs(
  props: Omit<ModelsTreeInstanceKeyPathsFromInstanceLabelProps, "abortSignal"> & { labelsFactory: IInstanceLabelSelectClauseFactory },
) {
  const { labelsFactory, hierarchyConfig, label, imodelAccess, limit } = props;
  return defer(async () => {
    const elementLabelSelectClause = await labelsFactory.createSelectClause({
      classAlias: "e",
      className: CLASS_NAME_Element,
      selectorsConcatenator: ECSql.createConcatenatedValueStringSelector,
    });
    const ecsql = `
        SELECT *
        FROM (
          SELECT
            ec_classname(e.ECClassId, 's.c'),
            e.ECInstanceId,
            ${elementLabelSelectClause} Label
          FROM ${CLASS_NAME_Element} e
          WHERE e.ECClassId IS (${CLASS_NAME_Subject}, ${CLASS_NAME_SpatialCategory}, ${hierarchyConfig.elementClassSpecification})

          UNION ALL

          SELECT
            ec_classname(m.ECClassId, 's.c'),
            m.ECInstanceId,
            ${elementLabelSelectClause} Label
          FROM ${CLASS_NAME_GeometricModel3d} m
          JOIN ${CLASS_NAME_Element} e ON e.ECInstanceId = m.ModeledElement.Id
          WHERE NOT m.IsPrivate
            ${hierarchyConfig.showEmptyModels ? "" : `AND EXISTS (SELECT 1 FROM ${hierarchyConfig.elementClassSpecification} WHERE Model.Id = m.ECInstanceId)`}
            AND json_extract(e.JsonProperties, '$.PhysicalPartition.Model.Content') IS NULL
            AND json_extract(e.JsonProperties, '$.GraphicalPartition3d.Model.Content') IS NULL
        )
        WHERE Label LIKE '%' || ? || '%' ESCAPE '\\'
        LIMIT ${MAX_FILTERING_INSTANCE_KEY_COUNT + 1}
      `;
    const bindings: ECSqlBinding[] = [{ type: "string", value: label.replace(/[%_\\]/g, "\\$&") }];
    return { ecsql, bindings };
  }).pipe(
    mergeMap((queryProps) => {
      return imodelAccess.createQueryReader(queryProps, {
        rowFormat: "Indexes",
        restartToken: "tree-widget/models-tree/filter-by-label-query",
        limit,
      });
    }),
    map((row) => ({ className: row[0], id: row[1] })),
    toArray(),
    mergeMap((targetKeys) => createInstanceKeyPathsFromTargetItemsObs({ ...props, targetItems: targetKeys })),
  );
}
