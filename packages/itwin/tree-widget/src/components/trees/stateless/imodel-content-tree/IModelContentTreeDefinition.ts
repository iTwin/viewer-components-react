/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  createClassBasedHierarchyDefinition,
  createNodesQueryClauseFactory,
  HierarchyNode,
  NodeSelectClauseColumnNames,
} from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql } from "@itwin/presentation-shared";
import { createIdsSelector } from "../common/Utils";

import type { ECClassHierarchyInspector, ECSchemaProvider, ECSqlBinding, IInstanceLabelSelectClauseFactory } from "@itwin/presentation-shared";
import type { Id64String } from "@itwin/core-bentley";
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

interface IModelContentTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & ECClassHierarchyInspector;
}

export class IModelContentTreeDefinition implements HierarchyDefinition {
  private _impl: HierarchyDefinition;
  private _selectQueryFactory: NodesQueryClauseFactory;
  private _nodeLabelSelectClauseFactory: IInstanceLabelSelectClauseFactory;

  public constructor(props: IModelContentTreeDefinitionProps) {
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
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) =>
              this.createGeometricModelChildrenQuery({ ...requestProps, viewType: "3d" }),
          },
          {
            parentNodeClassName: "BisCore.GeometricModel2d",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) =>
              this.createGeometricModelChildrenQuery({ ...requestProps, viewType: "2d" }),
          },
          {
            parentNodeClassName: "BisCore.SpatialCategory",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) =>
              this.createCategoryChildrenQuery({ ...requestProps, viewType: "3d" }),
          },
          {
            parentNodeClassName: "BisCore.DrawingCategory",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) =>
              this.createCategoryChildrenQuery({ ...requestProps, viewType: "2d" }),
          },
          {
            parentNodeClassName: "BisCore.Model",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createModelChildrenQuery(requestProps),
          },
          {
            parentNodeClassName: "BisCore.GroupInformationElement",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createGroupInformationElementChildElementsQuery(requestProps),
          },
          {
            customParentNodeKey: "ChildrenNode",
            definitions: async (requestProps: DefineCustomNodeChildHierarchyLevelProps) => this.createChildrenNodeChildrenQuery(requestProps),
          },
          {
            customParentNodeKey: "MembersNode",
            definitions: async (requestProps: DefineCustomNodeChildHierarchyLevelProps) => this.createGroupInformationElementMemberElementsQuery(requestProps),
          },
          {
            parentNodeClassName: "BisCore.Element",
            definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createElementChildrenQuery(requestProps),
          },
        ],
      },
    });
    this._selectQueryFactory = createNodesQueryClauseFactory({ imodelAccess: props.imodelAccess });
    this._nodeLabelSelectClauseFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
  }

  public async postProcessNode(node: ProcessedHierarchyNode): Promise<ProcessedHierarchyNode> {
    if (HierarchyNode.isClassGroupingNode(node)) {
      const label = node.children.length ? `${node.label} (${node.children.length})` : node.label;
      return { ...node, label, extendedData: { ...node.extendedData, imageId: "icon-ec-class" } };
    }
    return node;
  }

  public async defineHierarchyLevel(props: DefineHierarchyLevelProps) {
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
    const selectColumnNames = Object.values(NodeSelectClauseColumnNames).join(", ");
    const subjectFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: "BisCore.Subject", alias: "this" },
    });
    const modelFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: "BisCore.Model", alias: "this" },
    });
    const ctes = [
      `
        subjects(${selectColumnNames}, ParentId) AS (
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
              hideNodeInHierarchy: {
                selector: `
                  CASE
                    WHEN (
                      json_extract(this.JsonProperties, '$.Subject.Job.Bridge') IS NOT NULL
                      OR json_extract(this.JsonProperties, '$.Subject.Model.Type') = 'Hierarchy'
                    ) THEN 1
                    ELSE 0
                  END
                `,
              },
              extendedData: {
                imageId: "icon-folder",
                isSubject: true,
              },
              supportsFiltering: true,
            })},
            this.Parent.Id
          FROM BisCore.Subject this
        )
      `,
      `
        child_subjects(${selectColumnNames}, ParentId, RootId) AS (
          SELECT *, s.ParentId RootId FROM subjects s
          UNION ALL
          SELECT s.*, p.RootId
          FROM child_subjects p
          JOIN subjects s ON s.ParentId = p.ECInstanceId
          WHERE p.${NodeSelectClauseColumnNames.HideNodeInHierarchy} = 1
        )
      `,
    ];
    return [
      {
        fullClassName: "BisCore.Subject",
        query: {
          ctes,
          ecsql: `
            SELECT
              ${Object.values(NodeSelectClauseColumnNames)
                .map((name: string) => `cs.${name} AS ${name}`)
                .join(", ")},
              ParentId
            FROM child_subjects cs
            JOIN ${subjectFilterClauses.from} this ON this.ECInstanceId = cs.ECInstanceId
            ${subjectFilterClauses.joins}
            WHERE
              cs.RootId IN (${subjectIds.map(() => "?").join(",")})
              AND NOT cs.${NodeSelectClauseColumnNames.HideNodeInHierarchy}
              ${subjectFilterClauses.where ? `AND ${subjectFilterClauses.where}` : ""}
          `,
          bindings: [...subjectIds.map((id): ECSqlBinding => ({ type: "id", value: id }))],
        },
      },
      {
        fullClassName: "BisCore.Model",
        query: {
          ctes,
          ecsql: `
            SELECT childModel.ECInstanceId AS ECInstanceId, childModel.*
            FROM (
              SELECT
                ${await this._selectQueryFactory.createSelectClause({
                  ecClassId: { selector: "model.ECClassId" },
                  ecInstanceId: { selector: "model.ECInstanceId" },
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
              FROM BisCore.Model model
              JOIN bis.InformationPartitionElement [partition] ON [partition].ECInstanceId = model.ModeledElement.Id
              JOIN bis.Subject [subject] ON [subject].ECInstanceId = [partition].Parent.Id OR json_extract([subject].JsonProperties,'$.Subject.Model.TargetPartition') = printf('0x%x', [partition].ECInstanceId)
              WHERE
                NOT model.IsPrivate
                AND (
                  [subject].ECInstanceId IN (${subjectIds.map(() => "?").join(",")})
                  OR [subject].ECInstanceId IN (
                    SELECT s.ECInstanceId
                    FROM child_subjects s
                    WHERE s.RootId IN (${subjectIds.map(() => "?").join(",")}) AND s.${NodeSelectClauseColumnNames.HideNodeInHierarchy}
                  )
                )
            ) childModel
            JOIN ${modelFilterClauses.from} this ON this.ECInstanceId = childModel.ECInstanceId
            ${modelFilterClauses.joins}
            ${modelFilterClauses.where ? `AND (childModel.${NodeSelectClauseColumnNames.HideNodeInHierarchy} OR ${modelFilterClauses.where})` : ""}
          `,
          bindings: [
            ...subjectIds.map((id): ECSqlBinding => ({ type: "id", value: id })),
            ...subjectIds.map((id): ECSqlBinding => ({ type: "id", value: id })),
          ],
        },
      },
    ];
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
    const { categoryClass, elementClass } = getClassNameByViewType(viewType);
    const categoryFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: categoryClass, alias: "this" },
    });
    const informationContentElementFilterClauses = await this._selectQueryFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: "BisCore.InformationContentElement", alias: "this" },
    });
    return [
      {
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
                hasChildren: true,
                grouping: { byLabel: { action: "merge", groupId: "category" } },
                extendedData: {
                  imageId: "icon-layers",
                  modelIds: { selector: createIdsSelector(modelIds) },
                  isCategory: true,
                },
                supportsFiltering: true,
              })}
            FROM ${categoryFilterClauses.from} this
            ${categoryFilterClauses.joins}
            WHERE
              EXISTS (SELECT 1 FROM ${elementClass} e WHERE e.Category.Id = this.ECInstanceId AND e.Model.Id IN (${modelIds.map(() => "?").join(",")}))
              ${categoryFilterClauses.where ? `AND ${categoryFilterClauses.where}` : ""}
          `,
          bindings: modelIds.map((id) => ({ type: "id", value: id })),
        },
      },
      {
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
                extendedData: {
                  isInformationContentElement: true,
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
      },
    ];
  }

  private async createCategoryChildrenQuery({
    parentNodeInstanceIds: categoryIds,
    parentNode,
    instanceFilter,
    viewType,
  }: DefineInstanceNodeChildHierarchyLevelProps & { viewType: "2d" | "3d" }): Promise<HierarchyLevelDefinition> {
    // We only want to handle a category added as a child of `GeometricModel2d` or `GeometricModel3d`.
    if (!parentNode.extendedData?.isCategory) {
      return [];
    }
    const { elementClass, modelClass } = getClassNameByViewType(viewType);
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
      contentClass: { fullName: elementClass, alias: "this" },
    });
    return [
      {
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
                hasChildren: {
                  selector: `
                    IFNULL((
                      SELECT 1
                      FROM (
                        SELECT Parent.Id ParentId FROM ${elementClass}
                        UNION ALL
                        SELECT ModeledElement.Id ParentId FROM ${modelClass}
                      )
                      WHERE ParentId = this.ECInstanceId
                      LIMIT 1
                    ), 0)
                  `,
                },
                grouping: {
                  byClass: true,
                },
                extendedData: {
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

  private async createModelChildrenQuery({
    parentNodeInstanceIds: modelIds,
    instanceFilter,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    return Promise.all(
      mapElementsSelectProps(async ({ classFullName, whereClause, selectProps }) => {
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
                  ...selectProps.extendedData,
                },
                hasChildren: selectProps?.hasChildren,
                supportsFiltering: selectProps?.supportsFiltering,
              })}
            FROM ${instanceFilterClauses.from} this
            JOIN BisCore.Model m ON m.ECInstanceId = this.Model.id
            ${instanceFilterClauses.joins}
            WHERE
              m.ECClassId IS NOT (BisCore.GeometricModel)
              AND this.Parent IS NULL
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

  private async createChildrenNodeChildrenQuery({ parentNode, instanceFilter }: DefineCustomNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const groupIds: string[] = parentNode.extendedData?.groupIds;
    return Promise.all(
      mapElementsSelectProps(async ({ classFullName, whereClause, selectProps }) => {
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
                    ...selectProps.extendedData,
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
  }: DefineCustomNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const groupIds: string[] = parentNode.extendedData?.groupIds;
    return Promise.all(
      mapElementsSelectProps(async ({ classFullName, whereClause, selectProps }) => {
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
                    ...selectProps.extendedData,
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
    parentNode,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const data = parentNode.extendedData;
    if (data?.isCategory || data?.isSubject || data?.isInformationContentElement || data?.isGroupInformationElement) {
      return [];
    }
    return Promise.all(
      mapElementsSelectProps(async ({ classFullName, whereClause, selectProps }) => {
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
                    ...selectProps.extendedData,
                  },
                  hasChildren: selectProps.hasChildren,
                  supportsFiltering: selectProps.supportsFiltering,
                })}
              FROM ${instanceFilterClauses.from} this
              JOIN BisCore.Element p ON p.ECInstanceId = this.Parent.Id
              ${instanceFilterClauses.joins}
              WHERE
                p.ECInstanceId IN (${elementIds.map(() => "?").join(",")}) AND
                p.ECClassId IS NOT (BisCore.ISubModeledElement)
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
    return { categoryClass: "BisCore.DrawingCategory", elementClass: "BisCore.GeometricElement2d", modelClass: "BisCore.GeometricModel2d" };
  }
  return { categoryClass: "BisCore.SpatialCategory", elementClass: "BisCore.GeometricElement3d", modelClass: "BisCore.GeometricModel3d" };
}

function mapElementsSelectProps<T>(
  callback: (props: {
    classFullName: string;
    whereClause: string;
    selectProps: Partial<Pick<Parameters<NodesQueryClauseFactory["createSelectClause"]>[0], "supportsFiltering" | "hasChildren" | "extendedData">>;
  }) => T,
): T[] {
  return [
    {
      classFullName: "BisCore.Element",
      whereClause: "this.ECClassId IS NOT (BisCore.GroupInformationElement)",
      selectProps: {
        hasChildren: {
          selector: `
          IFNULL((
            SELECT 1
            FROM (
              SELECT Parent.Id ParentId FROM BisCore.Element
              UNION ALL
              SELECT ModeledElement.Id ParentId FROM BisCore.Model
            )
            WHERE ParentId = this.ECInstanceId
            LIMIT 1
          ), 0)
        `,
        },
        supportsFiltering: true,
      },
    },
    {
      classFullName: "BisCore.GroupInformationElement",
      whereClause: "this.ECClassId IS (BisCore.GroupInformationElement)",
      selectProps: {
        extendedData: {
          isGroupInformationElement: true,
        },
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
    },
  ].map((props) => callback(props));
}
