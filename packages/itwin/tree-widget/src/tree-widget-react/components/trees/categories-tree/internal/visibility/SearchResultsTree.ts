/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { CLASS_NAME_DefinitionContainer, CLASS_NAME_SubCategory } from "../../../common/internal/ClassNameDefinitions.js";
import { getOrCreate } from "../../../common/internal/Utils.js";
import { createSearchResultsTree, SearchResultsNodesHandler } from "../../../common/internal/visibility/BaseSearchResultsTree.js";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchySearchTree } from "@itwin/presentation-hierarchies";
import type { EC, ECClassHierarchyInspector, InstanceKey } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId, SubCategoryId } from "../../../common/internal/Types.js";
import type {
  BaseSearchResultsTreeNode,
  SearchResultsNodeIdentifierAsString,
  SearchResultsTree,
  SearchResultsTreeNodeChildren,
  SearchResultsTreeRootNode,
} from "../../../common/internal/visibility/BaseSearchResultsTree.js";
import type { CategoriesTreeIdsCache } from "../CategoriesTreeIdsCache.js";

/** @internal */
export interface CategoriesTreeSearchTargets {
  categories?: Array<{ modelId: Id64String | undefined; categoryIds: Id64Set }>;
  elements?: Array<{
    pathToElements: InstanceKey[];
    modelId: Id64String;
    categoryId: Id64String;
    nonSearchTargetElements: Array<ElementId>;
    searchTargetElements: Array<ElementId>;
    topMostParentElementId?: ElementId;
  }>;
  definitionContainerIds?: Id64Set;
  subCategories?: Array<{ categoryId: Id64String; subCategoryIds: Id64Set }>;
}

/** @internal */
export async function createCategoriesSearchResultsTree(props: {
  imodelAccess: ECClassHierarchyInspector;
  searchPaths: HierarchySearchTree[];
  categoryClassName: EC.FullClassName;
  categoryElementClassName: EC.FullClassName;
  categoryModelClassName: EC.FullClassName;
  idsCache: CategoriesTreeIdsCache;
}): Promise<SearchResultsTree<CategoriesTreeSearchTargets>> {
  const { imodelAccess, searchPaths, categoryClassName, categoryElementClassName, categoryModelClassName, idsCache } = props;
  return createSearchResultsTree({
    searchResultsNodesHandler: new CategoriesTreeSearchResultsNodesHandler({
      idsCache,
      imodelAccess,
      categoryClassName,
      categoryElementClassName,
      categoryModelClassName,
    }),
    searchPaths,
  });
}

interface SubModelNode extends BaseSearchResultsTreeNode<Node> {
  type: "subModel";
  modelId: Id64String;
  categoryId: Id64String;
}

interface CategoryNode extends BaseSearchResultsTreeNode<Node> {
  type: "category";
  modelId?: Id64String;
}

interface SubCategoryNode extends BaseSearchResultsTreeNode<Node> {
  type: "subCategory";
  categoryId: Id64String;
}

interface DefinitionContainerNode extends BaseSearchResultsTreeNode<Node> {
  type: "definitionContainer";
}

interface ElementNode extends BaseSearchResultsTreeNode<Node> {
  type: "element";
  categoryId: Id64String;
  modelId: Id64String;
}

type Node = DefinitionContainerNode | SubCategoryNode | CategoryNode | ElementNode | SubModelNode;

type RawDefinitionContainerNode = Omit<DefinitionContainerNode, "children"> & {
  children?: SearchResultsTreeNodeChildren<RawNode>;
};

type RawSubModelNode = Omit<SubModelNode, "children" | "modelId"> & {
  modelId: undefined;
  children?: SearchResultsTreeNodeChildren<RawNode>;
};

type RawSubCategoryNode = Omit<SubCategoryNode, "children"> & {
  children?: SearchResultsTreeNodeChildren<RawNode>;
};

type RawElementNode = Omit<ElementNode, "modelId" | "children"> & {
  modelId: undefined;
  children?: SearchResultsTreeNodeChildren<RawNode>;
};

type RawCategoryNode = Omit<CategoryNode, "children"> & {
  children?: SearchResultsTreeNodeChildren<RawNode>;
};

type RawNode = RawDefinitionContainerNode | RawSubCategoryNode | RawCategoryNode | RawElementNode | RawSubModelNode;

type InternalSearchTargetElements = Map<
  SearchResultsNodeIdentifierAsString,
  {
    children?: InternalSearchTargetElements;
    topMostParentElementId?: Id64String;
    modelCategoryElements?: Map<ModelCategoryKey, { searchTargets: Array<ElementId>; nonSearchTargets: Array<ElementId> }>;
  }
>;

interface InternalSearchTargets {
  elements?: InternalSearchTargetElements;
  categories?: Map<ModelId | undefined, Set<CategoryId>>;
  definitionContainerIds?: Id64Set;
  subCategories?: Map<CategoryId, Set<SubCategoryId>>;
}

interface ProcessedNodes {
  searchResultsElements: Map<ElementId, Omit<ElementNode, "children">>;
}
type ModelCategoryKey = `${ModelId}-${CategoryId}`;

