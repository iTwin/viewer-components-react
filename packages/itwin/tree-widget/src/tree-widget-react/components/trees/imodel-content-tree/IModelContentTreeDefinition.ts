/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModel } from "@itwin/core-common";
import { createPredicateBasedHierarchyDefinition, NodeSelectClauseColumnNames, ProcessedHierarchyNode } from "@itwin/presentation-hierarchies";
import {
  CLASS_NAME_DrawingCategory,
  CLASS_NAME_Element,
  CLASS_NAME_GeometricModel2d,
  CLASS_NAME_GeometricModel3d,
  CLASS_NAME_InformationPartitionElement,
  CLASS_NAME_ISubModeledElement,
  CLASS_NAME_Model,
  CLASS_NAME_SpatialCategory,
  CLASS_NAME_Subject,
} from "../common/internal/ClassNameDefinitions.js";
import { createIdsSelector, getClassesByView, parseIdsSelectorResult } from "../common/internal/Utils.js";

import type {
  DefineGenericNodeChildHierarchyLevelProps,
  DefineHierarchyLevelProps,
  DefineInstanceNodeChildHierarchyLevelProps,
  HierarchyDefinition,
  HierarchyLevelDefinition,
  HierarchyNodesDefinition,
  NodePostProcessor,
} from "@itwin/presentation-hierarchies";
import type { EC, ECClassHierarchyInspector, ECSchemaProvider } from "@itwin/presentation-shared";
import type { IModelContentTreeIdsCache } from "./internal/IModelContentTreeIdsCache.js";

/**
 * Defines hierarchy configuration supported by `IModelContentTree`.
 * @beta
 */
export interface IModelContentTreeHierarchyConfiguration {
  /** Should the root Subject node be hidden. Defaults to `false`. */
  hideRootSubject: boolean;
}

/** @internal */
export const defaultHierarchyConfiguration: IModelContentTreeHierarchyConfiguration = {
  hideRootSubject: false,
};

interface IModelContentTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & ECClassHierarchyInspector;
  idsCache: IModelContentTreeIdsCache;
  hierarchyConfig: IModelContentTreeHierarchyConfiguration;
}

/** @internal */
export class IModelContentTreeDefinition implements HierarchyDefinition {
  #impl: HierarchyDefinition;
  #idsCache: IModelContentTreeIdsCache;
  #hierarchyConfig: IModelContentTreeHierarchyConfiguration;

