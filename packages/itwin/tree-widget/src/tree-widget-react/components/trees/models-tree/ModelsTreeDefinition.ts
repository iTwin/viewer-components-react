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
import { Guid } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import {
  createNodesQueryClauseFactory,
  createPredicateBasedHierarchyDefinition,
  HierarchyFilteringPath,
  HierarchyNodeKey,
  NodeSelectClauseColumnNames,
  ProcessedHierarchyNode,
} from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql } from "@itwin/presentation-shared";
import { collect } from "../common/Rxjs.js";
import { FilterLimitExceededError } from "../common/TreeErrors.js";
import { createIdsSelector, parseIdsSelectorResult } from "../common/Utils.js";
import { releaseMainThreadOnItemsCount } from "./Utils.js";

import type { Observable } from "rxjs";
import type { GuidString, Id64String } from "@itwin/core-bentley";
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
import type {
  ECClassHierarchyInspector,
  ECSchemaProvider,
  ECSqlBinding,
  ECSqlQueryDef,
  ECSqlQueryRow,
  IInstanceLabelSelectClauseFactory,
  InstanceKey,
} from "@itwin/presentation-shared";
import type { NormalizedHierarchyFilteringPath } from "../common/Utils.js";
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
  elementClassSpecification: "BisCore.GeometricElement3d",
  showEmptyModels: false,
  hideRootSubject: false,
  hierarchyLevelFiltering: "enable",
};

interface ModelsTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  idsCache: ModelsTreeIdsCache;
  hierarchyConfig: ModelsTreeHierarchyConfiguration;
  componentId?: GuidString;
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
  componentId?: string;
}

type ModelsTreeInstanceKeyPathsFromTargetItemsProps = {
  targetItems: Array<InstanceKey | ElementsGroupInfo>;
} & ModelsTreeInstanceKeyPathsBaseProps;

type ModelsTreeInstanceKeyPathsFromInstanceLabelProps = {
  label: string;
} & ModelsTreeInstanceKeyPathsBaseProps;

export type ModelsTreeInstanceKeyPathsProps = ModelsTreeInstanceKeyPathsFromTargetItemsProps | ModelsTreeInstanceKeyPathsFromInstanceLabelProps;

// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace ModelsTreeInstanceKeyPathsProps {
  export function isLabelProps(props: ModelsTreeInstanceKeyPathsProps): props is ModelsTreeInstanceKeyPathsFromInstanceLabelProps {
    return !!(props as ModelsTreeInstanceKeyPathsFromInstanceLabelProps).label;
  }
}

export class ModelsTreeDefinition implements HierarchyDefinition {
  #impl: HierarchyDefinition;
  #idsCache: ModelsTreeIdsCache;
  #hierarchyConfig: ModelsTreeHierarchyConfiguration;
  #selectQueryFactory: NodesQueryClauseFactory;
  #nodeLabelSelectClauseFactory: IInstanceLabelSelectClauseFactory;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #isSupported?: Promise<boolean>;
  static #componentName = "ModelsTreeDefinition";
  #componentId: GuidString;

