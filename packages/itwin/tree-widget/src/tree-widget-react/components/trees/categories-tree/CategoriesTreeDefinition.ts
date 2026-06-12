/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  bufferCount,
  distinct,
  EMPTY,
  filter,
  firstValueFrom,
  from,
  fromEvent,
  identity,
  map,
  merge,
  mergeMap,
  reduce,
  switchMap,
  takeUntil,
  toArray,
} from "rxjs";
import { assert, Guid } from "@itwin/core-bentley";
import { createPredicateBasedHierarchyDefinition, ProcessedHierarchyNode } from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory, ECSql } from "@itwin/presentation-shared";
import { eachValueFrom } from "../../utils/EachValueFrom.js";
import {
  CLASS_NAME_DefinitionContainer,
  CLASS_NAME_ISubModeledElement,
  CLASS_NAME_Model,
  CLASS_NAME_SubCategory,
} from "../common/internal/ClassNameDefinitions.js";
import { catchBeSQLiteInterrupts } from "../common/internal/UseErrorState.js";
import {
  createIdsSelector,
  fromWithRelease,
  getClassesByView,
  getOptimalBatchSize,
  getOrCreate,
  groupingNodeDataFromChildren,
  ParentElementsPath,
  parseIdsSelectorResult,
  releaseMainThreadOnItemsCount,
} from "../common/internal/Utils.js";
import { SearchLimitExceededError } from "../common/TreeErrors.js";
import { CategoriesTreeNodeInternal } from "./internal/CategoriesTreeNodeInternal.js";

import type { Observable, ObservedValueOf, OperatorFunction } from "rxjs";
import type { GuidString, Id64Array, Id64String, MarkRequired } from "@itwin/core-bentley";
import type {
  DefineHierarchyLevelProps,
  DefineInstanceNodeChildHierarchyLevelProps,
  DefineRootHierarchyLevelProps,
  GenericInstanceFilter,
  HierarchyDefinition,
  HierarchyLevelDefinition,
  HierarchyNodeIdentifiersPath,
  HierarchyNodesDefinition,
  InstancesNodeKey,
  LimitingECSqlQueryExecutor,
  NodePostProcessor,
  NodePreProcessor,
  NodesQueryClauseFactory,
} from "@itwin/presentation-hierarchies";
import type {
  EC,
  ECClassHierarchyInspector,
  ECSchemaProvider,
  ECSqlBinding,
  ECSqlQueryRow,
  IInstanceLabelSelectClauseFactory,
  InstanceKey,
  Props,
} from "@itwin/presentation-shared";
import type { CategoryId, DefinitionContainerId, ElementId, ModelId, SubCategoryId } from "../common/internal/Types.js";
import type { CategoriesTreeIdsCache, CategoryInfo } from "./internal/CategoriesTreeIdsCache.js";
import type { CategoryNodeProps, ElementNodeProps } from "./internal/CategoriesTreeNodeInternal.js";

const MAX_SEARCH_INSTANCE_KEY_COUNT = 100;

interface CategoriesTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  viewType: "2d" | "3d";
  idsCache: CategoriesTreeIdsCache;
  hierarchyConfig: CategoriesTreeHierarchyConfiguration;
}

interface CategoriesTreeInstanceKeyPathsBaseProps {
  imodelAccess: ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  limit?: number | "unbounded";
  viewType: "2d" | "3d";
  idsCache: CategoriesTreeIdsCache;
  hierarchyConfig: CategoriesTreeHierarchyConfiguration;
  componentId?: GuidString;
  abortSignal?: AbortSignal;
}

/** @internal */
export interface CategoriesTreeInstanceKeyPathsFromInstanceLabelProps extends CategoriesTreeInstanceKeyPathsBaseProps {
  label: string;
}

/**
 * Defines hierarchy configuration supported by `CategoriesTree`.
 * @beta
 */
export interface CategoriesTreeHierarchyConfiguration {
  /** Should SubCategories be hidden. Defaults to `false` */
  hideSubCategories: boolean;
  /** Should Elements be shown. Defaults to `false` */
  showElements: boolean;
  /** Should categories without elements be shown. Defaults to `false`. */
  showEmptyCategories: boolean;
}

/** @internal */
export const defaultHierarchyConfiguration: CategoriesTreeHierarchyConfiguration = {
  hideSubCategories: false,
  showElements: false,
  showEmptyCategories: false,
};

/** @internal */
export class CategoriesTreeDefinition implements HierarchyDefinition {
  #impl: Promise<HierarchyDefinition> | undefined;
  #idsCache: CategoriesTreeIdsCache;
  #hierarchyConfig: CategoriesTreeHierarchyConfiguration;
  #iModelAccess: ECSchemaProvider & ECClassHierarchyInspector & LimitingECSqlQueryExecutor;
  #categoryClass: EC.FullClassName;
  #categoryElementClass: EC.FullClassName;
  #categoryModelClass: EC.FullClassName;
  static #componentName = "CategoriesTreeDefinition";

  public constructor(props: CategoriesTreeDefinitionProps) {
    this.#iModelAccess = props.imodelAccess;
    this.#idsCache = props.idsCache;
    this.#hierarchyConfig = props.hierarchyConfig;
    const { categoryClass, elementClass, modelClass } = getClassesByView(props.viewType);
    this.#categoryClass = categoryClass;
    this.#categoryElementClass = elementClass;
    this.#categoryModelClass = modelClass;
  }