  public constructor(props: IModelContentTreeDefinitionProps) {
    this.#idsCache = props.idsCache;
    this.#hierarchyConfig = props.hierarchyConfig;
    this.#impl = createPredicateBasedHierarchyDefinition({
      classHierarchyInspector: props.imodelAccess,
      hierarchy: {
        rootNodes: async (requestProps) =>
          this.createSubjectChildrenQuery({ ...requestProps, parentNodeInstanceIds: this.#hierarchyConfig.hideRootSubject ? [IModel.rootSubjectId] : [] }),
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
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) =>
              this.createGeometricModelChildrenQuery({ ...requestProps, viewType: "3d" }),
          },
          {
            parentInstancesNodePredicate: CLASS_NAME_GeometricModel2d,
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) =>
              this.createGeometricModelChildrenQuery({ ...requestProps, viewType: "2d" }),
          },
          {
            parentInstancesNodePredicate: CLASS_NAME_SpatialCategory,
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) =>
              this.createCategoryChildrenQuery({ ...requestProps, viewType: "3d" }),
          },
          {
            parentInstancesNodePredicate: CLASS_NAME_DrawingCategory,
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) =>
              this.createCategoryChildrenQuery({ ...requestProps, viewType: "2d" }),
          },
          {
            parentInstancesNodePredicate: CLASS_NAME_Model,
            onlyIfNotHandled: true,
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createModelChildrenQuery(requestProps),
          },
          {
            parentInstancesNodePredicate: "BisCore.GroupInformationElement",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createGroupInformationElementChildElementsQuery(requestProps),
          },
          {
            parentGenericNodePredicate: async ({ id }) => id === "ChildrenNode",
            definitions: async (requestProps: DefineGenericNodeChildHierarchyLevelProps) => this.createChildrenNodeChildrenQuery(requestProps),
          },
          {
            parentGenericNodePredicate: async ({ id }) => id === "MembersNode",
            definitions: async (requestProps: DefineGenericNodeChildHierarchyLevelProps) => this.createGroupInformationElementMemberElementsQuery(requestProps),
          },
          {
            parentInstancesNodePredicate: CLASS_NAME_Element,
            onlyIfNotHandled: true,
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createElementChildrenQuery(requestProps),
          },
        ],
      },
    });
  }

  public postProcessNode: NodePostProcessor = async ({ node }) => {
    if (ProcessedHierarchyNode.isGroupingNode(node)) {
      const label = node.children.length ? `${node.label} (${node.children.length})` : node.label;
      return { ...node, label, extendedData: { ...node.extendedData, imageId: "icon-ec-class" } };
    }
    return node;
  };

  public async defineHierarchyLevel(props: DefineHierarchyLevelProps) {
    return this.#impl.defineHierarchyLevel(props);
  }

  private async createSubjectChildrenQuery({
    parentNodeInstanceIds: parentSubjectIds,
    instanceFilter,
    instanceLabelSelectClauseFactory,
    nodeSelectClauseFactory,
  }: Pick<
    DefineInstanceNodeChildHierarchyLevelProps,
    "parentNodeInstanceIds" | "instanceFilter" | "nodeSelectClauseFactory" | "instanceLabelSelectClauseFactory"
  >): Promise<HierarchyLevelDefinition> {
    const [subjectFilterClauses, modelFilterClauses] = await Promise.all([
      nodeSelectClauseFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: CLASS_NAME_Subject, alias: "this" },
      }),
      nodeSelectClauseFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: CLASS_NAME_Model, alias: "this" },
      }),
    ]);
    const [childSubjectIds, childModelIds] = parentSubjectIds.length
      ? await Promise.all([this.#idsCache.getChildSubjectIds(parentSubjectIds), this.#idsCache.getChildSubjectModelIds(parentSubjectIds)])
      : [[IModel.rootSubjectId], []];
    const defs = new Array<HierarchyNodesDefinition>();
    childSubjectIds.length &&
      defs.push({
        fullClassName: CLASS_NAME_Subject,
        query: {
          ecsql: `
            SELECT
              ${await nodeSelectClauseFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await instanceLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: CLASS_NAME_Subject,
                  }),
                },
                hasChildren: { selector: `InVirtualSet(?, this.ECInstanceId)` },
                grouping: { byLabel: { action: "merge", groupId: "subject" } },
                extendedData: {
                  imageId: { selector: `IIF(this.ECInstanceId = ${IModel.rootSubjectId}, 'icon-imodel-hollow-2', 'icon-folder')` },
                },
                autoExpand: { selector: `IIF(this.ECInstanceId = ${IModel.rootSubjectId}, true, false)` },
                supportsFiltering: true,
              })}
            FROM ${subjectFilterClauses.from} this
            JOIN IdSet(?) childSubjectIdSet ON childSubjectIdSet.id = this.ECInstanceId
            ${subjectFilterClauses.joins}
            ${subjectFilterClauses.where ? `WHERE ${subjectFilterClauses.where}` : ""}
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `,
          bindings: [
            { type: "idset", value: await this.#idsCache.getParentSubjectIds() },
            { type: "idset", value: childSubjectIds },
          ],
        },
      });
    childModelIds.length &&
      defs.push({
        fullClassName: CLASS_NAME_Model,
        query: {
          ecsql: `
            SELECT model.ECInstanceId AS ECInstanceId, model.*
            FROM (
              SELECT
                ${await nodeSelectClauseFactory.createSelectClause({
                  ecClassId: { selector: "m.ECClassId" },
                  ecInstanceId: { selector: "m.ECInstanceId" },
                  nodeLabel: {
                    selector: await instanceLabelSelectClauseFactory.createSelectClause({
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
                  extendedData: {
                    imageId: "icon-model",
                  },
                  supportsFiltering: true,
                })}
              FROM ${CLASS_NAME_Model} m
              JOIN IdSet(?) childModelIdSet ON childModelIdSet.id = m.ECInstanceId
              JOIN ${CLASS_NAME_InformationPartitionElement} [partition] ON [partition].ECInstanceId = m.ModeledElement.Id
              ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
            ) model
            JOIN ${modelFilterClauses.from} this ON this.ECInstanceId = model.ECInstanceId
            ${modelFilterClauses.joins}
            ${modelFilterClauses.where ? `WHERE (model.${NodeSelectClauseColumnNames.HideNodeInHierarchy} OR ${modelFilterClauses.where})` : ""}
          `,
          bindings: [{ type: "idset", value: childModelIds }],
        },
      });
    return defs;
  }

  private async createISubModeledElementChildrenQuery({
    parentNodeInstanceIds: elementIds,
    nodeSelectClauseFactory,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    // note: we do not apply hierarchy level filtering on this hierarchy level, because it's always
    // hidden - the filter will get applied on the child hierarchy levels
    return [
      {
        fullClassName: CLASS_NAME_Model,
        query: {
          ecsql: `
            SELECT
              ${await nodeSelectClauseFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: "", // doesn't matter - the node is always hidden
                hideNodeInHierarchy: true,
              })}
            FROM ${CLASS_NAME_Model} this
            JOIN IdSet(?) elementIdSet ON elementIdSet.id = this.ModeledElement.Id
            WHERE NOT this.IsPrivate
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `,
          bindings: [{ type: "idset", value: elementIds }],
        },
      },
    ];
  }

  private async createGeometricModelChildrenQuery({
    parentNodeInstanceIds: modelIds,
    instanceFilter,
    viewType,
    nodeSelectClauseFactory,
    instanceLabelSelectClauseFactory,
  }: DefineInstanceNodeChildHierarchyLevelProps & { viewType: "2d" | "3d" }): Promise<HierarchyLevelDefinition> {
    const childCategoryIds = await this.#idsCache.getModelCategoryIds(modelIds);

    const { categoryClass } = getClassesByView(viewType);
    const categoryFilterClauses = await nodeSelectClauseFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: categoryClass, alias: "this" },
    });
    const informationContentElementFilterClauses = await nodeSelectClauseFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: "BisCore.InformationContentElement", alias: "this" },
    });

    const defs = new Array<HierarchyNodesDefinition>();
    childCategoryIds.length &&
      defs.push({
        fullClassName: categoryClass,
        query: {
          ecsql: `
            SELECT
              ${await nodeSelectClauseFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await instanceLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: categoryClass,
                  }),
                },
                grouping: { byLabel: { action: "merge", groupId: "category" } },
                extendedData: {
                  imageId: "icon-layers",
                  modelIds: { selector: createIdsSelector(modelIds) },
                },
                hasChildren: true,
                supportsFiltering: true,
              })}
            FROM ${categoryFilterClauses.from} this
            JOIN IdSet(?) childCategoryIdSet ON childCategoryIdSet.id = this.ECInstanceId
            ${categoryFilterClauses.joins}
            ${categoryFilterClauses.where ? `WHERE ${categoryFilterClauses.where}` : ""}
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `,
          bindings: [{ type: "idset", value: childCategoryIds }],
        },
      });
    defs.push({
      fullClassName: "BisCore.InformationContentElement",
      query: {
        ecsql: `
            SELECT
              ${await nodeSelectClauseFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await instanceLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: "BisCore.InformationContentElement",
                  }),
                },
                hasChildren: true,
                grouping: {
                  byClass: true,
                },
                supportsFiltering: true,
              })}
            FROM ${informationContentElementFilterClauses.from} this
            JOIN IdSet(?) modelIdSet ON modelIdSet.id = this.Model.Id
            ${informationContentElementFilterClauses.joins}
            ${informationContentElementFilterClauses.where ? `WHERE ${informationContentElementFilterClauses.where}` : ""}
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `,
        bindings: [{ type: "idset", value: modelIds }],
      },
    });
    return defs;
  }

  private async createCategoryChildrenQuery(props: DefineInstanceNodeChildHierarchyLevelProps & { viewType: "2d" | "3d" }): Promise<HierarchyLevelDefinition> {
    const { parentNodeInstanceIds: categoryIds, parentNode, instanceFilter, viewType, nodeSelectClauseFactory, instanceLabelSelectClauseFactory } = props;
    const modelIds = parseIdsSelectorResult(parentNode.extendedData?.modelIds);

    // We only want to handle a category added as a child of `GeometricModel2d` or `GeometricModel3d`.
    // ModelIds is not empty only if parent node is a geometric model.
    if (modelIds.length === 0) {
      return this.createElementChildrenQuery(props);
    }

    const { elementClass, modelClass } = getClassesByView(viewType);
    return Promise.all(
      getElementsSelectProps({ modelClass, elementClass }).map(async ({ selectProps, whereClause }) => {
        const instanceFilterClauses = await nodeSelectClauseFactory.createFilterClauses({
          filter: instanceFilter,
          contentClass: { fullName: elementClass, alias: "this" },
        });
        return {
          fullClassName: elementClass,
          query: {
            ecsql: `
              SELECT
                ${await nodeSelectClauseFactory.createSelectClause({
                  ecClassId: { selector: "this.ECClassId" },
                  ecInstanceId: { selector: "this.ECInstanceId" },
                  nodeLabel: {
                    selector: await instanceLabelSelectClauseFactory.createSelectClause({
                      classAlias: "this",
                      className: elementClass,
                    }),
                  },
                  grouping: {
                    byClass: true,
                  },
                  extendedData: {
                    imageId: "icon-item",
                  },
                  hasChildren: selectProps.hasChildren,
                  supportsFiltering: selectProps.supportsFiltering,
                })}
              FROM ${instanceFilterClauses.from} this
              JOIN IdSet(?) categoryIdSet ON this.Category.Id = categoryIdSet.id
              JOIN IdSet(?) modelIdSet ON this.Model.Id = modelIdSet.id
              ${instanceFilterClauses.joins}
              WHERE
                this.Parent.Id IS NULL
                ${whereClause ? `AND ${whereClause}` : ""}
                ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
              ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
            `,
            bindings: [
              { type: "idset", value: categoryIds },
              { type: "idset", value: modelIds },
            ],
          },
        };
      }),
    );
  }

  private async createModelChildrenQuery({
    parentNodeInstanceIds: modelIds,
    instanceFilter,
    nodeSelectClauseFactory,
    instanceLabelSelectClauseFactory,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    return Promise.all(
      getElementsSelectProps().map(async ({ classFullName, whereClause, selectProps }) => {
        const instanceFilterClauses = await nodeSelectClauseFactory.createFilterClauses({
          filter: instanceFilter,
          contentClass: { fullName: classFullName, alias: "this" },
        });
        return {
          fullClassName: classFullName,
          query: {
            ecsql: `
              SELECT
                ${await nodeSelectClauseFactory.createSelectClause({
                  ecClassId: { selector: "this.ECClassId" },
                  ecInstanceId: { selector: "this.ECInstanceId" },
                  nodeLabel: {
                    selector: await instanceLabelSelectClauseFactory.createSelectClause({
                      classAlias: "this",
                      className: classFullName,
                    }),
                  },
                  grouping: {
                    byClass: true,
                  },
                  extendedData: {
                    imageId: "icon-item",
                  },
                  hasChildren: selectProps?.hasChildren,
                  supportsFiltering: selectProps?.supportsFiltering,
                })}
              FROM ${instanceFilterClauses.from} this
              JOIN IdSet(?) modelIdSet ON this.Model.Id = modelIdSet.id
              ${instanceFilterClauses.joins}
              WHERE
                this.Parent.Id IS NULL
                ${whereClause ? `AND ${whereClause}` : ""}
                ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
              ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
            `,
            bindings: [{ type: "idset", value: modelIds }],
          },
        };
      }),
    );
  }

  private async createGroupInformationElementChildElementsQuery({
    parentNodeInstanceIds: groupIds,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    return [
      {
        node: {
          key: "ChildrenNode",
          label: "Children",
          extendedData: {
            groupIds,
            imageId: "icon-hierarchy-tree",
          },
          supportsFiltering: true,
          processingParams: {
            hideIfNoChildren: true,
          },
        },
      },
      {
        node: {
          key: "MembersNode",
          label: "Members",
          extendedData: {
            groupIds,
            imageId: "icon-group",
          },
          supportsFiltering: true,
          processingParams: {
            hideIfNoChildren: true,
          },
        },
      },
    ];
  }

  private async createChildrenNodeChildrenQuery({
    parentNode,
    instanceFilter,
    nodeSelectClauseFactory,
    instanceLabelSelectClauseFactory,
  }: DefineGenericNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const groupIds: string[] = parentNode.extendedData?.groupIds;
    return Promise.all(
      getElementsSelectProps().map(async ({ classFullName, whereClause, selectProps }) => {
        const instanceFilterClauses = await nodeSelectClauseFactory.createFilterClauses({
          filter: instanceFilter,
          contentClass: { fullName: classFullName, alias: "this" },
        });
        return {
          fullClassName: classFullName,
          query: {
            ecsql: `
              SELECT
                ${await nodeSelectClauseFactory.createSelectClause({
                  ecClassId: { selector: "this.ECClassId" },
                  ecInstanceId: { selector: "this.ECInstanceId" },
                  nodeLabel: {
                    selector: await instanceLabelSelectClauseFactory.createSelectClause({
                      classAlias: "this",
                      className: classFullName,
                    }),
                  },
                  extendedData: {
                    imageId: "icon-item",
                  },
                  grouping: { byClass: true },
                  hasChildren: selectProps.hasChildren,
                  supportsFiltering: selectProps.supportsFiltering,
                })}
              FROM ${instanceFilterClauses.from} this
              JOIN IdSet(?) groupIdSet ON this.Parent.Id = groupIdSet.id
              ${instanceFilterClauses.joins}
              ${whereClause ? `WHERE ${whereClause}` : ""}
              ${instanceFilterClauses.where ? `${whereClause ? "AND" : "WHERE"} ${instanceFilterClauses.where}` : ""}
              ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
            `,
            bindings: [{ type: "idset", value: groupIds }],
          },
        };
      }),
    );
  }

  private async createGroupInformationElementMemberElementsQuery({
    parentNode,
    instanceFilter,
    nodeSelectClauseFactory,
    instanceLabelSelectClauseFactory,
  }: DefineGenericNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const groupIds: string[] = parentNode.extendedData?.groupIds;
    return Promise.all(
      getElementsSelectProps().map(async ({ classFullName, whereClause, selectProps }) => {
        const instanceFilterClauses = await nodeSelectClauseFactory.createFilterClauses({
          filter: instanceFilter,
          contentClass: { fullName: classFullName, alias: "this" },
        });
        return {
          fullClassName: classFullName,
          query: {
            ecsql: `
              SELECT
                ${await nodeSelectClauseFactory.createSelectClause({
                  ecClassId: { selector: "this.ECClassId" },
                  ecInstanceId: { selector: "this.ECInstanceId" },
                  nodeLabel: {
                    selector: await instanceLabelSelectClauseFactory.createSelectClause({
                      classAlias: "this",
                      className: classFullName,
                    }),
                  },
                  grouping: { byClass: true },
                  extendedData: {
                    imageId: "icon-item",
                  },
                  hasChildren: selectProps.hasChildren,
                  supportsFiltering: selectProps.supportsFiltering,
                })}
              FROM ${instanceFilterClauses.from} this
              JOIN BisCore.ElementGroupsMembers egm ON egm.TargetECInstanceId = this.ECInstanceId
              JOIN IdSet(?) groupIdSet ON egm.SourceECInstanceId = groupIdSet.id
              ${instanceFilterClauses.joins}
              ${whereClause ? `WHERE ${whereClause}` : ""}
              ${instanceFilterClauses.where ? `${whereClause ? "AND" : "WHERE"} ${instanceFilterClauses.where}` : ""}
              ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
            `,
            bindings: [{ type: "idset", value: groupIds }],
          },
        };
      }),
    );
  }

  private async createElementChildrenQuery({
    parentNodeInstanceIds: elementIds,
    instanceFilter,
    nodeSelectClauseFactory,
    instanceLabelSelectClauseFactory,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    return Promise.all(
      getElementsSelectProps().map(async ({ classFullName, whereClause, selectProps }) => {
        const instanceFilterClauses = await nodeSelectClauseFactory.createFilterClauses({
          filter: instanceFilter,
          contentClass: { fullName: classFullName, alias: "this" },
        });
        return {
          fullClassName: classFullName,
          query: {
            ecsql: `
              SELECT
                ${await nodeSelectClauseFactory.createSelectClause({
                  ecClassId: { selector: "this.ECClassId" },
                  ecInstanceId: { selector: "this.ECInstanceId" },
                  nodeLabel: {
                    selector: await instanceLabelSelectClauseFactory.createSelectClause({
                      classAlias: "this",
                      className: classFullName,
                    }),
                  },
                  grouping: { byClass: true },
                  extendedData: {
                    imageId: "icon-item",
                  },
                  hasChildren: selectProps.hasChildren,
                  supportsFiltering: selectProps.supportsFiltering,
                })}
              FROM ${instanceFilterClauses.from} this
              JOIN BisCore.Element p ON p.ECInstanceId = this.Parent.Id
              JOIN IdSet(?) elementIdSet ON p.ECInstanceId = elementIdSet.id
              ${instanceFilterClauses.joins}
              ${whereClause ? `WHERE ${whereClause}` : ""}
              ${instanceFilterClauses.where ? `${whereClause ? "AND" : "WHERE"} ${instanceFilterClauses.where}` : ""}
              ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
            `,
            bindings: [{ type: "idset", value: elementIds }],
          },
        };
      }),
    );
  }
}

function getElementsSelectProps(props?: { modelClass?: EC.FullClassName; elementClass?: "BisCore.GeometricElement3d" | "BisCore.GeometricElement2d" }) {
  const modelClassFullName: EC.FullClassName = props?.modelClass ?? CLASS_NAME_Model;
  const elementClassFullName: EC.FullClassName = props?.elementClass ?? CLASS_NAME_Element;
  const result = [
    {
      classFullName: elementClassFullName,
      whereClause: "this.ECClassId IS NOT (BisCore.GroupInformationElement)",
      selectProps: {
        hasChildren: {
          selector: `
          IFNULL((
            SELECT 1
            FROM (
              SELECT Parent.Id ParentId FROM ${elementClassFullName}
              UNION ALL
              SELECT sm.ModeledElement.Id ParentId FROM ${modelClassFullName} sm WHERE EXISTS (SELECT 1 FROM ${elementClassFullName} WHERE Model.Id = sm.ECInstanceId)
            )
            WHERE ParentId = this.ECInstanceId
            LIMIT 1
          ), 0)
        `,
        },
        supportsFiltering: true,
      },
    },
  ];

  if (!props?.elementClass) {
    result.push({
      classFullName: "BisCore.GroupInformationElement",
      whereClause: "",
      selectProps: {
        hasChildren: {
          selector: `
            IFNULL((
              SELECT 1
              FROM (
                SELECT Parent.Id ParentId FROM ${CLASS_NAME_Element}
                UNION ALL
                SELECT SourceECInstanceId ParentId FROM BisCore.ElementGroupsMembers
              )
              WHERE ParentId = this.ECInstanceId
              LIMIT 1
            ), 0)
          `,
        },
        supportsFiltering: false,
      },
    });
  }

  return result;
}
