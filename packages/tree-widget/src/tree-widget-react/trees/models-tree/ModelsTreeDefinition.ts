/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { bufferCount, defer, EMPTY, firstValueFrom, forkJoin, from, fromEvent, identity, map, merge, mergeMap, reduce, switchMap, takeUntil } from "rxjs";
import { assert, Guid } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import { createPredicateBasedHierarchyDefinition, ProcessedHierarchyNode } from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql, parseFullClassName } from "@itwin/presentation-shared";
import {
  CLASS_NAME_Element,
  CLASS_NAME_GeometricElement3d,
  CLASS_NAME_GeometricModel3d,
  CLASS_NAME_InformationPartitionElement,
  CLASS_NAME_ISubModeledElement,
  CLASS_NAME_Model,
  CLASS_NAME_SpatialCategory,
  CLASS_NAME_Subject,
} from "../../shared/internal/ClassNameDefinitions.js";
import { eachValueFrom } from "../../shared/internal/EachValueFrom.js";
import { catchBeSQLiteInterrupts } from "../../shared/internal/hooks/UseErrorState.js";
import { fromWithRelease, releaseMainThreadOnItemsCount } from "../../shared/internal/Rxjs.js";
import {
  createExcludedClassesClause,
  createIdsSelector,
  createWhereClause,
  getOptimalBatchSize,
  groupingNodeDataFromChildren,
  ParentElementsPath,
  parseIdsSelectorResult,
} from "../../shared/internal/Utils.js";
import { SearchLimitExceededError } from "../../shared/TreeErrors.js";
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
import type { CategoryId } from "../../shared/internal/Types.js";
import type { DeepRequired } from "../../shared/internal/Utils.js";
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
  /**
   * Controls whether hierarchy levels are filterable.
   *
   * Defaults to `"enable"`.
   */
  hierarchyLevelFiltering?: "enable" | "disable";
  /**
   * Subject node's configuration options.
   *
   * Defaults to `{ root: "include" }`.
   */
  subjects?: {
    /**
     * Controls whether the root Subject node is included in the hierarchy.
     *
     * Defaults to `"include"`.
     */
    root?: "include" | "exclude";
  };
  /**
   * Element node's configuration options.
   *
   * Defaults to `{ baseClass: "BisCore.GeometricElement3d", classGrouping: "enable", excludedClasses: [] }`.
   */
  elements?: {
    /**
     * Full class name of a `GeometricElement3d` sub-class that should be used to load element nodes.
     *
     * Defaults to `BisCore.GeometricElement3d`.
     */
    baseClass?: EC.FullClassNameDotNotation;
    /**
     * Element classes to exclude from the hierarchy.
     *
     * Elements, whose class is or derives from one of the classes in this list, are not loaded into the hierarchy.
     * Children of such nodes are also not shown.
     *
     * Defaults to `[]`.
     */
    excludedClasses?: EC.FullClassNameDotNotation[];
    /**
     * Controls how element nodes are grouped.
     *
     * Defaults to `"enable"`.
     */
    classGrouping?: "enable" | "enable-with-counts" | "disable";
  };
  /**
   * Model node's configuration options.
   *
   * Defaults to `{ withoutElements: "exclude" }`.
   */
  models?: {
    /**
     * Controls whether models that have no elements in the iModel are included in the hierarchy.
     *
     * Defaults to `"exclude"`.
     */
    withoutElements?: "include" | "exclude";
  };
}

/** @internal */
export type RequiredModelsTreeHierarchyConfiguration = DeepRequired<ModelsTreeHierarchyConfiguration>;

/** @internal */
export const defaultHierarchyConfiguration: RequiredModelsTreeHierarchyConfiguration = {
  subjects: {
    root: "include",
  },
  elements: {
    baseClass: CLASS_NAME_GeometricElement3d,
    excludedClasses: [],
    classGrouping: "enable",
  },
  models: {
    withoutElements: "exclude",
  },
  hierarchyLevelFiltering: "enable",
};

