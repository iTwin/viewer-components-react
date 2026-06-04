/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { CLASS_NAME_Category, CLASS_NAME_GeometricElement3d, CLASS_NAME_Model, CLASS_NAME_Subject } from "../../../common/internal/ClassNameDefinitions.js";
import { getOrCreate, ParentElementsPath } from "../../../common/internal/Utils.js";
import { createSearchResultsTree, SearchResultsNodesHandler } from "../../../common/internal/visibility/BaseSearchResultsTree.js";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchySearchTree } from "@itwin/presentation-hierarchies";
import type { EC, ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId } from "../../../common/internal/Types.js";
import type {
  BaseSearchResultsTreeNode,
  SearchResultsTree,
  SearchResultsTreeNodeChildren,
  SearchResultsTreeRootNode,
} from "../../../common/internal/visibility/BaseSearchResultsTree.js";
import type { ModelsTreeIdsCache } from "../ModelsTreeIdsCache.js";

/** @internal */
export interface ModelsTreeSearchTargets {
  subjectIds?: Id64Set;
  modelIds?: Id64Set;
  categories?: Array<{ modelId: Id64String; categoryIds: Id64Set; parentElementsPath: ParentElementsPath }>;
  elements?: Array<{
    modelId: Id64String;
    categoryId: Id64String;
    searchTargetElements: Array<ElementId>;
    nonSearchTargetElements: Array<ElementId>;
    parentElementsPath: ParentElementsPath;
  }>;
}

/** @internal */
export async function createModelsSearchResultsTree(props: {
  imodelAccess: ECClassHierarchyInspector;
  searchPaths: HierarchySearchTree[];
  idsCache: ModelsTreeIdsCache;
}): Promise<SearchResultsTree<ModelsTreeSearchTargets>> {
  const { imodelAccess, searchPaths } = props;
  return createSearchResultsTree({
    searchResultsNodesHandler: new ModelsTreeNodesHandler({ imodelAccess, idsCache: props.idsCache }),
    searchPaths,
  });
}

interface SubjectNode extends BaseSearchResultsTreeNode<Node> {
  type: "subject";
}

interface ModelNode extends BaseSearchResultsTreeNode<Node> {
  type: "model";
}
interface CategoryNode extends BaseSearchResultsTreeNode<Node> {
  type: "category";
  modelId: Id64String;
  parentElementsPath: ParentElementsPath;
}

interface ElementNode extends BaseSearchResultsTreeNode<Node> {
  type: "element";
  modelId: Id64String;
  categoryId: Id64String;
  parentElementsPath: ParentElementsPath;
}

type Node = SubjectNode | ModelNode | CategoryNode | ElementNode;

type TemporarySubjectNode = Omit<SubjectNode, "children"> & {
  children?: SearchResultsTreeNodeChildren<TemporaryNode>;
};
type TemporaryModelNode = Omit<ModelNode, "children"> & {
  children?: SearchResultsTreeNodeChildren<TemporaryNode>;
};
type TemporaryCategoryNode = Omit<CategoryNode, "children" | "parentElementsPath" | "modelId"> & {
  potentialModelId: Id64String;
  potentialParentElementsPath: ParentElementsPath;
  children?: SearchResultsTreeNodeChildren<TemporaryNode>;
};

type TemporaryElementNode = Omit<ElementNode, "children" | "modelId" | "parentElementsPath"> & {
  potentialModelId: Id64String;
  potentialParentElementsPath: ParentElementsPath;
  children?: SearchResultsTreeNodeChildren<TemporaryNode>;
};

type TemporaryNode = TemporaryElementNode | TemporaryModelNode | TemporarySubjectNode | TemporaryCategoryNode;

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
  ModelId,
  Map<
    ElementId | undefined,
    {
      parentElementsPath: ParentElementsPath;
      searchTargets: Array<CategoryId>;
    }
  >
>;

interface InternalSearchTargets {
  subjectIds?: Id64Set;
  modelIds?: Id64Set;
  categories?: InternalSearchTargetCategories;
  elements?: InternalSearchTargetElements;
}

interface ProcessedNodes {
  allElements: Map<ElementId, Omit<ElementNode, "children">>;
  searchTargetCategories: Map<CategoryId, Omit<CategoryNode, "children">>;
}

interface ModelsTreeNodesHandlerProps {
  imodelAccess: ECClassHierarchyInspector;
  idsCache: ModelsTreeIdsCache;
}

class ModelsTreeNodesHandler extends SearchResultsNodesHandler<ProcessedNodes, ModelsTreeSearchTargets, Node, TemporaryNode> {
  readonly #props: ModelsTreeNodesHandlerProps;
  constructor(props: ModelsTreeNodesHandlerProps) {
    super();
    this.#props = props;
  }

