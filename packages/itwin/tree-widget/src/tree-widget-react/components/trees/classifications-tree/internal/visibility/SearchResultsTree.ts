/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { CLASS_NAME_Classification, CLASS_NAME_ClassificationTable, CLASS_NAME_GeometricElement3d } from "../../../common/internal/ClassNameDefinitions.js";
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

interface ElementSearchResultsTreeNode extends BaseSearchResultsTreeNode<ElementSearchResultsTreeNode> {
  type: "element";
  categoryId: Id64String;
  modelId: Id64String;
  categoryOfTopMostParentElement: CategoryId;
}

type SearchResultsTreeNode = ClassificationTableSearchResultsTreeNode | ClassificationSearchResultsTreeNode | ElementSearchResultsTreeNode;

type TemporaryElementSearchResultsNode = Omit<ElementSearchResultsTreeNode, "modelId" | "categoryId" | "categoryOfTopMostParentElement" | "children"> & {
  modelId: Id64String | undefined;
  categoryId: Id64String | undefined;
  categoryOfTopMostParentElement: CategoryId | undefined;
  children?: SearchResultsTreeNodeChildren<TemporaryElementSearchResultsNode>;
};

type TemporarySearchResultsTreeNode = ClassificationTableSearchResultsTreeNode | ClassificationSearchResultsTreeNode | TemporaryElementSearchResultsNode;

/** @internal */
export interface ClassificationsTreeSearchTargets {
  elements?: Array<{
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
  elements?: SearchTargetsInternalElements;
  classificationTableIds?: Id64Set;
  classificationIds?: Id64Set;
}

interface ClassificationsTreeSearchResultsNodesHandlerProps {
  idsCache: ClassificationsTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
}

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

interface ProcessedSearchResultsNodes {
  searchResultsElements: Map<Id64String, Omit<ElementSearchResultsTreeNode, "children">>;
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
    const searchResultsTemporaryElements = new Map<Id64String, Omit<TemporaryElementSearchResultsNode, "children">>();
    const result: ProcessedSearchResultsNodes = {
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
  ): Required<ClassificationsTreeSearchTargets>["elements"] {
    const result: Required<ClassificationsTreeSearchTargets>["elements"] = [];
    // Internal search target elements are stored in a tree structure, need to convert that to array structure.
    for (const [identifierAsString, entry] of searchTargetsInternalElements) {
      const identifier = this.convertSearchResultsNodeIdentifierStringToHierarchyNodeIdentifier(identifierAsString);
      if (entry.modelCategoryElements) {
        for (const [modelCategoryKey, { elementsMap: elements, categoryOfTopMostParentElement }] of entry.modelCategoryElements) {
          const { modelId, categoryId } = this.parseModelCategoryKey(modelCategoryKey);
          result.push({
            pathToElements: [...currentPath, identifier],
            modelId,
            categoryId,
            elements,
            categoryOfTopMostParentElement,
            topMostParentElementId: entry.topMostParentElementId,
          });
        }
      }
      if (entry.children) {
        this.convertInternalSearchTargetElementsRecursively(entry.children, [...currentPath, identifier]).forEach((childValue) => result.push(childValue));
      }
    }
    return result;
  }

  private convertInternalSearchTargets(searchTargets: SearchTargetsInternal): ClassificationsTreeSearchTargets | undefined {
    if (!searchTargets.classificationIds && !searchTargets.classificationIds && !searchTargets.elements) {
      return undefined;
    }

    return {
      classificationIds: searchTargets.classificationIds,
      classificationTableIds: searchTargets.classificationIds,
      elements: searchTargets.elements ? this.convertInternalSearchTargetElementsRecursively(searchTargets.elements, []) : undefined,
    };
  }

  private collectSearchTargets(
    searchTargets: SearchTargetsInternal,
    node: TemporarySearchResultsTreeNode,
    processedSearchResultsNodes: ProcessedSearchResultsNodes,
  ) {
    const searchResultsNode = node.type === "element" ? processedSearchResultsNodes.searchResultsElements.get(node.id) : node;
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
      this.collectSearchTargets(searchTargets, child, processedSearchResultsNodes);
    }
  }

  private addTargetElement(searchTargets: SearchTargetsInternal, node: ElementSearchResultsTreeNode) {
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
      if (topMostParentElementId === undefined && node.type === "element") {
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
      case "element":
        this.addTargetElement(searchTargets, node);
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

  public async getType(className: string): Promise<TemporarySearchResultsTreeNode["type"]> {
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_ClassificationTable)) {
      return "classificationTable";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_Classification)) {
      return "classification";
    }
    return "element";
  }

  public getClassName(type: TemporarySearchResultsTreeNode["type"]): string {
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
