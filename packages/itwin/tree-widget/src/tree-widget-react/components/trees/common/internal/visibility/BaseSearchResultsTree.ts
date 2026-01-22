/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Id64 } from "@itwin/core-bentley";
import { HierarchyNode, HierarchyNodeIdentifier, HierarchyNodeKey, HierarchySearchPath } from "@itwin/presentation-hierarchies";
import { getIdsFromChildrenTree } from "../Utils.js";

import type { Id64Arg, Id64Set, Id64String } from "@itwin/core-bentley";
import type { ClassGroupingNodeKey, InstancesNodeKey } from "@itwin/presentation-hierarchies";
import type { InstanceKey, Props } from "@itwin/presentation-shared";
import type { MapEntry } from "../AlwaysAndNeverDrawnElementInfo.js";
import type { ChildrenTree } from "../Utils.js";

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

type SearchResultsNodeType = string;
type SearchResultsNodeId = Id64String;

/** @internal */
export interface SearchResultsNodeIdentifier {
  type: SearchResultsNodeType;
  id: SearchResultsNodeId;
}
/** @internal */
export type SearchResultsNodeIdentifierAsString = `${SearchResultsNodeType}-${SearchResultsNodeId}`;

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
  /** Represents the path from the root to this node. It depends on the hierarchy structure. */
  pathToNode: Array<SearchResultsNodeIdentifier>;
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
  public abstract getType(className: string): Promise<TSearchResultsTreeNode["type"]>;
  /** Returns search results tree node className based on its' type */
  public abstract getClassName(type: TSearchResultsTreeNode["type"]): string;
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
  public abstract getProcessedSearchResultsNodes(): Promise<TProcessedSearchResultsNodes>;
  /** Creates search results nodes  */
  public abstract createSearchResultsTreeNode(props: {
    type: TSearchResultsTreeNode["type"];
    id: Id64String;
    isSearchTarget: boolean;
    parent: TSearchResultsTreeNode | SearchResultsTreeRootNode<TSearchResultsTreeNode>;
  }): TSearchResultsTreeNode;

  public async processSearchResultsNodes(): Promise<{
    getNodeSearchTargets: (node: HierarchyNode & { key: ClassGroupingNodeKey | InstancesNodeKey }) => TSearchTargets | undefined;
    getChildrenTreeIdsBasedOnSearchResultsNodes: (props: {
      pathToChildrenTree: InstanceKey[];
      unfilteredChildrenTree: ChildrenTree<MapEntry>;
      childrenTreePredicate: Required<Props<typeof getIdsFromChildrenTree<MapEntry>>>["predicate"];
    }) => Id64Set;
  }> {
    const processedSearchResultsNodes = await this.getProcessedSearchResultsNodes();
    return {
      getNodeSearchTargets: (node: HierarchyNode & { key: ClassGroupingNodeKey | InstancesNodeKey }) =>
        this.getNodeSearchTargets(node, processedSearchResultsNodes),
      getChildrenTreeIdsBasedOnSearchResultsNodes: (props: {
        pathToChildrenTree: InstanceKey[];
        unfilteredChildrenTree: ChildrenTree<MapEntry>;
        childrenTreePredicate: Required<Props<typeof getIdsFromChildrenTree<MapEntry>>>["predicate"];
      }) => {
        const { pathToChildrenTree, unfilteredChildrenTree, childrenTreePredicate } = props;
        let lookupParent: SearchResultsTreeRootNode<TSearchResultsTreeNode> | TSearchResultsTreeNode = this.root;
        for (const instanceKey of pathToChildrenTree) {
          const node: TSearchResultsTreeNode | undefined = lookupParent.children?.get(instanceKey.id);
          if (!node) {
            return new Set<Id64String>();
          }
          if (node.isSearchTarget) {
            return getIdsFromChildrenTree({ tree: unfilteredChildrenTree, predicate: childrenTreePredicate });
          }
          lookupParent = node;
        }
        // We have unfiltered children tree and filtered nodes that are parents of first level nodes in unfiltered children tree.
        // We can start filtering unfiltered children tree based on filtered nodes.
        return this.getChildrenTreeIdsMatchingSearchResultsNodes({
          tree: unfilteredChildrenTree,
          parentSearchResultsNode: lookupParent,
          childrenTreePredicate,
        });
      },
    };
  }

  /** Recursively gets children ids from children tree that match search results nodes and predicate. */
  private getChildrenTreeIdsMatchingSearchResultsNodes({
    tree,
    parentSearchResultsNode,
    childrenTreePredicate,
  }: {
    tree: ChildrenTree<MapEntry>;
    parentSearchResultsNode: TSearchResultsTreeNode | SearchResultsTreeRootNode<TSearchResultsTreeNode>;
    childrenTreePredicate: Required<Props<typeof getIdsFromChildrenTree<MapEntry>>>["predicate"];
  }): Id64Set {
    const getIdsRecursively = (
      childrenTree: ChildrenTree<MapEntry>,
      parentSearchResultsNodes: Array<TSearchResultsTreeNode | SearchResultsTreeRootNode<TSearchResultsTreeNode>>,
      depth: number,
    ): Id64Set => {
      const hasParentSearchTarget = parentSearchResultsNodes.some(
        (searchResultsNode) => "isSearchTarget" in searchResultsNode && searchResultsNode.isSearchTarget,
      );
      if (hasParentSearchTarget) {
        return getIdsFromChildrenTree({ tree: childrenTree, predicate: childrenTreePredicate });
      }
      const result = new Set<Id64String>();
      childrenTree.forEach((entry, id) => {
        const nodes = this.findMatchingSearchResultsNodes(parentSearchResultsNodes, id);
        // If no search result nodes match this id, skip it since it's not in the search results tree.
        if (nodes.length === 0) {
          return;
        }
        if (childrenTreePredicate({ treeEntry: entry, depth })) {
          // Id was found in search result nodes children and it matches the predicate, add it to the result.
          result.add(id);
        }
        if (entry.children) {
          // Continue recursively for children
          getIdsRecursively(entry.children, nodes, depth + 1).forEach((childId) => result.add(childId));
        }
      });
      return result;
    };

    return getIdsRecursively(tree, [parentSearchResultsNode], 0);
  }

  /** Converts a search results node identifier to a string representation. */
  public convertSearchResultsNodeIdentifierToString(identifier: SearchResultsNodeIdentifier): SearchResultsNodeIdentifierAsString {
    return `${identifier.type}-${identifier.id}`;
  }

  /** Converts a string representation of a search results node identifier back to a hierarchy node identifier. */
  public convertSearchResultsNodeIdentifierStringToHierarchyNodeIdentifier(identifier: SearchResultsNodeIdentifierAsString): InstanceKey {
    const [type, id] = identifier.split("-");
    return { className: this.getClassName(type), id };
  }

  /** Takes a new node and adds it to the tree structure. */
  public async accept(props: {
    instanceKey: InstanceKey;
    parentNode: TSearchResultsTreeNode | SearchResultsTreeRootNode<TSearchResultsTreeNode>;
    isSearchTarget: boolean;
  }): Promise<TSearchResultsTreeNode> {
    const { instanceKey, parentNode, isSearchTarget } = props;
    const type = await this.getType(instanceKey.className);

    const newNode = this.createSearchResultsTreeNode({
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
  getChildrenTreeIdsBasedOnSearchResultsNodes: (props: {
    pathToChildrenTree: InstanceKey[];
    unfilteredChildrenTree: ChildrenTree<MapEntry>;
    childrenTreePredicate: Required<Props<typeof getIdsFromChildrenTree<MapEntry>>>["predicate"];
  }) => Id64Set;
}

/** @internal */
export interface CreateSearchResultsTreeProps<
  TProcessedSearchResultsNodes,
  TSearchTargets,
  TSearchResultsTreeNode extends BaseSearchResultsTreeNode<TSearchResultsTreeNode>,
> {
  searchResultsNodesHandler: SearchResultsNodesHandler<TProcessedSearchResultsNodes, TSearchTargets, TSearchResultsTreeNode>;
  searchPaths: HierarchySearchPath[];
}

/**
 * Function iterates over search paths and uses `searchResultsNodesHandler` to create a search results tree.
 * @internal
 */
export async function createSearchResultsTree<
  TProcessedSearchResultsNodes,
  TSearchTargets,
  TSearchResultsTreeNode extends BaseSearchResultsTreeNode<TSearchResultsTreeNode>,
>(props: CreateSearchResultsTreeProps<TProcessedSearchResultsNodes, TSearchTargets, TSearchResultsTreeNode>): Promise<SearchResultsTree<TSearchTargets>> {
  const { searchPaths, searchResultsNodesHandler } = props;

  for (const searchPath of searchPaths) {
    const normalizedPath = HierarchySearchPath.normalize(searchPath).path;

    let parentNode: SearchResultsTreeRootNode<TSearchResultsTreeNode> | TSearchResultsTreeNode = searchResultsNodesHandler.root;
    for (let i = 0; i < normalizedPath.length; ++i) {
      if ("type" in parentNode && "isSearchTarget" in parentNode && parentNode.isSearchTarget) {
        break;
      }

      const identifier = normalizedPath[i];

      if (!HierarchyNodeIdentifier.isInstanceNodeIdentifier(identifier)) {
        break;
      }

      const currentNode: TSearchResultsTreeNode | undefined = parentNode.children?.get(identifier.id);
      if (currentNode !== undefined) {
        parentNode = currentNode;
        continue;
      }
      parentNode = await searchResultsNodesHandler.accept({
        instanceKey: identifier,
        parentNode,
        isSearchTarget: i === normalizedPath.length - 1,
      });
    }
  }
  const processedSearchResultsNodes = await searchResultsNodesHandler.processSearchResultsNodes();
  return {
    getSearchTargets: (node: HierarchyNode & { key: ClassGroupingNodeKey | InstancesNodeKey }) => processedSearchResultsNodes.getNodeSearchTargets(node),
    getChildrenTreeIdsBasedOnSearchResultsNodes: (fnProps: {
      pathToChildrenTree: InstanceKey[];
      unfilteredChildrenTree: ChildrenTree<MapEntry>;
      childrenTreePredicate: Required<Props<typeof getIdsFromChildrenTree<MapEntry>>>["predicate"];
    }) => processedSearchResultsNodes.getChildrenTreeIdsBasedOnSearchResultsNodes(fnProps),
  };
}
