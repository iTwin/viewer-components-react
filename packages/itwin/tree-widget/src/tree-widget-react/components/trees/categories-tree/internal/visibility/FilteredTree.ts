/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { CLASS_NAME_SubCategory } from "../../../common/internal/ClassNameDefinitions.js";
import { createFilteredTree, FilteredNodesHandler } from "../../../common/internal/visibility/BaseFilteredTree.js";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId, SubCategoryId } from "../../../common/internal/Types.js";
import type {
  BaseFilteredTreeNode,
  FilteredTree,
  FilteredTreeNodeChildren,
  FilteredTreeRootNode,
} from "../../../common/internal/visibility/BaseFilteredTree.js";
import type { CategoriesTreeIdsCache } from "../CategoriesTreeIdsCache.js";

/** @internal */
export interface CategoriesTreeFilterTargets {
  categories?: Array<{ modelId: Id64String | undefined; categoryIds: Id64Set }>;
  elements?: Array<{ modelId: Id64String; categoryId: Id64String; elementIds: Id64Set }>;
  definitionContainerIds?: Id64Set;
  modelIds?: Id64Set;
  subCategories?: Array<{ categoryId: Id64String; subCategoryIds: Id64Set }>;
}

interface CategoryFilteredTreeNode extends BaseFilteredTreeNode<CategoryFilteredTreeNode> {
  type: "category";
  modelId?: Id64String;
}

interface ModelFilteredTreeNode extends BaseFilteredTreeNode<ModelFilteredTreeNode> {
  type: "model";
  categoryId?: Id64String;
}
interface SubCategoryFilteredTreeNode extends BaseFilteredTreeNode<SubCategoryFilteredTreeNode> {
  type: "subCategory";
  categoryId: Id64String;
}

interface DefinitionContainerFilteredTreeNode extends BaseFilteredTreeNode<DefinitionContainerFilteredTreeNode> {
  type: "definitionContainer";
}

interface ElementFilteredTreeNode extends BaseFilteredTreeNode<ElementFilteredTreeNode> {
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

type TemporaryElementFilteredNode = Omit<ElementFilteredTreeNode, "modelId" | "children"> & {
  modelId: string | undefined;
  children?: FilteredTreeNodeChildren<TemporaryElementFilteredNode>;
};

type TemporaryFilteredTreeNode =
  | DefinitionContainerFilteredTreeNode
  | SubCategoryFilteredTreeNode
  | CategoryFilteredTreeNode
  | TemporaryElementFilteredNode
  | ModelFilteredTreeNode;

/** @internal */
export async function createFilteredCategoriesTree(props: {
  imodelAccess: ECClassHierarchyInspector;
  filteringPaths: HierarchyFilteringPath[];
  categoryClassName: string;
  categoryElementClassName: string;
  categoryModelClassName: string;
  idsCache: CategoriesTreeIdsCache;
}): Promise<FilteredTree<CategoriesTreeFilterTargets>> {
  const { imodelAccess, filteringPaths, categoryClassName, categoryElementClassName, categoryModelClassName, idsCache } = props;
  return createFilteredTree({
    filteredNodesHandler: new CategoriesTreeFilteredNodesHandler({
      idsCache,
      imodelAccess,
      categoryClassName,
      categoryElementClassName,
      categoryModelClassName,
    }),
    filteringPaths,
  });
}

interface FilterTargetsInternal {
  elements?: Map<ModelCategoryKey, Set<ElementId>>;
  categories?: Map<ModelId | undefined, Set<CategoryId>>;
  definitionContainerIds?: Id64Set;
  modelIds?: Id64Set;
  subCategories?: Map<CategoryId, Set<SubCategoryId>>;
}

interface CategoriesTreeFilteredNodesHandlerProps {
  idsCache: CategoriesTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  categoryClassName: string;
  categoryElementClassName: string;
  categoryModelClassName: string;
}

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

interface ProcessedFilteredNodes {
  filteredElements: Map<Id64String, Omit<ElementFilteredTreeNode, "children">>;
}

class CategoriesTreeFilteredNodesHandler extends FilteredNodesHandler<ProcessedFilteredNodes, CategoriesTreeFilterTargets, TemporaryFilteredTreeNode> {
  constructor(private readonly _props: CategoriesTreeFilteredNodesHandlerProps) {
    super();
  }

