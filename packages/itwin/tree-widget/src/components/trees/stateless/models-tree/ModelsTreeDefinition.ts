/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defer, EMPTY, from, map, merge, mergeAll, mergeMap } from "rxjs";
import {
  createClassBasedHierarchyDefinition,
  createNodesQueryClauseFactory,
  HierarchyNode,
  NodeSelectClauseColumnNames,
} from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql } from "@itwin/presentation-shared";
import { collect } from "../../common/Rxjs";

import type { Id64String } from "@itwin/core-bentley";
import type { Observable } from "rxjs";
import type {
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

const MAX_FILTERING_INSTANCE_KEY_COUNT = 100;

interface HierarchyConfiguration {
  /** Should element nodes be grouped by class. Defaults to `enable`. */
  elementClassGrouping: "enable" | "enableWithCounts" | "disable";
  /** Full class name of a `GeometricElement3d` sub-class that should be used to load element nodes. Defaults to `BisCore.GeometricElement3d` */
  elementClassSpecification: string;
  /** Should models without elements be shown. Defaults to `false` */
  showEmptyModels: boolean;
}

export const defaultHierarchyConfiguration: HierarchyConfiguration = {
  elementClassGrouping: "enable",
  elementClassSpecification: "BisCore.GeometricElement3d",
  showEmptyModels: false,
};

interface ModelsTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  idsCache: ModelsTreeIdsCache;
  hierarchyConfig: HierarchyConfiguration;
}

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
  classes: string[];
}

interface ModelsTreeInstanceKeyPathsFromInstanceKeysProps {
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  idsCache: ModelsTreeIdsCache;
  keys: Array<InstanceKey | ElementsGroupInfo>;
  hierarchyConfig: HierarchyConfiguration;
}

interface ModelsTreeInstanceKeyPathsFromInstanceLabelProps {
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  idsCache: ModelsTreeIdsCache;
  label: string;
  hierarchyConfig: HierarchyConfiguration;
}

export type ModelsTreeInstanceKeyPathsProps = ModelsTreeInstanceKeyPathsFromInstanceKeysProps | ModelsTreeInstanceKeyPathsFromInstanceLabelProps;

// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace ModelsTreeInstanceKeyPathsProps {
  export function isLabelProps(props: ModelsTreeInstanceKeyPathsProps): props is ModelsTreeInstanceKeyPathsFromInstanceLabelProps {
    return !!(props as ModelsTreeInstanceKeyPathsFromInstanceLabelProps).label;
  }
}

