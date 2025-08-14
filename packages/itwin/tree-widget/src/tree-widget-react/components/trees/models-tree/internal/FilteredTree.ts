/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { CLASS_NAME_Category, CLASS_NAME_Model, CLASS_NAME_Subject } from "../../common/internal/ClassNameDefinitions.js";
import { createFilteredTree } from "../../common/internal/visibility/BaseFilteredTree.js";

import type { BaseFilteredTreeNode, FilteredNodesHandler, FilteredTree, FilteredTreeRootNode } from "../../common/internal/visibility/BaseFilteredTree.js";
import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId } from "../../common/internal/Types.js";

interface GenericFilteredTreeNode extends BaseFilteredTreeNode<GenericFilteredTreeNode> {
  type: "subject" | "model";
}

interface CategoryFilteredTreeNode extends BaseFilteredTreeNode<CategoryFilteredTreeNode> {
  type: "category";
  modelId: Id64String;
}

interface ElementFilteredTreeNode extends BaseFilteredTreeNode<ElementFilteredTreeNode> {
  type: "element";
  modelId: Id64String;
  categoryId: Id64String;
}

type FilteredTreeNode = GenericFilteredTreeNode | CategoryFilteredTreeNode | ElementFilteredTreeNode;

/** @internal */
export interface ModelsTreeFilterTargets {
  subjectIds?: Id64Set;
  modelIds?: Id64Set;
  categories?: Array<{ modelId: Id64String | undefined; categoryIds: Id64Set }>;
  elements?: Array<{ modelId: Id64String; categoryId: Id64String; elementIds: Id64Set }>;
}

/** @internal */
export async function createFilteredModelsTree(props: {
  imodelAccess: ECClassHierarchyInspector;
  filteringPaths: HierarchyFilteringPath[];
}): Promise<FilteredTree<ModelsTreeFilterTargets>> {
  const { imodelAccess, filteringPaths } = props;
  return createFilteredTree({
    getType: async (className) => getType(imodelAccess, className),
    createFilteredTreeNode,
    filteredNodesHanlder: new ModelsTreeFilteredNodesHandler(),
    filteringPaths,
  });
}

interface FilterTargetsInternal {
  subjectIds?: Id64Set;
  modelIds?: Id64Set;
  categories?: Map<ModelId, Set<CategoryId>>;
  elements?: Map<ModelCategoryKey, Set<ElementId>>;
}

class ModelsTreeFilteredNodesHandler implements FilteredNodesHandler<ModelsTreeFilterTargets, FilteredTreeNode> {
  public convertNodesToFilterTargets(filteredNodes: FilteredTreeNode[]): ModelsTreeFilterTargets | undefined {
    const filterTargets: FilterTargetsInternal = {};

    filteredNodes.forEach((filteredNode) => this.collectFilterTargets(filterTargets, filteredNode));

    return this.convertInternalFilterTargets(filterTargets);
  }

  public async prepareSavedNodes() {}
  public saveFilteredNode() {}

  private convertInternalFilterTargets(filterTargets: FilterTargetsInternal): ModelsTreeFilterTargets | undefined {
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

  private collectFilterTargets(changeTargets: FilterTargetsInternal, filteredNode: FilteredTreeNode) {
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

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

function createModelCategoryKey(modelId: Id64String, categoryId: Id64String): ModelCategoryKey {
  return `${modelId}-${categoryId}`;
}

function parseModelCategoryKey(key: ModelCategoryKey) {
  const [modelId, categoryId] = key.split("-");
  return { modelId, categoryId };
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
  parent: FilteredTreeNode | FilteredTreeRootNode<FilteredTreeNode>;
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
