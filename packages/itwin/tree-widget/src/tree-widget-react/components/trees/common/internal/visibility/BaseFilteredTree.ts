/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { HierarchyFilteringPath, HierarchyNodeIdentifier, HierarchyNodeKey } from "@itwin/presentation-hierarchies";

import type { Id64String } from "@itwin/core-bentley";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";

/** @internal */
export type FilteredTreeNodeChildren<TFilteredTreeNode> = Map<Id64String, TFilteredTreeNode>;

/**
 * A generic interface for a filtered tree root node.
 *
 * It differs from `BaseFilteredTreeNode` in that it only contains children details and nothing else.
 * @internal
 */
export interface FilteredTreeRootNode<TFilteredTreeNode extends BaseFilteredTreeNode<TFilteredTreeNode>> {
  children: FilteredTreeNodeChildren<TFilteredTreeNode>;
}

/**
 * A generic interface for a filtered tree node.
 *
 * It represents every node in a filtered tree structure.
 * @internal
 * */
export interface BaseFilteredTreeNode<TFilteredTreeNode extends BaseFilteredTreeNode<TFilteredTreeNode>> {
  type: string;
  id: Id64String;
  children?: FilteredTreeNodeChildren<TFilteredTreeNode>;
  isFilterTarget: boolean;
}

/**
 * Class that provides methods to handle filtered nodes in a tree structure.
 *
 * It provides two methods that can be shared across different filtered trees:
 * - `processFilteredNodes` - processes filtered nodes and returns a function to get filter targets for a node.
 * - `accept` - accepts a new node and adds it to the tree structure.
 * @internal
 */
export abstract class FilteredNodesHandler<TProcessedFilteredNodes, TFilterTargets, TFilteredTreeNode extends BaseFilteredTreeNode<TFilteredTreeNode>> {
  public root: FilteredTreeRootNode<TFilteredTreeNode> = {
    children: new Map(),
  };
  public filteredNodesArr = new Array<TFilteredTreeNode>();

  /** Returns filtered tree node type based on its' className */
  public abstract getType(className: string): Promise<TFilteredTreeNode["type"]>;
  /** Converts nodes to filter targets */
  public abstract convertNodesToFilterTargets(filteredNodes: TFilteredTreeNode[], processedFilteredNodes: TProcessedFilteredNodes): TFilterTargets | undefined;
  /**
   * Processes filtered nodes.
   *
   * Nodes are created using filtering paths, and some information is not present in the filtering paths.
   * Because of this, some nodes may need to be processed to get additional information.
   *
   * E.g. Retrieving categoryId of elements can't be done using filtering paths.
   */
  public abstract getProcessedFilteredNodes(): Promise<TProcessedFilteredNodes>;
  /** Creates filtered nodes  */
  public abstract createFilteredTreeNode(props: {
    type: TFilteredTreeNode["type"];
    id: Id64String;
    isFilterTarget: boolean;
    parent: TFilteredTreeNode | FilteredTreeRootNode<TFilteredTreeNode>;
  }): TFilteredTreeNode;

  public async processFilteredNodes(): Promise<{ getNodeFilterTargets: (node: HierarchyNode) => TFilterTargets | undefined }> {
    const processedFilteredNodes = await this.getProcessedFilteredNodes();
    return {
      getNodeFilterTargets: (node: HierarchyNode) => this.getNodeFilterTargets(node, processedFilteredNodes),
    };
  }

  /** Takes a new node and adds it to the tree structure. */
  public async accept(props: {
    instanceKey: InstanceKey;
    parentNode: TFilteredTreeNode | FilteredTreeRootNode<TFilteredTreeNode>;
    isFilterTarget: boolean;
  }): Promise<TFilteredTreeNode> {
    const { instanceKey, parentNode, isFilterTarget } = props;
    const type = await this.getType(instanceKey.className);

    const newNode = this.createFilteredTreeNode({
      type,
      id: instanceKey.id,
      isFilterTarget,
      parent: parentNode,
    });
    (parentNode.children ??= new Map()).set(instanceKey.id, newNode);
    this.filteredNodesArr.push(newNode);
    return newNode;
  }

