/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Id64 } from "@itwin/core-bentley";
import { HierarchyNode, HierarchyNodeIdentifier, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { getOrCreate, ParentElementsPath } from "../Utils.js";

import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { ClassGroupingNodeKey, HierarchySearchTree, InstancesNodeKey } from "@itwin/presentation-hierarchies";
import type { EC, InstanceKey } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId } from "../Types.js";

/** @internal */
export type SearchResultsTreeNodeChildren<TSearchResultsTreeNode> = Map<Id64String, TSearchResultsTreeNode>;

/**
 * A generic interface for a search results tree root node.
 *
 * It differs from `BaseSearchResultsTreeNode` in that it only contains children details and nothing else.
 * @internal
 */
export interface SearchResultsTreeRootNode<TSearchResultsTreeNode extends BaseSearchResultsTreeNode<TSearchResultsTreeNode>> {
  children: SearchResultsTreeNodeChildren<TSearchResultsTreeNode>;
}

/**
 * A generic interface for a search results tree node.
 *
 * It represents every node in a search results tree structure.
 * @internal
 * */
export interface BaseSearchResultsTreeNode<TSearchResultsTreeNode extends BaseSearchResultsTreeNode<TSearchResultsTreeNode>> {
  type: string;
  id: Id64String;
  children?: SearchResultsTreeNodeChildren<TSearchResultsTreeNode>;
  isSearchTarget: boolean;
}

/**
 * Class that provides methods to handle search results nodes in a tree structure.
 *
 * It provides two methods that can be shared across different search results trees:
 * - `processSearchResultsNodes` - processes search results nodes and returns a function to get search targets for a node.
 * - `accept` - accepts a new node and adds it to the tree structure.
 * @internal
 */
export abstract class SearchResultsNodesHandler<
  TProcessedSearchResultsNodes,
  TSearchTargets,
  TSearchResultsTreeNode extends BaseSearchResultsTreeNode<TSearchResultsTreeNode>,
