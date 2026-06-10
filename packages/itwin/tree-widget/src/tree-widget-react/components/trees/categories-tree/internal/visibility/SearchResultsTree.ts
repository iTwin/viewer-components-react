/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom, forkJoin } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { CLASS_NAME_SubCategory } from "../../../common/internal/ClassNameDefinitions.js";
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

interface CategoryNode extends BaseSearchResultsTreeNode<Node> {
  type: "category";
  parentElementsPath: ParentElementsPath;
  modelId?: Id64String;
}

interface SubModelNode extends BaseSearchResultsTreeNode<Node> {
  type: "subModel";
  modelId: Id64String;
  categoryId: Id64String;
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

type RawElementNode = Omit<ElementNode, "modelId" | "children" | "parentElementsPath"> & {
  modelId: ModelId | undefined;
  potentialParentElementsPath: ParentElementsPath;
  children?: SearchResultsTreeNodeChildren<RawNode>;
};

type RawCategoryNode = Omit<CategoryNode, "children" | "parentElementsPath"> & {
  potentialParentElementsPath: ParentElementsPath;
  children?: SearchResultsTreeNodeChildren<RawNode>;
};

type RawNode = RawDefinitionContainerNode | RawSubCategoryNode | RawCategoryNode | RawElementNode | RawSubModelNode;

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

interface ProcessedNodes {
  searchResultsElements: Map<ElementId, Omit<ElementNode, "children">>;
  searchTargetCategories: Map<CategoryId, Omit<CategoryNode, "children">>;
}

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
    const rawElementsArray = new Array<Omit<RawElementNode, "children">>();
    const searchTargetCategories = new Array<RawCategoryNode>();
    const result: ProcessedNodes = {
      searchResultsElements: new Map(),
      searchTargetCategories: new Map(),
    };
    for (const node of this.searchResultsNodesArr) {
      if (node.type === "element") {
        rawElementsArray.push(node);
        continue;
      }
      if (node.type === "category" && node.isSearchTarget) {
        searchTargetCategories.push(node);
      }
    }

    const { searchResultsElementsModels, subModels } =
      rawElementsArray.length === 0
        ? { searchResultsElementsModels: new Map<ElementId, ModelId>(), subModels: new Set<Id64String>() }
        : await firstValueFrom(
            forkJoin({
              searchResultsElementsModels: this.#props.idsCache.getFilteredElementsModels(rawElementsArray.map((element) => element.id)),
              subModels: this.#props.idsCache.getAllSubModels(),
            }),
          );
    const getActualParentElementsPath =
      subModels.size > 0
        ? (potentialPath: ParentElementsPath): ParentElementsPath => {
            for (let i = potentialPath.length - 1; i >= 0; --i) {
              if (potentialPath[i].elementIds.some((parentId) => subModels.has(parentId))) {
                return potentialPath.slice(i + 1);
              }
            }
            return potentialPath;
          }
        : (potentialPath: ParentElementsPath): ParentElementsPath => potentialPath;
    for (const element of rawElementsArray) {
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

  public convertNodesToSearchTargets(rawNodes: RawNode[], processedNodes: ProcessedNodes): CategoriesTreeSearchTargets | undefined {
    const internalSearchTargets: InternalSearchTargets = {};

    rawNodes.forEach((rawNode) => this.collectSearchTargets(internalSearchTargets, rawNode, processedNodes));

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

  private collectSearchTargets(internalSearchTargets: InternalSearchTargets, node: RawNode, processedNodes: ProcessedNodes) {
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
    node: RawDefinitionContainerNode | RawSubCategoryNode | RawSubModelNode | CategoryNode | ElementNode,
  ) {
    switch (node.type) {
      case "definitionContainer": {
        (internalSearchTargets.definitionContainerIds ??= new Set()).add(node.id);
        return;
      }
      case "subModel": {
        // sub-models are hidden in hierarchy, they can not be search targets.
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

    if (type === "subModel") {
      assert("type" in parent && parent.type === "element");
      return {
        type,
        categoryId: parent.categoryId,
        id,
        modelId: undefined,
        isSearchTarget: false,
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
      if (parent.type === "subModel") {
        return {
          id,
          isSearchTarget,
          type,
          categoryId: parent.categoryId,
          modelId: parent.id,
          potentialParentElementsPath: [],
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
}