  /** Takes a specific node and gets all filter targets related to it. */
  private getNodeFilterTargets(node: HierarchyNode, processedFilteredNodes: TProcessedFilteredNodes): TFilterTargets | undefined {
    let lookupParents: Array<{ children?: Map<Id64String, TFilteredTreeNode> }> = [this.root];

    const nodeKey = node.key;
    if (!HierarchyNodeKey.isInstances(nodeKey)) {
      return undefined;
    }

    // find the filtered parent nodes of the `node`
    for (const parentKey of node.parentKeys) {
      if (!HierarchyNodeKey.isInstances(parentKey)) {
        continue;
      }

      // tree node might be merged from multiple instances. As filtered tree stores only one instance per node, we need to find all matching nodes
      // and use them when checking for matching node in one level deeper.
      const parentNodes = this.findMatchingFilteredNodes(lookupParents, parentKey.instanceKeys);
      if (parentNodes.length === 0) {
        return undefined;
      }
      lookupParents = parentNodes;
    }

    // find filtered nodes that match the `node`
    const filteredNodes = this.findMatchingFilteredNodes(lookupParents, nodeKey.instanceKeys);
    if (filteredNodes.length === 0) {
      return undefined;
    }

    return this.convertNodesToFilterTargets(filteredNodes, processedFilteredNodes);
  }

  /** Finds filtered nodes that match the given keys. */
  private findMatchingFilteredNodes(lookupParents: Array<{ children?: Map<Id64String, TFilteredTreeNode> }>, keys: InstanceKey[]) {
    return lookupParents
      .flatMap((lookup) => keys.map((key) => lookup.children?.get(key.id)))
      .filter((lookupNode): lookupNode is TFilteredTreeNode => lookupNode !== undefined);
  }
}

/** @internal */
export interface FilteredTree<TFilterTargets> {
  getFilterTargets: (node: HierarchyNode) => TFilterTargets | undefined;
}

/** @internal */
export interface CreateFilteredTreeProps<TProcessedFilteredNodes, TFilterTargets, TFilteredTreeNode extends BaseFilteredTreeNode<TFilteredTreeNode>> {
  filteredNodesHandler: FilteredNodesHandler<TProcessedFilteredNodes, TFilterTargets, TFilteredTreeNode>;
  filteringPaths: HierarchyFilteringPath[];
}

/**
 * Function iterates over filtering paths and creates uses `filteredNodesHandler` to create a filtered tree.
 * @internal
 */
export async function createFilteredTree<TProcessedFilteredNodes, TFilterTargets, TFilteredTreeNode extends BaseFilteredTreeNode<TFilteredTreeNode>>(
  props: CreateFilteredTreeProps<TProcessedFilteredNodes, TFilterTargets, TFilteredTreeNode>,
): Promise<FilteredTree<TFilterTargets>> {
  const { filteringPaths, filteredNodesHandler } = props;

  for (const filteringPath of filteringPaths) {
    const normalizedPath = HierarchyFilteringPath.normalize(filteringPath).path;

    let parentNode: FilteredTreeRootNode<TFilteredTreeNode> | TFilteredTreeNode = filteredNodesHandler.root;
    for (let i = 0; i < normalizedPath.length; ++i) {
      if ("type" in parentNode && "isFilterTarget" in parentNode && parentNode.isFilterTarget) {
        break;
      }

      const identifier = normalizedPath[i];

      if (!HierarchyNodeIdentifier.isInstanceNodeIdentifier(identifier)) {
        break;
      }

      const currentNode: TFilteredTreeNode | undefined = parentNode.children?.get(identifier.id);
      if (currentNode !== undefined) {
        parentNode = currentNode;
        continue;
      }
      parentNode = await filteredNodesHandler.accept({
        instanceKey: identifier,
        parentNode,
        isFilterTarget: i === normalizedPath.length - 1,
      });
    }
  }
  const processedFilteredNodes = await filteredNodesHandler.processFilteredNodes();
  return {
    getFilterTargets: (node: HierarchyNode) => processedFilteredNodes.getNodeFilterTargets(node),
  };
}
