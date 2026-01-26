/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { assert } from "@itwin/core-bentley";
import {
  CLASS_NAME_Classification,
  CLASS_NAME_ClassificationTable,
  CLASS_NAME_GeometricElement2d,
  CLASS_NAME_GeometricElement3d,
} from "../../../common/internal/ClassNameDefinitions.js";
import { createSearchResultsTree, SearchResultsNodesHandler } from "../../../common/internal/visibility/BaseSearchResultsTree.js";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchySearchPath } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector, InstanceKey } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId } from "../../../common/internal/Types.js";
import type {
  BaseSearchResultsTreeNode,
  SearchResultsNodeIdentifierAsString,
  SearchResultsTree,
  SearchResultsTreeNodeChildren,
  SearchResultsTreeRootNode,
} from "../../../common/internal/visibility/BaseSearchResultsTree.js";
import type { ClassificationsTreeIdsCache } from "../ClassificationsTreeIdsCache.js";

interface ClassificationTableSearchResultsTreeNode extends BaseSearchResultsTreeNode<ClassificationTableSearchResultsTreeNode> {
  type: "classificationTable";
}

interface ClassificationSearchResultsTreeNode extends BaseSearchResultsTreeNode<ClassificationSearchResultsTreeNode> {
  type: "classification";
}

interface Element2dSearchResultsTreeNode extends BaseSearchResultsTreeNode<Element2dSearchResultsTreeNode> {
  type: "element2d";
  categoryId: Id64String;
  modelId: Id64String;
  categoryOfTopMostParentElement: CategoryId;
}

interface Element3dSearchResultsTreeNode extends BaseSearchResultsTreeNode<Element3dSearchResultsTreeNode> {
  type: "element3d";
  categoryId: Id64String;
  modelId: Id64String;
  categoryOfTopMostParentElement: CategoryId;
}

type SearchResultsTreeNode =
  | ClassificationTableSearchResultsTreeNode
  | ClassificationSearchResultsTreeNode
  | Element2dSearchResultsTreeNode
  | Element3dSearchResultsTreeNode;

type TemporaryElement2dSearchResultsNode = Omit<Element2dSearchResultsTreeNode, "modelId" | "categoryId" | "categoryOfTopMostParentElement" | "children"> & {
  modelId: Id64String | undefined;
  categoryId: Id64String | undefined;
  categoryOfTopMostParentElement: CategoryId | undefined;
  children?: SearchResultsTreeNodeChildren<TemporaryElement2dSearchResultsNode>;
};

type TemporaryElement3dSearchResultsNode = Omit<Element3dSearchResultsTreeNode, "modelId" | "categoryId" | "categoryOfTopMostParentElement" | "children"> & {
  modelId: Id64String | undefined;
  categoryId: Id64String | undefined;
  categoryOfTopMostParentElement: CategoryId | undefined;
  children?: SearchResultsTreeNodeChildren<TemporaryElement3dSearchResultsNode>;
};

type TemporarySearchResultsTreeNode =
  | ClassificationTableSearchResultsTreeNode
  | ClassificationSearchResultsTreeNode
  | TemporaryElement2dSearchResultsNode
  | TemporaryElement3dSearchResultsNode;

/** @internal */
export interface ClassificationsTreeSearchTargets {
  elements2d?: Array<{
    pathToElements: InstanceKey[];
    modelId: Id64String;
    categoryId: Id64String;
    topMostParentElementId?: Id64String;
    elements: Map<ElementId, { isSearchTarget: boolean }>;
    categoryOfTopMostParentElement: CategoryId;
  }>;
  elements3d?: Array<{
    pathToElements: InstanceKey[];
    modelId: Id64String;
    categoryId: Id64String;
    topMostParentElementId?: Id64String;
    elements: Map<ElementId, { isSearchTarget: boolean }>;
    categoryOfTopMostParentElement: CategoryId;
  }>;
  classificationTableIds?: Id64Set;
  classificationIds?: Id64Set;
}

/** @internal */
export async function createClassificationsSearchResultsTree(props: {
  imodelAccess: ECClassHierarchyInspector;
  searchPaths: HierarchySearchPath[];
  idsCache: ClassificationsTreeIdsCache;
}): Promise<SearchResultsTree<ClassificationsTreeSearchTargets>> {
  const { imodelAccess, searchPaths, idsCache } = props;
  return createSearchResultsTree({
    searchResultsNodesHandler: new ClassificationsTreeSearchResultsNodesHandler({ idsCache, imodelAccess }),
    searchPaths,
  });
}

type SearchTargetsInternalElements = Map<
  SearchResultsNodeIdentifierAsString,
  {
    children?: SearchTargetsInternalElements;
    topMostParentElementId?: Id64String;
    modelCategoryElements?: Map<ModelCategoryKey, { elementsMap: Map<ElementId, { isSearchTarget: boolean }>; categoryOfTopMostParentElement: CategoryId }>;
  }
>;
interface SearchTargetsInternal {
  elements2d?: SearchTargetsInternalElements;
  elements3d?: SearchTargetsInternalElements;
  classificationTableIds?: Id64Set;
  classificationIds?: Id64Set;
}

