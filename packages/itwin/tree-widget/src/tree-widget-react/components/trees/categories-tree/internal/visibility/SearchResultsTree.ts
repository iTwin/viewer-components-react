/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom, forkJoin } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { CLASS_NAME_DefinitionContainer, CLASS_NAME_SubCategory } from "../../../common/internal/ClassNameDefinitions.js";
import { getOrCreate, ParentElementsPath } from "../../../common/internal/Utils.js";
import { createSearchResultsTree, SearchResultsNodesHandler } from "../../../common/internal/visibility/BaseSearchResultsTree.js";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchySearchTree } from "@itwin/presentation-hierarchies";
import type { EC, ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId, SubCategoryId } from "../../../common/internal/Types.js";
import type {
  BaseSearchResultsTreeNode,
  SearchResultsTree,
  SearchResultsTreeNodeChildren,
  SearchResultsTreeRootNode,
} from "../../../common/internal/visibility/BaseSearchResultsTree.js";
import type { CategoriesTreeIdsCache } from "../CategoriesTreeIdsCache.js";

/** @internal */
export interface CategoriesTreeSearchTargets {
  categories?: Array<{ modelId: Id64String | undefined; categoryIds: Id64Set; parentElementsPath: ParentElementsPath }>;
  elements?: Array<{
    modelId: Id64String;
    categoryId: Id64String;
    searchTargetElements: Array<ElementId>;
    nonSearchTargetElements: Array<ElementId>;
    parentElementsPath: ParentElementsPath;
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
  idsCache: CategoriesTreeIdsCache;
}): Promise<SearchResultsTree<CategoriesTreeSearchTargets>> {
  const { imodelAccess, searchPaths, categoryClassName, categoryElementClassName, idsCache } = props;
  return createSearchResultsTree({
    searchResultsNodesHandler: new CategoriesTreeNodesHandler({
      idsCache,
      imodelAccess,
      categoryClassName,
      categoryElementClassName,
    }),
    searchPaths,
  });
}

interface CategoryNode extends BaseSearchResultsTreeNode<Node> {
  type: "category";
  parentElementsPath: ParentElementsPath;
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
  parentElementsPath: ParentElementsPath;
}

type Node = DefinitionContainerNode | SubCategoryNode | CategoryNode | ElementNode;

type TemporaryDefinitionContainerNode = Omit<DefinitionContainerNode, "children"> & {
  children?: SearchResultsTreeNodeChildren<TemporaryNode>;
};

type TemporarySubCategoryNode = Omit<SubCategoryNode, "children"> & {
  children?: SearchResultsTreeNodeChildren<TemporaryNode>;
};

type TemporaryElementNode = Omit<ElementNode, "modelId" | "children" | "parentElementsPath"> & {
  modelId: undefined;
  potentialParentElementsPath: ParentElementsPath;
  children?: SearchResultsTreeNodeChildren<TemporaryNode>;
};

type TemporaryCategoryNode = Omit<CategoryNode, "children" | "parentElementsPath"> & {
  potentialParentElementsPath: ParentElementsPath;
  children?: SearchResultsTreeNodeChildren<TemporaryNode>;
};

type TemporaryNode = TemporaryDefinitionContainerNode | TemporarySubCategoryNode | TemporaryCategoryNode | TemporaryElementNode;

type InternalSearchTargetElements = Map<
  ModelId,
  Map<
    ElementId | undefined,
    {
      parentElementsPath: ParentElementsPath;
      elements: Map<CategoryId, Map<ElementId, { isSearchTarget: boolean }>>;
    }
  >
>;
type InternalSearchTargetCategories = Map<
  ModelId | undefined,
  Map<
    ElementId | undefined,
    {
      parentElementsPath: ParentElementsPath;
      searchTargets: Array<CategoryId>;
    }
  >
>;

interface InternalSearchTargets {
  elements?: InternalSearchTargetElements;
  categories?: InternalSearchTargetCategories;
  definitionContainerIds?: Id64Set;
  subCategories?: Map<CategoryId, Set<SubCategoryId>>;
}

