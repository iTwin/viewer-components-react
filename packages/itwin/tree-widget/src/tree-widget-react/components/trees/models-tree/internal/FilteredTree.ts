/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert, Id64 } from "@itwin/core-bentley";
import { HierarchyFilteringPath, HierarchyNode, HierarchyNodeIdentifier, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { getIdsFromChildrenTree } from "../Utils.js";

import type { Id64Arg, Id64Set, Id64String } from "@itwin/core-bentley";
import type { ClassGroupingNodeKey, InstancesNodeKey } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { ChildrenTree } from "../Utils.js";

interface FilteredTreeRootNode {
  children: Map<Id64String, FilteredTreeNode>;
}

interface BaseFilteredTreeNode {
  id: string;
  children?: Map<Id64String, FilteredTreeNode>;
  isFilterTarget: boolean;
}

interface GenericFilteredTreeNode extends BaseFilteredTreeNode {
  type: "subject" | "model";
}

interface CategoryFilteredTreeNode extends BaseFilteredTreeNode {
  type: "category";
  modelId: Id64String;
}

interface ElementFilteredTreeNode extends BaseFilteredTreeNode {
  type: "element";
  modelId: Id64String;
  categoryId: Id64String;
}

type FilteredTreeNode = GenericFilteredTreeNode | CategoryFilteredTreeNode | ElementFilteredTreeNode;

interface GetElementsFromUnfilteredChildrenTreeProps {
  childrenTree: ChildrenTree;
  parentIdsPath: Array<Id64Arg>;
}

/** @internal */
export interface FilteredTree {
  getVisibilityChangeTargets(node: HierarchyNode & { key: ClassGroupingNodeKey | InstancesNodeKey }): VisibilityChangeTargets;
  getElementsFromUnfilteredChildrenTree(props: GetElementsFromUnfilteredChildrenTreeProps): Id64Set | undefined;
}

export const SUBJECT_CLASS_NAME = "BisCore.Subject" as const;
export const MODEL_CLASS_NAME = "BisCore.GeometricModel3d" as const;
export const CATEGORY_CLASS_NAME = "BisCore.SpatialCategory" as const;
export const ELEMENT_CLASS_NAME = "BisCore.GeometricElement3d" as const;

type CategoryKey = `${Id64String}-${Id64String}`;

function createCategoryKey(modelId: string, categoryId: string): CategoryKey {
  return `${modelId}-${categoryId}`;
}

/** @internal */
export function parseCategoryKey(key: CategoryKey) {
  const [modelId, categoryId] = key.split("-");
  return { modelId, categoryId };
}

/** @internal */
export interface VisibilityChangeTargets {
  subjects?: Set<Id64String>;
  models?: Set<Id64String>;
  categories?: Set<CategoryKey>;
  elements?: Map<CategoryKey, Map<Id64String, { isFilterTarget: boolean }>>;
}

/** @internal */
export async function createFilteredTree(imodelAccess: ECClassHierarchyInspector, filteringPaths: HierarchyFilteringPath[]): Promise<FilteredTree> {
  const root: FilteredTreeRootNode = {
    children: new Map(),
  };

  for (const filteringPath of filteringPaths) {
    const normalizedPath = HierarchyFilteringPath.normalize(filteringPath).path;

    let parentNode: FilteredTreeRootNode | FilteredTreeNode = root;
    for (let i = 0; i < normalizedPath.length; i++) {
      if ("type" in parentNode && parentNode.isFilterTarget) {
        break;
      }

      const identifier = normalizedPath[i];
      if (!HierarchyNodeIdentifier.isInstanceNodeIdentifier(identifier)) {
        break;
      }

      const currentNode: FilteredTreeNode | undefined = parentNode.children?.get(identifier.id);
      if (currentNode !== undefined) {
        parentNode = currentNode;
        continue;
      }

      const type = await getType(imodelAccess, identifier.className);
      const newNode: FilteredTreeNode = createFilteredTreeNode({
        type,
        id: identifier.id,
        isFilterTarget: i === normalizedPath.length - 1,
        parent: parentNode as FilteredTreeNode,
      });
      (parentNode.children ??= new Map()).set(identifier.id, newNode);
      parentNode = newNode;
    }
  }

  return {
    getVisibilityChangeTargets: (node) => getVisibilityChangeTargets(root, node),
    getElementsFromUnfilteredChildrenTree: ({ childrenTree, parentIdsPath }) => getElementsFromUnfilteredChildrenTree({ parentIdsPath, root, childrenTree }),
  };
}

/**
 * Unfiltered tree can contain ids of models/categories/elements which are not present in the filtered tree.
 * This function retrieves only those ids which are either filter tree targets, or are their children (direct and indirect).
 */
function getElementsFromUnfilteredChildrenTree(props: GetElementsFromUnfilteredChildrenTreeProps & { root: FilteredTreeRootNode }): Id64Set | undefined {
  if (props.childrenTree.size === 0 || props.parentIdsPath.length === 0) {
    return undefined;
  }

  let lookupParents: Array<FilteredTreeRootNode | FilteredTreeNode> = [props.root];
  for (const parentIds of props.parentIdsPath) {
    // When filtered node does not have children, it is filter target and because of this, all elements in the childrenTree are in the filtered tree
    if (lookupParents.every((parent) => !parent.children)) {
      return getIdsFromChildrenTree({ tree: props.childrenTree });
    }

    const parentNodes = findMatchingFilteredNodes(lookupParents, parentIds);
    if (parentNodes.length === 0) {
      return undefined;
    }
    lookupParents = parentNodes;
  }

  // We have unfiltered children tree and filtered nodes that are parents of first level nodes in unfiltered children tree.
  // We can start filtering unfiltered children tree based on filtered nodes.
  const result = getChildrenTreeIdsMatchingFilteredNodes({ tree: props.childrenTree, filteredNodes: lookupParents });
  return result.size > 0 ? result : undefined;
}

function getChildrenTreeIdsMatchingFilteredNodes({
  tree,
  filteredNodes,
}: {
  tree: ChildrenTree;
  filteredNodes: Array<FilteredTreeNode | FilteredTreeRootNode>;
}): Id64Set {
  const getIdsRecursively = (childrenTree: ChildrenTree, parentFilteredNodes: Array<FilteredTreeNode | FilteredTreeRootNode>): Id64Set => {
    // If one of the parent filtered nodes does not have children, it is filter target and because of this, all elements in the childrenTree are in the filtered tree.
    const hasParentFilterTarget = parentFilteredNodes.some(
      (filteredNode) => !filteredNode.children || ("isFilterTarget" in filteredNode && filteredNode.isFilterTarget),
    );
    if (hasParentFilterTarget) {
      return getIdsFromChildrenTree({ tree: childrenTree });
    }
    const result = new Set<Id64String>();
    childrenTree.forEach((entry, id) => {
      const nodes = findMatchingFilteredNodes(parentFilteredNodes, id);
      // If no filtered nodes match this id, skip it since it's not in the filtered tree.
      if (nodes.length === 0) {
        return;
      }
      // Id was found in filtered nodes children, add it to the result.
      result.add(id);
      if (entry.children) {
        // Continue recursively for children
        getIdsRecursively(entry.children, nodes).forEach((childId) => result.add(childId));
      }
    });
    return result;
  };

  return getIdsRecursively(tree, filteredNodes);
}

function getVisibilityChangeTargets(root: FilteredTreeRootNode, node: HierarchyNode & { key: ClassGroupingNodeKey | InstancesNodeKey }) {
  let lookupParents: Array<FilteredTreeRootNode | FilteredTreeNode> = [root];
  const changeTargets: VisibilityChangeTargets = {};

  // find the filtered parent nodes of the `node`
  for (const parentKey of node.parentKeys) {
    if (!HierarchyNodeKey.isInstances(parentKey)) {
      continue;
    }

    // tree node might be merged from multiple instances. As filtered tree stores only one instance per node, we need to find all matching nodes
    // and use them when checking for matching node in one level deeper.
    const parentNodes = findMatchingFilteredNodes(
      lookupParents,
      parentKey.instanceKeys.map((key) => key.id),
    );
    if (parentNodes.length === 0) {
      return changeTargets;
    }
    lookupParents = parentNodes;
  }
  const ids = HierarchyNode.isInstancesNode(node) ? node.key.instanceKeys.map(({ id }) => id) : node.groupedInstanceKeys.map(({ id }) => id);
  // find filtered nodes that match the `node`
  const filteredNodes = findMatchingFilteredNodes(lookupParents, ids);
  if (filteredNodes.length === 0) {
    return changeTargets;
  }

  filteredNodes.forEach((filteredNode) => collectVisibilityChangeTargets(changeTargets, filteredNode));
  return changeTargets;
}

function findMatchingFilteredNodes(lookupParents: Array<FilteredTreeRootNode | FilteredTreeNode>, ids: Id64Arg): Array<FilteredTreeNode> {
  return lookupParents.flatMap((lookup) => {
    const childrenArray = Array<FilteredTreeNode>();
    for (const id of Id64.iterable(ids)) {
      const node = lookup.children?.get(id);
      if (node) {
        childrenArray.push(node);
      }
    }
    return childrenArray;
  });
}

function collectVisibilityChangeTargets(changeTargets: VisibilityChangeTargets, node: FilteredTreeNode) {
  if (node.isFilterTarget) {
    addTarget(changeTargets, node);
    return;
  }

  if (node.type === "element") {
    // need to add parent ids as filter target will be an element
    addTarget(changeTargets, node);
  }

  if (!node.children) {
    return;
  }

  for (const child of node.children.values()) {
    collectVisibilityChangeTargets(changeTargets, child);
  }
}

function addTarget(filterTargets: VisibilityChangeTargets, node: FilteredTreeNode) {
  switch (node.type) {
    case "subject":
      (filterTargets.subjects ??= new Set()).add(node.id);
      return;
    case "model":
      (filterTargets.models ??= new Set()).add(node.id);
      return;
    case "category":
      (filterTargets.categories ??= new Set()).add(createCategoryKey(node.modelId, node.id));
      return;
    case "element":
      const categoryKey = createCategoryKey(node.modelId, node.categoryId);
      const elements = (filterTargets.elements ??= new Map()).get(categoryKey);
      if (elements) {
        elements.set(node.id, { isFilterTarget: node.isFilterTarget });
      } else {
        filterTargets.elements.set(categoryKey, new Map([[node.id, { isFilterTarget: node.isFilterTarget }]]));
      }
  }
}

function createFilteredTreeNode({
  type,
  id,
  isFilterTarget,
  parent,
}: {
  type: FilteredTreeNode["type"];
  id: string;
  isFilterTarget: boolean;
  parent: FilteredTreeNode | FilteredTreeRootNode;
}): FilteredTreeNode {
  if (type === "subject" || type === "model") {
    return {
      id,
      isFilterTarget,
      type,
    };
  }

  if (type === "category") {
    assert("type" in parent && parent.type === "model");
    return {
      id,
      isFilterTarget,
      type,
      modelId: parent.id,
    };
  }

  if ("type" in parent && parent.type === "category") {
    return {
      id,
      isFilterTarget,
      type,
      modelId: parent.modelId,
      categoryId: parent.id,
    };
  }

  if ("type" in parent && parent.type === "element") {
    return {
      id,
      isFilterTarget,
      type,
      modelId: parent.modelId,
      categoryId: parent.categoryId,
    };
  }

  throw new Error("Invalid parent node type");
}

async function getType(hierarchyChecker: ECClassHierarchyInspector, className: string) {
  if (await hierarchyChecker.classDerivesFrom(className, SUBJECT_CLASS_NAME)) {
    return "subject";
  }
  if (await hierarchyChecker.classDerivesFrom(className, MODEL_CLASS_NAME)) {
    return "model";
  }
  if (await hierarchyChecker.classDerivesFrom(className, CATEGORY_CLASS_NAME)) {
    return "category";
  }
  return "element";
}