  public async getProcessedNodes(): Promise<ProcessedNodes> {
    const temporaryElementsArray = new Array<Omit<TemporaryElementNode, "children">>();
    const searchTargetCategories = new Array<TemporaryCategoryNode>();
    const result: ProcessedNodes = {
      allElements: new Map(),
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

    const subModels = temporaryElementsArray.length === 0 ? new Set<Id64String>() : await firstValueFrom(this.#props.idsCache.getAllSubModels());
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
      const { parentElementsPath, modelId } = this.getParentElementPathWithModel({
        potentialParentElementsPath: element.potentialParentElementsPath,
        potentialModelId: element.potentialModelId,
        getActualParentElementsPath,
      });
      result.allElements.set(element.id, {
        ...element,
        parentElementsPath,
        modelId,
      });
    }
    for (const categoryNode of searchTargetCategories) {
      const { parentElementsPath, modelId } = this.getParentElementPathWithModel({
        potentialParentElementsPath: categoryNode.potentialParentElementsPath,
        potentialModelId: categoryNode.potentialModelId,
        getActualParentElementsPath,
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
    potentialModelId,
    getActualParentElementsPath,
  }: {
    potentialParentElementsPath: ParentElementsPath;
    potentialModelId: Id64String;
    getActualParentElementsPath: (potentialPath: ParentElementsPath) => ParentElementsPath;
  }): { parentElementsPath: ParentElementsPath; modelId: Id64String } {
    const parentElementsPath = getActualParentElementsPath(potentialParentElementsPath);
    const modelId =
      parentElementsPath.length === potentialParentElementsPath.length
        ? potentialModelId
        : ParentElementsPath.getSingleLastParentId(potentialParentElementsPath.slice(0, potentialParentElementsPath.length - parentElementsPath.length));
    assert(modelId !== undefined);
    return { parentElementsPath, modelId };
  }

  public convertNodesToSearchTargets(temporaryNodes: TemporaryNode[], processedNodes: ProcessedNodes): ModelsTreeSearchTargets | undefined {
    const internalSearchTargets: InternalSearchTargets = {};

    temporaryNodes.forEach((temporaryNode) => this.collectSearchTargets(internalSearchTargets, temporaryNode, processedNodes));

    return this.convertInternalSearchTargets(internalSearchTargets);
  }

  private convertInternalSearchTargetElements(internalSearchTargetElements: InternalSearchTargetElements): Required<ModelsTreeSearchTargets>["elements"] {
    const result: Required<ModelsTreeSearchTargets>["elements"] = [];
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
  ): Required<ModelsTreeSearchTargets>["categories"] {
    const result: Required<ModelsTreeSearchTargets>["categories"] = [];
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

  private convertInternalSearchTargets(searchTargets: InternalSearchTargets): ModelsTreeSearchTargets | undefined {
    if (!searchTargets.categories && !searchTargets.subjectIds && !searchTargets.elements && !searchTargets.modelIds) {
      return undefined;
    }

    return {
      categories: searchTargets.categories ? this.convertInternalSearchTargetCategories(searchTargets.categories) : undefined,
      elements: searchTargets.elements ? this.convertInternalSearchTargetElements(searchTargets.elements) : undefined,
      modelIds: searchTargets.modelIds,
      subjectIds: searchTargets.subjectIds,
    };
  }

  private collectSearchTargets(internalSearchTargets: InternalSearchTargets, temporaryNode: TemporaryNode, processedNodes: ProcessedNodes) {
    const searchResultsNode = temporaryNode.type === "element" ? processedNodes.allElements.get(temporaryNode.id) : temporaryNode;
    assert(searchResultsNode !== undefined);
    if (searchResultsNode.isSearchTarget) {
      if (searchResultsNode.type !== "category") {
        this.addInternalTarget(internalSearchTargets, searchResultsNode);
        return;
      }
      const categoryTargetNode = processedNodes.searchTargetCategories.get(temporaryNode.id);
      assert(categoryTargetNode !== undefined);
      // If category is a search target, all elements under it are also search targets, so no need to go through children.
      this.addInternalTarget(internalSearchTargets, categoryTargetNode);
      return;
    }

    if (searchResultsNode.type === "element") {
      // need to add parent ids as search target will be an element
      this.addInternalTarget(internalSearchTargets, searchResultsNode);
    }

    if (!temporaryNode.children) {
      return;
    }

    for (const child of temporaryNode.children.values()) {
      this.collectSearchTargets(internalSearchTargets, child, processedNodes);
    }
  }

  private addInternalTarget(internalSearchTargets: InternalSearchTargets, node: TemporarySubjectNode | TemporaryModelNode | CategoryNode | ElementNode) {
    switch (node.type) {
      case "subject": {
        (internalSearchTargets.subjectIds ??= new Set()).add(node.id);
        return;
      }
      case "model": {
        (internalSearchTargets.modelIds ??= new Set()).add(node.id);
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
    if (type === "subject" || type === "model") {
      return {
        id,
        isSearchTarget,
        type,
      };
    }

    if (type === "category") {
      if ("type" in parent && parent.type === "model") {
        return {
          id,
          isSearchTarget,
          type,
          potentialModelId: parent.id,
          potentialParentElementsPath: [],
        };
      }
      assert("type" in parent && parent.type === "element");
      return {
        id,
        isSearchTarget,
        type,
        potentialModelId: parent.potentialModelId,
        potentialParentElementsPath: ParentElementsPath.appendToPath({
          path: parent.potentialParentElementsPath,
          // Append a single id, there are assertions that check this
          ids: parent.id,
          categoryId: parent.categoryId,
        }),
      };
    }

    if ("type" in parent && parent.type === "category") {
      return {
        id,
        isSearchTarget,
        type,
        potentialModelId: parent.potentialModelId,
        categoryId: parent.id,
        potentialParentElementsPath: parent.potentialParentElementsPath,
      };
    }

    if ("type" in parent && parent.type === "element") {
      return {
        id,
        isSearchTarget,
        type,
        potentialModelId: parent.potentialModelId,
        categoryId: parent.categoryId,
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

  public async getType(className: EC.FullClassName): Promise<Node["type"]> {
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_Subject)) {
      return "subject";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_Model)) {
      return "model";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_Category)) {
      return "category";
    }
    return "element";
  }

  public getClassName(type: Node["type"]): EC.FullClassName {
    switch (type) {
      case "subject":
        return CLASS_NAME_Subject;
      case "model":
        return CLASS_NAME_Model;
      case "category":
        return CLASS_NAME_Category;
      default:
        return CLASS_NAME_GeometricElement3d;
    }
  }
}
