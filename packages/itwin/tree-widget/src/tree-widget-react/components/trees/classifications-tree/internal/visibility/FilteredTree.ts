/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { CLASS_NAME_Classification, CLASS_NAME_ClassificationTable, CLASS_NAME_GeometricElement2d } from "../../../common/internal/ClassNameDefinitions.js";
import { createFilteredTree, FilteredNodesHandler } from "../../../common/internal/visibility/BaseFilteredTree.js";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId } from "../../../common/internal/Types.js";
import type { BaseFilteredTreeNode, FilteredTree, FilteredTreeNodeChildren } from "../../../common/internal/visibility/BaseFilteredTree.js";
import type { ClassificationsTreeIdsCache } from "../ClassificationsTreeIdsCache.js";
import { firstValueFrom } from "rxjs";

interface ClassificationTableFilteredTreeNode extends BaseFilteredTreeNode<ClassificationTableFilteredTreeNode> {
  type: "classificationTable";
}

interface ClassificationFilteredTreeNode extends BaseFilteredTreeNode<ClassificationFilteredTreeNode> {
  type: "classification";
}

interface Element2dFilteredTreeNode extends BaseFilteredTreeNode<Element2dFilteredTreeNode> {
  type: "element2d";
  categoryId: Id64String;
  modelId: Id64String;
}

interface Element3dFilteredTreeNode extends BaseFilteredTreeNode<Element3dFilteredTreeNode> {
  type: "element3d";
  categoryId: Id64String;
  modelId: Id64String;
}

type FilteredTreeNode = ClassificationTableFilteredTreeNode | ClassificationFilteredTreeNode | Element2dFilteredTreeNode | Element3dFilteredTreeNode;

type TemporaryElement2dFilteredNode = Omit<Element2dFilteredTreeNode, "modelId" | "categoryId" | "children"> & {
  modelId: string | undefined;
  categoryId: string | undefined;
  children?: FilteredTreeNodeChildren<TemporaryElement2dFilteredNode>;
};

type TemporaryElement3dFilteredNode = Omit<Element3dFilteredTreeNode, "modelId" | "categoryId" | "children"> & {
  modelId: string | undefined;
  categoryId: string | undefined;
  children?: FilteredTreeNodeChildren<TemporaryElement3dFilteredNode>;
};

type TemporaryFilteredTreeNode =
  | ClassificationTableFilteredTreeNode
  | ClassificationFilteredTreeNode
  | TemporaryElement2dFilteredNode
  | TemporaryElement3dFilteredNode;

/** @internal */
export interface ClassificationsTreeFilterTargets {
  elements2d?: Array<{ modelId: Id64String; categoryId: Id64String; elementIds: Set<Id64String> }>;
  elements3d?: Array<{ modelId: Id64String; categoryId: Id64String; elementIds: Set<Id64String> }>;
  classificationTableIds?: Id64Set;
  classificationIds?: Id64Set;
}

/** @internal */
export async function createFilteredClassificationsTree(props: {
  imodelAccess: ECClassHierarchyInspector;
  filteringPaths: HierarchyFilteringPath[];
  idsCache: ClassificationsTreeIdsCache;
}): Promise<FilteredTree<ClassificationsTreeFilterTargets>> {
  const { imodelAccess, filteringPaths, idsCache } = props;
  return createFilteredTree({
    filteredNodesHandler: new ClassificationsTreeFilteredNodesHandler({ idsCache, imodelAccess }),
    filteringPaths,
  });
}

interface FilterTargetsInternal {
  elements2d?: Map<ModelCategoryKey, Set<ElementId>>;
  elements3d?: Map<ModelCategoryKey, Set<ElementId>>;
  classificationTableIds?: Id64Set;
  classificationIds?: Id64Set;
}

interface ClassificationsTreeFilteredNodesHandlerProps {
  idsCache: ClassificationsTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
}

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

interface ProcessedFilteredNodes {
  filtered2dElements: Map<Id64String, Omit<Element2dFilteredTreeNode, "children">>;
  filtered3dElements: Map<Id64String, Omit<Element3dFilteredTreeNode, "children">>;
}

class ClassificationsTreeFilteredNodesHandler extends FilteredNodesHandler<
  ProcessedFilteredNodes,
  ClassificationsTreeFilterTargets,
  TemporaryFilteredTreeNode