interface CategoriesTreeNodesHandlerProps {
  idsCache: CategoriesTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  categoryClassName: EC.FullClassName;
  categoryElementClassName: EC.FullClassName;
}

interface ProcessedNodes {
  searchResultsElements: Map<ElementId, Omit<ElementNode, "children">>;
  searchTargetCategories: Map<CategoryId, Omit<CategoryNode, "children">>;
}

class CategoriesTreeNodesHandler extends SearchResultsNodesHandler<ProcessedNodes, CategoriesTreeSearchTargets, Node, TemporaryNode> {
  readonly #props: CategoriesTreeNodesHandlerProps;
  constructor(props: CategoriesTreeNodesHandlerProps) {
    super();
    this.#props = props;
  }

  public async getProcessedNodes(): Promise<ProcessedNodes> {
    const temporaryElementsArray = new Array<Omit<TemporaryElementNode, "children">>();
    const searchTargetCategories = new Array<TemporaryCategoryNode>();
    const result: ProcessedNodes = {
      searchResultsElements: new Map(),
      searchTargetCategories: new Map(),
    };
    for (const node of this.searchResultsNodesArr) {
      if (node.type === "element") {
        temporaryElementsArray.push(node);
        continue;
      }
      if (node.type === "category" && node.isSearchTarget) {
        searchTargetCategories.push(node);
      }
    }

    const { searchResultsElementsModels, subModels } =
      temporaryElementsArray.length === 0
        ? { searchResultsElementsModels: new Map<ElementId, ModelId>(), subModels: new Set<Id64String>() }
        : await firstValueFrom(
            forkJoin({
              searchResultsElementsModels: this.#props.idsCache.getFilteredElementsModels(temporaryElementsArray.map((element) => element.id)),
              subModels: this.#props.idsCache.getAllSubModels(),
            }),
          );
    const getActualParentElementsPath =
      subModels.size > 0
        ? (potentialPath: ParentElementsPath): ParentElementsPath => {
            for (let i = potentialPath.length - 1; i >= 0; --i) {
              if (potentialPath[i].parentIds.some((parentId) => subModels.has(parentId))) {
                return potentialPath.slice(i + 1);
              }
            }
            return potentialPath;
          }
        : (potentialPath: ParentElementsPath): ParentElementsPath => potentialPath;
    for (const element of temporaryElementsArray) {
      const modelId = searchResultsElementsModels.get(element.id);
      assert(modelId !== undefined);
      result.searchResultsElements.set(element.id, {
        ...element,
        parentElementsPath: getActualParentElementsPath(element.potentialParentElementsPath),
        modelId,
      });
    }
    for (const categoryNode of searchTargetCategories) {
      const { parentElementsPath, modelId } = this.getParentElementPathWithModel({
        potentialParentElementsPath: categoryNode.potentialParentElementsPath,
        getActualParentElementsPath,
        searchResultsElementsModels,
      });
      result.searchTargetCategories.set(categoryNode.id, {
        ...categoryNode,
        modelId,
        parentElementsPath,
      });
    }
    return result;
  }

  private getParentElementPathWithModel({
    potentialParentElementsPath,
    getActualParentElementsPath,
    searchResultsElementsModels,
  }: {
    potentialParentElementsPath: ParentElementsPath;
    searchResultsElementsModels: Map<ElementId, ModelId>;
    getActualParentElementsPath: (potentialPath: ParentElementsPath) => ParentElementsPath;
  }): { parentElementsPath: ParentElementsPath; modelId: Id64String | undefined } {
    if (potentialParentElementsPath.length === 0) {
      return { parentElementsPath: potentialParentElementsPath, modelId: undefined };
    }
    const parentElementsPath = getActualParentElementsPath(potentialParentElementsPath);
    const modelId =
      parentElementsPath.length === 0
        ? ParentElementsPath.getSingleLastParentId(potentialParentElementsPath)
        : searchResultsElementsModels.get(ParentElementsPath.getSingleLastParentId(parentElementsPath)!);
    assert(modelId !== undefined);
    return { parentElementsPath, modelId };
  }