> {
  public readonly root: SearchResultsTreeRootNode<TSearchResultsTreeNode> = {
    children: new Map(),
  };
  public readonly searchResultsNodesArr = new Array<TSearchResultsTreeNode>();

  /** Returns search results tree node type based on its' className */
  public abstract getType(className: EC.FullClassName): Promise<TSearchResultsTreeNode["type"]>;
  /** Converts nodes to search targets */
  public abstract convertNodesToSearchTargets(
    searchResultsNodes: TSearchResultsTreeNode[],
    processedSearchResultsNodes: TProcessedSearchResultsNodes,
  ): TSearchTargets | undefined;
  /**
   * Processes search results nodes.
   *
   * Nodes are created using search paths, and some information is not present in the search paths.
   * Because of this, some nodes may need to be processed to get additional information.
   *
   * E.g. Retrieving categoryId of elements can't be done using search paths.
   */
  public abstract getProcessedNodes(): Promise<TProcessedSearchResultsNodes>;
  /** Creates search results nodes  */
  public abstract createNode(props: {
    type: TSearchResultsTreeNode["type"];
    id: Id64String;
    isSearchTarget: boolean;
    parent: TSearchResultsTreeNode | SearchResultsTreeRootNode<TSearchResultsTreeNode>;
  }): TSearchResultsTreeNode;

  public async processSearchResultsNodes(): Promise<{
    getNodeSearchTargets: (node: HierarchyNode & { key: ClassGroupingNodeKey | InstancesNodeKey }) => TSearchTargets | undefined;
  }> {
    const processedSearchResultsNodes = await this.getProcessedNodes();
    return {
      getNodeSearchTargets: (node: HierarchyNode & { key: ClassGroupingNodeKey | InstancesNodeKey }) =>
        this.getNodeSearchTargets(node, processedSearchResultsNodes),
    };
  }

  /** Takes a new node and adds it to the tree structure. */
  public async accept(props: {
    instanceKey: InstanceKey;
    parentNode: TSearchResultsTreeNode | SearchResultsTreeRootNode<TSearchResultsTreeNode>;
    isSearchTarget: boolean;
  }): Promise<TSearchResultsTreeNode> {
    const { instanceKey, parentNode, isSearchTarget } = props;
    const type = await this.getType(instanceKey.className);

    const newNode = this.createNode({
      type,
      id: instanceKey.id,
      isSearchTarget,
      parent: parentNode,
    });
    (parentNode.children ??= new Map()).set(instanceKey.id, newNode);
    this.searchResultsNodesArr.push(newNode);
    return newNode;
  }

  /** Takes a specific node and gets all search targets related to it. */
  private getNodeSearchTargets(
    node: HierarchyNode & { key: ClassGroupingNodeKey | InstancesNodeKey },
    processedSearchResultsNodes: TProcessedSearchResultsNodes,
  ): TSearchTargets | undefined {
    let lookupParents: Array<SearchResultsTreeRootNode<TSearchResultsTreeNode> | TSearchResultsTreeNode> = [this.root];

    // find the search results parent nodes of the `node`
    for (const parentKey of node.parentKeys) {
      if (!HierarchyNodeKey.isInstances(parentKey)) {
        continue;
      }

      // tree node might be merged from multiple instances. As search results tree stores only one instance per node, we need to find all matching nodes
      // and use them when checking for matching node in one level deeper.
      const parentNodes = this.findMatchingSearchResultsNodes(
        lookupParents,
        parentKey.instanceKeys.map((key) => key.id),
      );
      if (parentNodes.length === 0) {
        return undefined;
      }
      lookupParents = parentNodes;
    }

    const ids = HierarchyNode.isInstancesNode(node) ? node.key.instanceKeys.map(({ id }) => id) : node.groupedInstanceKeys.map(({ id }) => id);
    // find search results nodes that match the `node`
    const searchResultsNodes = this.findMatchingSearchResultsNodes(lookupParents, ids);
    if (searchResultsNodes.length === 0) {
      return undefined;
    }

    return this.convertNodesToSearchTargets(searchResultsNodes, processedSearchResultsNodes);
  }

  /** Finds search results nodes that match the given keys. */
  private findMatchingSearchResultsNodes(lookupParents: Array<SearchResultsTreeRootNode<TSearchResultsTreeNode> | TSearchResultsTreeNode>, ids: Id64Arg) {
    return lookupParents.flatMap((lookup) => {
      const childrenArray = Array<TSearchResultsTreeNode>();
      for (const id of Id64.iterable(ids)) {
        const node = lookup.children?.get(id);
        if (node) {
          childrenArray.push(node);
        }
      }
      return childrenArray;
    });
  }
}

/** @internal */
export interface SearchResultsTree<TSearchTargets> {
  getSearchTargets: (node: HierarchyNode & { key: ClassGroupingNodeKey | InstancesNodeKey }) => TSearchTargets | undefined;
}

/** @internal */
export interface CreateSearchResultsTreeProps<
  TProcessedSearchResultsNodes,
  TSearchTargets,
  TSearchResultsTreeNode extends BaseSearchResultsTreeNode<TSearchResultsTreeNode>,
> {
  searchResultsNodesHandler: SearchResultsNodesHandler<TProcessedSearchResultsNodes, TSearchTargets, TSearchResultsTreeNode>;
  searchPaths: HierarchySearchTree[];
}

/**
 * Function iterates over search trees and uses `searchResultsNodesHandler` to create a search results tree.
 * @internal
 */
export async function createSearchResultsTree<
  TProcessedSearchResultsNodes,
  TSearchTargets,
  TSearchResultsTreeNode extends BaseSearchResultsTreeNode<TSearchResultsTreeNode>,
