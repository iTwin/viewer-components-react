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

/** @internal */
export interface FilteredTreeRootNode<TFilteredTreeNode extends BaseFilteredTreeNode<TFilteredTreeNode>> {
  children: FilteredTreeNodeChildren<TFilteredTreeNode>;
}

/** @internal */
export interface BaseFilteredTreeNode<TFilteredTreeNode extends BaseFilteredTreeNode<TFilteredTreeNode>> {
  type: string;
  id: Id64String;
  children?: FilteredTreeNodeChildren<TFilteredTreeNode>;
  isFilterTarget: boolean;
}

/** @internal */
export abstract class FilteredNodesHandler<
  TProcessedFilteredNodes extends { root: FilteredTreeRootNode<TFilteredTreeNode> },
  TFilterTargets,
  TFilteredTreeNode extends BaseFilteredTreeNode<TFilteredTreeNode>,
> {
  public abstract getType(className: string): Promise<TFilteredTreeNode["type"]>;
  public abstract convertNodesToFilterTargets(filteredNodes: TFilteredTreeNode[], processedFilteredNodes: TProcessedFilteredNodes): TFilterTargets | undefined;
  public abstract processFilteredNodes(nodes: TFilteredTreeNode[], root: FilteredTreeRootNode<TFilteredTreeNode>): Promise<TProcessedFilteredNodes>;
  public abstract createFilteredTreeNode(props: {
    type: TFilteredTreeNode["type"];
    id: Id64String;
    isFilterTarget: boolean;
    parent: TFilteredTreeNode | FilteredTreeRootNode<TFilteredTreeNode>;
  }): TFilteredTreeNode;
  public getNodeFilterTargets(node: HierarchyNode, processedFilteredNodes: TProcessedFilteredNodes): TFilterTargets | undefined {
    let lookupParents: Array<{ children?: Map<Id64String, TFilteredTreeNode> }> = [processedFilteredNodes.root];

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
export interface CreateFilteredTreeProps<
  TProcessedFilteredNodes extends { root: FilteredTreeRootNode<TFilteredTreeNode> },
  TFilterTargets,
  TFilteredTreeNode extends BaseFilteredTreeNode<TFilteredTreeNode>,
> {
  filteredNodesHandler: FilteredNodesHandler<TProcessedFilteredNodes, TFilterTargets, TFilteredTreeNode>;
  filteringPaths: HierarchyFilteringPath[];
}

/** @internal */
export async function createFilteredTree<
  TProcessedFilteredNodes extends { root: FilteredTreeRootNode<TFilteredTreeNode> },
  TFilterTargets,
  TFilteredTreeNode extends BaseFilteredTreeNode<TFilteredTreeNode>,
>(props: CreateFilteredTreeProps<TProcessedFilteredNodes, TFilterTargets, TFilteredTreeNode>): Promise<FilteredTree<TFilterTargets>> {
  const { filteringPaths, filteredNodesHandler } = props;
  const root: FilteredTreeRootNode<TFilteredTreeNode> = {
    children: new Map(),
  };
  const filteredNodesArr = new Array<TFilteredTreeNode>();

  for (const filteringPath of filteringPaths) {
    const normalizedPath = HierarchyFilteringPath.normalize(filteringPath).path;

    let parentNode: FilteredTreeRootNode<TFilteredTreeNode> | TFilteredTreeNode = root;
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

      const type = await filteredNodesHandler.getType(identifier.className);

      const newNode = filteredNodesHandler.createFilteredTreeNode({
        type,
        id: identifier.id,
        isFilterTarget: i === normalizedPath.length - 1,
        parent: parentNode,
      });
      (parentNode.children ??= new Map()).set(identifier.id, newNode);
      parentNode = newNode;
      filteredNodesArr.push(newNode);
    }
  }
  const processedFilteredNodes = await filteredNodesHandler.processFilteredNodes(filteredNodesArr, root);
  return {
    getFilterTargets: (node: HierarchyNode) => filteredNodesHandler.getNodeFilterTargets(node, processedFilteredNodes),
  };
}