  public convertNodesToSearchTargets(temporaryNodes: TemporaryNode[], processedNodes: ProcessedNodes): CategoriesTreeSearchTargets | undefined {
    const internalSearchTargets: InternalSearchTargets = {};

    temporaryNodes.forEach((temporaryNode) => this.collectSearchTargets(internalSearchTargets, temporaryNode, processedNodes));

    return this.convertInternalSearchTargets(internalSearchTargets);
  }

  private convertInternalSearchTargetElements(internalSearchTargetElements: InternalSearchTargetElements): Required<CategoriesTreeSearchTargets>["elements"] {
    const result: Required<CategoriesTreeSearchTargets>["elements"] = [];
    // Internal search target elements are stored in a tree structure, need to convert that to array structure.
    for (const [modelId, modelEntry] of internalSearchTargetElements) {
      for (const { parentElementsPath, elements } of modelEntry.values()) {
        for (const [categoryId, categoryEntry] of elements) {
          const searchTargets = new Array<ElementId>();
          const nonSearchTargets = new Array<ElementId>();
          for (const [elementId, { isSearchTarget }] of categoryEntry) {
            if (isSearchTarget) {
              searchTargets.push(elementId);
            } else {
              nonSearchTargets.push(elementId);
            }
          }
          result.push({
            categoryId,
            modelId,
            parentElementsPath,
            nonSearchTargetElements: nonSearchTargets,
            searchTargetElements: searchTargets,
          });
        }
      }
    }
    return result;
  }

  private convertInternalSearchTargetCategories(
    internalSearchTargetCategories: InternalSearchTargetCategories,
  ): Required<CategoriesTreeSearchTargets>["categories"] {
    const result: Required<CategoriesTreeSearchTargets>["categories"] = [];
    // Internal search target elements are stored in a tree structure, need to convert that to array structure.
    for (const [modelId, modelEntry] of internalSearchTargetCategories) {
      for (const { parentElementsPath, searchTargets } of modelEntry.values()) {
        result.push({
          categoryIds: new Set(searchTargets),
          modelId,
          parentElementsPath,
        });
      }
    }
    return result;
  }

  private convertInternalSearchTargets(searchTargets: InternalSearchTargets): CategoriesTreeSearchTargets | undefined {
    if (!searchTargets.categories && !searchTargets.definitionContainerIds && !searchTargets.elements && !searchTargets.subCategories) {
      return undefined;
    }
    return {
      categories: searchTargets.categories ? this.convertInternalSearchTargetCategories(searchTargets.categories) : undefined,
      elements: searchTargets.elements ? this.convertInternalSearchTargetElements(searchTargets.elements) : undefined,
      definitionContainerIds: searchTargets.definitionContainerIds,
      subCategories: searchTargets.subCategories
        ? [...searchTargets.subCategories.entries()].map(([categoryId, subCategoryIds]) => {
            return { categoryId, subCategoryIds };
          })
        : undefined,
    };
  }

  private collectSearchTargets(internalSearchTargets: InternalSearchTargets, node: TemporaryNode, processedNodes: ProcessedNodes) {
    const searchResultsNode = node.type === "element" ? processedNodes.searchResultsElements.get(node.id) : node;
    assert(searchResultsNode !== undefined);
    if (searchResultsNode.isSearchTarget) {
      if (searchResultsNode.type !== "category") {
        this.addInternalTarget(internalSearchTargets, searchResultsNode);
        return;
      }
      const categoryTargetNode = processedNodes.searchTargetCategories.get(node.id);
      assert(categoryTargetNode !== undefined);
      // If category is a search target, all elements under it are also search targets, so no need to go through children.
      this.addInternalTarget(internalSearchTargets, categoryTargetNode);
      return;
    }

    if (searchResultsNode.type === "element") {
      // Add elements even if they are not targets.
      this.addInternalTarget(internalSearchTargets, searchResultsNode);
    }

    if (!node.children) {
      return;
    }

    for (const child of node.children.values()) {
      this.collectSearchTargets(internalSearchTargets, child, processedNodes);
    }
  }

