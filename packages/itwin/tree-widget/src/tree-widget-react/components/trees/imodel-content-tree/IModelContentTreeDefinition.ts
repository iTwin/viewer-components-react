/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModel } from "@itwin/core-common";
import {
  createNodesQueryClauseFactory,
  createPredicateBasedHierarchyDefinition,
  NodeSelectClauseColumnNames,
  ProcessedHierarchyNode,
} from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory } from "@itwin/presentation-shared";
import { createIdsSelector, parseIdsSelectorResult } from "../common/Utils.js";

import type {
  DefineGenericNodeChildHierarchyLevelProps,
  DefineHierarchyLevelProps,
  DefineInstanceNodeChildHierarchyLevelProps,
  HierarchyDefinition,
  HierarchyLevelDefinition,
  HierarchyNodesDefinition,
  NodesQueryClauseFactory,
} from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector, ECSchemaProvider, ECSqlBinding, IInstanceLabelSelectClauseFactory } from "@itwin/presentation-shared";
import type { IModelContentTreeIdsCache } from "./internal/IModelContentTreeIdsCache.js";

interface IModelContentTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & ECClassHierarchyInspector;
  idsCache: IModelContentTreeIdsCache;
}

export class IModelContentTreeDefinition implements HierarchyDefinition {
  private _impl: HierarchyDefinition;
  private _idsCache: IModelContentTreeIdsCache;
  private _selectQueryFactory: NodesQueryClauseFactory;
  private _nodeLabelSelectClauseFactory: IInstanceLabelSelectClauseFactory;