  public constructor(props: ModelsTreeDefinitionProps) {
    this.#impl = createPredicateBasedHierarchyDefinition({
      classHierarchyInspector: props.imodelAccess,
      hierarchy: {
        rootNodes: async (requestProps) =>
          this.createSubjectChildrenQuery({ ...requestProps, parentNodeInstanceIds: this.#hierarchyConfig.hideRootSubject ? [IModel.rootSubjectId] : [] }),
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
    this.#componentId = props.componentId ?? Guid.createValue();
    this.#idsCache = props.idsCache;
    this.#queryExecutor = props.imodelAccess;
    this.#hierarchyConfig = props.hierarchyConfig;
    this.#nodeLabelSelectClauseFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
    this.#selectQueryFactory = createNodesQueryClauseFactory({
      imodelAccess: props.imodelAccess,
      instanceLabelSelectClauseFactory: this.#nodeLabelSelectClauseFactory,
    });
  }

  public async postProcessNode(node: ProcessedHierarchyNode): Promise<ProcessedHierarchyNode> {
    if (ProcessedHierarchyNode.isGroupingNode(node)) {
      let childrenCount = 0;
      let hasDirectNonFilteredTargets = false;
      let hasFilterTargetAncestor = false;
      const filterTargets = new Map<Id64String, { childrenCount: number }>();
      node.children.forEach((child) => {
        if (child.extendedData?.childrenCount) {
          childrenCount += child.extendedData.childrenCount;
        }
        if (child.filtering) {
          if (child.filtering.hasFilterTargetAncestor) {
            hasFilterTargetAncestor = true;
            return;
          }
          if ((!child.filtering.filteredChildrenIdentifierPaths?.length || child.filtering.isFilterTarget) && HierarchyNodeKey.isInstances(child.key)) {
            child.key.instanceKeys.forEach((key) => filterTargets.set(key.id, { childrenCount: child.extendedData?.childrenCount ?? 0 }));
          }
          if (!child.filtering.isFilterTarget) {
            hasDirectNonFilteredTargets = true;
          }
        }
      });
      return {
        ...node,
        ...(hasFilterTargetAncestor
          ? {
              filtering: {
                ...(node.filtering ?? {}),
                hasFilterTargetAncestor,
              },
            }
          : {}),
        label: this.#hierarchyConfig.elementClassGrouping === "enableWithCounts" ? `${node.label} (${node.children.length})` : node.label,
        extendedData: {
          ...node.extendedData,
          modelId: node.children[0].extendedData?.modelId,
          categoryId: node.children[0].extendedData?.categoryId,
          childrenCount,
          ...(hasDirectNonFilteredTargets ? { hasDirectNonFilteredTargets } : {}),
          filterTargets,
          // `imageId` is assigned to instance nodes at query time, but grouping ones need to
          // be handled during post-processing
          imageId: "icon-ec-class",
        },
      };
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

  private async createSubjectChildrenQuery({
    parentNodeInstanceIds: parentSubjectIds,
    instanceFilter,
  }: Pick<DefineInstanceNodeChildHierarchyLevelProps, "parentNodeInstanceIds" | "instanceFilter">): Promise<HierarchyLevelDefinition> {
    const [subjectFilterClauses, modelFilterClauses] = await Promise.all([
      this.#selectQueryFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: "BisCore.Subject", alias: "this" },
      }),
      this.#selectQueryFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: "BisCore.GeometricModel3d", alias: "this" },
      }),
    ]);
    const [childSubjectIds, childModelIds] = parentSubjectIds.length
      ? await Promise.all([this.#idsCache.getChildSubjectIds(parentSubjectIds), this.#idsCache.getChildSubjectModelIds(parentSubjectIds)])
      : [[IModel.rootSubjectId], []];
    const defs = new Array<HierarchyNodesDefinition>();
    childSubjectIds.length &&
      defs.push({
        fullClassName: "BisCore.Subject",
        query: {
          ecsql: `
            SELECT
              ${await this.#selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: "BisCore.Subject",
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
            { type: "idset", value: await this.#idsCache.getParentSubjectIds() },
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
                ${await this.#selectQueryFactory.createSelectClause({
                  ecClassId: { selector: "m.ECClassId" },
                  ecInstanceId: { selector: "m.ECInstanceId" },
                  nodeLabel: {
                    selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
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
                  hasChildren: this.#hierarchyConfig.showEmptyModels
                    ? {
                        selector: `
                          IFNULL((
                            SELECT 1
                            FROM ${this.#hierarchyConfig.elementClassSpecification} e
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
              ${await this.#selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: "", // doesn't matter - the node is always hidden
                hideNodeInHierarchy: true,
              })}
            FROM BisCore.GeometricModel3d this
            WHERE
              this.ModeledElement.Id IN (${elementIds.map(() => "?").join(",")})
              AND NOT this.IsPrivate
              AND this.ECInstanceId IN (SELECT Model.Id FROM ${this.#hierarchyConfig.elementClassSpecification})
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
    const instanceFilterClauses = await this.#selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: "BisCore.SpatialCategory", alias: "this" },
    });
    return [
      {
        fullClassName: "BisCore.SpatialCategory",
        query: {
          ecsql: `
            SELECT
              ${await this.#selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
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
                supportsFiltering: this.supportsFiltering(),
              })}
            FROM ${instanceFilterClauses.from} this
            ${instanceFilterClauses.joins}
            WHERE
              EXISTS (
                SELECT 1
                FROM ${this.#hierarchyConfig.elementClassSpecification} element
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

  private getElementChildrenCountCtes(props: { whereClauseFn: (parentAlias: string) => string }): {
    elementChildrenCountCte: Array<string>;
    elementChildrenCountCteName: string;
  } {
    return {
      elementChildrenCountCte: [
        `
        ElementWithParent(id, parentId) AS (
          SELECT
            c.ECInstanceId,
            c.Parent.Id
          FROM ${this.#hierarchyConfig.elementClassSpecification} p
          JOIN ${this.#hierarchyConfig.elementClassSpecification} c on c.Parent.Id = p.ECInstanceId
          WHERE ${props.whereClauseFn("p")}

          UNION ALL

          SELECT
            c.ECInstanceId,
            p.parentId
          FROM ${this.#hierarchyConfig.elementClassSpecification} c
          JOIN ElementWithParent p ON p.id = c.Parent.Id
        )
        `,
        `
        ElementChildrenCount(parentId, childrenCount) AS (
          SELECT parentId, COUNT(id)
          FROM ElementWithParent
          GROUP BY parentId
        )
        `,
      ],
      elementChildrenCountCteName: `ElementChildrenCount`,
    };
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
    const instanceFilterClauses = await this.#selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: this.#hierarchyConfig.elementClassSpecification, alias: "this" },
    });
    const modeledElements = await firstValueFrom(
      from(modelIds).pipe(
        mergeMap(async (modelId) => this.#idsCache.getCategoriesModeledElements(modelId, categoryIds)),
        reduce((acc, foundModeledElements) => {
          return acc.concat(foundModeledElements);
        }, new Array<Id64String>()),
      ),
    );
    const childrenCountWhereClause = (parentAlias: string) => `
      ${parentAlias}.Category.Id IN (${categoryIds.map(() => "?").join(",")})
      AND ${parentAlias}.Model.Id IN (${modelIds.map(() => "?").join(",")})
      AND ${parentAlias}.Parent.Id IS NULL
    `;
    const { elementChildrenCountCte, elementChildrenCountCteName } = this.getElementChildrenCountCtes({ whereClauseFn: childrenCountWhereClause });
    const bindings = new Array<ECSqlBinding>();
    for (let i = 0; i < 2; ++i) {
      categoryIds.forEach((id) => bindings.push({ type: "id", value: id }));
      modelIds.map((id) => bindings.push({ type: "id", value: id }));
    }
    return [
      {
        fullClassName: this.#hierarchyConfig.elementClassSpecification,
        query: {
          ctes: elementChildrenCountCte,
          ecsql: `
            SELECT
              ${await this.#selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: this.#hierarchyConfig.elementClassSpecification,
                  }),
                },
                grouping: {
                  byClass: this.#hierarchyConfig.elementClassGrouping !== "disable",
                },
                hasChildren: {
                  selector: `
                    IIF(
                      ${modeledElements.length ? `this.ECInstanceId IN (${modeledElements.join(",")})` : `FALSE`},
                      1,
                      IFNULL((
                        SELECT 1
                        FROM ${this.#hierarchyConfig.elementClassSpecification} ce
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
                  childrenCount: { selector: "c.ChildrenCount" },
                },
                supportsFiltering: this.supportsFiltering(),
              })}
            FROM ${instanceFilterClauses.from} this
            LEFT JOIN ${elementChildrenCountCteName} c ON c.parentId = this.ECInstanceId
            ${instanceFilterClauses.joins}
            WHERE
              this.Category.Id IN (${categoryIds.map(() => "?").join(",")})
              AND this.Model.Id IN (${modelIds.map(() => "?").join(",")})
              AND this.Parent.Id IS NULL
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
          bindings,
        },
      },
    ];
  }

  private async createGeometricElement3dChildrenQuery({
    parentNodeInstanceIds: elementIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await this.#selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: this.#hierarchyConfig.elementClassSpecification, alias: "this" },
    });

    const childrenCountWhereClause = (parentAlias: string) => `
      ${parentAlias}.Parent.Id IN (${elementIds.map(() => "?").join(",")})
    `;
    const { elementChildrenCountCte, elementChildrenCountCteName } = this.getElementChildrenCountCtes({ whereClauseFn: childrenCountWhereClause });
    const bindings = new Array<ECSqlBinding>();
    for (let i = 0; i < 2; ++i) {
      elementIds.map((id) => bindings.push({ type: "id", value: id }));
    }
    return [
      {
        fullClassName: this.#hierarchyConfig.elementClassSpecification,
        query: {
          ctes: elementChildrenCountCte,
          ecsql: `
            SELECT
              ${await this.#selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this.#nodeLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: this.#hierarchyConfig.elementClassSpecification,
                  }),
                },
                grouping: {
                  byClass: this.#hierarchyConfig.elementClassGrouping !== "disable",
                },
                hasChildren: {
                  selector: `
                    IFNULL((
                      SELECT 1
                      FROM ${this.#hierarchyConfig.elementClassSpecification} ce
                      JOIN BisCore.Model m ON ce.Model.Id = m.ECInstanceId
                      WHERE ce.Parent.Id = this.ECInstanceId OR (ce.Model.Id = this.ECInstanceId AND m.IsPrivate = false)
                      LIMIT 1
                    ), 0)
                  `,
                },
                extendedData: {
                  modelId: { selector: "IdToHex(this.Model.Id)" },
                  categoryId: { selector: "IdToHex(this.Category.Id)" },
                  imageId: "icon-item",
                  childrenCount: { selector: "c.ChildrenCount" },
                },
                supportsFiltering: this.supportsFiltering(),
              })}
            FROM ${instanceFilterClauses.from} this
            LEFT JOIN ${elementChildrenCountCteName} c ON c.parentId = this.ECInstanceId
            ${instanceFilterClauses.joins}
            WHERE
              this.Parent.Id IN (${elementIds.map(() => "?").join(",")})
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
          bindings,
        },
      },
    ];
  }

  public static async createInstanceKeyPaths(props: ModelsTreeInstanceKeyPathsProps): Promise<NormalizedHierarchyFilteringPath[]> {
    return lastValueFrom(
      defer(() => {
        const componentInfo = { componentId: props.componentId ?? Guid.createValue(), componentName: this.#componentName };
        if (ModelsTreeInstanceKeyPathsProps.isLabelProps(props)) {
          const labelsFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
          return createInstanceKeyPathsFromInstanceLabelObs({
            ...props,
            ...componentInfo,
            labelsFactory,
          });
        }
        return createInstanceKeyPathsFromTargetItemsObs({ ...props, ...componentInfo });
      }).pipe(props.abortSignal ? takeUntil(fromEvent(props.abortSignal, "abort")) : identity, defaultIfEmpty([])),
    );
  }

  private supportsFiltering() {
    return this.#hierarchyConfig.hierarchyLevelFiltering === "enable";
  }

  private async isSupported() {
    const [schemaName, className] = this.#hierarchyConfig.elementClassSpecification.split(/[\.:]/);
    if (!schemaName || !className) {
      throw new Error(
        `Provided class specification ${this.#hierarchyConfig.elementClassSpecification} should be in format {SchemaName}:{ClassName} or {SchemaName}.{ClassName}`,
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

    for await (const _row of this.#queryExecutor.createQueryReader(query, {
      restartToken: `${ModelsTreeDefinition.#componentName}/${this.#componentId}/is-class-supported`,
    })) {
      return true;
    }
    return false;
  }
}

function createGeometricElementInstanceKeyPaths(props: {
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  idsCache: ModelsTreeIdsCache;
  hierarchyConfig: ModelsTreeHierarchyConfiguration;
  targetItems: Array<Id64String | ElementsGroupInfo>;
  componentId: GuidString;
  componentName: string;
  chunkIndex: number;
}): Observable<NormalizedHierarchyFilteringPath> {
  const { targetItems, chunkIndex, componentId, componentName, hierarchyConfig, idsCache, imodelAccess } = props;
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

    return imodelAccess.createQueryReader(
      { ctes, ecsql },
      { rowFormat: "Indexes", limit: "unbounded", restartToken: `${componentName}/${componentId}/geometric-element-paths/${chunkIndex}` },
    );
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

function createInstanceKeyPathsFromTargetItemsObs({
  targetItems,
  imodelAccess,
  hierarchyConfig,
  idsCache,
  limit,
  componentId,
  componentName,
}: Omit<ModelsTreeInstanceKeyPathsFromTargetItemsProps, "abortSignal" | "componentId"> & { componentId: GuidString; componentName: string }): Observable<
  NormalizedHierarchyFilteringPath[]
> {
  if (limit !== "unbounded" && targetItems.length > (limit ?? MAX_FILTERING_INSTANCE_KEY_COUNT)) {
    throw new FilterLimitExceededError(limit ?? MAX_FILTERING_INSTANCE_KEY_COUNT);
  }

  return from(targetItems).pipe(
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
          from(ids.subjects).pipe(mergeMap((id) => from(idsCache.createSubjectInstanceKeysPath(id)).pipe(map(HierarchyFilteringPath.normalize)))),
          from(ids.models).pipe(mergeMap((id) => from(idsCache.createModelInstanceKeyPaths(id)).pipe(mergeAll(), map(HierarchyFilteringPath.normalize)))),
          from(ids.categories).pipe(
            mergeMap((id) => from(idsCache.createCategoryInstanceKeyPaths(id)).pipe(mergeAll(), map(HierarchyFilteringPath.normalize))),
          ),
          from(ids.elements).pipe(
            bufferCount(Math.ceil(elementsLength / Math.ceil(elementsLength / 5000))),
            releaseMainThreadOnItemsCount(1),
            mergeMap(
              (block, chunkIndex) =>
                createGeometricElementInstanceKeyPaths({
                  imodelAccess,
                  idsCache,
                  hierarchyConfig,
                  targetItems: block,
                  componentId,
                  componentName,
                  chunkIndex,
                }),
              10,
            ),
          ),
        ),
      );
    }),
  );
}