>(props: CreateSearchResultsTreeProps<TProcessedSearchResultsNodes, TSearchTargets, TSearchResultsTreeNode>): Promise<SearchResultsTree<TSearchTargets>> {
  const { searchPaths, searchResultsNodesHandler } = props;

  async function traverseTree(
    tree: HierarchySearchTree,
    parentNode: SearchResultsTreeRootNode<TSearchResultsTreeNode> | TSearchResultsTreeNode,
  ): Promise<void> {
    // If parent is already a search target, skip deeper nodes - we want to load all children for them.
    if ("type" in parentNode && "isSearchTarget" in parentNode && parentNode.isSearchTarget) {
      return;
    }

    const identifier = tree.identifier;
    if (!HierarchyNodeIdentifier.isInstanceNodeIdentifier(identifier)) {
      return;
    }

    const isTarget = tree.isTarget === true || !tree.children?.length;
    const currentNode =
      parentNode.children?.get(identifier.id) ??
      (await searchResultsNodesHandler.accept({
        instanceKey: identifier,
        parentNode,
        isSearchTarget: isTarget,
      }));

    // Do not descend into children once the current node is a search target.
    if (!currentNode.isSearchTarget && tree.children) {
      for (const child of tree.children) {
        await traverseTree(child, currentNode);
      }
    }
  }

  for (const tree of searchPaths) {
    await traverseTree(tree, searchResultsNodesHandler.root);
  }

  const processedSearchResultsNodes = await searchResultsNodesHandler.processSearchResultsNodes();
  return {
    getSearchTargets: (node: HierarchyNode & { key: ClassGroupingNodeKey | InstancesNodeKey }) => processedSearchResultsNodes.getNodeSearchTargets(node),
  };
}

/**
 * Shared type representing internal element search targets stored in a tree structure.
 * Used across models, categories, and classifications search results trees.
 * @internal
 */
export type InternalSearchTargetElements = Map<
  ModelId,
  Map<
    ElementId | undefined,
    {
      parentElementsPath: ParentElementsPath;
      elements: Map<CategoryId, { searchTargets: Array<ElementId>; nonSearchTargets: Array<ElementId> }>;
    }
  >
>;

/** @internal */
export interface SearchTargetElementEntry {
  modelId: Id64String;
  categoryId: Id64String;
  searchTargetElements: Array<ElementId>;
  nonSearchTargetElements: Array<ElementId>;
  parentElementsPath: ParentElementsPath;
}

/**
 * Converts the internal tree-structured element search targets into a flat array.
 * @internal
 */
export function convertInternalSearchTargetElements(internalSearchTargetElements: InternalSearchTargetElements): Array<SearchTargetElementEntry> {
  const result: Array<SearchTargetElementEntry> = [];
  for (const [modelId, modelEntry] of internalSearchTargetElements) {
    for (const { parentElementsPath, elements } of modelEntry.values()) {
      for (const [categoryId, { searchTargets, nonSearchTargets }] of elements) {
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

/**
 * Adds an element node to the internal search targets element map.
 * @internal
 */
export function addElementToInternalSearchTargets(
  internalSearchTargetElements: InternalSearchTargetElements,
  node: { id: ElementId; modelId: Id64String; categoryId: Id64String; parentElementsPath: ParentElementsPath; isSearchTarget: boolean },
): void {
  const modelEntry = getOrCreate({
    map: internalSearchTargetElements,
    key: node.modelId,
    createFunc: () =>
      new Map<
        ElementId | undefined,
        {
          parentElementsPath: ParentElementsPath;
          elements: Map<CategoryId, { searchTargets: Array<ElementId>; nonSearchTargets: Array<ElementId> }>;
        }
      >(),
  });
  const lastParentId = ParentElementsPath.getSingleLastParentId(node.parentElementsPath);
  const parentEntry = getOrCreate({
    map: modelEntry,
    key: lastParentId,
    createFunc: () => ({
      parentElementsPath: node.parentElementsPath,
      elements: new Map<
        CategoryId,
        {
          searchTargets: Array<ElementId>;
          nonSearchTargets: Array<ElementId>;
        }
      >(),
    }),
  });
  const categoryEntry = getOrCreate({ map: parentEntry.elements, key: node.categoryId, createFunc: () => ({ searchTargets: [], nonSearchTargets: [] }) });
  if (node.isSearchTarget) {
    categoryEntry.searchTargets.push(node.id);
  } else {
    categoryEntry.nonSearchTargets.push(node.id);
  }
}