  public constructor(props: IModelContentTreeDefinitionProps) {
    this._idsCache = props.idsCache;
    this._impl = createPredicateBasedHierarchyDefinition({
      classHierarchyInspector: props.imodelAccess,
      hierarchy: {
        rootNodes: async (requestProps) => this.createSubjectChildrenQuery({ ...requestProps, parentNodeInstanceIds: [IModel.rootSubjectId] }),
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
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) =>
              this.createGeometricModelChildrenQuery({ ...requestProps, viewType: "3d" }),
          },
          {
            parentInstancesNodePredicate: "BisCore.GeometricModel2d",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) =>
              this.createGeometricModelChildrenQuery({ ...requestProps, viewType: "2d" }),
          },
          {
            parentInstancesNodePredicate: "BisCore.SpatialCategory",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) =>
              this.createCategoryChildrenQuery({ ...requestProps, viewType: "3d" }),
          },
          {
            parentInstancesNodePredicate: "BisCore.DrawingCategory",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) =>
              this.createCategoryChildrenQuery({ ...requestProps, viewType: "2d" }),
          },
          {
            parentInstancesNodePredicate: "BisCore.Model",
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
            parentInstancesNodePredicate: "BisCore.Element",
            onlyIfNotHandled: true,
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createElementChildrenQuery(requestProps),
          },
        ],
      },
    });
    this._nodeLabelSelectClauseFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
    this._selectQueryFactory = createNodesQueryClauseFactory({
      imodelAccess: props.imodelAccess,
      instanceLabelSelectClauseFactory: this._nodeLabelSelectClauseFactory,
    });
  }

  public async postProcessNode(node: ProcessedHierarchyNode): Promise<ProcessedHierarchyNode> {
    if (ProcessedHierarchyNode.isGroupingNode(node)) {
      const label = node.children.length ? `${node.label} (${node.children.length})` : node.label;
      return { ...node, label, extendedData: { ...node.extendedData, imageId: "icon-ec-class" } };
    }
    return node;
  }

  public async defineHierarchyLevel(props: DefineHierarchyLevelProps) {
    return this._impl.defineHierarchyLevel(props);
  }

  private async createSubjectChildrenQuery({
    parentNodeInstanceIds: subjectIds,
    instanceFilter,
  }: Pick<DefineInstanceNodeChildHierarchyLevelProps, "parentNodeInstanceIds" | "instanceFilter">): Promise<HierarchyLevelDefinition> {
    const [subjectFilterClauses, modelFilterClauses] = await Promise.all([
      this._selectQueryFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: "BisCore.Subject", alias: "this" },
      }),
      this._selectQueryFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: "BisCore.Model", alias: "this" },
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
                hasChildren: { selector: `InVirtualSet(?, this.ECInstanceId)` },
                grouping: { byLabel: { action: "merge", groupId: "subject" } },
                extendedData: {
                  imageId: "icon-folder",
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
        fullClassName: "BisCore.Model",
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
                  extendedData: {
                    imageId: "icon-model",
                  },
                  supportsFiltering: true,
                })}
              FROM BisCore.Model m
              JOIN BisCore.InformationPartitionElement [partition] ON [partition].ECInstanceId = m.ModeledElement.Id
              WHERE
                m.ECInstanceId IN (${childModelIds.map(() => "?").join(",")})
            ) model
            JOIN ${modelFilterClauses.from} this ON this.ECInstanceId = model.ECInstanceId
            ${modelFilterClauses.joins}
            ${modelFilterClauses.where ? `WHERE (model.${NodeSelectClauseColumnNames.HideNodeInHierarchy} OR ${modelFilterClauses.where})` : ""}
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
        fullClassName: "BisCore.Model",
        query: {
          ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: "", // doesn't matter - the node is always hidden
                hideNodeInHierarchy: true,
              })}
            FROM BisCore.Model this
            WHERE
              this.ModeledElement.Id IN (${elementIds.map(() => "?").join(",")})
              AND NOT this.IsPrivate
          `,
          bindings: [...elementIds.map((id): ECSqlBinding => ({ type: "id", value: id }))],
        },
      },
    ];
  }

  private async createGeometricModelChildrenQuery({
    parentNodeInstanceIds: modelIds,
    instanceFilter,
    viewType,
  }: DefineInstanceNodeChildHierarchyLevelProps & { viewType: "2d" | "3d" }): Promise<HierarchyLevelDefinition> {
    const childCategoryIds = await this._idsCache.getModelCategories(modelIds);

    const { categoryClass } = getClassNameByViewType(viewType);
    const categoryFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: categoryClass, alias: "this" },
    });
    const informationContentElementFilterClauses = await this._selectQueryFactory.createFilterClauses({
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
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
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
            ${categoryFilterClauses.joins}
            WHERE
              this.ECInstanceId IN (${childCategoryIds.map(() => "?").join(",")})
              ${categoryFilterClauses.where ? `AND ${categoryFilterClauses.where}` : ""}
          `,
          bindings: childCategoryIds.map((id): ECSqlBinding => ({ type: "id", value: id })),
        },
      });
    defs.push({
      fullClassName: "BisCore.InformationContentElement",
      query: {
        ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
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
            ${informationContentElementFilterClauses.joins}
            WHERE
              this.Model.Id IN (${modelIds.map(() => "?").join(",")})
              ${informationContentElementFilterClauses.where ? `AND ${informationContentElementFilterClauses.where}` : ""}
          `,
        bindings: modelIds.map((id) => ({ type: "id", value: id })),
      },
    });
    return defs;
  }

  private async createCategoryChildrenQuery(props: DefineInstanceNodeChildHierarchyLevelProps & { viewType: "2d" | "3d" }): Promise<HierarchyLevelDefinition> {
    const { parentNodeInstanceIds: categoryIds, parentNode, instanceFilter, viewType } = props;
    const modelIds = parseIdsSelectorResult(parentNode.extendedData?.modelIds);

    // We only want to handle a category added as a child of `GeometricModel2d` or `GeometricModel3d`.
    // ModelIds is not empty only if parent node is a geometric model.
    if (modelIds.length === 0) {
      return this.createElementChildrenQuery(props);
    }

    const { elementClass, modelClass } = getClassNameByViewType(viewType);
    return Promise.all(
      getElementsSelectProps({ modelClass, elementClass }).map(async ({ selectProps, whereClause }) => {
        const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
          filter: instanceFilter,
          contentClass: { fullName: elementClass, alias: "this" },
        });
        return {
          fullClassName: elementClass,
          query: {
            ecsql: `
              SELECT
                ${await this._selectQueryFactory.createSelectClause({
                  ecClassId: { selector: "this.ECClassId" },
                  ecInstanceId: { selector: "this.ECInstanceId" },
                  nodeLabel: {
                    selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
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
              ${instanceFilterClauses.joins}
              WHERE
                this.Category.Id IN (${categoryIds.map(() => "?").join(",")})
                AND this.Model.Id IN (${modelIds.map(() => "?").join(",")})
                AND this.Parent.Id IS NULL
                ${whereClause ? `AND ${whereClause}` : ""}
                ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
            `,
            bindings: [...categoryIds.map((id) => ({ type: "id", value: id })), ...modelIds.map((id) => ({ type: "id", value: id }))] as ECSqlBinding[],
          },
        };
      }),
    );
  }

  private async createModelChildrenQuery({
    parentNodeInstanceIds: modelIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    return Promise.all(
      getElementsSelectProps().map(async ({ classFullName, whereClause, selectProps }) => {
        const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
          filter: instanceFilter,
          contentClass: { fullName: classFullName, alias: "this" },
        });
        return {
          fullClassName: classFullName,
          query: {
            ecsql: `
            SELECT
              ${await this._selectQueryFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
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
            ${instanceFilterClauses.joins}
            WHERE
              this.Parent.Id IS NULL
              AND this.Model.Id IN (${modelIds.map(() => "?").join(",")})
              ${whereClause ? `AND ${whereClause}` : ""}
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
          `,
            bindings: modelIds.map((id): ECSqlBinding => ({ type: "id", value: id })),
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

  private async createChildrenNodeChildrenQuery({ parentNode, instanceFilter }: DefineGenericNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const groupIds: string[] = parentNode.extendedData?.groupIds;
    return Promise.all(
      getElementsSelectProps().map(async ({ classFullName, whereClause, selectProps }) => {
        const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
          filter: instanceFilter,
          contentClass: { fullName: classFullName, alias: "this" },
        });
        return {
          fullClassName: classFullName,
          query: {
            ecsql: `
              SELECT
                ${await this._selectQueryFactory.createSelectClause({
                  ecClassId: { selector: "this.ECClassId" },
                  ecInstanceId: { selector: "this.ECInstanceId" },
                  nodeLabel: {
                    selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
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
              ${instanceFilterClauses.joins}
              WHERE
                this.Parent.Id IN (${groupIds.map(() => "?").join(",")})
                ${whereClause ? `AND ${whereClause}` : ""}
                ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
            `,
            bindings: groupIds.map((id) => ({ type: "id", value: id })),
          },
        };
      }),
    );
  }

  private async createGroupInformationElementMemberElementsQuery({
    parentNode,
    instanceFilter,
  }: DefineGenericNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const groupIds: string[] = parentNode.extendedData?.groupIds;
    return Promise.all(
      getElementsSelectProps().map(async ({ classFullName, whereClause, selectProps }) => {
        const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
          filter: instanceFilter,
          contentClass: { fullName: classFullName, alias: "this" },
        });
        return {
          fullClassName: classFullName,
          query: {
            ecsql: `
              SELECT
                ${await this._selectQueryFactory.createSelectClause({
                  ecClassId: { selector: "this.ECClassId" },
                  ecInstanceId: { selector: "this.ECInstanceId" },
                  nodeLabel: {
                    selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
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
              ${instanceFilterClauses.joins}
              WHERE
                egm.SourceECInstanceId IN (${groupIds.map(() => "?").join(",")})
                ${whereClause ? `AND ${whereClause}` : ""}
                ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
            `,
            bindings: groupIds.map((id) => ({ type: "id", value: id })),
          },
        };
      }),
    );
  }

  private async createElementChildrenQuery({
    parentNodeInstanceIds: elementIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    return Promise.all(
      getElementsSelectProps().map(async ({ classFullName, whereClause, selectProps }) => {
        const instanceFilterClauses = await this._selectQueryFactory.createFilterClauses({
          filter: instanceFilter,
          contentClass: { fullName: classFullName, alias: "this" },
        });
        return {
          fullClassName: classFullName,
          query: {
            ecsql: `
              SELECT
                ${await this._selectQueryFactory.createSelectClause({
                  ecClassId: { selector: "this.ECClassId" },
                  ecInstanceId: { selector: "this.ECInstanceId" },
                  nodeLabel: {
                    selector: await this._nodeLabelSelectClauseFactory.createSelectClause({
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
              ${instanceFilterClauses.joins}
              WHERE
                p.ECInstanceId IN (${elementIds.map(() => "?").join(",")})
                ${whereClause ? `AND ${whereClause}` : ""}
                ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
            `,
            bindings: elementIds.map((id) => ({ type: "id", value: id })),
          },
        };
      }),
    );
  }
}

function getClassNameByViewType(view: "2d" | "3d") {
  if (view === "2d") {
    return { categoryClass: "BisCore.DrawingCategory", elementClass: "BisCore.GeometricElement2d", modelClass: "BisCore.GeometricModel2d" } as const;
  }
  return { categoryClass: "BisCore.SpatialCategory", elementClass: "BisCore.GeometricElement3d", modelClass: "BisCore.GeometricModel3d" } as const;
}

function getElementsSelectProps(props?: { modelClass?: string; elementClass?: "BisCore.GeometricElement3d" | "BisCore.GeometricElement2d" }) {
  const modelClassFullName = props?.modelClass ?? "BisCore.Model";
  const elementClassFullName = props?.elementClass ?? "BisCore.Element";
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
                SELECT Parent.Id ParentId FROM BisCore.Element
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