interface ClassificationsTreeSearchResultsNodesHandlerProps {
  idsCache: ClassificationsTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
}

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

interface ProcessedSearchResultsNodes {
  searchResults2dElements: Map<Id64String, Omit<Element2dSearchResultsTreeNode, "children">>;
  searchResults3dElements: Map<Id64String, Omit<Element3dSearchResultsTreeNode, "children">>;
}

class ClassificationsTreeSearchResultsNodesHandler extends SearchResultsNodesHandler<
  ProcessedSearchResultsNodes,
  ClassificationsTreeSearchTargets,
  TemporarySearchResultsTreeNode
> {
  readonly #props: ClassificationsTreeSearchResultsNodesHandlerProps;
  constructor(props: ClassificationsTreeSearchResultsNodesHandlerProps) {
    super();
    this.#props = props;
  }

  public async getProcessedSearchResultsNodes(): Promise<ProcessedSearchResultsNodes> {
    const searchResultsTemporary2dElements = new Map<Id64String, Omit<TemporaryElement2dSearchResultsNode, "children">>();
    const searchResultsTemporary3dElements = new Map<Id64String, Omit<TemporaryElement3dSearchResultsNode, "children">>();
    const result: ProcessedSearchResultsNodes = {
      searchResults2dElements: new Map(),
      searchResults3dElements: new Map(),
    };
    for (const node of this.searchResultsNodesArr) {
      if (node.type === "element2d") {
        searchResultsTemporary2dElements.set(node.id, node);
      } else if (node.type === "element3d") {
        searchResultsTemporary3dElements.set(node.id, node);
      }
    }

    const searchResultsElementsModels = await firstValueFrom(
      this.#props.idsCache.getFilteredElementsData({
        element2dIds: [...searchResultsTemporary2dElements.keys()],
        element3dIds: [...searchResultsTemporary3dElements.keys()],
      }),
    );
    searchResultsTemporary2dElements.forEach((element, id) => {
      const entry = searchResultsElementsModels.get(element.id);
      assert(entry !== undefined);
      result.searchResults2dElements.set(id, {
        ...element,
        modelId: entry.modelId,
        categoryId: entry.categoryId,
        categoryOfTopMostParentElement: entry.categoryOfTopMostParentElement,
      });
    });
    searchResultsTemporary3dElements.forEach((element, id) => {
      const entry = searchResultsElementsModels.get(element.id);
      assert(entry !== undefined);
      result.searchResults3dElements.set(id, {
        ...element,
        modelId: entry.modelId,
        categoryId: entry.categoryId,
        categoryOfTopMostParentElement: entry.categoryOfTopMostParentElement,
      });
    });
    return result;
  }

  public convertNodesToSearchTargets(
    searchResultsNodes: TemporarySearchResultsTreeNode[],
    processedSearchResultsNodes: ProcessedSearchResultsNodes,
  ): ClassificationsTreeSearchTargets | undefined {
    const searchTargets: SearchTargetsInternal = {};

    searchResultsNodes.forEach((searchResultsNode) => this.collectSearchTargets(searchTargets, searchResultsNode, processedSearchResultsNodes));

    return this.convertInternalSearchTargets(searchTargets);
  }

  private convertInternalSearchTargetElementsRecursively(
    searchTargetsInternalElements: SearchTargetsInternalElements,
    currentPath: InstanceKey[],
  ): Required<ClassificationsTreeSearchTargets>["elements2d" | "elements3d"] {
    const result: Required<ClassificationsTreeSearchTargets>["elements2d" | "elements3d"] = [];
    // Internal search target elements are stored in a tree structure, need to convert that to array structure.
    searchTargetsInternalElements.forEach((entry, identifierAsString) => {
      const identifier = this.convertSearchResultsNodeIdentifierStringToHierarchyNodeIdentifier(identifierAsString);
      if (entry.modelCategoryElements) {
        entry.modelCategoryElements.forEach(({ elementsMap: elements, categoryOfTopMostParentElement }, modelCategoryKey) => {
          const { modelId, categoryId } = this.parseModelCategoryKey(modelCategoryKey);
          result.push({
            pathToElements: [...currentPath, identifier],
            modelId,
            categoryId,
            elements,
            categoryOfTopMostParentElement,
            topMostParentElementId: entry.topMostParentElementId,
          });
        });
      }
      if (entry.children) {
        this.convertInternalSearchTargetElementsRecursively(entry.children, [...currentPath, identifier]).forEach((childValue) => result.push(childValue));
      }
    });
    return result;
  }

  private convertInternalSearchTargets(searchTargets: SearchTargetsInternal): ClassificationsTreeSearchTargets | undefined {
    if (!searchTargets.classificationIds && !searchTargets.classificationIds && !searchTargets.elements2d && !searchTargets.elements3d) {
      return undefined;
    }

    return {
      classificationIds: searchTargets.classificationIds,
      classificationTableIds: searchTargets.classificationIds,
      elements2d: searchTargets.elements2d ? this.convertInternalSearchTargetElementsRecursively(searchTargets.elements2d, []) : undefined,
      elements3d: searchTargets.elements3d ? this.convertInternalSearchTargetElementsRecursively(searchTargets.elements3d, []) : undefined,
    };
  }

  private collectSearchTargets(
    searchTargets: SearchTargetsInternal,
    node: TemporarySearchResultsTreeNode,
    processedSearchResultsNodes: ProcessedSearchResultsNodes,
  ) {
    const searchResultsNode =
      node.type === "element2d"
        ? processedSearchResultsNodes.searchResults2dElements.get(node.id)
        : node.type === "element3d"
          ? processedSearchResultsNodes.searchResults3dElements.get(node.id)
          : node;
    assert(searchResultsNode !== undefined);
    if (searchResultsNode.isSearchTarget) {
      this.addTarget(searchTargets, searchResultsNode);
      return;
    }

    if (searchResultsNode.type === "element2d" || searchResultsNode.type === "element3d") {
      // need to add parent ids as search target will be an element
      this.addTarget(searchTargets, searchResultsNode);
    }

    if (!node.children) {
      return;
    }

    for (const child of node.children.values()) {
      this.collectSearchTargets(searchTargets, child, processedSearchResultsNodes);
    }
  }

  private addTargetElement(
    searchTargets: SearchTargetsInternal,
    node: Element2dSearchResultsTreeNode | Element3dSearchResultsTreeNode,
    type: "element2d" | "element3d",
  ) {
    // Internal search target elements need to have path saved in some way.
    // For this, a tree structure is used, where keys are stringified identifiers of parent nodes depending on the hierarchy.
    const modelCategoryKey = this.createModelCategoryKey(node.modelId, node.categoryId);
    if (type === "element2d" && !searchTargets.elements2d) {
      searchTargets.elements2d = new Map();
    } else if (type === "element3d" && !searchTargets.elements3d) {
      searchTargets.elements3d = new Map();
    }
    const searchTargetElementsMap = type === "element2d" ? searchTargets.elements2d : searchTargets.elements3d;
    assert(searchTargetElementsMap !== undefined);
    let entry = searchTargetElementsMap;
    let topMostParentElementId: Id64String | undefined;
    for (let i = 0; i < node.pathToNode.length; ++i) {
      if (topMostParentElementId === undefined && (node.type === "element2d" || node.type === "element3d")) {
        topMostParentElementId = node.pathToNode[i].id;
      }
      const identifierAsString = this.convertSearchResultsNodeIdentifierToString(node.pathToNode[i]);
      let identifierEntry = entry.get(identifierAsString);
      // create a new entry for parent node if it does not exist
      if (!identifierEntry) {
        identifierEntry = { topMostParentElementId };
        entry.set(identifierAsString, identifierEntry);
      }
      // last entry in the path don't need to have children
      if (i < node.pathToNode.length - 1) {
        identifierEntry.children ??= new Map();
        entry = identifierEntry.children;
        continue;
      }

      const elements = (identifierEntry.modelCategoryElements ??= new Map()).get(modelCategoryKey);
      // Add elements who share the same path to the modelCategoryElements map
      if (elements) {
        elements.set(node.id, { isSearchTarget: node.isSearchTarget });
      } else {
        identifierEntry.modelCategoryElements.set(modelCategoryKey, {
          elementsMap: new Map([[node.id, { isSearchTarget: node.isSearchTarget }]]),
          categoryOfTopMostParentElement: node.categoryOfTopMostParentElement,
        });
      }
    }
  }

  private addTarget(searchTargets: SearchTargetsInternal, node: SearchResultsTreeNode) {
    switch (node.type) {
      case "classificationTable":
        (searchTargets.classificationTableIds ??= new Set()).add(node.id);
        return;
      case "classification":
        (searchTargets.classificationIds ??= new Set()).add(node.id);
        return;
      case "element2d":
        this.addTargetElement(searchTargets, node, "element2d");
        return;
      case "element3d":
        this.addTargetElement(searchTargets, node, "element3d");
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

  public createSearchResultsTreeNode({
    type,
    id,
    isSearchTarget,
    parent,
  }: {
    type: SearchResultsTreeNode["type"];
    id: Id64String;
    isSearchTarget: boolean;
    parent: SearchResultsTreeNode | SearchResultsTreeRootNode<SearchResultsTreeNode>;
  }): TemporarySearchResultsTreeNode {
    const pathToNode = "pathToNode" in parent ? [...parent.pathToNode, { type: parent.type, id: parent.id }] : [];
    if (type === "element2d" || type === "element3d") {
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

  public async getType(className: string): Promise<TemporarySearchResultsTreeNode["type"]> {
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_ClassificationTable)) {
      return "classificationTable";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_Classification)) {
      return "classification";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_GeometricElement2d)) {
      return "element2d";
    }
    return "element3d";
  }

  public getClassName(type: TemporarySearchResultsTreeNode["type"]): string {
    switch (type) {
      case "classificationTable":
        return CLASS_NAME_ClassificationTable;
      case "classification":
        return CLASS_NAME_Classification;
      case "element2d":
        return CLASS_NAME_GeometricElement2d;
      default:
        return CLASS_NAME_GeometricElement3d;
    }
  }
}
