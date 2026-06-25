/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, defer, EMPTY, firstValueFrom, forkJoin, from, fromEvent, identity, map, merge, mergeMap, reduce, switchMap, takeUntil } from "rxjs";
import { assert, Guid } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import { createPredicateBasedHierarchyDefinition, NodeSelectClauseColumnNames, ProcessedHierarchyNode } from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql } from "@itwin/presentation-shared";
import { eachValueFrom } from "../../utils/EachValueFrom.js";
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
import { catchBeSQLiteInterrupts } from "../common/internal/UseErrorState.js";
import {
  createIdsSelector,
  fromWithRelease,
  getOptimalBatchSize,
  groupingNodeDataFromChildren,
  ParentElementsPath,
  parseIdsSelectorResult,
  releaseMainThreadOnItemsCount,
} from "../common/internal/Utils.js";
import { SearchLimitExceededError } from "../common/TreeErrors.js";
import { ModelsTreeNodeInternal } from "./internal/ModelsTreeNodeInternal.js";

import type { Observable, ObservedValueOf, OperatorFunction } from "rxjs";
import type { GuidString, Id64Array, Id64String } from "@itwin/core-bentley";
import type {
  ClassGroupingNodeKey,
  DefineHierarchyLevelProps,
  DefineInstanceNodeChildHierarchyLevelProps,
  GroupingHierarchyNode,
  HierarchyDefinition,
  HierarchyLevelDefinition,
  HierarchyNodeIdentifiersPath,
  HierarchyNodesDefinition,
  InstancesNodeKey,
  LimitingECSqlQueryExecutor,
  NodePostProcessor,
  NodePreProcessor,
} from "@itwin/presentation-hierarchies";
import type {
  EC,
  ECClassHierarchyInspector,
  ECSchemaProvider,
  ECSqlBinding,
  ECSqlQueryDef,
  ECSqlQueryRow,
  IInstanceLabelSelectClauseFactory,
  InstanceKey,
  Props,
} from "@itwin/presentation-shared";
import type { ModelsTreeIdsCache } from "./internal/ModelsTreeIdsCache.js";
import type { CategoryNodeProps, ElementNodeProps } from "./internal/ModelsTreeNodeInternal.js";

/** @beta */
export type ClassGroupingHierarchyNode = GroupingHierarchyNode & { key: ClassGroupingNodeKey };

const MAX_SEARCH_INSTANCE_KEY_COUNT = 100;

/**
 * Defines hierarchy configuration supported by `ModelsTree`.
 * @beta
 */
