/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { HierarchyFilteringPath, HierarchyNodeIdentifier, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { CLASS_NAME_Category, CLASS_NAME_Model, CLASS_NAME_Subject } from "../../common/internal/ClassNameDefinitions.js";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector, InstanceKey } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId } from "../../common/internal/Types.js";
import type { FilteredTree } from "../../common/internal/visibility/BaseFilteredTree.js";

interface FilteredTreeRootNode {
  children: Map<Id64String, FilteredTreeNode>;
}

interface BaseFilteredTreeNode {
  id: Id64String;
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

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

function createModelCategoryKey(modelId: Id64String, categoryId: Id64String): ModelCategoryKey {
  return `${modelId}-${categoryId}`;
}

function parseModelCategoryKey(key: ModelCategoryKey) {
  const [modelId, categoryId] = key.split("-");
  return { modelId, categoryId };
}

interface FilterTargetsInternal {
  subjectIds?: Id64Set;
  modelIds?: Id64Set;
  categories?: Map<ModelId, Set<CategoryId>>;
  elements?: Map<ModelCategoryKey, Set<ElementId>>;
}

/** @internal */
export interface ModelsTreeFilterTargets {
  subjectIds?: Id64Set;
  modelIds?: Id64Set;
  categories?: Array<{ modelId: Id64String | undefined; categoryIds: Id64Set }>;
  elements?: Array<{ modelId: Id64String; categoryId: Id64String; elementIds: Id64Set }>;
}

/** @internal */
export async function createFilteredTree({
  imodelAccess,
  filteringPaths,
}: {
  imodelAccess: ECClassHierarchyInspector;
  filteringPaths: HierarchyFilteringPath[];
}): Promise<FilteredTree<ModelsTreeFilterTargets>> {
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
        parent: parentNode,
      });
      (parentNode.children ??= new Map()).set(identifier.id, newNode);
      parentNode = newNode;
    }
  }

  return {
    getFilterTargets: (node: HierarchyNode) => getFilterTargets(root, node),
  };
}

function getFilterTargets(root: FilteredTreeRootNode, node: HierarchyNode): ModelsTreeFilterTargets | undefined {
  const filterTargetsHandler = new FilterTargetsHandler();
  let lookupParents: Array<{ children?: Map<Id64String, FilteredTreeNode> }> = [root];
  const filterTargets: FilterTargetsInternal = {};

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
    const parentNodes = findMatchingFilteredNodes(lookupParents, parentKey.instanceKeys);
    if (parentNodes.length === 0) {
      return undefined;
    }
    lookupParents = parentNodes;
  }

  // find filtered nodes that match the `node`
  const filteredNodes = findMatchingFilteredNodes(lookupParents, nodeKey.instanceKeys);
  if (filteredNodes.length === 0) {
    return undefined;
  }

  filteredNodes.forEach((filteredNode) => filterTargetsHandler.collectFilterTargets(filterTargets, filteredNode));

  return filterTargetsHandler.convertInternalFilterTargets(filterTargets);
}

class FilterTargetsHandler {
  public convertInternalFilterTargets(filterTargets: FilterTargetsInternal): ModelsTreeFilterTargets | undefined {
    if (!filterTargets.categories && !filterTargets.subjectIds && !filterTargets.elements && !filterTargets.modelIds) {
      return undefined;
    }

    return {
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
      modelIds: filterTargets.modelIds,
      subjectIds: filterTargets.subjectIds,
    };
  }

  public collectFilterTargets(changeTargets: FilterTargetsInternal, filteredNode: FilteredTreeNode) {
    if (filteredNode.isFilterTarget) {
      this.addTarget(changeTargets, filteredNode);
      return;
    }

    if (filteredNode.type === "element") {
      // need to add parent ids as filter target will be an element
      this.addTarget(changeTargets, filteredNode);
    }

    if (!filteredNode.children) {
      return;
    }

    for (const child of filteredNode.children.values()) {
      this.collectFilterTargets(changeTargets, child);
    }
  }

  private addTarget(filterTargets: FilterTargetsInternal, node: FilteredTreeNode) {
    switch (node.type) {
      case "subject":
        (filterTargets.subjectIds ??= new Set()).add(node.id);
        return;
      case "model":
        (filterTargets.modelIds ??= new Set()).add(node.id);
        return;
      case "category":
        const categories = (filterTargets.categories ??= new Map()).get(node.modelId);
        if (categories) {
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
}

function findMatchingFilteredNodes(lookupParents: Array<{ children?: Map<Id64String, FilteredTreeNode> }>, keys: InstanceKey[]) {
  return lookupParents
    .flatMap((lookup) => keys.map((key) => lookup.children?.get(key.id)))
    .filter((lookupNode): lookupNode is FilteredTreeNode => lookupNode !== undefined);
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
  if (await hierarchyChecker.classDerivesFrom(className, CLASS_NAME_Subject)) {
    return "subject";
  }
  if (await hierarchyChecker.classDerivesFrom(className, CLASS_NAME_Model)) {
    return "model";
  }
  if (await hierarchyChecker.classDerivesFrom(className, CLASS_NAME_Category)) {
    return "category";
  }
  return "element";
}