> {
  readonly #props: ClassificationsTreeFilteredNodesHandlerProps;
  constructor(props: ClassificationsTreeFilteredNodesHandlerProps) {
    super();
    this.#props = props;
  }

  public async getProcessedFilteredNodes(): Promise<ProcessedFilteredNodes> {
    const filteredTemporary2dElements = new Map<Id64String, Omit<TemporaryElement2dFilteredNode, "children">>();
    const filteredTemporary3dElements = new Map<Id64String, Omit<TemporaryElement3dFilteredNode, "children">>();
    const result: ProcessedFilteredNodes = {
      filtered2dElements: new Map(),
      filtered3dElements: new Map(),
    };
    for (const node of this.filteredNodesArr) {
      if (node.type === "element2d") {
        filteredTemporary2dElements.set(node.id, node);
      } else if (node.type === "element3d") {
        filteredTemporary3dElements.set(node.id, node);
      }
    }

    const filteredElementsModels = await firstValueFrom(this.#props.idsCache.getFilteredElementsData({
      element2dIds: [...filteredTemporary2dElements.keys()],
      element3dIds: [...filteredTemporary3dElements.keys()],
    }));
    filteredTemporary2dElements.forEach((element, id) => {
      const entry = filteredElementsModels.get(element.id);
      assert(entry !== undefined);
      result.filtered2dElements.set(id, { ...element, modelId: entry.modelId, categoryId: entry.categoryId });
    });
    filteredTemporary3dElements.forEach((element, id) => {
      const entry = filteredElementsModels.get(element.id);
      assert(entry !== undefined);
      result.filtered3dElements.set(id, { ...element, modelId: entry.modelId, categoryId: entry.categoryId });
    });
    return result;
  }

  public convertNodesToFilterTargets(
    filteredNodes: TemporaryFilteredTreeNode[],
    processedFilteredNodes: ProcessedFilteredNodes,
  ): ClassificationsTreeFilterTargets | undefined {
    const filterTargets: FilterTargetsInternal = {};

    filteredNodes.forEach((filteredNode) => this.collectFilterTargets(filterTargets, filteredNode, processedFilteredNodes));

    return this.convertInternalFilterTargets(filterTargets);
  }

  private convertInternalFilterTargets(filterTargets: FilterTargetsInternal): ClassificationsTreeFilterTargets | undefined {
    if (!filterTargets.classificationIds && !filterTargets.classificationIds && !filterTargets.elements2d && !filterTargets.elements3d) {
      return undefined;
    }

    return {
      classificationIds: filterTargets.classificationIds,
      classificationTableIds: filterTargets.classificationIds,
      elements2d: filterTargets.elements2d
        ? [...filterTargets.elements2d?.entries()].map(([modelCategoryKey, elementIds]) => {
            const { modelId, categoryId } = this.parseModelCategoryKey(modelCategoryKey);
            return { modelId, categoryId, elementIds };
          })
        : undefined,
      elements3d: filterTargets.elements3d
        ? [...filterTargets.elements3d?.entries()].map(([modelCategoryKey, elementIds]) => {
            const { modelId, categoryId } = this.parseModelCategoryKey(modelCategoryKey);
            return { modelId, categoryId, elementIds };
          })
        : undefined,
    };
  }

  private collectFilterTargets(changeTargets: FilterTargetsInternal, node: TemporaryFilteredTreeNode, processedFilteredNodes: ProcessedFilteredNodes) {
    const filteredNode =
      node.type === "element2d"
        ? processedFilteredNodes.filtered2dElements.get(node.id)
        : node.type === "element3d"
          ? processedFilteredNodes.filtered3dElements.get(node.id)
          : node;
    assert(filteredNode !== undefined);
    if (filteredNode.isFilterTarget) {
      this.addTarget(changeTargets, filteredNode);
      return;
    }

    if (filteredNode.type === "element2d" || filteredNode.type === "element3d") {
      // need to add parent ids as filter target will be an element
      this.addTarget(changeTargets, filteredNode);
    }

    if (!node.children) {
      return;
    }

    for (const child of node.children.values()) {
      this.collectFilterTargets(changeTargets, child, processedFilteredNodes);
    }
  }

  private addTarget(filterTargets: FilterTargetsInternal, node: FilteredTreeNode) {
    switch (node.type) {
      case "classificationTable":
        (filterTargets.classificationTableIds ??= new Set()).add(node.id);
        return;
      case "classification":
        (filterTargets.classificationIds ??= new Set()).add(node.id);
        return;
      case "element2d":
        const element2dKey = this.createModelCategoryKey(node.modelId, node.categoryId);
        const elements2d = (filterTargets.elements2d ??= new Map()).get(element2dKey);
        if (elements2d) {
          elements2d.add(node.id);
          return;
        }
        filterTargets.elements2d.set(element2dKey, new Set([node.id]));
        return;
      case "element3d":
        const element3dKey = this.createModelCategoryKey(node.modelId, node.categoryId);
        const elements3d = (filterTargets.elements3d ??= new Map()).get(element3dKey);
        if (elements3d) {
          elements3d.add(node.id);
          return;
        }
        filterTargets.elements3d.set(element3dKey, new Set([node.id]));
        return;
    }
  }

  private createModelCategoryKey(modelId: Id64String, categoryId: Id64String): ModelCategoryKey {
    return `${modelId}-${categoryId}`;
  }

  private parseModelCategoryKey(key: ModelCategoryKey): { modelId: Id64String; categoryId: Id64String } {
    const [modelId, categoryId] = key.split("-");
    return { modelId, categoryId };
  }

  public createFilteredTreeNode({
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

  public async getType(className: string): Promise<TemporaryFilteredTreeNode["type"]> {
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_ClassificationTable)) {
      return "classificationTable";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_Classification)) {
      return "classification";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_GeometricElement2d)) {
      return "element2d";
    }
    return "element3d";
  }
}