export interface ModelsTreeHierarchyConfiguration {
  /** Should element nodes be grouped by class. Defaults to `enable`. */
  elementClassGrouping: "enable" | "enableWithCounts" | "disable";
  /** Full class name of a `GeometricElement3d` sub-class that should be used to load element nodes. Defaults to `BisCore.GeometricElement3d`. */
  elementClassSpecification: EC.FullClassName;
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
  #impl: HierarchyDefinition;
  #idsCache: ModelsTreeIdsCache;
  #hierarchyConfig: ModelsTreeHierarchyConfiguration;
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
    this.#componentId = props.componentId ?? Guid.createValue();
    this.#idsCache = props.idsCache;
    this.#queryExecutor = props.imodelAccess;
    this.#hierarchyConfig = props.hierarchyConfig;
  }

  public preProcessNode: NodePreProcessor = async ({ node }) => {
    if (ModelsTreeNodeInternal.isRawCategoryNode(node)) {
      return {
        ...node,
        extendedData: {
          ...node.extendedData,
          modelIds: parseIdsSelectorResult(node.extendedData.modelIds),
        },
      };
    }
    return node;
  };

  private static extendPathWithElement(elementNode: { key: InstancesNodeKey; extendedData: ElementNodeProps }): ParentElementsPath {
    return ParentElementsPath.appendToPath({
      path: elementNode.extendedData.parentElementsPath,
      ids: elementNode.key.instanceKeys.map(({ id }) => id),
      categoryId: elementNode.extendedData.categoryId,
    });
  }

  private static getInheritedParentElementsPath(parentNode: NonNullable<Props<NodePostProcessor>["parentNode"]>): ParentElementsPath {
    if (ModelsTreeNodeInternal.isElementClassGroupingNode(parentNode) || ModelsTreeNodeInternal.isCategoryNode(parentNode)) {
      return parentNode.extendedData.parentElementsPath;
    }
    throw new Error("Expected node's parent to be category, or class grouping node");
  }

  private assignParentElementsPath({ node, parentNode }: Pick<Props<NodePostProcessor>, "node" | "parentNode">): ProcessedHierarchyNode {
    if (ModelsTreeNodeInternal.isRawCategoryNode(node)) {
      const modelIds: CategoryNodeProps["modelIds"] = node.extendedData.modelIds;
      if (parentNode === undefined) {
        // If subjects are not shown and model has PhysicalPartition.Model.Content or GraphicalPartition3d.Model.Content property,
        // then such models are not shown and category might have no parent node
        node.extendedData = {
          ...node.extendedData,
          parentElementsPath: [],
        };
        return node;
      }
      // When the parent is an element that actually contains this category, the category continues the element path.
      // Otherwise (parent is a model, or a sub-model boundary) the path is reset.
      const parentIsContainingElement =
        ModelsTreeNodeInternal.isElementNode(parentNode) && parentNode.key.instanceKeys.every(({ id }) => !modelIds.includes(id));
      node.extendedData = {
        ...node.extendedData,
        parentElementsPath: parentIsContainingElement ? ModelsTreeDefinition.extendPathWithElement(parentNode) : [],
      };
      return node;
    }
    if (ModelsTreeNodeInternal.isRawElementNode(node) || ModelsTreeNodeInternal.isRawElementClassGroupingNode(node)) {
      assert(parentNode !== undefined, "Expected node to have a parent node");
      node.extendedData = {
        ...node.extendedData,
        parentElementsPath: ModelsTreeNodeInternal.isElementNode(parentNode)
          ? ModelsTreeDefinition.extendPathWithElement(parentNode)
          : ModelsTreeDefinition.getInheritedParentElementsPath(parentNode),
      };
      return node;
    }
    return node;
  }

  public postProcessNode: NodePostProcessor = async ({ node, parentNode }) => {
    node = this.assignParentElementsPath({ node, parentNode });
    if (!ProcessedHierarchyNode.isGroupingNode(node)) {
      return node;
    }
    const { hasSearchTargetAncestor, hasDirectNonSearchTargets } = groupingNodeDataFromChildren(node.children);
    const childrenWhichAreParents = new Set(
      node.children
        .filter((child) => !!child.children)
        .map((child) => {
          assert(ModelsTreeNodeInternal.isRawElementNode(child), "Expect all children of grouping nodes to be element nodes");
          return child.key.instanceKeys.map(({ id }) => id);
        })
        .flat(),
    );
    const firstChild = node.children[0];
    assert(ModelsTreeNodeInternal.isRawElementNode(firstChild), "Expect first child of grouping node to be an element node");

    return {
      ...node,
      label: this.#hierarchyConfig.elementClassGrouping === "enableWithCounts" ? `${node.label} (${node.children.length})` : node.label,
      extendedData: {
        ...node.extendedData,
        // `modelId`, `categoryId` are shared by all grouped elements.
        categoryId: firstChild.extendedData.categoryId,
        modelId: firstChild.extendedData.modelId,
        childrenWhichAreParents,
        ...(hasDirectNonSearchTargets ? { hasDirectNonSearchTargets } : {}),
        ...(hasSearchTargetAncestor ? { hasSearchTargetAncestor } : {}),
        // `imageId` is assigned to instance nodes at query time, but grouping ones need to
        // be handled during post-processing
        imageId: "icon-ec-class",
      },
    };
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

  private async createSubjectChildrenQuery({
    parentNodeInstanceIds: parentSubjectIds,
    instanceFilter,
    instanceLabelSelectClauseFactory,
    nodeSelectClauseFactory,
  }: Pick<
    DefineInstanceNodeChildHierarchyLevelProps,
    "parentNodeInstanceIds" | "instanceFilter" | "instanceLabelSelectClauseFactory" | "nodeSelectClauseFactory"
  >): Promise<HierarchyLevelDefinition> {
    const [subjectFilterClauses, modelFilterClauses] = await Promise.all([
      nodeSelectClauseFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: CLASS_NAME_Subject, alias: "this" },
      }),
      nodeSelectClauseFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: CLASS_NAME_GeometricModel3d, alias: "this" },
      }),
    ]);
    const { childSubjectIds, childModelIds } = parentSubjectIds.length
      ? await firstValueFrom(
          forkJoin({
            childSubjectIds: this.#idsCache.getChildSubjectIds(parentSubjectIds),
            childModelIds: this.#idsCache.getChildSubjectModelIds(parentSubjectIds),
          }),
        )
      : { childSubjectIds: [IModel.rootSubjectId], childModelIds: [] };
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
                hideIfNoChildren: true,
                hasChildren: {
                  selector: `IFNULL(
                    (
                      SELECT 1
                      FROM IdSet(?) hasChildrenIdSet
                      WHERE hasChildrenIdSet.id = this.ECInstanceId
                      LIMIT 1
                    ),
                    0
                  )`,
                },
                grouping: { byLabel: { action: "merge", groupId: "subject" } },
                extendedData: {
                  imageId: { selector: `IIF(this.ECInstanceId = ${IModel.rootSubjectId}, 'icon-imodel-hollow-2', 'icon-folder')` },
                  isSubject: true,
                },
                autoExpand: { selector: `IIF(this.ECInstanceId = ${IModel.rootSubjectId}, true, false)` },
                supportsFiltering: this.supportsFiltering(),
              })}
            FROM ${subjectFilterClauses.from} this
            JOIN IdSet(?) childSubjectIdSet ON this.ECInstanceId = childSubjectIdSet.id
            ${subjectFilterClauses.joins}
            ${subjectFilterClauses.where ? `WHERE ${subjectFilterClauses.where}` : ""}
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `,
          bindings: [
            { type: "idset", value: await firstValueFrom(this.#idsCache.getParentSubjectIds()) },
            { type: "idset", value: childSubjectIds },
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
              FROM ${CLASS_NAME_GeometricModel3d} m
              JOIN IdSet(?) childModelIdSet ON m.ECInstanceId = childModelIdSet.id
              JOIN ${CLASS_NAME_InformationPartitionElement} [partition] ON [partition].ECInstanceId = m.ModeledElement.Id
              ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
            ) model
            JOIN ${modelFilterClauses.from} this ON this.ECInstanceId = model.ECInstanceId
            ${modelFilterClauses.joins}
            ${modelFilterClauses.where ? `AND (model.${NodeSelectClauseColumnNames.HideNodeInHierarchy} OR ${modelFilterClauses.where})` : ""}
          `,
          bindings: [{ type: "idset", value: childModelIds }],
        },
      });
    return defs;
  }

  private async createISubModeledElementChildrenQuery({
    parentNodeInstanceIds: elementIds,
    parentNode,
    nodeSelectClauseFactory,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    assert(ModelsTreeNodeInternal.isElementNode(parentNode), "Expected parent node to be element node");
    // note: we do not apply hierarchy level filtering on this hierarchy level, because it's always
    // hidden - the filter will get applied on the child hierarchy levels
    return [
      {
        fullClassName: CLASS_NAME_GeometricModel3d,
        query: {
          ecsql: `
            SELECT
              ${await nodeSelectClauseFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: "", // doesn't matter - the node is always hidden
                hideNodeInHierarchy: true,
                hasChildren: true,
                extendedData: {
                  isModel: true,
                  modeledElementCategory: { selector: `IdToHex(${parentNode.extendedData.categoryId})` },
                },
              })}
            FROM ${CLASS_NAME_GeometricModel3d} this
            JOIN IdSet(?) elementIdSet ON this.ModeledElement.Id = elementIdSet.id
            WHERE
              NOT this.IsPrivate
              AND this.ECInstanceId IN (SELECT Model.Id FROM ${this.#hierarchyConfig.elementClassSpecification})
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `,
          bindings: [{ type: "idset", value: elementIds }],
        },
      },
    ];
  }

  private async createGeometricModel3dChildrenQuery({
    parentNodeInstanceIds: modelIds,
    parentNode,
    instanceFilter,
    nodeSelectClauseFactory,
    instanceLabelSelectClauseFactory,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const modeledElementCategory = parentNode.extendedData?.modeledElementCategory;
    const [categoryInstanceFilterClauses, elementInstanceFilterClauses, allSubModels, categoryIds] = await Promise.all([
      nodeSelectClauseFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: CLASS_NAME_SpatialCategory, alias: "this" },
      }),
      nodeSelectClauseFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: this.#hierarchyConfig.elementClassSpecification, alias: "this" },
      }),
      firstValueFrom(this.#idsCache.getAllSubModels()),
      firstValueFrom(this.#idsCache.getCategoriesOfModelsTopMostElements(modelIds).pipe(map((categoriesSet) => [...categoriesSet]))),
    ]);
    if (categoryIds.length === 0) {
      return [];
    }
    // For top-level models show all categories of the top-most elements. For sub-models show only the categories
    // that don't match the sub-model element's category as intermediate category nodes - the elements matching
    // that category are shown directly (see below).
    const categoriesToShow = modeledElementCategory === undefined ? categoryIds : categoryIds.filter((categoryId) => categoryId !== modeledElementCategory);
    const definitions: HierarchyLevelDefinition = [];
    if (categoriesToShow.length > 0) {
      definitions.push({
        fullClassName: CLASS_NAME_SpatialCategory,
        query: {
          ecsql: `
            SELECT
              ${await this.createCategoryNodeSelectClause({
                nodeSelectClauseFactory,
                instanceLabelSelectClauseFactory,
                extendedData: { modelIds: { selector: createIdsSelector(modelIds) } },
              })}
            FROM ${categoryInstanceFilterClauses.from} this
            JOIN IdSet(?) categoryIdSet ON categoryIdSet.id = this.ECInstanceId
            ${categoryInstanceFilterClauses.joins}
            ${categoryInstanceFilterClauses.where ? `WHERE ${categoryInstanceFilterClauses.where}` : ""}
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `,
          bindings: [{ type: "idset", value: categoriesToShow }],
        },
      });
    }
    // Show elements which match the sub-model element's category directly under the (hidden) sub-model node.
    if (categoriesToShow.length !== categoryIds.length) {
      const { selectClause, bindings } = await this.createElementNodeSelectClause({
        nodeSelectClauseFactory,
        instanceLabelSelectClauseFactory,
        allSubModels: [...allSubModels],
      });
      definitions.push({
        fullClassName: this.#hierarchyConfig.elementClassSpecification,
        query: {
          ecsql: `
            SELECT
              ${selectClause}
            FROM ${elementInstanceFilterClauses.from} this
            JOIN IdSet(?) modelIdSet ON this.Model.Id = modelIdSet.id
            ${elementInstanceFilterClauses.joins}
            WHERE
              this.Parent.Id IS NULL
              AND this.Category.Id = ${modeledElementCategory}
              ${elementInstanceFilterClauses.where ? `AND ${elementInstanceFilterClauses.where}` : ""}
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `,
          bindings: [...bindings, { type: "idset", value: modelIds }],
        },
      });
    }
    return definitions;
  }

  private async createElementNodeSelectClause({
    nodeSelectClauseFactory,
    instanceLabelSelectClauseFactory,
    allSubModels,
  }: {
    nodeSelectClauseFactory: DefineInstanceNodeChildHierarchyLevelProps["nodeSelectClauseFactory"];
    instanceLabelSelectClauseFactory: DefineInstanceNodeChildHierarchyLevelProps["instanceLabelSelectClauseFactory"];
    allSubModels: Id64String[];
  }): Promise<{ selectClause: string; bindings: ECSqlBinding[] }> {
    const selectClause = await nodeSelectClauseFactory.createSelectClause({
      ecClassId: { selector: "this.ECClassId" },
      ecInstanceId: { selector: "this.ECInstanceId" },
      nodeLabel: {
        selector: await instanceLabelSelectClauseFactory.createSelectClause({
          classAlias: "this",
          className: this.#hierarchyConfig.elementClassSpecification,
        }),
      },
      grouping: {
        byClass: this.#hierarchyConfig.elementClassGrouping !== "disable",
      },
      hasChildren: {
        selector: `
          IFNULL(
            (
              SELECT 1
              FROM ${this.#hierarchyConfig.elementClassSpecification} ce
              WHERE ce.Parent.Id = this.ECInstanceId
              LIMIT 1
            ),
            ${
              allSubModels.length
                ? `IFNULL(
                    (
                      SELECT 1
                      FROM IdSet(?) subModelIdSet
                      WHERE this.ECInstanceId = subModelIdSet.id
                      LIMIT 1
                      ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
                    ),
                    0
                  )`
                : "0"
            }
          )
        `,
      },
      extendedData: {
        isElement: true,
        modelId: { selector: "IdToHex(this.Model.Id)" },
        categoryId: { selector: "IdToHex(this.Category.Id)" },
        imageId: "icon-item",
      },
      supportsFiltering: this.supportsFiltering(),
    });
    return {
      selectClause,
      bindings: allSubModels.length > 0 ? [{ type: "idset", value: allSubModels }] : [],
    };
  }

  private async createCategoryNodeSelectClause({
    nodeSelectClauseFactory,
    instanceLabelSelectClauseFactory,
    extendedData,
  }: {
    nodeSelectClauseFactory: DefineInstanceNodeChildHierarchyLevelProps["nodeSelectClauseFactory"];
    instanceLabelSelectClauseFactory: DefineInstanceNodeChildHierarchyLevelProps["instanceLabelSelectClauseFactory"];
    extendedData: Props<DefineInstanceNodeChildHierarchyLevelProps["nodeSelectClauseFactory"]["createSelectClause"]>["extendedData"];
  }): Promise<string> {
    return nodeSelectClauseFactory.createSelectClause({
      ecClassId: { selector: "this.ECClassId" },
      ecInstanceId: { selector: "this.ECInstanceId" },
      nodeLabel: {
        selector: await instanceLabelSelectClauseFactory.createSelectClause({
          classAlias: "this",
          className: CLASS_NAME_SpatialCategory,
        }),
      },
      grouping: { byLabel: { action: "merge", groupId: "category" } },
      hasChildren: true,
      extendedData: {
        imageId: "icon-layers",
        isCategory: true,
        ...extendedData,
      },
      supportsFiltering: this.supportsFiltering(),
    });
  }

  private async createSpatialCategoryChildrenQuery({
    parentNodeInstanceIds: categoryIds,
    parentNode,
    instanceFilter,
    nodeSelectClauseFactory,
    instanceLabelSelectClauseFactory,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    assert(ModelsTreeNodeInternal.isCategoryNode(parentNode), "Expected category node as parent");
    const modelIds = parseIdsSelectorResult(parentNode.extendedData.modelIds);
    const [instanceFilterClauses, allSubModels] = await Promise.all([
      nodeSelectClauseFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: this.#hierarchyConfig.elementClassSpecification, alias: "this" },
      }),
      firstValueFrom(this.#idsCache.getAllSubModels()),
    ]);
    const parentIds = ParentElementsPath.getLastParentIds(parentNode.extendedData.parentElementsPath);
    const { selectClause, bindings } = await this.createElementNodeSelectClause({
      nodeSelectClauseFactory,
      instanceLabelSelectClauseFactory,
      allSubModels: [...allSubModels],
    });
    return [
      {
        fullClassName: this.#hierarchyConfig.elementClassSpecification,
        query: {
          ecsql: `
            SELECT
              ${selectClause}
            FROM ${instanceFilterClauses.from} this
            JOIN IdSet(?) categoryIdSet ON this.Category.Id = categoryIdSet.id
            JOIN IdSet(?) modelIdSet ON this.Model.Id = modelIdSet.id
            ${parentIds ? `JOIN IdSet(?) parentIdSet ON this.Parent.Id = parentIdSet.id` : ""}
            ${instanceFilterClauses.joins}
            ${parentIds ? "" : "WHERE this.Parent.Id IS NULL"}
            ${instanceFilterClauses.where ? `${parentIds ? "WHERE" : "AND"} ${instanceFilterClauses.where}` : ""}
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `,
          bindings: [
            ...bindings,
            { type: "idset", value: categoryIds },
            { type: "idset", value: modelIds },
            ...(parentIds ? [{ type: "idset" as const, value: parentIds }] : []),
          ],
        },
      },
    ];
  }

  private async createGeometricElement3dChildrenQuery({
    parentNodeInstanceIds: elementIds,
    instanceFilter,
    parentNode,
    nodeSelectClauseFactory,
    instanceLabelSelectClauseFactory,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    assert(ModelsTreeNodeInternal.isElementNode(parentNode), "Expected parent node to be element node");
    const parentCategoryId = parentNode.extendedData.categoryId;
    const parentModelId = parentNode.extendedData.modelId;

    const [elementInstanceFilterClauses, categoryInstanceFilterClauses, allSubModels] = await Promise.all([
      nodeSelectClauseFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: this.#hierarchyConfig.elementClassSpecification, alias: "this" },
      }),
      nodeSelectClauseFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: CLASS_NAME_SpatialCategory, alias: "this" },
      }),
      firstValueFrom(this.#idsCache.getAllSubModels()),
    ]);

    const { selectClause, bindings } = await this.createElementNodeSelectClause({
      nodeSelectClauseFactory,
      instanceLabelSelectClauseFactory,
      allSubModels: [...allSubModels],
    });
    return [
      {
        fullClassName: this.#hierarchyConfig.elementClassSpecification,
        query: {
          ecsql: `
          SELECT
            ${selectClause}
          FROM ${elementInstanceFilterClauses.from} this
          JOIN IdSet(?) elementIdSet ON this.Parent.Id = elementIdSet.id
          ${elementInstanceFilterClauses.joins}
          WHERE
            this.Category.Id = ${parentCategoryId}
            ${elementInstanceFilterClauses.where ? `AND ${elementInstanceFilterClauses.where}` : ""}
          ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
        `,
          bindings: [...bindings, { type: "idset", value: elementIds }],
        },
      },
      {
        fullClassName: CLASS_NAME_SpatialCategory,
        query: {
          ecsql: `
          SELECT
            ${await this.createCategoryNodeSelectClause({
              nodeSelectClauseFactory,
              instanceLabelSelectClauseFactory,
              extendedData: { modelIds: { selector: createIdsSelector([parentModelId]) } },
            })}
          FROM ${categoryInstanceFilterClauses.from} this
          ${categoryInstanceFilterClauses.joins ? `${categoryInstanceFilterClauses.joins}` : ""}
          WHERE
            this.ECInstanceId <> ${parentCategoryId}
            AND this.ECInstanceId IN (
              SELECT DISTINCT ce.Category.Id
              FROM ${this.#hierarchyConfig.elementClassSpecification} ce
              JOIN IdSet(?) parentIdSet ON ce.Parent.Id = parentIdSet.id
              ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
            )
            ${categoryInstanceFilterClauses.where ? `AND ${categoryInstanceFilterClauses.where}` : ""}
        `,
          bindings: [{ type: "idset", value: elementIds }],
        },
      },
    ];
  }

  public static createInstanceKeyPaths(props: ModelsTreeInstanceKeyPathsProps) {
    return eachValueFrom<{ path: HierarchyNodeIdentifiersPath; target: Id64String | ElementsGroupInfo }>(
      defer(() => {
        const componentInfo = { componentId: props.componentId ?? Guid.createValue(), componentName: this.#componentName };
        if (ModelsTreeInstanceKeyPathsProps.isLabelProps(props)) {
          const labelsFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
          return createInstanceKeyPathsFromInstanceLabelObs({ ...props, ...componentInfo, labelsFactory });
        }
        return createInstanceKeyPathsFromTargetItemsObs({ ...props, ...componentInfo });
      }).pipe(props.abortSignal ? takeUntil(fromEvent(props.abortSignal, "abort")) : identity),
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
        WHERE s.Name = ? AND c.Name = ? AND c.ECInstanceId IS (${CLASS_NAME_GeometricElement3d})
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

const SUBJECT_TYPE_AS_NUMBER = 1;
const SUBJECT_CLASS_NAME_QUERY_ALIAS = "s";
const MODEL_TYPE_AS_NUMBER = 2;
const MODEL_CLASS_NAME_QUERY_ALIAS = "m";
const CATEGORY_TYPE_AS_NUMBER = 3;
const CATEGORY_CLASS_NAME_QUERY_ALIAS = "c";
const ELEMENT_TYPE_AS_NUMBER = 0;
const ELEMENT_CLASS_NAME_QUERY_ALIAS = "e";

/** @internal */
export function createGeometricElementInstanceKeyPaths(props: {
  queryExecutor: LimitingECSqlQueryExecutor;
  idsCache: ModelsTreeIdsCache;
  elementClassName: EC.FullClassName;
  targetItems: Array<Id64String | ElementsGroupInfo>;
  componentId: GuidString;
  componentName: string;
  chunkIndex: number;
}): Observable<{ path: HierarchyNodeIdentifiersPath; target: Id64String | ElementsGroupInfo }> {
  const { targetItems, chunkIndex, componentId, componentName, elementClassName, idsCache, queryExecutor } = props;
  const elementIds = targetItems.filter((info): info is Id64String => typeof info === "string");
  const groupInfos = targetItems.filter((info): info is ElementsGroupInfo => typeof info !== "string");
  const separator = ";";
  const bindings = new Array<ECSqlBinding>();
  if (elementIds.length > 0) {
    bindings.push({ type: "idset", value: elementIds });
  }
  groupInfos.forEach(({ parent }) => {
    bindings.push({ type: "idset", value: parent.ids });
    if (parent.type !== "element") {
      bindings.push({ type: "idset", value: parent.modelIds });
    }
  });
  return props.idsCache.getAllSubModels().pipe(
    mergeMap(() => {
      const targetElementsInfoQuery =
        elementIds.length > 0
          ? `
            SELECT e.ECInstanceId, e.ECClassId, e.Parent.Id, e.Model.Id, e.Category.Id, -1
            FROM ${elementClassName} e
            JOIN IdSet(?) elementIdSet ON e.ECInstanceId = elementIdSet.id
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `
          : undefined;

      const targetGroupingNodesElementInfoQueries = groupInfos.map(
        ({ parent, groupingNode }, index) => `
          SELECT e.ECInstanceId, e.ECClassId, e.Parent.Id, e.Model.Id, e.Category.Id, ${index}
          FROM ${elementClassName} e
          JOIN IdSet(?) parentIdSet${index} ON ${parent.type === "element" ? `e.Parent.Id = parentIdSet${index}.id` : `e.Category.Id = parentIdSet${index}.id`}
          ${parent.type !== "element" ? `JOIN IdSet(?) modelIdSet${index} ON e.Model.Id = modelIdSet${index}.id` : ""}
          WHERE
            e.ECClassId IS (${groupingNode.key.className})
            ${parent.type === "element" ? "" : `AND e.Parent.Id IS NULL`}
          ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
        `,
      );

      const ctes = [
        `InstanceElementsWithClassGroupingNodes(ECInstanceId, ECClassId, ParentId, ModelId, CategoryId, GroupingNodeIndex) AS (
          ${[...(targetElementsInfoQuery ? [targetElementsInfoQuery] : []), ...targetGroupingNodesElementInfoQueries].join(" UNION ALL ")}
        )`,
        `ModelsCategoriesElementsHierarchy(ECInstanceId, ParentId, ModelId, CategoryId, GroupingNodeIndex, Path) AS (
          SELECT
            e.ECInstanceId,
            e.ParentId,
            e.ModelId,
            e.CategoryId,
            e.GroupingNodeIndex,
            '${ELEMENT_CLASS_NAME_QUERY_ALIAS}${separator}' || CAST(IdToHex([e].[ECInstanceId]) AS TEXT)

          FROM InstanceElementsWithClassGroupingNodes e

          UNION ALL

          SELECT
            pe.ECInstanceId,
            pe.Parent.Id,
            pe.Model.Id,
            pe.Category.Id,
            ce.GroupingNodeIndex,
            (
              '${ELEMENT_CLASS_NAME_QUERY_ALIAS}${separator}'
              || CAST(IdToHex([pe].[ECInstanceId]) AS TEXT)
              || IIF(ce.ParentId IS NULL,
                  '${separator}${MODEL_CLASS_NAME_QUERY_ALIAS}${separator}' || CAST(IdToHex([ce].[ModelId]) AS TEXT),
                  ''
                  )
              || IIF(ce.CategoryId <> pe.Category.Id,
                  '${separator}${CATEGORY_CLASS_NAME_QUERY_ALIAS}${separator}' || CAST(IdToHex(ce.CategoryId) AS TEXT),
                  ''
                  )
              || '${separator}'
              || ce.Path
            )
          FROM ModelsCategoriesElementsHierarchy ce
          JOIN ${elementClassName} pe ON (pe.ECInstanceId = ce.ParentId OR (pe.ECInstanceId = ce.ModelId AND ce.ParentId IS NULL))
        )`,
      ];
      const ecsql = `
        SELECT
          (
            '${MODEL_CLASS_NAME_QUERY_ALIAS}${separator}'
            || CAST(IdToHex([mce].[ModelId]) AS TEXT)
            || '${separator}${CATEGORY_CLASS_NAME_QUERY_ALIAS}${separator}'
            || CAST(IdToHex([mce].[CategoryId]) AS TEXT)
            || '${separator}'
            || mce.Path
        ),
          mce.GroupingNodeIndex
        FROM ModelsCategoriesElementsHierarchy mce
        WHERE mce.ParentId IS NULL
      `;

      return queryExecutor.createQueryReader(
        { ctes, ecsql, bindings },
        { rowFormat: "Indexes", limit: "unbounded", restartToken: `${componentName}/${componentId}/geometric-element-paths/${chunkIndex}` },
      );
    }),
    catchBeSQLiteInterrupts,
    releaseMainThreadOnItemsCount(300),
    map((row) => parseElementsQueryRow(row, groupInfos, separator, elementClassName)),
    mergeMap(({ elementHierarchyPath, groupingInfo }) =>
      idsCache.createUpToModelInstanceKeyPaths(elementHierarchyPath[0].id).pipe(
        map((modelPath) => {
          const path = [...modelPath, ...elementHierarchyPath];
          return {
            path,
            target: groupingInfo ?? elementHierarchyPath[elementHierarchyPath.length - 1].id,
          };
        }),
      ),
    ),
  );
}

function parseElementsQueryRow(row: ECSqlQueryRow, groupInfos: ElementsGroupInfo[], separator: string, elementClassName: EC.FullClassName) {
  const path = parseQueriedPath({ queriedPathRaw: row[0], elementClassName, separator });
  return {
    elementHierarchyPath: path,
    groupingInfo: row[1] === -1 ? undefined : groupInfos[row[1]],
  };
}

/** @internal */
export function createCategoriesSearchPaths(props: {
  queryExecutor: LimitingECSqlQueryExecutor;
  idsCache: ModelsTreeIdsCache;
  targetCategoryIds: Id64Array;
  componentId: GuidString;
  componentName: string;
  elementClassName: EC.FullClassName;
}): Observable<{ path: HierarchyNodeIdentifiersPath; target: Id64String }> {
  const separator = ";";
  const { targetCategoryIds, componentId, componentName, idsCache, queryExecutor, elementClassName } = props;
  if (targetCategoryIds.length === 0) {
    return EMPTY;
  }

  return merge(
    fromWithRelease({ source: targetCategoryIds, releaseOnCount: 300 }).pipe(
      mergeMap((categoryId) =>
        idsCache
          .getSearchPathsUpToRootCategory({ categoryId })
          .pipe(map((path) => ({ path: [...path, { id: categoryId, className: CLASS_NAME_SpatialCategory }], target: categoryId }))),
      ),
    ),
    props.idsCache.getAllSubModels().pipe(
      mergeMap((subModelIds) => {
        const ctes = [
          `CategoriesParentsHierarchy(ECInstanceId, ParentId, ModelId, CategoryId, Path) AS (
            SELECT
              pe.ECInstanceId,
              pe.Parent.Id,
              pe.Model.Id,
              pe.Category.Id,
              (
                '${ELEMENT_CLASS_NAME_QUERY_ALIAS}${separator}'
                || CAST(IdToHex([pe].[ECInstanceId]) AS TEXT)
                || IIF(e.Parent.Id IS NULL,
                    '${separator}${MODEL_CLASS_NAME_QUERY_ALIAS}${separator}' || CAST(IdToHex([e].[Model].[Id]) AS TEXT),
                    ''
                    )
                || '${separator}${CATEGORY_CLASS_NAME_QUERY_ALIAS}${separator}'
                || CAST(IdToHex([e].[Category].[Id]) AS TEXT)
              )
            FROM ${elementClassName} e
            JOIN IdSet(?) categoryIdSet ON e.Category.Id = categoryIdSet.id
            JOIN ${elementClassName} pe ON (pe.ECInstanceId = e.Parent.Id OR (pe.ECInstanceId = e.Model.Id AND e.Parent.Id IS NULL))
            WHERE pe.Category.Id <> e.Category.Id
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES

            UNION ALL

            SELECT
              pe.ECInstanceId,
              pe.Parent.Id,
              pe.Model.Id,
              pe.Category.Id,
              (
                '${ELEMENT_CLASS_NAME_QUERY_ALIAS}${separator}'
                || CAST(IdToHex([pe].[ECInstanceId]) AS TEXT)
                || IIF(ce.ParentId IS NULL,
                    '${separator}${MODEL_CLASS_NAME_QUERY_ALIAS}${separator}' || CAST(IdToHex([ce].[ModelId]) AS TEXT),
                    ''
                    )
                || IIF(ce.CategoryId <> pe.Category.Id,
                    '${separator}${CATEGORY_CLASS_NAME_QUERY_ALIAS}${separator}' || CAST(IdToHex(ce.CategoryId) AS TEXT),
                    ''
                    )
                || '${separator}'
                || ce.Path
              )
            FROM CategoriesParentsHierarchy ce
            JOIN ${elementClassName} pe ON (pe.ECInstanceId = ce.ParentId OR (pe.ECInstanceId = ce.ModelId AND ce.ParentId IS NULL))
          )`,
        ];
        const ecsql = `
          SELECT
            (
              '${MODEL_CLASS_NAME_QUERY_ALIAS}${separator}'
              || CAST(IdToHex([mce].[ModelId]) AS TEXT)
              || '${separator}${CATEGORY_CLASS_NAME_QUERY_ALIAS}${separator}'
              || CAST(IdToHex([mce].[CategoryId]) AS TEXT)
              || '${separator}'
              || mce.Path
            )
          FROM CategoriesParentsHierarchy mce
          WHERE mce.ParentId IS NULL
           ${
             subModelIds.size > 0
               ? `AND NOT IFNULL(
                  (
                    SELECT 1
                    FROM IdSet(?) subModelIdSet
                    WHERE mce.ModelId = subModelIdSet.id
                    LIMIT 1
                  ),
                  0
                )`
               : ""
           }
        `;

        return queryExecutor.createQueryReader(
          {
            ctes,
            ecsql,
            bindings: [{ type: "idset", value: targetCategoryIds }, ...(subModelIds.size > 0 ? [{ type: "idset" as const, value: [...subModelIds] }] : [])],
          },
          { rowFormat: "Indexes", limit: "unbounded", restartToken: `${componentName}/${componentId}/categories-paths` },
        );
      }),
      catchBeSQLiteInterrupts,
      targetCategoryIds.length > 300 ? releaseMainThreadOnItemsCount(300) : identity,
      map((row) => {
        return parseQueriedPath({ queriedPathRaw: row[0], elementClassName, separator });
      }),
      mergeMap((categoryHierarchyPath) =>
        idsCache.createUpToModelInstanceKeyPaths(categoryHierarchyPath[0].id).pipe(
          map((pathUpToCategory) => {
            const path = [...pathUpToCategory, ...categoryHierarchyPath];
            return { path, target: categoryHierarchyPath[categoryHierarchyPath.length - 1].id };
          }),
        ),
      ),
    ),
  );
}

function parseQueriedPath({
  queriedPathRaw,
  elementClassName,
  separator,
}: {
  queriedPathRaw: string;
  elementClassName: EC.FullClassName;
  separator: string;
}): HierarchyNodeIdentifiersPath {
  const path = new Array<InstanceKey>();
  const queriedPath: string[] = queriedPathRaw.split(separator);
  for (let i = 0; i < queriedPath.length; i += 2) {
    switch (queriedPath[i]) {
      case ELEMENT_CLASS_NAME_QUERY_ALIAS:
        path.push({ className: elementClassName, id: queriedPath[i + 1] });
        break;
      case CATEGORY_CLASS_NAME_QUERY_ALIAS:
        path.push({ className: CLASS_NAME_SpatialCategory, id: queriedPath[i + 1] });
        break;
      case MODEL_CLASS_NAME_QUERY_ALIAS:
        path.push({ className: CLASS_NAME_GeometricModel3d, id: queriedPath[i + 1] });
        break;
    }
  }
  return path;
}

function createInstanceKeyPathsFromTargetItemsObs(
  props: Omit<ModelsTreeInstanceKeyPathsFromTargetItemsProps, "abortSignal" | "componentId"> & { componentId: GuidString; componentName: string },
) {
  const { targetItems, imodelAccess, limit } = props;
  if (limit !== "unbounded" && targetItems.length > (limit ?? MAX_SEARCH_INSTANCE_KEY_COUNT)) {
    throw new SearchLimitExceededError(limit ?? MAX_SEARCH_INSTANCE_KEY_COUNT);
  }
  return fromWithRelease({ source: targetItems, releaseOnCount: 2000 }).pipe(
    mergeMap(async (key): Promise<{ key: Id64String; type: number } | { key: ElementsGroupInfo; type: 0 }> => {
      if ("parent" in key) {
        return { key, type: ELEMENT_TYPE_AS_NUMBER };
      }

      if (await imodelAccess.classDerivesFrom(key.className, CLASS_NAME_Subject)) {
        return { key: key.id, type: SUBJECT_TYPE_AS_NUMBER };
      }

      if (await imodelAccess.classDerivesFrom(key.className, CLASS_NAME_Model)) {
        return { key: key.id, type: MODEL_TYPE_AS_NUMBER };
      }

      if (await imodelAccess.classDerivesFrom(key.className, CLASS_NAME_SpatialCategory)) {
        return { key: key.id, type: CATEGORY_TYPE_AS_NUMBER };
      }

      return { key: key.id, type: ELEMENT_TYPE_AS_NUMBER };
    }, 2),
    createSearchPathsForDifferentTypes(props),
  );
}

function createSearchPathsForDifferentTypes(
  props: Omit<ModelsTreeInstanceKeyPathsBaseProps, "componentId"> & { componentId: GuidString; componentName: string },
): OperatorFunction<
  | {
      key: Id64String;
      type: number;
    }
  | {
      key: ElementsGroupInfo;
      type: typeof ELEMENT_TYPE_AS_NUMBER;
    },
  ObservedValueOf<ReturnType<typeof createGeometricElementInstanceKeyPaths>>
> {
  return (obs) =>
    obs.pipe(
      reduce(
        (acc, value) => {
          if (value.type === SUBJECT_TYPE_AS_NUMBER) {
            acc.subjectIds.push(value.key);
            return acc;
          }
          if (value.type === MODEL_TYPE_AS_NUMBER) {
            acc.modelIds.push(value.key);
            return acc;
          }
          if (value.type === CATEGORY_TYPE_AS_NUMBER) {
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
      switchMap((ids) => {
        const { idsCache, imodelAccess, hierarchyConfig, componentId, componentName, limit } = props;
        const elementsLength = ids.elementIds.length;
        const totalSize = ids.subjectIds.length + ids.modelIds.length + ids.categoryIds.length + elementsLength;
        if (limit !== "unbounded" && totalSize > (limit ?? MAX_SEARCH_INSTANCE_KEY_COUNT)) {
          throw new SearchLimitExceededError(limit ?? MAX_SEARCH_INSTANCE_KEY_COUNT);
        }

        return merge(
          from(ids.subjectIds).pipe(mergeMap((id) => idsCache.createSubjectInstanceKeysPath(id).pipe(map((path) => ({ path, target: id }))))),
          from(ids.modelIds).pipe(
            mergeMap((id) =>
              idsCache
                .createUpToModelInstanceKeyPaths(id)
                .pipe(map((path) => ({ path: [...path, { className: CLASS_NAME_GeometricModel3d, id }], target: id }))),
            ),
          ),
          createCategoriesSearchPaths({
            targetCategoryIds: ids.categoryIds,
            idsCache,
            queryExecutor: imodelAccess,
            elementClassName: hierarchyConfig.elementClassSpecification,
            componentId,
            componentName,
          }),
          from(ids.elementIds).pipe(
            bufferCount(getOptimalBatchSize({ totalSize: elementsLength, maximumBatchSize: 5000 })),
            releaseMainThreadOnItemsCount(1),
            mergeMap(
              (block, chunkIndex) =>
                createGeometricElementInstanceKeyPaths({
                  queryExecutor: imodelAccess,
                  idsCache,
                  elementClassName: hierarchyConfig.elementClassSpecification,
                  targetItems: block,
                  componentId,
                  componentName,
                  chunkIndex,
                }),
              2,
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
      className: CLASS_NAME_Element,
      selectorsConcatenator: ECSql.createConcatenatedValueStringSelector,
    });
    const ecsql = `
        SELECT *
        FROM (
          SELECT
            IIF(e.ECClassId IS (${CLASS_NAME_Subject}), '${SUBJECT_CLASS_NAME_QUERY_ALIAS}', IIF(e.ECClassId IS (${CLASS_NAME_SpatialCategory}), '${CATEGORY_CLASS_NAME_QUERY_ALIAS}', '${ELEMENT_CLASS_NAME_QUERY_ALIAS}')),
            e.ECInstanceId,
            ${elementLabelSelectClause} Label
          FROM ${CLASS_NAME_Element} e
          WHERE e.ECClassId IS (${CLASS_NAME_Subject}, ${CLASS_NAME_SpatialCategory}, ${hierarchyConfig.elementClassSpecification})

          UNION ALL

          SELECT
           '${MODEL_CLASS_NAME_QUERY_ALIAS}',
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
        LIMIT ${MAX_SEARCH_INSTANCE_KEY_COUNT + 1}
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
    catchBeSQLiteInterrupts,
    map((row) => {
      const key = row[1];
      switch (row[0]) {
        case SUBJECT_CLASS_NAME_QUERY_ALIAS:
          return { key, type: SUBJECT_TYPE_AS_NUMBER };
        case MODEL_CLASS_NAME_QUERY_ALIAS:
          return { key, type: MODEL_TYPE_AS_NUMBER };
        case CATEGORY_CLASS_NAME_QUERY_ALIAS:
          return { key, type: CATEGORY_TYPE_AS_NUMBER };
        default:
          return { key, type: ELEMENT_TYPE_AS_NUMBER };
      }
    }),
    createSearchPathsForDifferentTypes(props),
  );
}
