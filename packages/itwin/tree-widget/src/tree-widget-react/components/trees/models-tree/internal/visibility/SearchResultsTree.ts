/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { CLASS_NAME_Category, CLASS_NAME_Model, CLASS_NAME_Subject } from "../../../common/internal/ClassNameDefinitions.js";
import { getOrCreate, ParentElementsPath } from "../../../common/internal/Utils.js";
import {
  addElementToInternalSearchTargets,
  createSearchResultsTree,
  flattenInternalSearchTargetCategories,
  flattenInternalSearchTargetElements,
  SearchResultsNodesHandler,
} from "../../../common/internal/visibility/BaseSearchResultsTree.js";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchySearchTree } from "@itwin/presentation-hierarchies";
import type { EC, ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { CategoryId, ElementId } from "../../../common/internal/Types.js";
import type {
  BaseSearchResultsTreeNode,
  InternalSearchTargetCategories,
  InternalSearchTargetElements,
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
    searchResultsNodesHandler: new ModelsTreeSearchResultsNodesHandler({ imodelAccess, idsCache: props.idsCache }),
    searchPaths,
  });
}

interface SubjectNode extends BaseSearchResultsTreeNode<Node> {
  type: "subject";
}

interface ModelNode extends BaseSearchResultsTreeNode<Node> {
  type: "model";
  parentCategoryId?: Id64String;
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

type RawSubjectNode = Omit<SubjectNode, "children"> & {
  children?: SearchResultsTreeNodeChildren<RawNode>;
};
type RawModelNode = Omit<ModelNode, "children"> & {
  children?: SearchResultsTreeNodeChildren<RawNode>;
};
type RawCategoryNode = Omit<CategoryNode, "children" | "parentElementsPath" | "modelId"> & {
  potentialModelId: Id64String;
  potentialParentElementsPath: ParentElementsPath;
  children?: SearchResultsTreeNodeChildren<RawNode>;
};

type RawElementNode = Omit<ElementNode, "children" | "modelId" | "parentElementsPath"> & {
  potentialModelId: Id64String;
  potentialParentElementsPath: ParentElementsPath;
  children?: SearchResultsTreeNodeChildren<RawNode>;
};

type RawNode = RawElementNode | RawModelNode | RawSubjectNode | RawCategoryNode;

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

interface ModelsTreeSearchResultsNodesHandlerProps {
  imodelAccess: ECClassHierarchyInspector;
  idsCache: ModelsTreeIdsCache;
}

class ModelsTreeSearchResultsNodesHandler extends SearchResultsNodesHandler<ProcessedNodes, ModelsTreeSearchTargets, RawNode> {
  readonly #props: ModelsTreeSearchResultsNodesHandlerProps;
  constructor(props: ModelsTreeSearchResultsNodesHandlerProps) {
    super();
    this.#props = props;
  }

  public async getProcessedNodes(): Promise<ProcessedNodes> {
    const rawElementsArray = new Array<Omit<RawElementNode, "children">>();
    const searchTargetCategories = new Array<RawCategoryNode>();
    const result: ProcessedNodes = {
      allElements: new Map(),
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

    const subModels = rawElementsArray.length === 0 ? new Set<Id64String>() : await firstValueFrom(this.#props.idsCache.getAllSubModels());
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

  public convertNodesToSearchTargets(rawNodes: RawNode[], processedNodes: ProcessedNodes): ModelsTreeSearchTargets | undefined {
    const internalSearchTargets: InternalSearchTargets = {};

    rawNodes.forEach((rawNode) => this.collectSearchTargets(internalSearchTargets, rawNode, processedNodes));

    return this.convertInternalSearchTargets(internalSearchTargets);
  }

  private convertInternalSearchTargets(searchTargets: InternalSearchTargets): ModelsTreeSearchTargets | undefined {
    if (!searchTargets.categories && !searchTargets.subjectIds && !searchTargets.elements && !searchTargets.modelIds) {
      return undefined;
    }

    return {
      categories: searchTargets.categories ? flattenInternalSearchTargetCategories(searchTargets.categories) : undefined,
      elements: searchTargets.elements ? flattenInternalSearchTargetElements(searchTargets.elements) : undefined,
      modelIds: searchTargets.modelIds,
      subjectIds: searchTargets.subjectIds,
    };
  }

  private collectSearchTargets(internalSearchTargets: InternalSearchTargets, rawNode: RawNode, processedNodes: ProcessedNodes) {
    const searchResultsNode = rawNode.type === "element" ? processedNodes.allElements.get(rawNode.id) : rawNode;
    assert(searchResultsNode !== undefined);
    if (searchResultsNode.isSearchTarget) {
      if (searchResultsNode.type !== "category") {
        this.addInternalTarget(internalSearchTargets, searchResultsNode);
        return;
      }
      const categoryTargetNode = processedNodes.searchTargetCategories.get(rawNode.id);
      assert(categoryTargetNode !== undefined);
      this.addInternalTarget(internalSearchTargets, categoryTargetNode);
      return;
    }

    if (searchResultsNode.type === "element") {
      // need to add parent ids as search target will be an element
      this.addInternalTarget(internalSearchTargets, searchResultsNode);
    }

    if (!rawNode.children) {
      return;
    }

    for (const child of rawNode.children.values()) {
      this.collectSearchTargets(internalSearchTargets, child, processedNodes);
    }
  }

  private addInternalTarget(internalSearchTargets: InternalSearchTargets, node: RawSubjectNode | RawModelNode | CategoryNode | ElementNode) {
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
        internalSearchTargets.elements ??= new Map();
        addElementToInternalSearchTargets(internalSearchTargets.elements, node);
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
    if (type === "subject") {
      return {
        id,
        isSearchTarget,
        type,
      };
    }
    if (type === "model") {
      if ("type" in parent && parent.type === "element") {
        // This is a sub-model
        return {
          type,
          parentCategoryId: parent.categoryId,
          id,
          isSearchTarget: false,
        };
      }
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

    assert("type" in parent, "element nodes must have a parent");
    if (parent.type === "category") {
      return {
        id,
        isSearchTarget,
        type,
        potentialModelId: parent.potentialModelId,
        categoryId: parent.id,
        potentialParentElementsPath: parent.potentialParentElementsPath,
      };
    }
    if (parent.type === "model") {
      // In this case parent is a sub-model
      return {
        id,
        isSearchTarget,
        type,
        potentialModelId: parent.id,
        categoryId: parent.parentCategoryId!,
        potentialParentElementsPath: [],
      };
    }

    assert(parent.type === "element", "element nodes must have a parent of type 'category' | 'model' or 'element'");
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
}