interface ModelsTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  idsCache: ModelsTreeIdsCache;
  hierarchyConfig: RequiredModelsTreeHierarchyConfiguration;
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
  hierarchyConfig: RequiredModelsTreeHierarchyConfiguration;
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
  #hierarchyConfig: RequiredModelsTreeHierarchyConfiguration;
  #queryExecutor: LimitingECSqlQueryExecutor;
  #isSupported?: Promise<boolean>;
  static #componentName = "ModelsTreeDefinition";
  #componentId: GuidString;

  public constructor(props: ModelsTreeDefinitionProps) {
    this.#hierarchyConfig = props.hierarchyConfig;
    this.#impl = createPredicateBasedHierarchyDefinition({
      classHierarchyInspector: props.imodelAccess,
      hierarchy: {
        rootNodes: async (requestProps) =>
          this.createSubjectChildrenQuery({
            ...requestProps,
            parentNodeInstanceIds: this.#hierarchyConfig.subjects.root === "exclude" ? [IModel.rootSubjectId] : [],
          }),
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
      label: this.#hierarchyConfig.elements.classGrouping === "enable-with-counts" ? `${node.label} (${node.children.length})` : node.label,
      extendedData: {
        ...node.extendedData,
        // `modelId`, `categoryId` are shared by all grouped elements.
        categoryId: firstChild.extendedData.categoryId,
        modelId: firstChild.extendedData.modelId,
        childrenWhichAreParents,
        ...(hasDirectNonSearchTargets ? { hasDirectNonSearchTargets } : {}),
        ...(hasSearchTargetAncestor ? { hasSearchTargetAncestor } : {}),
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
    createSelectClause,
    createFilterClauses,
  }: Pick<
    DefineInstanceNodeChildHierarchyLevelProps,
    "parentNodeInstanceIds" | "instanceFilter" | "createSelectClause" | "createFilterClauses"
  >): Promise<HierarchyLevelDefinition> {
    const [subjectFilterClauses, modelFilterClauses] = await Promise.all([
      createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: CLASS_NAME_Subject, alias: "this" },
      }),
      createFilterClauses({
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
              ${await createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  of: {
                    classAlias: "this",
                    className: CLASS_NAME_Subject,
                  },
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
                  isRootSubject: { selector: `IIF(this.ECInstanceId = ${IModel.rootSubjectId}, true, false)` },
                  type: "subject",
                },
                autoExpand: { selector: `IIF(this.ECInstanceId = ${IModel.rootSubjectId}, true, false)` },
                supportsFiltering: this.supportsFiltering(),
              })}
            FROM ${subjectFilterClauses.from} this
            JOIN IdSet(?) childSubjectIdSet ON this.ECInstanceId = childSubjectIdSet.id
            ${subjectFilterClauses.joins}
            ${createWhereClause({ conditions: [subjectFilterClauses.where] })}
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `,
          bindings: [
            {
              type: "idset",
              value: await firstValueFrom(this.#idsCache.getParentSubjectIds()),
            },
            { type: "idset", value: childSubjectIds },
          ],
        },
      });
    childModelIds.length &&
      defs.push({
        fullClassName: CLASS_NAME_GeometricModel3d,
        query: {
          ecsql: `
            SELECT
              ${await createSelectClause({
                ecClassId: { selector: "model.ECClassId" },
                ecInstanceId: { selector: "model.ECInstanceId" },
                nodeLabel: {
                  of: {
                    classAlias: "partition",
                    className: CLASS_NAME_InformationPartitionElement,
                  },
                },
                hideNodeInHierarchy: { selector: "model.IsHidden" },
                hasChildren:
                  this.#hierarchyConfig.models.withoutElements === "include" || this.#hierarchyConfig.elements.excludedClasses.length
                    ? { selector: "model.HasChildren" }
                    : true,
                extendedData: {
                  type: "model",
                },
                supportsFiltering: this.supportsFiltering(),
              })}
            FROM (
              SELECT
                CASE
                  WHEN (
                    json_extract(p.JsonProperties, '$.PhysicalPartition.Model.Content') IS NOT NULL
                    OR json_extract(p.JsonProperties, '$.GraphicalPartition3d.Model.Content') IS NOT NULL
                  ) THEN 1
                  ELSE 0
                END IsHidden,
                ${
                  this.#hierarchyConfig.models.withoutElements === "include" || this.#hierarchyConfig.elements.excludedClasses.length
                    ? `IFNULL((
                        SELECT 1
                        FROM ${this.#hierarchyConfig.elements.baseClass} e
                        ${createWhereClause({
                          conditions: [
                            "e.Model.Id = m.ECInstanceId",
                            createExcludedClassesClause({ alias: "e", excludedClassNames: this.#hierarchyConfig.elements.excludedClasses }),
                          ],
                        })}
                        LIMIT 1
                      ), 0)`
                    : "1"
                } HasChildren,
                m.*
              FROM ${CLASS_NAME_GeometricModel3d} m
              JOIN IdSet(?) childModelIdSet ON m.ECInstanceId = childModelIdSet.id
              JOIN ${CLASS_NAME_InformationPartitionElement} p ON p.ECInstanceId = m.ModeledElement.Id
              ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
            ) model
            JOIN ${modelFilterClauses.from} this ON this.ECInstanceId = model.ECInstanceId
            JOIN ${CLASS_NAME_InformationPartitionElement} [partition] ON [partition].ECInstanceId = this.ModeledElement.Id
            ${modelFilterClauses.joins}
            ${createWhereClause({ conditions: [modelFilterClauses.where && `model.IsHidden OR ${modelFilterClauses.where}`] })}
          `,
          bindings: [{ type: "idset", value: childModelIds }],
        },
      });
    return defs;
  }

  private async createISubModeledElementChildrenQuery({
    parentNodeInstanceIds: elementIds,
    parentNode,
    createSelectClause,
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
              ${await createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: "", // doesn't matter - the node is always hidden
                hideNodeInHierarchy: true,
                hasChildren: true,
                extendedData: {
                  type: "model",
                  modeledElementCategory: { selector: `IdToHex(${parentNode.extendedData.categoryId})` },
                },
              })}
            FROM ${CLASS_NAME_GeometricModel3d} this
            JOIN IdSet(?) elementIdSet ON this.ModeledElement.Id = elementIdSet.id
            ${createWhereClause({
              conditions: [
                "NOT this.IsPrivate",
                `this.ECInstanceId IN (
                  SELECT c.Model.Id
                  FROM ${this.#hierarchyConfig.elements.baseClass} c
                  ${createWhereClause({
                    conditions: [createExcludedClassesClause({ alias: "c", excludedClassNames: this.#hierarchyConfig.elements.excludedClasses })],
                  })}
                )`,
              ],
            })}
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
    createSelectClause,
    createFilterClauses,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const modeledElementCategory = parentNode.extendedData?.modeledElementCategory;
    const [categoryInstanceFilterClauses, elementInstanceFilterClauses, allSubModels, categoryIds] = await Promise.all([
      createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: CLASS_NAME_SpatialCategory, alias: "this" },
      }),
      createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: this.#hierarchyConfig.elements.baseClass, alias: "this" },
      }),
      this.#idsCache.modeledElementsLoaded() ? firstValueFrom(this.#idsCache.getAllSubModels({ excludeIfOnlyExcludedClasses: true })) : undefined,
      this.#idsCache.elementModelCategoriesLoaded()
        ? firstValueFrom(
            from(modelIds).pipe(
              mergeMap((modelId) => this.#idsCache.getCategories({ modelId, includeOnlyIfCategoryOfTopMostElement: true, excludeIfOnlyExcludedClasses: true })),
              reduce((acc, modelCategories) => {
                for (const categoryId of modelCategories) {
                  acc.add(categoryId);
                }
                return acc;
              }, new Set<CategoryId>()),
              map((categoryIdsSet) => [...categoryIdsSet]),
            ),
          )
        : undefined,
    ]);
    const cachedDataExists = !!categoryIds;
    if (cachedDataExists && categoryIds.length === 0) {
      return [];
    }
    // For top-level models show all categories of the top-most elements. For sub-models show only the categories
    // that don't match the sub-model element's category as intermediate category nodes - the elements matching
    // that category are shown directly (see below).
    const categoriesToShow = modeledElementCategory === undefined ? categoryIds : categoryIds?.filter((categoryId) => categoryId !== modeledElementCategory);
    const hasElementsWithTheSameCategory = categoriesToShow?.length !== categoryIds?.length;
    const definitions: HierarchyLevelDefinition = [];
    if (!categoriesToShow || categoriesToShow.length > 0) {
      definitions.push({
        fullClassName: CLASS_NAME_SpatialCategory,
        query: {
          ecsql: `
            SELECT ${!categoriesToShow ? "DISTINCT" : ""}
              ${await this.createCategoryNodeSelectClause({
                createSelectClause,
                extendedData: { modelIds: { selector: createIdsSelector(modelIds) } },
              })}
            FROM ${categoryInstanceFilterClauses.from} this
            ${
              categoriesToShow
                ? "JOIN IdSet(?) categoryIdSet ON categoryIdSet.id = this.ECInstanceId"
                : `
                  JOIN ${CLASS_NAME_GeometricElement3d} ce ON ce.Category.Id = this.ECInstanceId
                  JOIN IdSet(?) modelIdSet ON ce.Model.Id = modelIdSet.id
                `
            }
            ${categoryInstanceFilterClauses.joins}
            ${createWhereClause({
              conditions: [
                categoryInstanceFilterClauses.where,
                !categoriesToShow && "ce.Parent.Id IS NULL",
                !categoriesToShow && createExcludedClassesClause({ alias: "ce", excludedClassNames: this.#hierarchyConfig.elements.excludedClasses }),
                !categoriesToShow && modeledElementCategory !== undefined && `this.ECInstanceId <> ${modeledElementCategory}`,
              ],
            })}
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `,
          bindings: [{ type: "idset", value: categoriesToShow ? categoriesToShow : modelIds }],
        },
      });
    }
    // Show elements which match the sub-model element's category directly under the (hidden) sub-model node.
    if (modeledElementCategory !== undefined && (!cachedDataExists || hasElementsWithTheSameCategory)) {
      const { selectClause, bindings } = await this.createElementNodeSelectClause({
        createSelectClause,
        // allSubModels are defined when modeledElementCategory is defined
        allSubModels: allSubModels ? [...allSubModels] : undefined,
      });
      definitions.push({
        fullClassName: this.#hierarchyConfig.elements.baseClass,
        query: {
          ecsql: `
            SELECT
              ${selectClause}
            FROM ${elementInstanceFilterClauses.from} this
            JOIN IdSet(?) modelIdSet ON this.Model.Id = modelIdSet.id
            ${elementInstanceFilterClauses.joins}
            ${createWhereClause({ conditions: ["this.Parent.Id IS NULL", `this.Category.Id = ${modeledElementCategory}`, createExcludedClassesClause({ alias: "this", excludedClassNames: this.#hierarchyConfig.elements.excludedClasses }), elementInstanceFilterClauses.where] })}
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `,
          bindings: [...bindings, { type: "idset", value: modelIds }],
        },
      });
    }
    return definitions;
  }

  private async createElementNodeSelectClause({
    createSelectClause,
    allSubModels,
  }: {
    createSelectClause: DefineHierarchyLevelProps["createSelectClause"];
    allSubModels?: Id64String[];
  }): Promise<{ selectClause: string; bindings: ECSqlBinding[] }> {
    const selectClause = await createSelectClause({
      ecClassId: { selector: "this.ECClassId" },
      ecInstanceId: { selector: "this.ECInstanceId" },
      nodeLabel: {
        of: {
          classAlias: "this",
          className: this.#hierarchyConfig.elements.baseClass,
        },
      },
      grouping: {
        byClass: this.#hierarchyConfig.elements.classGrouping !== "disable",
      },
      hasChildren: {
        selector: `
          IFNULL(
            (
              SELECT 1
              FROM ${this.#hierarchyConfig.elements.baseClass} ce
              ${createWhereClause({
                conditions: [
                  "ce.Parent.Id = this.ECInstanceId",
                  createExcludedClassesClause({ alias: "ce", excludedClassNames: this.#hierarchyConfig.elements.excludedClasses }),
                ],
              })}
              LIMIT 1
            ),
            ${
              allSubModels !== undefined
                ? allSubModels.length
                  ? `IFNULL(
                      (
                        SELECT 1
                        FROM IdSet(?) subModelIdSet
                        WHERE this.ECInstanceId = subModelIdSet.id
                        LIMIT 1
                      ),
                      0
                    )`
                  : "0"
                : `IFNULL(
                      (
                        SELECT 1
                        FROM ${CLASS_NAME_GeometricModel3d} m
                        JOIN ${this.#hierarchyConfig.elements.baseClass} ce ON ce.Model.Id = m.ECInstanceId
                        ${createWhereClause({
                          conditions: [
                            "m.ECInstanceId = this.ECInstanceId",
                            "NOT m.IsPrivate",
                            createExcludedClassesClause({ alias: "ce", excludedClassNames: this.#hierarchyConfig.elements.excludedClasses }),
                          ],
                        })}
                        LIMIT 1
                      ),
                      0
                    )`
            }
          )
        `,
      },
      extendedData: {
        type: "element",
        modelId: { selector: "IdToHex(this.Model.Id)" },
        categoryId: { selector: "IdToHex(this.Category.Id)" },
      },
      supportsFiltering: this.supportsFiltering(),
    });
    return {
      selectClause,
      bindings: allSubModels && allSubModels.length > 0 ? [{ type: "idset", value: allSubModels }] : [],
    };
  }

  private async createCategoryNodeSelectClause({
    createSelectClause,
    extendedData,
  }: {
    createSelectClause: DefineHierarchyLevelProps["createSelectClause"];
    extendedData: Parameters<DefineHierarchyLevelProps["createSelectClause"]>[0]["extendedData"];
  }): Promise<string> {
    return createSelectClause({
      ecClassId: { selector: "this.ECClassId" },
      ecInstanceId: { selector: "this.ECInstanceId" },
      nodeLabel: {
        of: {
          classAlias: "this",
          className: CLASS_NAME_SpatialCategory,
        },
      },
      grouping: { byLabel: { action: "merge", groupId: "category" } },
      hasChildren: true,
      extendedData: {
        type: "category",
        ...extendedData,
      },
      supportsFiltering: this.supportsFiltering(),
    });
  }

  private async createSpatialCategoryChildrenQuery({
    parentNodeInstanceIds: categoryIds,
    parentNode,
    instanceFilter,
    createSelectClause,
    createFilterClauses,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    assert(ModelsTreeNodeInternal.isCategoryNode(parentNode), "Expected category node as parent");
    const modelIds = parseIdsSelectorResult(parentNode.extendedData.modelIds);
    const [instanceFilterClauses, allSubModels] = await Promise.all([
      createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: this.#hierarchyConfig.elements.baseClass, alias: "this" },
      }),
      this.#idsCache.modeledElementsLoaded() ? firstValueFrom(this.#idsCache.getAllSubModels({ excludeIfOnlyExcludedClasses: true })) : undefined,
    ]);
    const parentIds = ParentElementsPath.getLastParentIds(parentNode.extendedData.parentElementsPath);
    const { selectClause, bindings } = await this.createElementNodeSelectClause({
      createSelectClause,
      allSubModels: allSubModels ? [...allSubModels] : undefined,
    });
    return [
      {
        fullClassName: this.#hierarchyConfig.elements.baseClass,
        query: {
          ecsql: `
            SELECT
              ${selectClause}
            FROM ${instanceFilterClauses.from} this
            JOIN IdSet(?) categoryIdSet ON this.Category.Id = categoryIdSet.id
            JOIN IdSet(?) modelIdSet ON this.Model.Id = modelIdSet.id
            ${parentIds ? `JOIN IdSet(?) parentIdSet ON this.Parent.Id = parentIdSet.id` : ""}
            ${instanceFilterClauses.joins}
            ${createWhereClause({ conditions: [!parentIds && "this.Parent.Id IS NULL", createExcludedClassesClause({ alias: "this", excludedClassNames: this.#hierarchyConfig.elements.excludedClasses }), instanceFilterClauses.where] })}
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
    createSelectClause,
    createFilterClauses,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    assert(ModelsTreeNodeInternal.isElementNode(parentNode), "Expected parent node to be element node");
    const parentCategoryId = parentNode.extendedData.categoryId;
    const parentModelId = parentNode.extendedData.modelId;

    const [elementInstanceFilterClauses, categoryInstanceFilterClauses, allSubModels] = await Promise.all([
      createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: this.#hierarchyConfig.elements.baseClass, alias: "this" },
      }),
      createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: CLASS_NAME_SpatialCategory, alias: "this" },
      }),
      this.#idsCache.modeledElementsLoaded() ? firstValueFrom(this.#idsCache.getAllSubModels({ excludeIfOnlyExcludedClasses: true })) : undefined,
    ]);

    const { selectClause, bindings } = await this.createElementNodeSelectClause({
      createSelectClause,
      allSubModels: allSubModels ? [...allSubModels] : undefined,
    });
    return [
      {
        fullClassName: this.#hierarchyConfig.elements.baseClass,
        query: {
          ecsql: `
          SELECT
            ${selectClause}
          FROM ${elementInstanceFilterClauses.from} this
          JOIN IdSet(?) elementIdSet ON this.Parent.Id = elementIdSet.id
          ${elementInstanceFilterClauses.joins}
          ${createWhereClause({ conditions: [`this.Category.Id = ${parentCategoryId}`, createExcludedClassesClause({ alias: "this", excludedClassNames: this.#hierarchyConfig.elements.excludedClasses }), elementInstanceFilterClauses.where] })}
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
              createSelectClause,
              extendedData: { modelIds: { selector: createIdsSelector([parentModelId]) } },
            })}
          FROM ${categoryInstanceFilterClauses.from} this
          ${categoryInstanceFilterClauses.joins ? `${categoryInstanceFilterClauses.joins}` : ""}
          ${createWhereClause({
            conditions: [
              `this.ECInstanceId <> ${parentCategoryId}`,
              `this.ECInstanceId IN (
                SELECT DISTINCT ce.Category.Id
                FROM ${this.#hierarchyConfig.elements.baseClass} ce
                JOIN IdSet(?) parentIdSet ON ce.Parent.Id = parentIdSet.id
                ${createWhereClause({ conditions: [createExcludedClassesClause({ alias: "ce", excludedClassNames: this.#hierarchyConfig.elements.excludedClasses })] })}
                ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
              )`,
              categoryInstanceFilterClauses.where,
            ],
          })}
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
    const { schemaName, className } = parseFullClassName(this.#hierarchyConfig.elements.baseClass);

    const query: ECSqlQueryDef = {
      ecsql: `
        SELECT 1
        FROM ECDbMeta.ECSchemaDef s
        JOIN ECDbMeta.ECClassDef c ON c.Schema.Id = s.ECInstanceId
        ${createWhereClause({ conditions: ["s.Name = ?", "c.Name = ?", `c.ECInstanceId IS (${CLASS_NAME_GeometricElement3d})`] })}
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
  elementClassName: EC.FullClassNameDotNotation;
  targetItems: Array<Id64String | ElementsGroupInfo>;
  componentId: GuidString;
  componentName: string;
  chunkIndex: number;
  excludedElementClassNames?: Array<EC.FullClassNameDotNotation>;
}): Observable<{ path: HierarchyNodeIdentifiersPath; target: Id64String | ElementsGroupInfo }> {
  const { targetItems, chunkIndex, componentId, componentName, elementClassName, idsCache, queryExecutor, excludedElementClassNames } = props;
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
            ${createWhereClause({ conditions: [createExcludedClassesClause({ alias: "e", excludedClassNames: excludedElementClassNames })] })}
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `
          : undefined;

      const targetGroupingNodesElementInfoQueries = groupInfos.map(
        ({ parent, groupingNode }, index) => `
          SELECT e.ECInstanceId, e.ECClassId, e.Parent.Id, e.Model.Id, e.Category.Id, ${index}
          FROM ${elementClassName} e
          JOIN IdSet(?) parentIdSet${index} ON ${parent.type === "element" ? `e.Parent.Id = parentIdSet${index}.id` : `e.Category.Id = parentIdSet${index}.id`}
          ${parent.type !== "element" ? `JOIN IdSet(?) modelIdSet${index} ON e.Model.Id = modelIdSet${index}.id` : ""}
          ${createWhereClause({
            conditions: [
              `e.ECClassId IS (${groupingNode.key.className})`,
              parent.type !== "element" && `e.Parent.Id IS NULL`,
              createExcludedClassesClause({ alias: "e", excludedClassNames: excludedElementClassNames }),
            ],
          })}
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
          ${createWhereClause({ conditions: [createExcludedClassesClause({ alias: "pe", excludedClassNames: props.excludedElementClassNames })] })}
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

function parseElementsQueryRow(row: ECSqlQueryRow, groupInfos: ElementsGroupInfo[], separator: string, elementClassName: EC.FullClassNameDotNotation) {
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
  elementClassName: EC.FullClassNameDotNotation;
  excludedElementClassNames?: Array<EC.FullClassNameDotNotation>;
}): Observable<{ path: HierarchyNodeIdentifiersPath; target: Id64String }> {
  const separator = ";";
  const { targetCategoryIds, componentId, componentName, idsCache, queryExecutor, elementClassName, excludedElementClassNames } = props;
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
            ${createWhereClause({
              conditions: [
                "pe.Category.Id <> e.Category.Id",
                createExcludedClassesClause({ alias: "e", excludedClassNames: excludedElementClassNames }),
                createExcludedClassesClause({ alias: "pe", excludedClassNames: excludedElementClassNames }),
              ],
            })}
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
            ${createWhereClause({ conditions: [createExcludedClassesClause({ alias: "pe", excludedClassNames: excludedElementClassNames })] })}
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
          ${createWhereClause({
            conditions: [
              "mce.ParentId IS NULL",
              subModelIds.size > 0 &&
                `NOT EXISTS (
                  SELECT 1
                  FROM IdSet(?) subModelIdSet
                  WHERE mce.ModelId = subModelIdSet.id
                  LIMIT 1
                )`,
            ],
          })}
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
  elementClassName: EC.FullClassNameDotNotation;
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
        const { idsCache, imodelAccess, componentId, componentName, limit } = props;
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
            elementClassName: props.hierarchyConfig.elements.baseClass,
            componentId,
            componentName,
            excludedElementClassNames: props.hierarchyConfig.elements.excludedClasses,
          }),
          from(ids.elementIds).pipe(
            bufferCount(getOptimalBatchSize({ totalSize: elementsLength, maximumBatchSize: 5000 })),
            releaseMainThreadOnItemsCount(1),
            mergeMap(
              (block, chunkIndex) =>
                createGeometricElementInstanceKeyPaths({
                  queryExecutor: imodelAccess,
                  idsCache,
                  elementClassName: props.hierarchyConfig.elements.baseClass,
                  targetItems: block,
                  componentId,
                  componentName,
                  chunkIndex,
                  excludedElementClassNames: props.hierarchyConfig.elements.excludedClasses,
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
  const { labelsFactory, label, imodelAccess, limit, hierarchyConfig } = props;
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
          ${createWhereClause({
            conditions: [
              `e.ECClassId IS (${CLASS_NAME_Subject}, ${CLASS_NAME_SpatialCategory}, ${hierarchyConfig.elements.baseClass})`,
              createExcludedClassesClause({ alias: "e", excludedClassNames: hierarchyConfig.elements.excludedClasses }),
            ],
          })}

          UNION ALL

          SELECT
           '${MODEL_CLASS_NAME_QUERY_ALIAS}',
            m.ECInstanceId,
            ${elementLabelSelectClause} Label
          FROM ${CLASS_NAME_GeometricModel3d} m
          JOIN ${CLASS_NAME_Element} e ON e.ECInstanceId = m.ModeledElement.Id
          ${createWhereClause({
            conditions: [
              "NOT m.IsPrivate",
              hierarchyConfig.models.withoutElements === "exclude" &&
                `EXISTS (SELECT 1 FROM ${hierarchyConfig.elements.baseClass} WHERE Model.Id = m.ECInstanceId)`,
              "json_extract(e.JsonProperties, '$.PhysicalPartition.Model.Content') IS NULL",
              "json_extract(e.JsonProperties, '$.GraphicalPartition3d.Model.Content') IS NULL",
            ],
          })}
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