export class ModelsTreeDefinition implements HierarchyDefinition {
  private _impl: HierarchyDefinition;
  private _idsCache: ModelsTreeIdsCache;
  private _hierarchyConfig: HierarchyConfiguration;
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
    function createModelIdsSelector(): string {
      // Note: `json_array` function only accepts up to 127 arguments and we may have more `modelIds` than that. As a workaround,
      // we're creating an array of arrays
      const slices = new Array<Id64String[]>();
      for (let sliceStartIndex = 0; sliceStartIndex < modelIds.length; sliceStartIndex += 127) {
        let sliceEndIndex: number | undefined = sliceStartIndex + 127;
        if (sliceEndIndex > modelIds.length) {
          sliceEndIndex = undefined;
        }
        slices.push(modelIds.slice(sliceStartIndex, sliceEndIndex));
      }
      return `json_array(${slices.map((sliceIds) => `json_array(${sliceIds.map((id) => `'${id}'`).join(",")})`).join(",")})`;
    }
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
                  modelIds: { selector: createModelIdsSelector() },
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
    const modelIds: Id64String[] =
      parentNode.extendedData && parentNode.extendedData.hasOwnProperty("modelIds") && Array.isArray(parentNode.extendedData.modelIds)
        ? parentNode.extendedData.modelIds.reduce(
            (arr, ids: Id64String | Id64String[]) => [...arr, ...(Array.isArray(ids) ? ids : [ids])],
            new Array<Id64String>(),
          )
        : [];
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
    return createInstanceKeyPathsFromInstanceKeys(props);
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
  hierarchyConfig: HierarchyConfiguration,
  elementInfos: Array<Id64String | ElementsGroupInfo>,
): Observable<HierarchyNodeIdentifiersPath> {
  return defer(() => {
    const elementIds = elementInfos.filter((info): info is Id64String => typeof info === "string");
    const groupInfos = elementInfos.filter((info): info is ElementsGroupInfo => typeof info !== "string");

    const elementsClause = elementIds.length > 0 ? `e.ECInstanceId IN (${elementIds.map(() => "?").join(",")})` : undefined;

    const createParentElementClause = (parent: { ids: Id64String[] }) => `e.Parent.Id IN (${parent.ids.map(() => "?").join(",")})`;
    const createParentCategoryClause = ({ ids, modelIds }: { ids: Id64String[]; modelIds: Id64String[] }) =>
      `e.Category.Id IN (${ids.map(() => "?").join(",")}) AND e.Model.Id IN (${modelIds.map(() => "?").join(",")})`;

    const classClause = groupInfos.map(
      ({ parent, classes }) =>
        `(${parent.type === "element" ? createParentElementClause(parent) : createParentCategoryClause(parent)} AND e.ECClassId IS (${classes.join(",")}))`,
    );

    const whereClause = [...(elementsClause ? [elementsClause] : []), ...(classClause ?? [])].join(" OR ");

    const ctes = [
      `ModelsCategoriesElementsHierarchy(ECInstanceId, ParentId, ModelId, Path) AS (
        SELECT
          e.ECInstanceId,
          e.Parent.Id,
          e.Model.Id,
          json_array(
            ${createECInstanceKeySelectClause({ alias: "e" })},
            IIF(e.Parent.Id IS NULL, ${createECInstanceKeySelectClause({ alias: "c" })}, NULL),
            IIF(e.Parent.Id IS NULL, ${createECInstanceKeySelectClause({ alias: "m" })}, NULL)
          )
        FROM ${hierarchyConfig.elementClassSpecification} e
        JOIN bis.GeometricModel3d m ON m.ECInstanceId = e.Model.Id
        JOIN bis.SpatialCategory c ON c.ECInstanceId = e.Category.Id
        WHERE ${whereClause}

        UNION ALL

        SELECT
          pe.ECInstanceId,
          pe.Parent.Id,
          pe.Model.Id,
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
      SELECT mce.ModelId, mce.Path
      FROM ModelsCategoriesElementsHierarchy mce
      WHERE mce.ParentId IS NULL
    `;
    const createIdBinding = (id: Id64String) => ({ type: "id" as const, value: id });
    const createCategoryElementsBindings = ({ ids, modelIds }: { ids: Id64String[]; modelIds: Id64String[] }) => [
      ...ids.map(createIdBinding),
      ...modelIds.map(createIdBinding),
    ];
    return imodelAccess.createQueryReader(
      {
        ctes,
        ecsql,
        bindings: [
          ...elementIds.map(createIdBinding),
          ...groupInfos.flatMap((info) =>
            info.parent.type === "element" ? info.parent.ids.map(createIdBinding) : createCategoryElementsBindings(info.parent),
          ),
        ],
      },
      { rowFormat: "Indexes" },
    );
  }).pipe(
    map((row) => ({
      modelId: row[0],
      elementHierarchyPath: flatten<InstanceKey | undefined>(JSON.parse(row[1])).reverse(),
    })),
    mergeMap(({ modelId, elementHierarchyPath }) =>
      createModelInstanceKeyPaths(modelId, idsCache).pipe(
        map((modelPath) => {
          modelPath.pop(); // model is already included in the element hierarchy path
          return [...modelPath, ...elementHierarchyPath.filter((x): x is InstanceKey => !!x)];
        }),
      ),
    ),
  );
}

async function createInstanceKeyPathsFromInstanceKeys(props: ModelsTreeInstanceKeyPathsFromInstanceKeysProps): Promise<HierarchyNodeIdentifiersPath[]> {
  if (props.keys.length > MAX_FILTERING_INSTANCE_KEY_COUNT) {
    throw new Error(`Filter matches more than ${MAX_FILTERING_INSTANCE_KEY_COUNT} items`);
  }
  const ids = {
    models: new Array<Id64String>(),
    categories: new Array<Id64String>(),
    subjects: new Array<Id64String>(),
    elements: new Array<Id64String | ElementsGroupInfo>(),
  };
  await Promise.all(
    props.keys.map(async (key) => {
      if ("parent" in key) {
        ids.elements.push(key);
      } else if (await props.imodelAccess.classDerivesFrom(key.className, "BisCore.Subject")) {
        ids.subjects.push(key.id);
      } else if (await props.imodelAccess.classDerivesFrom(key.className, "BisCore.Model")) {
        ids.models.push(key.id);
      } else if (await props.imodelAccess.classDerivesFrom(key.className, "BisCore.SpatialCategory")) {
        ids.categories.push(key.id);
      } else {
        ids.elements.push(key.id);
      }
    }),
  );
  return collect(
    merge(
      from(ids.subjects).pipe(mergeMap((id) => createSubjectInstanceKeysPath(id, props.idsCache))),
      from(ids.models).pipe(mergeMap((id) => createModelInstanceKeyPaths(id, props.idsCache))),
      from(ids.categories).pipe(mergeMap((id) => createCategoryInstanceKeyPaths(id, props.idsCache))),
      ids.elements.length ? createGeometricElementInstanceKeyPaths(props.imodelAccess, props.idsCache, props.hierarchyConfig, ids.elements) : EMPTY,
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

  return createInstanceKeyPathsFromInstanceKeys({ ...props, keys: targetKeys });
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