interface CategoriesTreeSearchResultsNodesHandlerProps {
  idsCache: CategoriesTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  categoryClassName: EC.FullClassName;
  categoryElementClassName: EC.FullClassName;
  categoryModelClassName: EC.FullClassName;
}

class CategoriesTreeSearchResultsNodesHandler extends SearchResultsNodesHandler<ProcessedNodes, CategoriesTreeSearchTargets, RawNode> {
  readonly #props: CategoriesTreeSearchResultsNodesHandlerProps;
  constructor(props: CategoriesTreeSearchResultsNodesHandlerProps) {
    super();
    this.#props = props;
  }

  public async getProcessedNodes(): Promise<ProcessedNodes> {
    const searchResultsTemporaryElements = new Map<Id64String, Omit<RawElementNode, "children">>();
    const result: ProcessedNodes = {
      searchResultsElements: new Map(),
    };
    for (const node of this.searchResultsNodesArr) {
      if (node.type === "element") {
        searchResultsTemporaryElements.set(node.id, node);
      }
    }

    const searchResultsElementsModels = await firstValueFrom(this.#props.idsCache.getFilteredElementsModels([...searchResultsTemporaryElements.keys()]));
    for (const [id, element] of searchResultsTemporaryElements) {
      const modelId = searchResultsElementsModels.get(element.id);
      assert(modelId !== undefined);
      result.searchResultsElements.set(id, { ...element, modelId });
    }
    return result;
  }

  public convertNodesToSearchTargets(rawNodes: RawNode[], processedNodes: ProcessedNodes): CategoriesTreeSearchTargets | undefined {
    const internalSearchTargets: InternalSearchTargets = {};

    rawNodes.forEach((rawNode) => this.collectSearchTargets(internalSearchTargets, rawNode, processedNodes));

    return this.convertInternalSearchTargets(internalSearchTargets);
  }

  private convertInternalSearchTargetElementsRecursively(
    internalSearchTargetElements: InternalSearchTargetElements,
    currentPath: InstanceKey[],
  ): Required<CategoriesTreeSearchTargets>["elements"] {
    const result: Required<CategoriesTreeSearchTargets>["elements"] = [];
    // Internal search target elements are stored in a tree structure, need to convert that to array structure.
    for (const [identifierAsString, entry] of internalSearchTargetElements) {
      const identifier = this.convertSearchResultsNodeIdentifierStringToHierarchyNodeIdentifier(identifierAsString);
      if (entry.modelCategoryElements) {
        for (const [modelCategoryKey, { searchTargets, nonSearchTargets }] of entry.modelCategoryElements) {
          const { modelId, categoryId } = this.parseModelCategoryKey(modelCategoryKey);
          result.push({
            pathToElements: [...currentPath, identifier],
            modelId,
            categoryId,
            searchTargetElements: searchTargets,
            nonSearchTargetElements: nonSearchTargets,
            topMostParentElementId: entry.topMostParentElementId,
          });
        }
      }
      if (!entry.children) {
        continue;
      }
      for (const childValue of this.convertInternalSearchTargetElementsRecursively(entry.children, [...currentPath, identifier])) {
        result.push(childValue);
      }
    }
    return result;
  }

  private convertInternalSearchTargets(searchTargets: InternalSearchTargets): CategoriesTreeSearchTargets | undefined {
    if (!searchTargets.categories && !searchTargets.definitionContainerIds && !searchTargets.elements && !searchTargets.subCategories) {
      return undefined;
    }
    return {
      categories: searchTargets.categories
        ? [...searchTargets.categories.entries()].map(([modelId, categoryIds]) => {
            return { modelId, categoryIds };
          })
        : undefined,
      elements: searchTargets.elements ? this.convertInternalSearchTargetElementsRecursively(searchTargets.elements, []) : undefined,
      definitionContainerIds: searchTargets.definitionContainerIds,
      subCategories: searchTargets.subCategories
        ? [...searchTargets.subCategories.entries()].map(([categoryId, subCategoryIds]) => {
            return { categoryId, subCategoryIds };
          })
        : undefined,
    };
  }

  private collectSearchTargets(searchTargets: InternalSearchTargets, node: RawNode, processedNodes: ProcessedNodes) {
    const searchResultsNode = node.type !== "element" ? node : processedNodes.searchResultsElements.get(node.id);
    assert(searchResultsNode !== undefined);
    if (searchResultsNode.isSearchTarget) {
      this.addTarget(searchTargets, searchResultsNode);
      return;
    }

    if (searchResultsNode.type === "element") {
      // need to add parent ids as search target will be an element
      this.addTarget(searchTargets, searchResultsNode);
    }

    if (!node.children) {
      return;
    }

    for (const child of node.children.values()) {
      this.collectSearchTargets(searchTargets, child, processedNodes);
    }
  }

  private addTarget(
    internalSearchTargets: InternalSearchTargets,
    node: RawDefinitionContainerNode | RawSubCategoryNode | RawSubModelNode | RawCategoryNode | ElementNode,
  ) {
    switch (node.type) {
      case "definitionContainer":
        (internalSearchTargets.definitionContainerIds ??= new Set()).add(node.id);
        return;
      case "subModel":
        // sub-models are hidden in hierarchy, they can not be search targets.
        return;
      case "subCategory":
        internalSearchTargets.subCategories ??= new Map();
        const subCategories = getOrCreate({ map: internalSearchTargets.subCategories, key: node.categoryId, createFunc: () => new Set<SubCategoryId>() });
        subCategories.add(node.id);
        return;
      case "category":
        internalSearchTargets.categories ??= new Map();
        const categories = getOrCreate({ map: internalSearchTargets.categories, key: node.modelId, createFunc: () => new Set<CategoryId>() });
        categories.add(node.id);
        return;
      case "element":
        // Internal search target elements need to have path saved in some way.
        // For this, a tree structure is used, where keys are stringified identifiers of parent nodes depending on the hierarchy.
        const modelCategoryKey = this.createModelCategoryKey(node.modelId, node.categoryId);
        internalSearchTargets.elements ??= new Map();
        let entry = internalSearchTargets.elements;
        let topMostParentElementId: Id64String | undefined;
        for (let i = 0; i < node.pathToNode.length; ++i) {
          if (topMostParentElementId === undefined && node.pathToNode[i].type === "element") {
            topMostParentElementId = node.pathToNode[i].id;
          }
          const identifierAsString = this.convertSearchResultsNodeIdentifierToString(node.pathToNode[i]);
          const identifierEntry = getOrCreate({ map: entry, key: identifierAsString, createFunc: () => ({ topMostParentElementId }) });
          // last entry in the path don't need to have children
          if (i < node.pathToNode.length - 1) {
            identifierEntry.children ??= new Map();
            entry = identifierEntry.children;
            continue;
          }

          // Add elements who share the same path to the modelCategoryElements map
          identifierEntry.modelCategoryElements ??= new Map();
          const elements = getOrCreate({
            map: identifierEntry.modelCategoryElements,
            key: modelCategoryKey,
            createFunc: () => ({ searchTargets: [], nonSearchTargets: [] }),
          });
          if (node.isSearchTarget) {
            elements.searchTargets.push(node.id);
          } else {
            elements.nonSearchTargets.push(node.id);
          }
        }
    }
  }

  private createModelCategoryKey(modelId: Id64String, categoryId: Id64String): ModelCategoryKey {
    return `${modelId}-${categoryId}`;
  }

  private parseModelCategoryKey(key: ModelCategoryKey): { modelId: Id64String; categoryId: Id64String } {
    const [modelId, categoryId] = key.split("-");
    return { modelId, categoryId };
  }

  public createNode({
    type,
    id,
    isSearchTarget,
    parent,
  }: {
    type: RawNode["type"];
    id: Id64String;
    isSearchTarget: boolean;
    parent: RawNode | SearchResultsTreeRootNode<RawNode>;
  }): RawNode {
    const pathToNode = "pathToNode" in parent ? [...parent.pathToNode, { type: parent.type, id: parent.id }] : [];
    if (type === "definitionContainer") {
      return {
        id,
        isSearchTarget,
        type,
        pathToNode,
      };
    }
    if (type === "subCategory") {
      assert("id" in parent);
      return {
        id,
        isSearchTarget,
        type,
        categoryId: parent.id,
        pathToNode,
      };
    }
    if (type === "category") {
      if ("type" in parent && parent.type === "subModel") {
        return {
          id,
          isSearchTarget,
          type,
          modelId: parent.id,
          pathToNode,
        };
      }
      return {
        id,
        isSearchTarget,
        type,
        pathToNode,
      };
    }
    if (type === "subModel") {
      assert("type" in parent && parent.type === "element");
      return {
        id,
        isSearchTarget,
        type,
        categoryId: parent.categoryId,
        modelId: parent.modelId,
        pathToNode,
      };
    }

    if ("type" in parent) {
      if (parent.type === "category") {
        return {
          id,
          isSearchTarget,
          type,
          categoryId: parent.id,
          modelId: undefined,
          pathToNode,
        };
      }
      assert(parent.type === "element");
      return {
        id,
        isSearchTarget,
        type,
        categoryId: parent.categoryId,
        modelId: undefined,
        pathToNode,
      };
    }

    throw new Error("Invalid parent node type");
  }

  public async getType(className: EC.FullClassName): Promise<RawNode["type"]> {
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_SubCategory)) {
      return "subCategory";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, this.#props.categoryElementClassName)) {
      return "element";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, this.#props.categoryClassName)) {
      return "category";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, this.#props.categoryModelClassName)) {
      return "subModel";
    }
    return "definitionContainer";
  }

  public getClassName(type: RawNode["type"]): EC.FullClassName {
    switch (type) {
      case "definitionContainer":
        return CLASS_NAME_DefinitionContainer;
      case "subCategory":
        return CLASS_NAME_SubCategory;
      case "category":
        return this.#props.categoryClassName;
      case "subModel":
        return this.#props.categoryModelClassName;
      default:
        return this.#props.categoryElementClassName;
    }
  }
}