  public async getProcessedFilteredNodes(): Promise<ProcessedFilteredNodes> {
    const filteredTemporaryElements = new Map<Id64String, Omit<TemporaryElementFilteredNode, "children">>();
    const result: ProcessedFilteredNodes = {
      filteredElements: new Map(),
    };
    this.filteredNodesArr.forEach((node) => {
      if (node.type === "element") {
        filteredTemporaryElements.set(node.id, node);
      }
    });

    const filteredElementsModels = await this._props.idsCache.getFilteredElementsModels([...filteredTemporaryElements.keys()]);
    filteredTemporaryElements.forEach((element, id) => {
      const modelId = filteredElementsModels.get(element.id);
      assert(modelId !== undefined);
      result.filteredElements.set(id, { ...element, modelId });
    });
    return result;
  }

  public convertNodesToFilterTargets(
    filteredNodes: TemporaryFilteredTreeNode[],
    processedFilteredNodes: ProcessedFilteredNodes,
  ): CategoriesTreeFilterTargets | undefined {
    const filterTargets: FilterTargetsInternal = {};

    filteredNodes.forEach((filteredNode) => this.collectFilterTargets(filterTargets, filteredNode, processedFilteredNodes));

    return this.convertInternalFilterTargets(filterTargets);
  }

  private convertInternalFilterTargets(filterTargets: FilterTargetsInternal): CategoriesTreeFilterTargets | undefined {
    if (
      !filterTargets.categories &&
      !filterTargets.definitionContainerIds &&
      !filterTargets.elements &&
      !filterTargets.modelIds &&
      !filterTargets.subCategories
    ) {
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
            const { modelId, categoryId } = this.parseModelCategoryKey(modelCategoryKey);
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
    };
  }

  private collectFilterTargets(changeTargets: FilterTargetsInternal, node: TemporaryFilteredTreeNode, processedFilteredNodes: ProcessedFilteredNodes) {
    const filteredNode = node.type !== "element" ? node : processedFilteredNodes.filteredElements.get(node.id);
    assert(filteredNode !== undefined);
    if (filteredNode.isFilterTarget) {
      this.addTarget(changeTargets, filteredNode);
      return;
    }

    if (filteredNode.type === "element") {
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
        const modelCategoryKey = this.createModelCategoryKey(node.modelId, node.categoryId);
        const elements = (filterTargets.elements ??= new Map()).get(modelCategoryKey);
        if (elements) {
          elements.add(node.id);
          return;
        }
        filterTargets.elements.set(modelCategoryKey, new Set([node.id]));
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
    parent,
  }: {
    type: FilteredTreeNode["type"];
    id: Id64String;
    isFilterTarget: boolean;
    parent: TemporaryFilteredTreeNode | FilteredTreeRootNode<TemporaryFilteredTreeNode>;
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

  public async getType(className: string): Promise<TemporaryFilteredTreeNode["type"]> {
    if (await this._props.imodelAccess.classDerivesFrom(className, CLASS_NAME_SubCategory)) {
      return "subCategory";
    }
    if (await this._props.imodelAccess.classDerivesFrom(className, this._props.categoryElementClassName)) {
      return "element";
    }
    if (await this._props.imodelAccess.classDerivesFrom(className, this._props.categoryClassName)) {
      return "category";
    }
    if (await this._props.imodelAccess.classDerivesFrom(className, this._props.categoryModelClassName)) {
      return "model";
    }
    return "definitionContainer";
  }
}
