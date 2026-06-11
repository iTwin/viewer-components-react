/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { CLASS_NAME_Classification, CLASS_NAME_ClassificationTable, CLASS_NAME_GeometricElement3d } from "../../../common/internal/ClassNameDefinitions.js";
import { getOrCreate } from "../../../common/internal/Utils.js";
import { createSearchResultsTree, SearchResultsNodesHandler } from "../../../common/internal/visibility/BaseSearchResultsTree.js";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchySearchTree } from "@itwin/presentation-hierarchies";
import type { EC, ECClassHierarchyInspector, InstanceKey } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId } from "../../../common/internal/Types.js";
import type {
  BaseSearchResultsTreeNode,
  SearchResultsNodeIdentifierAsString,
  SearchResultsTree,
  SearchResultsTreeNodeChildren,
  SearchResultsTreeRootNode,
} from "../../../common/internal/visibility/BaseSearchResultsTree.js";
import type { ClassificationsTreeIdsCache } from "../ClassificationsTreeIdsCache.js";

/** @internal */
export interface ClassificationsTreeSearchTargets {
  elements?: Array<{
    pathToElements: InstanceKey[];
    modelId: Id64String;
    categoryId: Id64String;
    searchTargetElements: Array<ElementId>;
    nonSearchTargetElements: Array<ElementId>;
    topMostParentElementId?: Id64String;
    categoryOfTopMostParentElement: CategoryId;
  }>;
  classificationTableIds?: Id64Set;
  classificationIds?: Id64Set;
}

/** @internal */
export async function createClassificationsSearchResultsTree(props: {
  imodelAccess: ECClassHierarchyInspector;
  searchPaths: HierarchySearchTree[];
  idsCache: ClassificationsTreeIdsCache;
}): Promise<SearchResultsTree<ClassificationsTreeSearchTargets>> {
  const { imodelAccess, searchPaths, idsCache } = props;
  return createSearchResultsTree({
    searchResultsNodesHandler: new ClassificationsTreeSearchResultsNodesHandler({ idsCache, imodelAccess }),
    searchPaths,
  });
}

interface ClassificationTableNode extends BaseSearchResultsTreeNode<Node> {
  type: "classificationTable";
}

interface ClassificationNode extends BaseSearchResultsTreeNode<Node> {
  type: "classification";
}

interface ElementNode extends BaseSearchResultsTreeNode<Node> {
  type: "element";
  categoryId: Id64String;
  modelId: Id64String;
  categoryOfTopMostParentElement: CategoryId;
}

type Node = ClassificationTableNode | ClassificationNode | ElementNode;

type RawClassificationTableNode = Omit<ClassificationTableNode, "children"> & {
  children?: SearchResultsTreeNodeChildren<RawNode>;
};

type RawClassificationNode = Omit<ClassificationNode, "children"> & {
  children?: SearchResultsTreeNodeChildren<RawNode>;
};

type RawElementNode = Omit<ElementNode, "modelId" | "categoryId" | "children" | "categoryOfTopMostParentElement"> & {
  modelId: Id64String | undefined;
  categoryId: Id64String | undefined;
  categoryOfTopMostParentElement: CategoryId | undefined;
  children?: SearchResultsTreeNodeChildren<RawNode>;
};

type RawNode = RawClassificationTableNode | RawClassificationNode | RawElementNode;

type InternalSearchTargetElements = Map<
  SearchResultsNodeIdentifierAsString,
  {
    children?: InternalSearchTargetElements;
    topMostParentElementId?: Id64String;
    modelCategoryElements?: Map<
      ModelCategoryKey,
      { searchTargets: Array<ElementId>; nonSearchTargets: Array<ElementId>; categoryOfTopMostParentElement: CategoryId }
    >;
  }
>;

interface InternalSearchTargets {
  elements?: InternalSearchTargetElements;
  classificationTableIds?: Id64Set;
  classificationIds?: Id64Set;
}

interface ProcessedNodes {
  searchResultsElements: Map<ElementId, Omit<ElementNode, "children">>;
}

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

interface ClassificationsTreeSearchResultsNodesHandlerProps {
  idsCache: ClassificationsTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
}

