/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import { assert } from "@itwin/core-bentley";
import { HierarchyFilteringPath, HierarchyNodeIdentifier, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { CLASS_NAME_Classification, CLASS_NAME_ClassificationTable, CLASS_NAME_GeometricElement2d } from "../../common/internal/ClassNameDefinitions.js";

import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector, InstanceKey } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId } from "../../common/internal/Types.js";
import type { FilteredTree, FilteredVisibilityTargets } from "../../common/internal/visibility/BaseFilteredTree.js";
import type { ClassificationsTreeIdsCache } from "./ClassificationsTreeIdsCache.js";

interface FilteredTreeRootNode {
  children: Map<Id64String, FilteredTreeNode>;
}

interface BaseFilteredTreeNode {
  id: Id64String;
  children?: Map<Id64String, FilteredTreeNode>;
  isFilterTarget: boolean;
}

interface ClassificationTableFilteredTreeNode extends BaseFilteredTreeNode {
  type: "classificationTable";
}

interface ClassificationFilteredTreeNode extends BaseFilteredTreeNode {
  type: "classification";
}

interface Element2dFilteredTreeNode extends BaseFilteredTreeNode {
  type: "element2d";
  categoryId: Id64String;
  modelId: Id64String;
}

interface Element3dFilteredTreeNode extends BaseFilteredTreeNode {
  type: "element3d";
  categoryId: Id64String;
  modelId: Id64String;
}

type FilteredTreeNode = ClassificationTableFilteredTreeNode | ClassificationFilteredTreeNode | Element2dFilteredTreeNode | Element3dFilteredTreeNode;

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

function createModelCategoryKey(modelId: Id64String, categoryId: Id64String): ModelCategoryKey {
  return `${modelId}-${categoryId}`;
}

function parseModelCategoryKey(key: ModelCategoryKey): { modelId: Id64String; categoryId: Id64String } {
  const [modelId, categoryId] = key.split("-");
  return { modelId, categoryId };
}

type TemporaryElement2dFilteredNode = Omit<Element2dFilteredTreeNode, "modelId" | "categoryId"> & {
  modelId: string | undefined;
  categoryId: string | undefined;
};
type TemporaryElement3dFilteredNode = Omit<Element3dFilteredTreeNode, "modelId" | "categoryId"> & {
  modelId: string | undefined;
  categoryId: string | undefined;
};
type TemporaryFilteredTreeNode =
  | ClassificationTableFilteredTreeNode
  | ClassificationFilteredTreeNode
  | TemporaryElement2dFilteredNode
  | TemporaryElement3dFilteredNode;

interface FilterTargetsInternal {
  elements2d?: Map<ModelCategoryKey, Set<ElementId>>;
  elements3d?: Map<ModelCategoryKey, Set<ElementId>>;
  classificationTableIds?: Id64Set;
  classificationIds?: Id64Set;
}

/** @internal */
export interface ClassificationsTreeFilterTargets {
  elements2d?: Array<{ modelId: Id64String; categoryId: Id64String; elementIds: Set<Id64String> }>;
  elements3d?: Array<{ modelId: Id64String; categoryId: Id64String; elementIds: Set<Id64String> }>;
  classificationTableIds?: Id64Set;
  classificationIds?: Id64Set;
}