  public preProcessNode: NodePreProcessor = async ({ node }) => {
    if (CategoriesTreeNodeInternal.isRawCategoryNode(node)) {
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
    if (CategoriesTreeNodeInternal.isElementClassGroupingNode(parentNode) || CategoriesTreeNodeInternal.isCategoryNode(parentNode)) {
      return parentNode.extendedData.parentElementsPath;
    }
    throw new Error("Expected node's parent to be category, element, or class grouping node");
  }

  private assignParentElementsPath({ node, parentNode }: Pick<Props<NodePostProcessor>, "node" | "parentNode">): ProcessedHierarchyNode {
    if (CategoriesTreeNodeInternal.isRawCategoryNode(node)) {
      const modelIds: CategoryNodeProps["modelIds"] = node.extendedData.modelIds;
      // When the parent is an element that actually contains this category, the category continues the element path.
      // Otherwise (top-level category, or category of a sub-model) the path is reset.
      const parentIsContainingElement =
        parentNode !== undefined &&
        CategoriesTreeNodeInternal.isElementNode(parentNode) &&
        parentNode.key.instanceKeys.every(({ id }) => !modelIds.includes(id));
      node.extendedData = {
        ...node.extendedData,
        parentElementsPath: parentIsContainingElement ? CategoriesTreeDefinition.extendPathWithElement(parentNode) : [],
      };
      return node;
    }
    if (CategoriesTreeNodeInternal.isRawElementNode(node) || CategoriesTreeNodeInternal.isRawElementClassGroupingNode(node)) {
      assert(parentNode !== undefined, "Expected node to have a parent node");
      node.extendedData = {
        ...node.extendedData,
        parentElementsPath: CategoriesTreeNodeInternal.isElementNode(parentNode)
          ? CategoriesTreeDefinition.extendPathWithElement(parentNode)
          : CategoriesTreeDefinition.getInheritedParentElementsPath(parentNode),
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
    const modelElementsMap = new Map<
      ModelId,
      {
        elementIds: Set<ElementId>;
        childrenWhichAreParents: Set<ElementId>;
      }
    >();
    for (const child of node.children) {
      assert(CategoriesTreeNodeInternal.isRawElementNode(child));
      const modelEntry = getOrCreate({
        map: modelElementsMap,
        key: child.extendedData.modelId,
        createFunc: () => ({ elementIds: new Set<ElementId>(), childrenWhichAreParents: new Set<ElementId>() }),
      });
      const addId = child.children
        ? (id: Id64String) => {
            modelEntry.elementIds.add(id);
            modelEntry.childrenWhichAreParents.add(id);
          }
        : (id: Id64String) => modelEntry.elementIds.add(id);
      for (const { id } of child.key.instanceKeys) {
        addId(id);
      }
    }

    const { hasSearchTargetAncestor, hasDirectNonSearchTargets } = groupingNodeDataFromChildren(node.children);
    const firstChild = node.children[0];
    assert(CategoriesTreeNodeInternal.isRawElementNode(firstChild));
    return {
      ...node,
      label: node.label,
      extendedData: {
        ...node.extendedData,
        // add `categoryId` from the first grouped element
        categoryId: firstChild.extendedData.categoryId,
        modelElementsMap,
        ...(hasDirectNonSearchTargets ? { hasDirectNonSearchTargets } : {}),
        ...(hasSearchTargetAncestor ? { hasSearchTargetAncestor } : {}),
        // `imageId` is assigned to instance nodes at query time, but grouping ones need to
        // be handled during post-processing
        imageId: "icon-ec-class",
      },
    };
  };

  private async getHierarchyDefinition(): Promise<HierarchyDefinition> {
    this.#impl ??= (async () => {
      const isDefinitionContainerSupported = await firstValueFrom(this.#idsCache.getIsDefinitionContainerSupported());
      return createPredicateBasedHierarchyDefinition({
        classHierarchyInspector: this.#iModelAccess,
        hierarchy: {
          rootNodes: async (requestProps: DefineRootHierarchyLevelProps) => this.createDefinitionContainersAndCategoriesQuery(requestProps),
          childNodes: [
            ...(this.#hierarchyConfig.showElements
              ? [
                  {
                    parentInstancesNodePredicate: this.#categoryElementClass,
                    definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createElementChildrenQuery(requestProps),
                  },
                  {
                    parentInstancesNodePredicate: CLASS_NAME_ISubModeledElement,
                    definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createISubModeledElementChildrenQuery(requestProps),
                  },
                  {
                    parentInstancesNodePredicate: this.#categoryModelClass,
                    definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createGeometricModelChildrenQuery(requestProps),
                  },
                ]
              : []),
            ...(this.#hierarchyConfig.hideSubCategories && !this.#hierarchyConfig.showElements
              ? []
              : [
                  {
                    parentInstancesNodePredicate: this.#categoryClass,
                    definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) => this.createCategoryChildrenQuery(requestProps),
                  },
                ]),
            ...(isDefinitionContainerSupported
              ? [
                  {
                    parentInstancesNodePredicate: CLASS_NAME_DefinitionContainer,
                    definitions: async (requestProps: DefineInstanceNodeChildHierarchyLevelProps) =>
                      this.createDefinitionContainersAndCategoriesQuery(requestProps),
                  },
                ]
              : []),
          ],
        },
      });
    })();
    return this.#impl;
  }

  public async defineHierarchyLevel(props: DefineHierarchyLevelProps) {
    return (await this.getHierarchyDefinition()).defineHierarchyLevel(props);
  }

  private async createISubModeledElementChildrenQuery({
    parentNodeInstanceIds: elementIds,
    parentNode,
    nodeSelectClauseFactory,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    if (CategoriesTreeNodeInternal.isDefinitionContainerNode(parentNode)) {
      return [];
    }
    assert(CategoriesTreeNodeInternal.isElementNode(parentNode), "Expected parent node to be element node");
    // note: we do not apply hierarchy level filtering on this hierarchy level, because it's always
    // hidden - the filter will get applied on the child hierarchy levels
    return [
      {
        fullClassName: this.#categoryModelClass,
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
            FROM ${this.#categoryModelClass} this
            JOIN IdSet(?) elementIdSet ON this.ModeledElement.Id = elementIdSet.id
            WHERE
              NOT this.IsPrivate
              AND this.ECInstanceId IN (SELECT Model.Id FROM ${this.#categoryElementClass})
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
    nodeSelectClauseFactory,
    parentNode,
    instanceLabelSelectClauseFactory,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const modeledElementCategory = parentNode.extendedData?.modeledElementCategory;
    assert(modeledElementCategory !== undefined, "Expected parent node to have modeledElementCategory extended data");
    const [categoryInstanceFilterClauses, elementInstanceFilterClauses, allSubModels, categoryIds] = await Promise.all([
      nodeSelectClauseFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: this.#categoryClass, alias: "this" },
      }),
      nodeSelectClauseFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: this.#categoryElementClass, alias: "this" },
      }),
      firstValueFrom(this.#idsCache.getAllSubModels()),
      firstValueFrom(this.#idsCache.getCategoriesOfModelsTopMostElements(modelIds).pipe(map((categoriesSet) => [...categoriesSet]))),
    ]);
    if (categoryIds.length === 0) {
      return [];
    }
    const categoriesToShow = categoryIds.filter((categoryId) => categoryId !== modeledElementCategory);
    const definitions: HierarchyLevelDefinition = [];
    // Show categories which don't match modeled elements category
    if (categoriesToShow.length > 0) {
      definitions.push({
        fullClassName: this.#categoryClass,
        query: {
          ecsql: `
            SELECT
              ${await this.createCategoryNodeSelectClause({ nodeSelectClauseFactory, instanceLabelSelectClauseFactory, hasChildren: true, extendedData: { modelIds: { selector: createIdsSelector(modelIds) } } })}
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
    // Show elements which match modeled elements category
    if (categoriesToShow.length !== categoryIds.length) {
      const { selectClause, bindings } = await this.createElementNodeSelectClause({
        nodeSelectClauseFactory,
        instanceLabelSelectClauseFactory,
        allSubModels: [...allSubModels],
      });
      definitions.push({
        fullClassName: this.#categoryElementClass,
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

  private async createDefinitionContainersAndCategoriesQuery(
    props: DefineRootHierarchyLevelProps | DefineInstanceNodeChildHierarchyLevelProps,
  ): Promise<HierarchyLevelDefinition> {
    const { instanceFilter, instanceLabelSelectClauseFactory, nodeSelectClauseFactory } = props;
    const parentNodeInstanceIds = "parentNodeInstanceIds" in props ? props.parentNodeInstanceIds : undefined;
    const { definitionContainers, categories } = await firstValueFrom(
      parentNodeInstanceIds === undefined
        ? this.#idsCache.getRootDefinitionContainersAndCategories({ includeEmpty: this.#hierarchyConfig.showEmptyCategories })
        : this.#idsCache.getDirectChildDefinitionContainersAndCategories({
            parentDefinitionContainerIds: parentNodeInstanceIds,
            includeEmpty: this.#hierarchyConfig.showEmptyCategories,
          }),
    );
    const hierarchyDefinition = new Array<HierarchyNodesDefinition>();
    if (categories.length > 0) {
      (await this.createTopMostCategoriesQuery({ categories, instanceFilter, instanceLabelSelectClauseFactory, nodeSelectClauseFactory })).forEach((def) =>
        hierarchyDefinition.push(def),
      );
    }
    if (definitionContainers.length > 0) {
      (
        await this.createDefinitionContainersQuery({
          definitionContainerIds: definitionContainers,
          instanceFilter,
          nodeSelectClauseFactory,
          instanceLabelSelectClauseFactory,
        })
      ).forEach((def) => hierarchyDefinition.push(def));
    }
    return hierarchyDefinition;
  }

  private async createDefinitionContainersQuery({
    definitionContainerIds,
    instanceFilter,
    nodeSelectClauseFactory,
    instanceLabelSelectClauseFactory,
  }: {
    definitionContainerIds: Id64Array;
    instanceFilter?: GenericInstanceFilter;
    nodeSelectClauseFactory: NodesQueryClauseFactory;
    instanceLabelSelectClauseFactory: IInstanceLabelSelectClauseFactory;
  }): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await nodeSelectClauseFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: CLASS_NAME_DefinitionContainer, alias: "this" },
    });

    return [
      {
        fullClassName: CLASS_NAME_DefinitionContainer,
        query: {
          ecsql: `
            SELECT
              ${await nodeSelectClauseFactory.createSelectClause({
                ecClassId: { selector: ECSql.createRawPropertyValueSelector("this", "ECClassId") },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await instanceLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: CLASS_NAME_DefinitionContainer,
                  }),
                },
                extendedData: {
                  isDefinitionContainer: true,
                  imageId: "icon-definition-container",
                },
                hasChildren: true,
                supportsFiltering: true,
              })}
            FROM ${instanceFilterClauses.from} this
            JOIN IdSet(?) definitionContainerIdSet ON this.ECInstanceId = definitionContainerIdSet.id
            ${instanceFilterClauses.joins}
            ${instanceFilterClauses.where ? `WHERE ${instanceFilterClauses.where}` : ""}
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `,
          bindings: [{ type: "idset", value: definitionContainerIds }],
        },
      },
    ];
  }

  private async createTopMostCategoriesQuery({
    categories,
    instanceFilter,
    instanceLabelSelectClauseFactory,
    nodeSelectClauseFactory,
  }: {
    categories: Array<CategoryInfo>;
    instanceFilter?: GenericInstanceFilter;
    instanceLabelSelectClauseFactory: IInstanceLabelSelectClauseFactory;
    nodeSelectClauseFactory: NodesQueryClauseFactory;
  }): Promise<HierarchyLevelDefinition> {
    const [instanceFilterClauses, subModels] = await Promise.all([
      nodeSelectClauseFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: this.#categoryClass, alias: "this" },
      }),
      this.#hierarchyConfig.showElements ? firstValueFrom(this.#idsCache.getAllSubModels()) : new Set<ModelId>(),
    ]);
    const categoriesWithMultipleSubCategories = categories
      .filter((categoryInfo) => categoryInfo.subCategoryChildCount > 1)
      .map((categoryInfo) => categoryInfo.id);

    const conditions = new Array<string>();
    if (!this.#hierarchyConfig.hideSubCategories && categoriesWithMultipleSubCategories.length > 0) {
      conditions.push(`InVirtualSet(?, this.ECInstanceId)`);
    }
    if (this.#hierarchyConfig.showElements) {
      conditions.push(`
          this.ECInstanceId IN (
            SELECT e.Category.Id
            FROM ${this.#categoryElementClass} e
            WHERE
              e.Parent.Id IS NULL
              ${subModels.size > 0 ? `AND NOT InVirtualSet(?, e.Model.Id)` : ""}
          )`);
    }

    const hasChildren =
      conditions.length > 0
        ? {
            selector: `IIF(${conditions.join(" OR ")}, 1, 0)`,
          }
        : false;

    return [
      {
        fullClassName: this.#categoryClass,
        query: {
          ecsql: `
            SELECT
              ${await this.createCategoryNodeSelectClause({
                nodeSelectClauseFactory,
                instanceLabelSelectClauseFactory,
                hasChildren,
                extendedData: {
                  description: { selector: "this.Description" },
                  modelIds: { selector: createIdsSelector(new Array<ModelId>()) },
                  hasSubCategories:
                    categoriesWithMultipleSubCategories.length > 0 ? { selector: "IIF(InVirtualSet(?, this.ECInstanceId), true, false)" } : false,
                },
              })}
            FROM ${instanceFilterClauses.from} this
            JOIN IdSet(?) categoryIdSet ON this.ECInstanceId = categoryIdSet.id
            ${instanceFilterClauses.joins}
            ${instanceFilterClauses.where ? `WHERE ${instanceFilterClauses.where}` : ""}
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `,
          bindings: [
            ...(!this.#hierarchyConfig.hideSubCategories && categoriesWithMultipleSubCategories.length > 0
              ? [{ type: "idset" as const, value: categoriesWithMultipleSubCategories }]
              : []),
            ...(subModels.size > 0 ? [{ type: "idset" as const, value: [...subModels] }] : []),
            ...(categoriesWithMultipleSubCategories.length > 0 ? [{ type: "idset" as const, value: categoriesWithMultipleSubCategories }] : []),
            { type: "idset", value: categories.map((category) => category.id) },
          ],
        },
      },
    ];
  }

  private async createCategoryChildrenQuery(props: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    return (
      await Promise.all([
        ...(!this.#hierarchyConfig.hideSubCategories && props.parentNode.extendedData?.hasSubCategories ? [this.createSubCategoriesQuery(props)] : []),
        ...(this.#hierarchyConfig.showElements ? [this.createCategoryElementsQuery(props)] : []),
      ])
    ).reduce((acc, levelDefinition) => acc.concat(levelDefinition), new Array<HierarchyNodesDefinition>());
  }

  private async createSubCategoriesQuery({
    parentNodeInstanceIds: categoryIds,
    instanceFilter,
    nodeSelectClauseFactory,
    instanceLabelSelectClauseFactory,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    const instanceFilterClauses = await nodeSelectClauseFactory.createFilterClauses({
      filter: instanceFilter,
      contentClass: { fullName: CLASS_NAME_SubCategory, alias: "this" },
    });

    return [
      {
        fullClassName: CLASS_NAME_SubCategory,
        query: {
          ecsql: `
            SELECT
              ${await nodeSelectClauseFactory.createSelectClause({
                ecClassId: { selector: "this.ECClassId" },
                ecInstanceId: { selector: "this.ECInstanceId" },
                nodeLabel: {
                  selector: await instanceLabelSelectClauseFactory.createSelectClause({
                    classAlias: "this",
                    className: CLASS_NAME_SubCategory,
                  }),
                },
                extendedData: {
                  categoryId: { selector: "printf('0x%x', this.Parent.Id)" },
                  isSubCategory: true,
                  imageId: "icon-layers-isolate",
                },
                supportsFiltering: false,
              })}
            FROM ${instanceFilterClauses.from} this
            JOIN IdSet(?) categoryIdSet ON this.Parent.Id = categoryIdSet.id
            ${instanceFilterClauses.joins}
            WHERE
              NOT this.IsPrivate
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
            ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
          `,
          bindings: [{ type: "idset", value: categoryIds }],
        },
      },
    ];
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
          className: this.#categoryElementClass,
        }),
      },
      hasChildren: {
        selector: `
          IFNULL(
            (
              SELECT 1
              FROM ${this.#categoryElementClass} ce
              WHERE ce.Parent.Id = this.ECInstanceId
              LIMIT 1
            ),
            ${allSubModels.length ? "InVirtualSet(?, this.ECInstanceId)" : `0`}
            )
        `,
      },
      grouping: { byClass: true },
      extendedData: {
        modelId: { selector: "IdToHex(this.Model.Id)" },
        categoryId: { selector: "IdToHex(this.Category.Id)" },
        imageId: "icon-item",
        isElement: true,
      },
      supportsFiltering: true,
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
    hasChildren,
  }: {
    nodeSelectClauseFactory: DefineInstanceNodeChildHierarchyLevelProps["nodeSelectClauseFactory"];
    instanceLabelSelectClauseFactory: DefineInstanceNodeChildHierarchyLevelProps["instanceLabelSelectClauseFactory"];
    extendedData: Props<typeof nodeSelectClauseFactory.createSelectClause>["extendedData"];
    hasChildren: boolean | { selector: string };
  }): Promise<string> {
    return nodeSelectClauseFactory.createSelectClause({
      ecClassId: { selector: "this.ECClassId" },
      ecInstanceId: { selector: "this.ECInstanceId" },
      nodeLabel: {
        selector: await instanceLabelSelectClauseFactory.createSelectClause({
          classAlias: "this",
          className: this.#categoryClass,
        }),
      },
      grouping: { byLabel: { action: "merge", groupId: "category" } },
      hasChildren,
      extendedData: {
        imageId: "icon-layers",
        isCategory: true,
        ...extendedData,
      },
      supportsFiltering: true,
    });
  }

  private async createCategoryElementsQuery({
    parentNodeInstanceIds: categoryIds,
    instanceFilter,
    parentNode,
    nodeSelectClauseFactory,
    instanceLabelSelectClauseFactory,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    assert(CategoriesTreeNodeInternal.isCategoryNode(parentNode), "Expected category node as parent");
    const parentCategoryElementPath = parentNode.extendedData.parentElementsPath;
    const [instanceFilterClauses, allSubModels] = await Promise.all([
      nodeSelectClauseFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: this.#categoryElementClass, alias: "this" },
      }),
      firstValueFrom(this.#idsCache.getAllSubModels()),
    ]);
    const modelIds: Id64Array =
      parentNode.extendedData.modelIds.length > 0
        ? parseIdsSelectorResult(parentNode.extendedData.modelIds)
        : await firstValueFrom(
            from(categoryIds).pipe(
              mergeMap((categoryId) => this.#idsCache.getModels({ categoryId })),
              filter(({ isSubModel }) => !isSubModel), // sub-models are handled as separate nodes, so we need to filter them out here
              map(({ id }) => id),
              distinct(),
              toArray(),
            ),
          );

    if (modelIds.length === 0) {
      return [];
    }
    const parentIds = ParentElementsPath.getLastParentIds(parentCategoryElementPath);
    const { selectClause, bindings } = await this.createElementNodeSelectClause({
      nodeSelectClauseFactory,
      instanceLabelSelectClauseFactory,
      allSubModels: [...allSubModels],
    });
    return [
      {
        fullClassName: this.#categoryElementClass,
        query: {
          ecsql: `
            SELECT
              ${selectClause}
            FROM ${instanceFilterClauses.from} this
            JOIN IdSet(?) categoryIdSet ON this.Category.Id = categoryIdSet.id
            JOIN IdSet(?) modelIdSet ON this.Model.Id = modelIdSet.id
            ${instanceFilterClauses.joins}
            WHERE
              ${parentIds === undefined ? "this.Parent.Id IS NULL" : `InVirtualSet(?, this.Parent.Id)`}
              ${instanceFilterClauses.where ? `AND ${instanceFilterClauses.where}` : ""}
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

  private async createElementChildrenQuery({
    parentNodeInstanceIds: elementIds,
    instanceFilter,
    parentNode,
    nodeSelectClauseFactory,
    instanceLabelSelectClauseFactory,
  }: DefineInstanceNodeChildHierarchyLevelProps): Promise<HierarchyLevelDefinition> {
    assert(CategoriesTreeNodeInternal.isElementNode(parentNode), "Expected parent node to be element node");
    const parentCategoryId = parentNode.extendedData.categoryId;

    const [elementInstanceFilterClauses, categoryInstanceFilterClauses, allSubModels] = await Promise.all([
      nodeSelectClauseFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: this.#categoryElementClass, alias: "this" },
      }),
      nodeSelectClauseFactory.createFilterClauses({
        filter: instanceFilter,
        contentClass: { fullName: this.#categoryClass, alias: "this" },
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
        fullClassName: this.#categoryElementClass,
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
        fullClassName: this.#categoryClass,
        query: {
          ecsql: `
            SELECT
              ${await this.createCategoryNodeSelectClause({
                nodeSelectClauseFactory,
                instanceLabelSelectClauseFactory,
                hasChildren: true,
                extendedData: {
                  modelIds: { selector: createIdsSelector([parentNode.extendedData.modelId]) },
                },
              })}
            FROM ${categoryInstanceFilterClauses.from} this
            WHERE
              this.ECInstanceId <> ${parentCategoryId}
              AND this.ECInstanceId IN (
                SELECT DISTINCT ce.Category.Id
                FROM ${this.#categoryElementClass} ce
                JOIN IdSet(?) parentIdSet ON ce.Parent.Id = parentIdSet.id
                ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
              )
              ${categoryInstanceFilterClauses.joins ? `${categoryInstanceFilterClauses.joins}` : ""}
              ${categoryInstanceFilterClauses.where ? `AND ${categoryInstanceFilterClauses.where}` : ""}
          `,
          bindings: [{ type: "idset", value: elementIds }],
        },
      },
    ];
  }

  public static createInstanceKeyPaths(
    props: CategoriesTreeInstanceKeyPathsFromInstanceLabelProps,
  ): AsyncIterableIterator<{ path: HierarchyNodeIdentifiersPath; target: Id64String }> {
    const labelsFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: props.imodelAccess });
    return eachValueFrom(
      createInstanceKeyPathsFromInstanceLabel({
        ...props,
        labelsFactory,
        componentId: props.componentId ?? Guid.createValue(),
        componentName: this.#componentName,
      }).pipe(props.abortSignal ? takeUntil(fromEvent(props.abortSignal, "abort")) : identity),
    );
  }
}

const DEFINITION_CONTAINER_TYPE_AS_NUMBER = 0;
const DEFINITION_CONTAINER_CLASS_NAME_QUERY_ALIAS = "dc";
const SUB_CATEGORY_TYPE_AS_NUMBER = 1;
const SUB_CATEGORY_CLASS_NAME_QUERY_ALIAS = "sc";
const CATEGORY_TYPE_AS_NUMBER = 2;
const CATEGORY_CLASS_NAME_QUERY_ALIAS = "c";
const ELEMENT_TYPE_AS_NUMBER = 3;
const ELEMENT_CLASS_NAME_QUERY_ALIAS = "e";
const MODEL_CLASS_NAME_QUERY_ALIAS = "m";

function createInstanceKeyPathsFromInstanceLabel(
  props: MarkRequired<Omit<CategoriesTreeInstanceKeyPathsFromInstanceLabelProps, "abortSignal">, "componentId"> & {
    labelsFactory: IInstanceLabelSelectClauseFactory;
    componentName: string;
  },
) {
  const { idsCache, label, viewType, labelsFactory, limit, hierarchyConfig, imodelAccess, componentId, componentName } = props;
  const { categoryClass, elementClass } = getClassesByView(viewType);

  const adjustedLabel = label.replace(/[%_\\]/g, "\\$&");

  const CATEGORIES_WITH_LABELS_CTE = "CategoriesWithLabels";
  const ELEMENTS_WITH_LABELS_CTE = "ElementsWithLabels";
  const SUBCATEGORIES_WITH_LABELS_CTE = "SubCategoriesWithLabels";
  const DEFINITION_CONTAINERS_WITH_LABELS_CTE = "DefinitionContainersWithLabels";

  return idsCache
    .getAllDefinitionContainersAndCategories({
      includeEmpty: props.hierarchyConfig.showEmptyCategories,
    })
    .pipe(
      mergeMap(async ({ definitionContainers, categories }) => {
        if (categories.length === 0) {
          return undefined;
        }
        const [categoryLabelSelectClause, subCategoryLabelSelectClause, elementLabelSelectClause, definitionContainerLabelSelectClause] = await Promise.all(
          [categoryClass, CLASS_NAME_SubCategory, elementClass, ...(definitionContainers.length > 0 ? [CLASS_NAME_DefinitionContainer] : [])].map(
            async (className) =>
              labelsFactory.createSelectClause({ classAlias: "this", className, selectorsConcatenator: ECSql.createConcatenatedValueStringSelector }),
          ),
        );
        const ctes = [
          `${CATEGORIES_WITH_LABELS_CTE}(ClassName, ECInstanceId, ChildCount, DisplayLabel) AS (
            SELECT
              '${CATEGORY_CLASS_NAME_QUERY_ALIAS}',
              this.ECInstanceId,
              COUNT(sc.ECInstanceId),
              ${categoryLabelSelectClause}
            FROM ${categoryClass} this
            JOIN ${CLASS_NAME_SubCategory} sc ON sc.Parent.Id = this.ECInstanceId
            GROUP BY this.ECInstanceId
          )`,
          ...(hierarchyConfig.showElements
            ? [
                `${ELEMENTS_WITH_LABELS_CTE}(ClassName, ECInstanceId, ParentId, DisplayLabel) AS (
                  SELECT
                    '${ELEMENT_CLASS_NAME_QUERY_ALIAS}',
                    this.ECInstanceId,
                    this.Parent.Id,
                    ${elementLabelSelectClause}
                  FROM ${elementClass} this
                  JOIN IdSet(?) elementCategoryIdSet ON this.Category.Id = elementCategoryIdSet.id
                  JOIN ${CLASS_NAME_Model} m ON this.Model.Id = m.ECInstanceId
                  WHERE NOT m.IsPrivate
                  ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
                )`,
              ]
            : []),
          ...(hierarchyConfig.hideSubCategories
            ? []
            : [
                `${SUBCATEGORIES_WITH_LABELS_CTE}(ClassName, ECInstanceId, ParentId, DisplayLabel) AS (
                  SELECT
                    '${SUB_CATEGORY_CLASS_NAME_QUERY_ALIAS}',
                    this.ECInstanceId,
                    this.Parent.Id,
                    ${subCategoryLabelSelectClause}
                  FROM ${CLASS_NAME_SubCategory} this
                  JOIN IdSet(?) subCategoryParentIdSet ON this.Parent.Id = subCategoryParentIdSet.id
                  WHERE NOT this.IsPrivate
                  ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
                )`,
              ]),
          ...(definitionContainers.length > 0
            ? [
                `${DEFINITION_CONTAINERS_WITH_LABELS_CTE}(ClassName, ECInstanceId, DisplayLabel) AS (
                  SELECT
                    '${DEFINITION_CONTAINER_CLASS_NAME_QUERY_ALIAS}',
                    this.ECInstanceId,
                    ${definitionContainerLabelSelectClause}
                  FROM ${CLASS_NAME_DefinitionContainer} this
                  JOIN IdSet(?) definitionContainerIdSet ON this.ECInstanceId = definitionContainerIdSet.id
                  WHERE NOT this.IsPrivate
                  ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
                )`,
              ]
            : []),
        ];
        const ecsql = `
          SELECT * FROM (
            SELECT
              c.ClassName AS ClassName,
              c.ECInstanceId AS ECInstanceId
            FROM
              ${CATEGORIES_WITH_LABELS_CTE} c
            WHERE
              c.DisplayLabel LIKE '%' || ? || '%' ESCAPE '\\'
            ${
              hierarchyConfig.showElements
                ? `
                  UNION ALL
                  SELECT
                    e.ClassName AS ClassName,
                    e.ECInstanceId AS ECInstanceId
                  FROM
                    ${ELEMENTS_WITH_LABELS_CTE} e
                  WHERE
                    e.DisplayLabel LIKE '%' || ? || '%' ESCAPE '\\'
                `
                : ""
            }
            ${
              hierarchyConfig.hideSubCategories
                ? ""
                : `
                  UNION ALL
                  SELECT
                    sc.ClassName AS ClassName,
                    sc.ECInstanceId AS ECInstanceId
                  FROM
                    ${CATEGORIES_WITH_LABELS_CTE} c
                    JOIN ${SUBCATEGORIES_WITH_LABELS_CTE} sc ON sc.ParentId = c.ECInstanceId
                  WHERE
                    c.ChildCount > 1
                    AND sc.DisplayLabel LIKE '%' || ? || '%' ESCAPE '\\'
                `
            }
            ${
              definitionContainers.length > 0
                ? `
                  UNION ALL
                  SELECT
                    dc.ClassName AS ClassName,
                    dc.ECInstanceId AS ECInstanceId
                  FROM
                    ${DEFINITION_CONTAINERS_WITH_LABELS_CTE} dc
                  WHERE
                    dc.DisplayLabel LIKE '%' || ? || '%' ESCAPE '\\'
                `
                : ""
            }
          )
          ${limit === undefined ? `LIMIT ${MAX_SEARCH_INSTANCE_KEY_COUNT + 1}` : limit !== "unbounded" ? `LIMIT ${limit}` : ""}
        `;
        const bindings = [
          ...(hierarchyConfig.showElements ? [{ type: "idset" as const, value: categories }] : []),
          ...(hierarchyConfig.hideSubCategories ? [] : [{ type: "idset" as const, value: categories }]),
          ...(definitionContainers.length > 0 ? [{ type: "idset" as const, value: definitionContainers }] : []),
          { type: "string" as const, value: adjustedLabel },
          ...(hierarchyConfig.showElements ? [{ type: "string" as const, value: adjustedLabel }] : []),
          ...(hierarchyConfig.hideSubCategories ? [] : [{ type: "string" as const, value: adjustedLabel }]),
          ...(definitionContainers.length > 0 ? [{ type: "string" as const, value: adjustedLabel }] : []),
        ];
        return { ctes, ecsql, bindings };
      }),
      mergeMap((queryProps) => {
        if (!queryProps) {
          return EMPTY;
        }
        return imodelAccess.createQueryReader(queryProps, { restartToken: `${componentName}/${componentId}/filter-by-label`, limit });
      }),
      catchBeSQLiteInterrupts,
      map((row): { key: Id64String; type: number } => {
        let type: number;
        switch (row.ClassName) {
          case CATEGORY_CLASS_NAME_QUERY_ALIAS:
            type = CATEGORY_TYPE_AS_NUMBER;
            break;
          case SUB_CATEGORY_CLASS_NAME_QUERY_ALIAS:
            type = SUB_CATEGORY_TYPE_AS_NUMBER;
            break;
          case ELEMENT_CLASS_NAME_QUERY_ALIAS:
            type = ELEMENT_TYPE_AS_NUMBER;
            break;
          default:
            type = DEFINITION_CONTAINER_TYPE_AS_NUMBER;
            break;
        }
        return {
          type,
          key: row.ECInstanceId,
        };
      }),
      createSearchPathsForDifferentTypes(props),
    );
}

function createSearchPathsForDifferentTypes(
  props: Omit<CategoriesTreeInstanceKeyPathsBaseProps, "componentId"> & { componentId: GuidString; componentName: string },
): OperatorFunction<
  {
    key: Id64String;
    type: number;
  },
  ObservedValueOf<ReturnType<typeof createGeometricElementInstanceKeyPaths>>
> {
  return (obs) =>
    obs.pipe(
      reduce(
        (acc, { key, type }) => {
          switch (type) {
            case CATEGORY_TYPE_AS_NUMBER:
              acc.categoryIds.push(key);
              break;
            case DEFINITION_CONTAINER_TYPE_AS_NUMBER:
              acc.definitionContainerIds.push(key);
              break;
            case SUB_CATEGORY_TYPE_AS_NUMBER:
              if (props.hierarchyConfig.hideSubCategories) {
                break;
              }
              acc.subCategoryIds.push(key);
              break;
            default:
              if (!props.hierarchyConfig.showElements) {
                break;
              }
              acc.elementIds.push(key);
              break;
          }
          return acc;
        },
        {
          definitionContainerIds: new Array<DefinitionContainerId>(),
          categoryIds: new Array<CategoryId>(),
          subCategoryIds: new Array<SubCategoryId>(),
          elementIds: new Array<ElementId>(),
        },
      ),
      switchMap((ids) => {
        const { idsCache, imodelAccess, componentId, componentName, limit } = props;
        const elementsLength = ids.elementIds.length;
        const totalSize = ids.definitionContainerIds.length + ids.categoryIds.length + ids.subCategoryIds.length + elementsLength;
        if (limit !== "unbounded" && totalSize > (limit ?? MAX_SEARCH_INSTANCE_KEY_COUNT)) {
          throw new SearchLimitExceededError(limit ?? MAX_SEARCH_INSTANCE_KEY_COUNT);
        }

        return merge(
          idsCache
            .getDefinitionContainersSearchPaths({ definitionContainerIds: ids.definitionContainerIds })
            .pipe(map((path) => ({ path, target: path[path.length - 1].id }))),
          createCategoriesSearchPaths({
            queryExecutor: imodelAccess,
            targetCategoryIds: ids.categoryIds,
            componentId,
            componentName,
            idsCache,
            viewType: props.viewType,
            showElements: props.hierarchyConfig.showElements,
          }),
          idsCache.getSubCategoriesSearchPaths({ subCategoryIds: ids.subCategoryIds }).pipe(map((path) => ({ path, target: path[path.length - 1].id }))),
          props.hierarchyConfig.showElements
            ? from(ids.elementIds).pipe(
                bufferCount(getOptimalBatchSize({ totalSize: elementsLength, maximumBatchSize: 5000 })),
                releaseMainThreadOnItemsCount(1),
                mergeMap(
                  (block, chunkIndex) =>
                    createGeometricElementInstanceKeyPaths({
                      queryExecutor: imodelAccess,
                      idsCache,
                      viewType: props.viewType,
                      targetItems: block,
                      chunkIndex,
                      componentId,
                      componentName,
                    }),
                  2,
                ),
              )
            : EMPTY,
        );
      }),
    );
}

/** @internal */
export function createGeometricElementInstanceKeyPaths(props: {
  queryExecutor: LimitingECSqlQueryExecutor;
  idsCache: CategoriesTreeIdsCache;
  viewType: "2d" | "3d";
  targetItems: Id64Array;
  componentId: GuidString;
  componentName: string;
  chunkIndex: number;
}): Observable<{ path: HierarchyNodeIdentifiersPath; target: Id64String }> {
  const separator = ";";
  const { targetItems, chunkIndex, componentId, componentName, idsCache, queryExecutor, viewType } = props;
  const { categoryClass, elementClass, modelClass } = getClassesByView(viewType);
  if (targetItems.length === 0) {
    return EMPTY;
  }

  return props.idsCache.getAllSubModels().pipe(
    mergeMap((subModelIds) => {
      const ctes = [
        `CategoriesElementsHierarchy(ECInstanceId, ParentId, ModelId, CategoryId, Path) AS (
          SELECT
            e.ECInstanceId,
            e.Parent.Id,
            e.Model.Id,
            e.Category.Id,
            '${ELEMENT_CLASS_NAME_QUERY_ALIAS}${separator}' || CAST(IdToHex([e].[ECInstanceId]) AS TEXT)
          FROM ${elementClass} e
          JOIN IdSet(?) targetItemIdSet ON e.ECInstanceId = targetItemIdSet.id
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
          FROM CategoriesElementsHierarchy ce
          JOIN ${elementClass} pe ON (pe.ECInstanceId = ce.ParentId OR pe.ECInstanceId = ce.ModelId AND ce.ParentId IS NULL)
        )`,
      ];
      const ecsql = `
        SELECT '${CATEGORY_CLASS_NAME_QUERY_ALIAS}${separator}' || CAST(IdToHex([mce].[CategoryId]) AS TEXT) || '${separator}' || mce.Path
        FROM CategoriesElementsHierarchy mce
        WHERE mce.ParentId IS NULL ${subModelIds.size > 0 ? `AND NOT InVirtualSet(?, mce.ModelId)` : ""}
      `;

      return queryExecutor.createQueryReader(
        {
          ctes,
          ecsql,
          bindings: [{ type: "idset", value: targetItems }, ...(subModelIds.size > 0 ? [{ type: "idset" as const, value: [...subModelIds] }] : [])],
        },
        { rowFormat: "Indexes", limit: "unbounded", restartToken: `${componentName}/${componentId}/element-paths/${chunkIndex}` },
      );
    }),
    catchBeSQLiteInterrupts,
    targetItems.length > 300 ? releaseMainThreadOnItemsCount(300) : identity,
    map((row) => parseQueryRow(row, separator, elementClass, categoryClass, modelClass)),
    mergeMap((elementHierarchyPath) =>
      idsCache.getSearchPathsUpToRootCategory({ categoryId: elementHierarchyPath[0].id }).pipe(
        map((pathUpToCategory) => {
          const path = [...pathUpToCategory, ...elementHierarchyPath];
          return { path, target: elementHierarchyPath[elementHierarchyPath.length - 1].id };
        }),
      ),
    ),
  );
}

/** @internal */
export function createCategoriesSearchPaths(props: {
  queryExecutor: LimitingECSqlQueryExecutor;
  idsCache: CategoriesTreeIdsCache;
  viewType: "2d" | "3d";
  targetCategoryIds: Id64Array;
  componentId: GuidString;
  componentName: string;
  showElements: boolean;
}): Observable<{ path: HierarchyNodeIdentifiersPath; target: Id64String }> {
  const separator = ";";
  const { targetCategoryIds, componentId, componentName, idsCache, queryExecutor, viewType } = props;
  const { categoryClass, elementClass, modelClass } = getClassesByView(viewType);
  if (targetCategoryIds.length === 0) {
    return EMPTY;
  }
  const rootCategoriesSearchPaths = fromWithRelease({ source: targetCategoryIds, releaseOnCount: 300 }).pipe(
    mergeMap((categoryId) =>
      idsCache
        .getSearchPathsUpToRootCategory({ categoryId })
        .pipe(map((path) => ({ path: [...path, { id: categoryId, className: categoryClass }], target: categoryId }))),
    ),
  );
  if (!props.showElements) {
    return rootCategoriesSearchPaths;
  }

  return merge(
    rootCategoriesSearchPaths,
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
            FROM ${elementClass} e
            JOIN IdSet(?) categoryIdSet ON e.Category.Id = categoryIdSet.id
            JOIN ${elementClass} pe ON (pe.ECInstanceId = e.Parent.Id OR (pe.ECInstanceId = e.Model.Id AND e.Parent.Id IS NULL))
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
            JOIN ${elementClass} pe ON (pe.ECInstanceId = ce.ParentId OR (pe.ECInstanceId = ce.ModelId AND ce.ParentId IS NULL))
          )`,
        ];
        const ecsql = `
          SELECT '${CATEGORY_CLASS_NAME_QUERY_ALIAS}${separator}' || CAST(IdToHex([mce].[CategoryId]) AS TEXT) || '${separator}' || mce.Path
          FROM CategoriesParentsHierarchy mce
          WHERE mce.ParentId IS NULL ${subModelIds.size > 0 ? `AND NOT InVirtualSet(?, mce.ModelId)` : ""}
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
      map((row) => parseQueryRow(row, separator, elementClass, categoryClass, modelClass)),
      mergeMap((categoryHierarchyPath) =>
        idsCache.getSearchPathsUpToRootCategory({ categoryId: categoryHierarchyPath[0].id }).pipe(
          map((pathUpToCategory) => {
            const path = [...pathUpToCategory, ...categoryHierarchyPath];
            return { path, target: categoryHierarchyPath[categoryHierarchyPath.length - 1].id };
          }),
        ),
      ),
    ),
  );
}

function parseQueryRow(
  row: ECSqlQueryRow,
  separator: string,
  elementClassName: EC.FullClassName,
  categoryClassName: EC.FullClassName,
  modelClassName: EC.FullClassName,
) {
  const queriedPath: string[] = row[0].split(separator);
  const path = new Array<InstanceKey>();
  for (let i = 0; i < queriedPath.length; i += 2) {
    switch (queriedPath[i]) {
      case ELEMENT_CLASS_NAME_QUERY_ALIAS:
        path.push({ className: elementClassName, id: queriedPath[i + 1] });
        break;
      case CATEGORY_CLASS_NAME_QUERY_ALIAS:
        path.push({ className: categoryClassName, id: queriedPath[i + 1] });
        break;
      case MODEL_CLASS_NAME_QUERY_ALIAS:
        path.push({ className: modelClassName, id: queriedPath[i + 1] });
        break;
    }
  }

  return path;
}