class ClassificationsTreeSearchResultsNodesHandler extends SearchResultsNodesHandler<ProcessedNodes, ClassificationsTreeSearchTargets, RawNode> {
  readonly #props: ClassificationsTreeSearchResultsNodesHandlerProps;
  constructor(props: ClassificationsTreeSearchResultsNodesHandlerProps) {
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

    const searchResultsElementsModels = await firstValueFrom(
      this.#props.idsCache.getFilteredElementsData({
        elementIds: [...searchResultsTemporaryElements.keys()],
      }),
    );
    for (const [id, element] of searchResultsTemporaryElements) {
      const entry = searchResultsElementsModels.get(element.id);
      assert(entry !== undefined);
      result.searchResultsElements.set(id, {
        ...element,
        modelId: entry.modelId,
        categoryId: entry.categoryId,
        categoryOfTopMostParentElement: entry.categoryOfTopMostParentElement,
      });
    }
    return result;
  }

  public convertNodesToSearchTargets(rawNodes: RawNode[], processedNodes: ProcessedNodes): ClassificationsTreeSearchTargets | undefined {
    const internalSearchTargets: InternalSearchTargets = {};

    rawNodes.forEach((rawNode) => this.collectSearchTargets(internalSearchTargets, rawNode, processedNodes));

    return this.convertInternalSearchTargets(internalSearchTargets);
  }

  private convertInternalSearchTargetElementsRecursively(
    internalSearchTargetElements: InternalSearchTargetElements,
    currentPath: InstanceKey[],
  ): Required<ClassificationsTreeSearchTargets>["elements"] {
    const result: Required<ClassificationsTreeSearchTargets>["elements"] = [];
    // Internal search target elements are stored in a tree structure, need to convert that to array structure.
    for (const [identifierAsString, entry] of internalSearchTargetElements) {
      const identifier = this.convertSearchResultsNodeIdentifierStringToHierarchyNodeIdentifier(identifierAsString);
      if (entry.modelCategoryElements) {
        for (const [modelCategoryKey, { searchTargets, nonSearchTargets, categoryOfTopMostParentElement }] of entry.modelCategoryElements) {
          const { modelId, categoryId } = this.parseModelCategoryKey(modelCategoryKey);
          result.push({
            pathToElements: [...currentPath, identifier],
            modelId,
            categoryId,
            searchTargetElements: searchTargets,
            nonSearchTargetElements: nonSearchTargets,
            categoryOfTopMostParentElement,
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

  private convertInternalSearchTargets(searchTargets: InternalSearchTargets): ClassificationsTreeSearchTargets | undefined {
    if (!searchTargets.classificationTableIds && !searchTargets.classificationIds && !searchTargets.elements) {
      return undefined;
    }

    return {
      classificationIds: searchTargets.classificationIds,
      classificationTableIds: searchTargets.classificationTableIds,
      elements: searchTargets.elements ? this.convertInternalSearchTargetElementsRecursively(searchTargets.elements, []) : undefined,
    };
  }

  private collectSearchTargets(internalSearchTargets: InternalSearchTargets, node: RawNode, processedNodes: ProcessedNodes) {
    const searchResultsNode = node.type === "element" ? processedNodes.searchResultsElements.get(node.id) : node;
    assert(searchResultsNode !== undefined);
    if (searchResultsNode.isSearchTarget) {
      this.addInternalTarget(internalSearchTargets, searchResultsNode);
      return;
    }

    if (searchResultsNode.type === "element") {
      // need to add parent ids as search target will be an element
      this.addInternalTarget(internalSearchTargets, searchResultsNode);
    }

    if (!node.children) {
      return;
    }

    for (const child of node.children.values()) {
      this.collectSearchTargets(internalSearchTargets, child, processedNodes);
    }
  }

  private addTargetElement(searchTargets: InternalSearchTargets, node: ElementNode) {
    // Internal search target elements need to have path saved in some way.
    // For this, a tree structure is used, where keys are stringified identifiers of parent nodes depending on the hierarchy.
    const modelCategoryKey = this.createModelCategoryKey(node.modelId, node.categoryId);
    if (!searchTargets.elements) {
      searchTargets.elements = new Map();
    }
    const searchTargetElementsMap = searchTargets.elements;
    assert(searchTargetElementsMap !== undefined);
    let entry = searchTargetElementsMap;
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

      identifierEntry.modelCategoryElements ??= new Map();
      const elements = getOrCreate({
        key: modelCategoryKey,
        map: identifierEntry.modelCategoryElements,
        createFunc: () => ({
          searchTargets: [],
          nonSearchTargets: [],
          categoryOfTopMostParentElement: node.categoryOfTopMostParentElement,
        }),
      });
      // Add elements who share the same path to the modelCategoryElements map
      if (node.isSearchTarget) {
        elements.searchTargets.push(node.id);
      } else {
        elements.nonSearchTargets.push(node.id);
      }
    }
  }

  private addInternalTarget(internalSearchTargets: InternalSearchTargets, node: RawClassificationTableNode | RawClassificationNode | ElementNode) {
    switch (node.type) {
      case "classificationTable":
        (internalSearchTargets.classificationTableIds ??= new Set()).add(node.id);
        return;
      case "classification":
        (internalSearchTargets.classificationIds ??= new Set()).add(node.id);
        return;
      case "element":
        this.addTargetElement(internalSearchTargets, node);
        return;
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
    if (type === "element") {
      return {
        id,
        isSearchTarget,
        type,
        modelId: undefined,
        categoryId: undefined,
        categoryOfTopMostParentElement: undefined,
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

  public async getType(className: EC.FullClassName): Promise<RawNode["type"]> {
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_ClassificationTable)) {
      return "classificationTable";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_Classification)) {
      return "classification";
    }
    return "element";
  }

  public getClassName(type: RawNode["type"]): EC.FullClassName {
    switch (type) {
      case "classificationTable":
        return CLASS_NAME_ClassificationTable;
      case "classification":
        return CLASS_NAME_Classification;
      case "element":
        return CLASS_NAME_GeometricElement3d;
    }
  }
}