/** @internal */
export async function createFilteredTree(props: {
  imodelAccess: ECClassHierarchyInspector;
  filteringPaths: HierarchyFilteringPath[];
  idsCache: ClassificationsTreeIdsCache;
}): Promise<FilteredTree<ClassificationsTreeFilterTargets>> {
  const { imodelAccess, filteringPaths, idsCache } = props;
  const root: FilteredTreeRootNode = {
    children: new Map(),
  };

  const filtered2dElements = new Array<TemporaryElement2dFilteredNode>();
  const filtered3dElements = new Array<TemporaryElement3dFilteredNode>();
  for (const filteringPath of filteringPaths) {
    const normalizedPath = HierarchyFilteringPath.normalize(filteringPath).path;

    let parentNode: TemporaryFilteredTreeNode | FilteredTreeRootNode = root;
    for (let i = 0; i < normalizedPath.length; ++i) {
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

      const newNode = createFilteredTreeNode({
        type,
        id: identifier.id,
        isFilterTarget: i === normalizedPath.length - 1,
      });
      (parentNode.children ??= new Map()).set(identifier.id, newNode);
      parentNode = newNode;
      if (newNode.type === "element2d") {
        filtered2dElements.push(newNode);
      } else if (newNode.type === "element3d") {
        filtered3dElements.push(newNode);
      }
    }
  }
  const filteredElementsModels = await idsCache.getFilteredElementsData({
    element2dIds: filtered2dElements.map(({ id }) => id),
    element3dIds: filtered3dElements.map(({ id }) => id),
  });
  // We populate filtered elements array with references, this causes root to change accordingly
  [filtered2dElements, filtered3dElements].forEach((elementsArr) =>
    elementsArr.forEach((element) => {
      const entry = filteredElementsModels.get(element.id);
      assert(entry !== undefined);
      element.modelId = entry.modelId;
      element.categoryId = entry.categoryId;
    }),
  );

  return {
    getFilterTargets: (node: HierarchyNode) => getFilterTargets(root, node),
  };
}

function getFilterTargets(root: FilteredTreeRootNode, node: HierarchyNode): FilteredVisibilityTargets<ClassificationsTreeFilterTargets> {
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

  if (!filterTargets.classificationIds && !filterTargets.classificationIds && !filterTargets.elements2d && !filterTargets.elements3d) {
    return {};
  }

  return {
    targets: {
      classificationIds: filterTargets.classificationIds,
      classificationTableIds: filterTargets.classificationIds,
      elements2d: filterTargets.elements2d
        ? [...filterTargets.elements2d?.entries()].map(([modelCategoryKey, elementIds]) => {
            const { modelId, categoryId } = parseModelCategoryKey(modelCategoryKey);
            return { modelId, categoryId, elementIds };
          })
        : undefined,
      elements3d: filterTargets.elements3d
        ? [...filterTargets.elements3d?.entries()].map(([modelCategoryKey, elementIds]) => {
            const { modelId, categoryId } = parseModelCategoryKey(modelCategoryKey);
            return { modelId, categoryId, elementIds };
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

  if (filteredNode.type === "element2d" || filteredNode.type === "element3d") {
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
    case "classificationTable":
      (filterTargets.classificationTableIds ??= new Set()).add(node.id);
      return;
    case "classification":
      (filterTargets.classificationIds ??= new Set()).add(node.id);
      return;
    case "element2d":
      const element2dKey = createModelCategoryKey(node.modelId, node.categoryId);
      const elements2d = (filterTargets.elements2d ??= new Map()).get(element2dKey);
      if (elements2d) {
        elements2d.add(node.id);
        return;
      }
      filterTargets.elements2d.set(element2dKey, new Set([node.id]));
      return;
    case "element3d":
      const element3dKey = createModelCategoryKey(node.modelId, node.categoryId);
      const elements3d = (filterTargets.elements3d ??= new Map()).get(element3dKey);
      if (elements3d) {
        elements3d.add(node.id);
        return;
      }
      filterTargets.elements3d.set(element3dKey, new Set([node.id]));
      return;
  }
}

function createFilteredTreeNode({
  type,
  id,
  isFilterTarget,
}: {
  type: FilteredTreeNode["type"];
  id: Id64String;
  isFilterTarget: boolean;
}): TemporaryFilteredTreeNode {
  if (type === "element2d" || type === "element3d") {
    return {
      id,
      isFilterTarget,
      type,
      modelId: undefined,
      categoryId: undefined,
    };
  }
  return {
    id,
    isFilterTarget,
    type,
  };
}

async function getType(hierarchyChecker: ECClassHierarchyInspector, className: string) {
  if (await hierarchyChecker.classDerivesFrom(className, CLASS_NAME_ClassificationTable)) {
    return "classificationTable";
  }
  if (await hierarchyChecker.classDerivesFrom(className, CLASS_NAME_Classification)) {
    return "classification";
  }
  if (await hierarchyChecker.classDerivesFrom(className, CLASS_NAME_GeometricElement2d)) {
    return "element2d";
  }
  return "element3d";
}
