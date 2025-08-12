/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { HierarchyFilteringPath, HierarchyNodeIdentifier, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { CLASS_NAME_SubCategory } from "../../common/internal/ClassNameDefinitions.js";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector, InstanceKey } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId, SubCategoryId } from "../../common/internal/Types.js";
import type { FilteredTree, FilteredVisibilityTargets } from "../../common/internal/visibility/BaseFilteredTree.js";
import type { CategoriesTreeIdsCache } from "./CategoriesTreeIdsCache.js";

interface FilteredTreeRootNode {
  children: Map<Id64String, FilteredTreeNode>;
}

interface BaseFilteredTreeNode {
  id: Id64String;
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
  modelId: Id64String;
}

type FilteredTreeNode =
  | DefinitionContainerFilteredTreeNode
  | SubCategoryFilteredTreeNode
  | CategoryFilteredTreeNode
  | ElementFilteredTreeNode
  | ModelFilteredTreeNode;

type TemporaryElementFilteredNode = Omit<ElementFilteredTreeNode, "modelId"> & { modelId: string | undefined };

type TemporaryFilteredTreeNode =
  | DefinitionContainerFilteredTreeNode
  | SubCategoryFilteredTreeNode
  | CategoryFilteredTreeNode
  | TemporaryElementFilteredNode
  | ModelFilteredTreeNode;

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

function createModelCategoryKey(modelId: Id64String, categoryId: Id64String): ModelCategoryKey {
  return `${modelId}-${categoryId}`;
}

/** @internal */
function parseModelCategoryKey(key: ModelCategoryKey): { modelId: Id64String; categoryId: Id64String } {
  const [modelId, categoryId] = key.split("-");
  return { modelId, categoryId };
}

/** @internal */
export interface CategoriesTreeFilterTargets {
  categories?: Array<{ modelId: Id64String | undefined; categoryIds: Id64Set }>;
  elements?: Array<{ modelId: Id64String; categoryId: Id64String; elementIds: Id64Set }>;
  definitionContainerIds?: Id64Set;
  modelIds?: Id64Set;
  subCategories?: Array<{ categoryId: Id64String; subCategoryIds: Id64Set }>;
}

interface FilterTargetsInternal {
  elements?: Map<ModelCategoryKey, Set<ElementId>>;
  categories?: Map<ModelId | undefined, Set<CategoryId>>;
  definitionContainerIds?: Id64Set;
  modelIds?: Id64Set;
  subCategories?: Map<CategoryId, Set<SubCategoryId>>;
}

/** @internal */
export async function createFilteredTree(props: {
  imodelAccess: ECClassHierarchyInspector;
  filteringPaths: HierarchyFilteringPath[];
  categoryClassName: string;
  categoryElementClassName: string;
  categoryModelClassName: string;
  idsCache: CategoriesTreeIdsCache;
}): Promise<FilteredTree<CategoriesTreeFilterTargets>> {
  const { imodelAccess, filteringPaths, categoryClassName, categoryElementClassName, categoryModelClassName, idsCache } = props;
  const root: FilteredTreeRootNode = {
    children: new Map(),
  };

  const filteredElements = new Array<TemporaryElementFilteredNode>();
  for (const filteringPath of filteringPaths) {
    const normalizedPath = HierarchyFilteringPath.normalize(filteringPath).path;

    let parentNode: FilteredTreeRootNode | TemporaryFilteredTreeNode = root;
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

      const newNode = createFilteredTreeNode({
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
    getFilterTargets: (node: HierarchyNode) => getFilterTargets(root, node),
  };
}

function getFilterTargets(root: FilteredTreeRootNode, node: HierarchyNode): FilteredVisibilityTargets<CategoriesTreeFilterTargets> {
  let lookupParents: Array<{ children?: Map<Id64String, FilteredTreeNode> }> = [root];
  const filterTargets: FilterTargetsInternal = {};

  const nodeKey = node.key;
  if (!HierarchyNodeKey.isInstances(nodeKey)) {
    return {};
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
      return {};
    }
    lookupParents = parentNodes;
  }

  // find filtered nodes that match the `node`
  const filteredNodes = findMatchingFilteredNodes(lookupParents, nodeKey.instanceKeys);
  if (filteredNodes.length === 0) {
    return {};
  }

  filteredNodes.forEach((filteredNode) => collectFilterTargets(filterTargets, filteredNode));

  if (
    !filterTargets.categories &&
    !filterTargets.definitionContainerIds &&
    !filterTargets.elements &&
    !filterTargets.modelIds &&
    !filterTargets.subCategories
  ) {
    return {};
  }

  return {
    targets: {
      categories: filterTargets.categories
        ? [...filterTargets.categories.entries()].map(([modelId, categoryIds]) => {
            return { modelId, categoryIds };
          })
        : undefined,
      elements: filterTargets.elements
        ? [...filterTargets.elements.entries()].map(([modelCategoryKey, elementIds]) => {
            const { modelId, categoryId } = parseModelCategoryKey(modelCategoryKey);
            return { modelId, categoryId, elementIds };
          })
        : undefined,
      definitionContainerIds: filterTargets.definitionContainerIds,
      modelIds: filterTargets.modelIds,
      subCategories: filterTargets.subCategories
        ? [...filterTargets.subCategories.entries()].map(([categoryId, subCategoryIds]) => {
            return { categoryId, subCategoryIds };
          })
        : undefined,
    },
  };
}

function findMatchingFilteredNodes(lookupParents: Array<{ children?: Map<Id64String, FilteredTreeNode> }>, keys: InstanceKey[]) {
  return lookupParents
    .flatMap((lookup) => keys.map((key) => lookup.children?.get(key.id)))
    .filter((lookupNode): lookupNode is FilteredTreeNode => lookupNode !== undefined);
}

function collectFilterTargets(changeTargets: FilterTargetsInternal, filteredNode: FilteredTreeNode) {
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
    collectFilterTargets(changeTargets, child);
  }
}

function addTarget(filterTargets: FilterTargetsInternal, node: FilteredTreeNode) {
  switch (node.type) {
    case "definitionContainer":
      (filterTargets.definitionContainerIds ??= new Set()).add(node.id);
      return;
    case "model":
      (filterTargets.modelIds ??= new Set()).add(node.id);
      return;
    case "subCategory":
      const subCategories = (filterTargets.subCategories ??= new Map()).get(node.categoryId);
      if (subCategories) {
        subCategories.add(node.id);
        return;
      }
      filterTargets.subCategories.set(node.categoryId, new Set([node.id]));
      return;
    case "category":
      const categories = (filterTargets.categories ??= new Map()).get(node.modelId);
      if (!categories) {
        categories.add(node.id);
        return;
      }
      filterTargets.categories.set(node.modelId, new Set([node.id]));
      return;
    case "element":
      const modelCategoryKey = createModelCategoryKey(node.modelId, node.categoryId);
      const elements = (filterTargets.elements ??= new Map()).get(modelCategoryKey);
      if (elements) {
        elements.add(node.id);
        return;
      }
      filterTargets.elements.set(modelCategoryKey, new Set([node.id]));
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
  id: Id64String;
  isFilterTarget: boolean;
  parent: TemporaryFilteredTreeNode | FilteredTreeRootNode;
}): TemporaryFilteredTreeNode {
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
        modelId: undefined,
      };
    }
    assert(parent.type === "element");
    return {
      id,
      isFilterTarget,
      type,
      categoryId: parent.categoryId,
      modelId: undefined,
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
  if (await hierarchyChecker.classDerivesFrom(className, CLASS_NAME_SubCategory)) {
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