function createInstanceKeyPathsFromInstanceLabelObs(
  props: Omit<ModelsTreeInstanceKeyPathsFromInstanceLabelProps, "abortSignal" | "componentId"> & {
    labelsFactory: IInstanceLabelSelectClauseFactory;
    componentId: GuidString;
    componentName: string;
  },
) {
  const { labelsFactory, hierarchyConfig, label, imodelAccess, limit } = props;
  return defer(async () => {
    const elementLabelSelectClause = await labelsFactory.createSelectClause({
      classAlias: "e",
      className: "BisCore.Element",
      // eslint-disable-next-line @typescript-eslint/unbound-method
      selectorsConcatenator: ECSql.createConcatenatedValueStringSelector,
    });
    const ecsql = `
        SELECT *
        FROM (
          SELECT
            ec_classname(e.ECClassId, 's.c'),
            e.ECInstanceId,
            ${elementLabelSelectClause} Label
          FROM BisCore.Element e
          WHERE e.ECClassId IS (BisCore.Subject, BisCore.SpatialCategory, ${hierarchyConfig.elementClassSpecification})

          UNION ALL

          SELECT
            ec_classname(m.ECClassId, 's.c'),
            m.ECInstanceId,
            ${elementLabelSelectClause} Label
          FROM BisCore.GeometricModel3d m
          JOIN BisCore.Element e ON e.ECInstanceId = m.ModeledElement.Id
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
        restartToken: `${props.componentName}/${props.componentId}/filter-by-label`,
        limit,
      });
    }),
    map((row) => ({ className: row[0], id: row[1] })),
    toArray(),
    mergeMap((targetKeys) => createInstanceKeyPathsFromTargetItemsObs({ ...props, targetItems: targetKeys })),
  );
}
