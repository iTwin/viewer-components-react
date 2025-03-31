/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { HierarchyFilteringPath, HierarchyNodeIdentifier, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { SUB_CATEGORY_CLASS_NAME } from "../../common/internal/ClassNameDefinitions.js";

import type { Id64String } from "@itwin/core-bentley";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector, InstanceKey } from "@itwin/presentation-shared";
import type { CategoriesTreeIdsCache } from "./CategoriesTreeIdsCache.js";

interface FilteredTreeRootNode {
  children: Map<Id64String, FilteredTreeNode>;
}

interface BaseFilteredTreeNode {
  id: string;
  children?: Map<Id64String, FilteredTreeNode>;
  isFilterTarget: boolean;
}

interface CategoryFilteredTreeNode extends BaseFilteredTreeNode {
  type: "category";
  modelId?: Id64String;
}

interface ModelFilteredTreeNode extends BaseFilteredTreeNode {
  type: "model";
  categoryId?: Id64String;
}
interface SubCategoryFilteredTreeNode extends BaseFilteredTreeNode {
  type: "subCategory";
  categoryId: Id64String;
}

interface DefinitionContainerFilteredTreeNode extends BaseFilteredTreeNode {
  type: "definitionContainer";
}

interface ElementFilteredTreeNode extends BaseFilteredTreeNode {
  type: "element";
  categoryId: Id64String;
  modelId?: Id64String;
}

type FilteredTreeNode =
  | DefinitionContainerFilteredTreeNode
  | SubCategoryFilteredTreeNode
  | CategoryFilteredTreeNode
  | ElementFilteredTreeNode
  | ModelFilteredTreeNode;

export interface FilteredTree {
  getVisibilityChangeTargets(node: HierarchyNode): VisibilityChangeTargets;
}

type CategoryKey = `${Id64String}-${Id64String}`;
type SubCategoryKey = `${Id64String}-${Id64String}`;

function createCategoryKey(modelId: string | undefined, categoryId: string): CategoryKey {
  return `${modelId ?? ""}-${categoryId}`;
}

function createSubCategoryKey(categoryId: string, subCategoryId: string): SubCategoryKey {
  return `${categoryId}-${subCategoryId}`;
}

export function parseCategoryKey(key: CategoryKey): { modelId: Id64String | undefined; categoryId: Id64String } {
  const [modelId, categoryId] = key.split("-");
  return { modelId: modelId !== "" ? modelId : undefined, categoryId };
}

export function parseSubCategoryKey(key: SubCategoryKey) {
  const [categoryId, subCategoryId] = key.split("-");
  return { categoryId, subCategoryId };
}

interface VisibilityChangeTargets {
  definitionContainers?: Set<Id64String>;
  models?: Set<Id64String>;
  categories?: Set<CategoryKey>;
  elements?: Map<CategoryKey, Set<Id64String>>;
  subCategories?: Set<SubCategoryKey>;
}

export async function createFilteredTree(props: {
  imodelAccess: ECClassHierarchyInspector;
  filteringPaths: HierarchyFilteringPath[];
  categoryClassName: string;
  categoryElementClassName: string;
  categoryModelClassName: string;
  idsCache: CategoriesTreeIdsCache;
}): Promise<FilteredTree> {
  const { imodelAccess, filteringPaths, categoryClassName, categoryElementClassName, categoryModelClassName, idsCache } = props;
  const root: FilteredTreeRootNode = {
    children: new Map(),
  };

  const filteredElements = new Array<ElementFilteredTreeNode>();
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

      const type = await getType(imodelAccess, identifier.className, categoryClassName, categoryElementClassName, categoryModelClassName);

      const newNode: FilteredTreeNode = createFilteredTreeNode({
        type,
        id: identifier.id,
        isFilterTarget: i === normalizedPath.length - 1,
        parent: parentNode,
      });
      (parentNode.children ??= new Map()).set(identifier.id, newNode);
      parentNode = newNode;
      if (newNode.type === "element") {
        filteredElements.push(newNode);
      }
    }
  }
  const filteredElementsModels = await idsCache.getFilteredElementsModels(filteredElements.map(({ id }) => id));
  // We populate filtered elements array with references, this causes root to change accordingly
  filteredElements.forEach((element) => {
    element.modelId = filteredElementsModels.get(element.id);
  });

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

  for (const filteredNode of filteredNodes) {
    collectVisibilityChangeTargets(changeTargets, filteredNode);
  }
  return changeTargets;
}

function findMatchingFilteredNodes(lookupParents: Array<{ children?: Map<Id64String, FilteredTreeNode> }>, keys: InstanceKey[]) {
  return lookupParents
    .flatMap((lookup) => keys.map((key) => lookup.children?.get(key.id)))
    .filter((lookupNode): lookupNode is FilteredTreeNode => lookupNode !== undefined);
}

function collectVisibilityChangeTargets(changeTargets: VisibilityChangeTargets, filteredNode: FilteredTreeNode) {
  if (filteredNode.isFilterTarget) {
    addTarget(changeTargets, filteredNode);
    return;
  }

  if (filteredNode.type === "element") {
    // need to add parent ids as filter target will be an element
    addTarget(changeTargets, filteredNode);
  }

  if (!filteredNode.children) {
    return;
  }

  for (const child of filteredNode.children.values()) {
    collectVisibilityChangeTargets(changeTargets, child);
  }
}

function addTarget(filterTargets: VisibilityChangeTargets, node: FilteredTreeNode) {
  switch (node.type) {
    case "definitionContainer":
      (filterTargets.definitionContainers ??= new Set()).add(node.id);
      return;
    case "model":
      (filterTargets.models ??= new Set()).add(node.id);
      return;
    case "subCategory":
      (filterTargets.subCategories ??= new Set()).add(createSubCategoryKey(node.categoryId, node.id));
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
  if (type === "definitionContainer") {
    return {
      id,
      isFilterTarget,
      type,
    };
  }
  if (type === "subCategory") {
    assert("id" in parent);
    return {
      id,
      isFilterTarget,
      type,
      categoryId: parent.id,
    };
  }
  if (type === "category") {
    if ("type" in parent && parent.type === "model") {
      return {
        id,
        isFilterTarget,
        type,
        modelId: parent.id,
      };
    }
    return {
      id,
      isFilterTarget,
      type,
    };
  }
  if (type === "model") {
    assert("id" in parent);
    return {
      id,
      isFilterTarget,
      type,
      categoryId: parent.type === "category" ? parent.id : undefined,
    };
  }

  if ("type" in parent) {
    if (parent.type === "category") {
      return {
        id,
        isFilterTarget,
        type,
        categoryId: parent.id,
      };
    }
    assert(parent.type === "element");
    return {
      id,
      isFilterTarget,
      type,
      categoryId: parent.categoryId,
    };
  }

  throw new Error("Invalid parent node type");
}

async function getType(
  hierarchyChecker: ECClassHierarchyInspector,
  className: string,
  categoryClassName: string,
  categoryElementClass: string,
  categoryModelClassName: string,
) {
  if (await hierarchyChecker.classDerivesFrom(className, SUB_CATEGORY_CLASS_NAME)) {
    return "subCategory";
  }
  if (await hierarchyChecker.classDerivesFrom(className, categoryElementClass)) {
    return "element";
  }
  if (await hierarchyChecker.classDerivesFrom(className, categoryClassName)) {
    return "category";
  }
  if (await hierarchyChecker.classDerivesFrom(className, categoryModelClassName)) {
    return "model";
  }
  return "definitionContainer";
}