  private addInternalTarget(
    internalSearchTargets: InternalSearchTargets,
    node: TemporaryDefinitionContainerNode | TemporarySubCategoryNode | CategoryNode | ElementNode,
  ) {
    switch (node.type) {
      case "definitionContainer": {
        (internalSearchTargets.definitionContainerIds ??= new Set()).add(node.id);
        return;
      }
      case "subCategory": {
        internalSearchTargets.subCategories ??= new Map();
        const subCategories = getOrCreate({ map: internalSearchTargets.subCategories, key: node.categoryId, createFunc: () => new Set<SubCategoryId>() });
        subCategories.add(node.id);
        return;
      }
      case "category": {
        internalSearchTargets.categories ??= new Map();
        const modelEntry = getOrCreate({ map: internalSearchTargets.categories, key: node.modelId, createFunc: () => new Map() });
        const lastParentId = ParentElementsPath.getSingleLastParentId(node.parentElementsPath);
        const parentEntry = getOrCreate({
          map: modelEntry,
          key: lastParentId,
          createFunc: () => ({
            parentElementsPath: node.parentElementsPath,
            searchTargets: [],
          }),
        });
        parentEntry.searchTargets.push(node.id);
        return;
      }
      case "element": {
        // Internal search target elements need to have path saved in some way.
        // For this, a tree structure is used, where keys are stringified identifiers of parent nodes depending on the hierarchy.
        internalSearchTargets.elements ??= new Map();
        const modelEntry = getOrCreate({ map: internalSearchTargets.elements, key: node.modelId, createFunc: () => new Map() });
        const lastParentId = ParentElementsPath.getSingleLastParentId(node.parentElementsPath);
        const parentEntry = getOrCreate({
          map: modelEntry,
          key: lastParentId,
          createFunc: () => ({
            parentElementsPath: node.parentElementsPath,
            elements: new Map(),
          }),
        });
        const categoryEntry = getOrCreate({ map: parentEntry.elements, key: node.categoryId, createFunc: () => new Map() });
        categoryEntry.set(node.id, { isSearchTarget: node.isSearchTarget });
      }
    }
  }

  public createTemporaryNode({
    type,
    id,
    isSearchTarget,
    parent,
  }: {
    type: TemporaryNode["type"];
    id: Id64String;
    isSearchTarget: boolean;
    parent: TemporaryNode | SearchResultsTreeRootNode<TemporaryNode>;
  }): TemporaryNode {
    if (type === "definitionContainer") {
      return {
        id,
        isSearchTarget,
        type,
      };
    }
    if (type === "subCategory") {
      assert("id" in parent);
      return {
        id,
        isSearchTarget,
        type,
        categoryId: parent.id,
      };
    }
    if (type === "category") {
      if ("type" in parent && parent.type === "element") {
        return {
          id,
          isSearchTarget,
          type,
          potentialParentElementsPath: ParentElementsPath.appendToPath({
            path: parent.potentialParentElementsPath,
            // Append a single id, there are assertions that check this
            ids: parent.id,
            categoryId: parent.categoryId,
          }),
        };
      }
      return {
        id,
        isSearchTarget,
        type,
        potentialParentElementsPath: [],
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
          potentialParentElementsPath: parent.potentialParentElementsPath,
        };
      }
      assert(parent.type === "element");
      return {
        id,
        isSearchTarget,
        type,
        categoryId: parent.categoryId,
        modelId: undefined,
        potentialParentElementsPath: ParentElementsPath.appendToPath({
          path: parent.potentialParentElementsPath,
          // Append a single id, there are assertions that check this
          ids: parent.id,
          categoryId: parent.categoryId,
        }),
      };
    }

    throw new Error("Invalid parent node type");
  }

  public async getType(className: EC.FullClassName): Promise<TemporaryNode["type"]> {
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_SubCategory)) {
      return "subCategory";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, this.#props.categoryElementClassName)) {
      return "element";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, this.#props.categoryClassName)) {
      return "category";
    }
    return "definitionContainer";
  }

  public getClassName(type: TemporaryNode["type"]): EC.FullClassName {
    switch (type) {
      case "definitionContainer":
        return CLASS_NAME_DefinitionContainer;
      case "subCategory":
        return CLASS_NAME_SubCategory;
      case "category":
        return this.#props.categoryClassName;
      default:
        return this.#props.categoryElementClassName;
    }
  }
}
