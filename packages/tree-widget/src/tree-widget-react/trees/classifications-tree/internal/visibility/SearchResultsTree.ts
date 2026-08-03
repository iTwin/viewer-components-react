/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { CLASS_NAME_Classification, CLASS_NAME_ClassificationTable } from "../../../../shared/internal/ClassNameDefinitions.js";
import { ParentElementsPath } from "../../../../shared/internal/Utils.js";
import {
  createSearchResultsTree,
  InternalSearchTargetElements,
  SearchResultsNodesHandler,
} from "../../../../shared/internal/visibility/BaseSearchResultsTree.js";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchySearchTree } from "@itwin/presentation-hierarchies";
import type { EC, ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { ElementId } from "../../../../shared/internal/Types.js";
import type {
  BaseSearchResultsTreeNode,
  SearchResultsTree,
  SearchResultsTreeNodeChildren,
  SearchResultsTreeRootNode,
} from "../../../../shared/internal/visibility/BaseSearchResultsTree.js";
import type { ClassificationsTreeIdsCache } from "../ClassificationsTreeIdsCache.js";

/** @internal */
export interface ClassificationsTreeSearchTargets {
  elements?: Array<{
    modelId: Id64String;
    categoryId: Id64String;
    searchTargetElements: Array<ElementId>;
    nonSearchTargetElements: Array<ElementId>;
    parentElementsPath: ParentElementsPath;
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
  parentElementsPath: ParentElementsPath;
}

type Node = ClassificationTableNode | ClassificationNode | ElementNode;

type RawClassificationTableNode = Omit<ClassificationTableNode, "children"> & {
  children?: SearchResultsTreeNodeChildren<RawNode>;
};

type RawClassificationNode = Omit<ClassificationNode, "children"> & {
  children?: SearchResultsTreeNodeChildren<RawNode>;
};

type RawElementNode = Omit<ElementNode, "modelId" | "categoryId" | "children" | "parentElementsPath"> & {
  modelId: Id64String | undefined;
  categoryId: Id64String | undefined;
  parentElementPathWithoutCategories: ParentElementsPath;
  children?: SearchResultsTreeNodeChildren<RawNode>;
};

type RawNode = RawClassificationTableNode | RawClassificationNode | RawElementNode;

interface InternalSearchTargets {
  elements?: InternalSearchTargetElements;
  classificationTableIds?: Id64Set;
  classificationIds?: Id64Set;
}

interface ProcessedNodes {
  searchResultsElements: Map<ElementId, Omit<ElementNode, "children">>;
}

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
    const rawElementsArray = new Array<Omit<RawElementNode, "children">>();
    const result: ProcessedNodes = {
      searchResultsElements: new Map(),
    };
    for (const node of this.searchResultsNodesArr) {
      if (node.type === "element") {
        rawElementsArray.push(node);
      }
    }

    const searchResultsElementsData = await firstValueFrom(
      this.#props.idsCache.getFilteredElementsData({
        elementIds: rawElementsArray.map((element) => element.id),
      }),
    );
    for (const element of rawElementsArray) {
      const entry = searchResultsElementsData.get(element.id);
      assert(entry !== undefined);
      let parentElementsPath: ParentElementsPath = [];
      for (const { elementIds } of element.parentElementPathWithoutCategories) {
        assert(elementIds.length === 1);
        const categoryId = searchResultsElementsData.get(elementIds[0])?.categoryId;
        assert(categoryId !== undefined);
        parentElementsPath = ParentElementsPath.appendToPath({
          path: parentElementsPath,
          ids: elementIds[0],
          categoryId,
        });
      }
      result.searchResultsElements.set(element.id, {
        ...element,
        modelId: entry.modelId,
        categoryId: entry.categoryId,
        parentElementsPath,
      });
    }
    return result;
  }

  public convertNodesToSearchTargets(rawNodes: RawNode[], processedNodes: ProcessedNodes): ClassificationsTreeSearchTargets | undefined {
    const internalSearchTargets: InternalSearchTargets = {};

    rawNodes.forEach((rawNode) => this.collectSearchTargets(internalSearchTargets, rawNode, processedNodes));

    return this.convertInternalSearchTargets(internalSearchTargets);
  }

  private convertInternalSearchTargets(searchTargets: InternalSearchTargets): ClassificationsTreeSearchTargets | undefined {
    if (!searchTargets.classificationTableIds && !searchTargets.classificationIds && !searchTargets.elements) {
      return undefined;
    }

    return {
      classificationTableIds: searchTargets.classificationTableIds,
      classificationIds: searchTargets.classificationIds,
      elements: searchTargets.elements ? InternalSearchTargetElements.flatten(searchTargets.elements) : undefined,
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

  private addInternalTarget(internalSearchTargets: InternalSearchTargets, node: RawClassificationTableNode | RawClassificationNode | ElementNode) {
    switch (node.type) {
      case "classificationTable":
        (internalSearchTargets.classificationTableIds ??= new Set()).add(node.id);
        return;
      case "classification":
        (internalSearchTargets.classificationIds ??= new Set()).add(node.id);
        return;
      case "element": {
        // Internal search target elements need to have path saved in some way.
        // For this, a tree structure is used, where keys are stringified identifiers of parent nodes depending on the hierarchy.
        internalSearchTargets.elements ??= new Map();
        InternalSearchTargetElements.addElement(internalSearchTargets.elements, node);
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
    if (type === "classificationTable" || type === "classification") {
      return {
        id,
        isSearchTarget,
        type,
      };
    }

    // type === "element"
    if ("type" in parent && parent.type === "element") {
      return {
        id,
        isSearchTarget,
        type,
        categoryId: undefined,
        modelId: undefined,
        parentElementPathWithoutCategories: ParentElementsPath.appendToPath({
          path: parent.parentElementPathWithoutCategories,
          ids: parent.id,
          categoryId: "", // Placeholder categoryId - real categories are resolved in getProcessedNodes() using searchResultsElementsData
        }),
      };
    }
    // Parent is classification or root
    return {
      id,
      isSearchTarget,
      type,
      categoryId: undefined,
      modelId: undefined,
      parentElementPathWithoutCategories: [],
    };
  }

  public async getType(className: EC.FullClassNameDotNotation): Promise<RawNode["type"]> {
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_ClassificationTable)) {
      return "classificationTable";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_Classification)) {
      return "classification";
    }
    return "element";
  }
}
