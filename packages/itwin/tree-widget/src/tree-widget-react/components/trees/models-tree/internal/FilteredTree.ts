/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { HierarchyFilteringPath, HierarchyNodeIdentifier, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { MODEL_3D_CLASS_NAME, SPATIAL_CATEGORY_CLASS_NAME, SUBJECT_CLASS_NAME } from "../../common/internal/ClassNames.js";

import type { Id64String } from "@itwin/core-bentley";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector, InstanceKey } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId, ParentId, SubjectId } from "../../common/internal/Types.js";

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
  modelId: ModelId;
  parentId: ParentId | undefined;
}

interface ElementFilteredTreeNode extends BaseFilteredTreeNode {
  type: "element";
  modelId: ModelId;
  categoryId: CategoryId;
  parentId: ParentId | undefined;
}

type FilteredTreeNode = GenericFilteredTreeNode | CategoryFilteredTreeNode | ElementFilteredTreeNode;

export interface FilteredTree {
  getVisibilityChangeTargets(node: HierarchyNode): VisibilityChangeTargets;
}

type CategoryKey = `${ModelId}-${ParentId}-${CategoryId}`;

function createCategoryKey(modelId: ModelId, categoryId: CategoryId, parentId: ParentId | undefined): CategoryKey {
  return `${modelId}-${parentId ?? ""}-${categoryId}`;
}

export function parseCategoryKey(key: CategoryKey) {
  const [modelId, parentId, categoryId] = key.split("-");
  return { modelId, categoryId, parentId: parentId !== "" ? parentId : undefined };
}

interface VisibilityChangeTargets {
  subjects?: Set<SubjectId>;
  models?: Set<ModelId>;
  categories?: Set<CategoryKey>;
  elements?: Map<CategoryKey, Set<ElementId>>;
}

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
    getVisibilityChangeTargets: (node: HierarchyNode) => getVisibilityChangeTargets(root, node),
  };
}

function getVisibilityChangeTargets(root: FilteredTreeRootNode, node: HierarchyNode) {
  let lookupParents: Array<{ children?: Map<Id64String, FilteredTreeNode> }> = [root];
  const changeTargets: VisibilityChangeTargets = {};

  const nodeKey = node.key;
  if (!HierarchyNodeKey.isInstances(nodeKey)) {
    return changeTargets;
  }

  // find the filtered parent nodes of the `node`
  for (const parentKey of node.parentKeys) {
    if (!HierarchyNodeKey.isInstances(parentKey)) {
      continue;
    }

    // tree node might be merged from multiple instances. As filtered tree stores only one instance per node, we need to find all matching nodes
    // and use them when checking for matching node in one level deeper.
    const parentNodes = findMatchingFilteredNodes(lookupParents, parentKey.instanceKeys);
    if (parentNodes.length === 0) {
      return changeTargets;
    }
    lookupParents = parentNodes;
  }

  // find filtered nodes that match the `node`
  const filteredNodes = findMatchingFilteredNodes(lookupParents, nodeKey.instanceKeys);
  if (filteredNodes.length === 0) {
    return changeTargets;
  }

  filteredNodes.forEach((filteredNode) => collectVisibilityChangeTargets(changeTargets, filteredNode));
  return changeTargets;
}

function findMatchingFilteredNodes(lookupParents: Array<{ children?: Map<Id64String, FilteredTreeNode> }>, keys: InstanceKey[]) {
  return lookupParents
    .flatMap((lookup) => keys.map((key) => lookup.children?.get(key.id)))
    .filter((lookupNode): lookupNode is FilteredTreeNode => lookupNode !== undefined);
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
      (filterTargets.categories ??= new Set()).add(createCategoryKey(node.modelId, node.id, node.parentId));
      return;
    case "element":
      const categoryKey = createCategoryKey(node.modelId, node.categoryId, node.parentId);
      const elements = (filterTargets.elements ??= new Map()).get(categoryKey);
      if (elements) {
        elements.add(node.id);
        return;
      }
      filterTargets.elements.set(categoryKey, new Set([node.id]));
      return;
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
    assert("id" in parent);
    return {
      id,
      isFilterTarget,
      type,
      modelId: "modelId" in parent ? parent.modelId : parent.id,
      parentId: parent.id,
    };
  }

  if ("type" in parent && parent.type === "category") {
    return {
      id,
      isFilterTarget,
      type,
      modelId: parent.modelId,
      categoryId: parent.id,
      parentId: parent.parentId,
    };
  }

  if ("type" in parent && parent.type === "element") {
    return {
      id,
      isFilterTarget,
      type,
      modelId: parent.modelId,
      categoryId: parent.categoryId,
      parentId: parent.id,
    };
  }

  throw new Error("Invalid parent node type");
}

async function getType(hierarchyChecker: ECClassHierarchyInspector, className: string) {
  if (await hierarchyChecker.classDerivesFrom(className, SUBJECT_CLASS_NAME)) {
    return "subject";
  }
  if (await hierarchyChecker.classDerivesFrom(className, MODEL_3D_CLASS_NAME)) {
    return "model";
  }
  if (await hierarchyChecker.classDerivesFrom(className, SPATIAL_CATEGORY_CLASS_NAME)) {
    return "category";
  }
  return "element";
}
