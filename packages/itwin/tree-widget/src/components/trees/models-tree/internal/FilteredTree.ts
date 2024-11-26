import type { Id64String } from "@itwin/core-bentley";
import { HierarchyFilteringPath, HierarchyNodeIdentifier, HierarchyNodeKey } from "@itwin/presentation-hierarchies";

import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";

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

export interface FilteredTree {
  getFilterTargets(node: HierarchyNode): FilterTargets;
}

export const SUBJECT_CLASS_NAME = "BisCore.Subject" as const;
export const MODEL_CLASS_NAME = "BisCore.GeometricModel3d" as const;
export const CATEGORY_CLASS_NAME = "BisCore.SpatialCategory" as const;
export const ELEMENT_CLASS_NAME = "BisCore.GeometricElement3d" as const;

type CategoryKey = `${Id64String}-${Id64String}`;

function createCategoryKey(modelId: string, categoryId: string): CategoryKey {
  return `${modelId}-${categoryId}`;
}

export function parseCategoryKey(key: CategoryKey) {
  const [modelId, categoryId] = key.split("-");
  return { modelId, categoryId };
}

interface FilterTargets {
  subjects?: Set<Id64String>;
  models?: Set<Id64String>;
  categories?: Set<CategoryKey>;
  elements?: Map<CategoryKey, Set<Id64String>>;
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
      const newNode: FilteredTreeNode = createFilteredTreeNode(type, identifier.id, i === normalizedPath.length - 1, parentNode as FilteredTreeNode);
      (parentNode.children ??= new Map()).set(identifier.id, newNode);
      parentNode = newNode;
    }
  }

  return {
    getFilterTargets: (node: HierarchyNode) => getFilterTargets(root, node),
  };
}

function getFilterTargets(root: FilteredTreeRootNode, node: HierarchyNode) {
  let currentNode: { children?: Map<Id64String, FilteredTreeNode> } = root;
  const filterTargets: FilterTargets = {};

  const nodeKey = node.key;
  if (!HierarchyNodeKey.isInstances(nodeKey)) {
    return filterTargets;
  }

  for (const parentKey of node.parentKeys) {
    if (!HierarchyNodeKey.isInstances(parentKey)) {
      continue;
    }

    const parentNode = currentNode.children?.get(parentKey.instanceKeys[0].id);
    if (!parentNode) {
      return filterTargets;
    }
    currentNode = parentNode;
  }

  const filteredNode = currentNode.children?.get(nodeKey.instanceKeys[0].id);
  if (!filteredNode) {
    return filterTargets;
  }

  collectFilterTargets(filterTargets, filteredNode);
  return filterTargets;
}

function collectFilterTargets(filterTargets: FilterTargets, node: FilteredTreeNode) {
  if (node.isFilterTarget) {
    addTarget(filterTargets, node);
    return;
  }

  if (node.type === "element") {
    // need to add parent ids as filter target will be an element
    addTarget(filterTargets, node);
  }

  if (!node.children) {
    return;
  }

  for (const child of node.children.values()) {
    collectFilterTargets(filterTargets, child);
  }
}

function addTarget(filterTargets: FilterTargets, node: FilteredTreeNode) {
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
        elements.add(node.id);
        return;
      }
      filterTargets.elements.set(categoryKey, new Set([node.id]));
      return;
  }
}


function createFilteredTreeNode(type: FilteredTreeNode["type"],
  id: string,
  isFilterTarget: boolean,
  parent: FilteredTreeNode,): FilteredTreeNode {
  if (type === "subject" || type === "model") {
    return {
      id,
      isFilterTarget,
      type,
    };
  }

  if (type === "category") {
    return {
      id,
      isFilterTarget,
      type,
      modelId: parent.id,
    };
  }

  if (parent.type === "category") {
    return {
      id,
      isFilterTarget,
      type,
      modelId: parent.modelId,
      categoryId: parent.id,
    };
  }

  if (parent.type === "element") {
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
