/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { CLASS_NAME_SubCategory } from "../../../common/internal/ClassNameDefinitions.js";
import { createSearchResultsTree, SearchResultsNodesHandler } from "../../../common/internal/visibility/BaseSearchResultsTree.js";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchySearchPath } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId, SubCategoryId } from "../../../common/internal/Types.js";
import type {
  BaseSearchResultsTreeNode,
  SearchResultsTree,
  SearchResultsTreeNodeChildren,
  SearchResultsTreeRootNode,
} from "../../../common/internal/visibility/BaseSearchResultsTree.js";
import type { CategoriesTreeIdsCache } from "../CategoriesTreeIdsCache.js";

/** @internal */
export interface CategoriesTreeSearchTargets {
  categories?: Array<{ modelId: Id64String | undefined; categoryIds: Id64Set }>;
  elements?: Array<{ modelId: Id64String; categoryId: Id64String; elements: Map<ElementId, { isSearchTarget: boolean }> }>;
  definitionContainerIds?: Id64Set;
  modelIds?: Id64Set;
  subCategories?: Array<{ categoryId: Id64String; subCategoryIds: Id64Set }>;
}

interface CategorySearchResultsTreeNode extends BaseSearchResultsTreeNode<CategorySearchResultsTreeNode> {
  type: "category";
  modelId?: Id64String;
}

interface ModelSearchResultsTreeNode extends BaseSearchResultsTreeNode<ModelSearchResultsTreeNode> {
  type: "model";
  categoryId?: Id64String;
}
interface SubCategorySearchResultsTreeNode extends BaseSearchResultsTreeNode<SubCategorySearchResultsTreeNode> {
  type: "subCategory";
  categoryId: Id64String;
}

interface DefinitionContainerSearchResultsTreeNode extends BaseSearchResultsTreeNode<DefinitionContainerSearchResultsTreeNode> {
  type: "definitionContainer";
}

interface ElementSearchResultsTreeNode extends BaseSearchResultsTreeNode<ElementSearchResultsTreeNode> {
  type: "element";
  categoryId: Id64String;
  modelId: Id64String;
}

type SearchResultsTreeNode =
  | DefinitionContainerSearchResultsTreeNode
  | SubCategorySearchResultsTreeNode
  | CategorySearchResultsTreeNode
  | ElementSearchResultsTreeNode
  | ModelSearchResultsTreeNode;

type TemporaryElementSearchResultsNode = Omit<ElementSearchResultsTreeNode, "modelId" | "children"> & {
  modelId: string | undefined;
  children?: SearchResultsTreeNodeChildren<TemporaryElementSearchResultsNode>;
};

type TemporarySearchResultsTreeNode =
  | DefinitionContainerSearchResultsTreeNode
  | SubCategorySearchResultsTreeNode
  | CategorySearchResultsTreeNode
  | TemporaryElementSearchResultsNode
  | ModelSearchResultsTreeNode;

/** @internal */
export async function createCategoriesSearchResultsTree(props: {
  imodelAccess: ECClassHierarchyInspector;
  searchPaths: HierarchySearchPath[];
  categoryClassName: string;
  categoryElementClassName: string;
  categoryModelClassName: string;
  idsCache: CategoriesTreeIdsCache;
}): Promise<SearchResultsTree<CategoriesTreeSearchTargets>> {
  const { imodelAccess, searchPaths, categoryClassName, categoryElementClassName, categoryModelClassName, idsCache } = props;
  return createSearchResultsTree({
    searchResultsNodesHandler: new CategoriesTreeSearchResultsNodesHandler({
      idsCache,
      imodelAccess,
      categoryClassName,
      categoryElementClassName,
      categoryModelClassName,
    }),
    searchPaths,
  });
}

interface SearchTargetsInternal {
  elements?: Map<ModelCategoryKey, Map<ElementId, { isSearchTarget: boolean }>>;
  categories?: Map<ModelId | undefined, Set<CategoryId>>;
  definitionContainerIds?: Id64Set;
  modelIds?: Id64Set;
  subCategories?: Map<CategoryId, Set<SubCategoryId>>;
}

interface CategoriesTreeSearchResultsNodesHandlerProps {
  idsCache: CategoriesTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  categoryClassName: string;
  categoryElementClassName: string;
  categoryModelClassName: string;
}

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

interface ProcessedSearchResultsNodes {
  searchResultsElements: Map<Id64String, Omit<ElementSearchResultsTreeNode, "children">>;
}

class CategoriesTreeSearchResultsNodesHandler extends SearchResultsNodesHandler<ProcessedSearchResultsNodes, CategoriesTreeSearchTargets, TemporarySearchResultsTreeNode> {
  readonly #props: CategoriesTreeSearchResultsNodesHandlerProps;
  constructor(props: CategoriesTreeSearchResultsNodesHandlerProps) {
    super();
    this.#props = props;
  }

  public async getProcessedSearchResultsNodes(): Promise<ProcessedSearchResultsNodes> {
    const searchResultsTemporaryElements = new Map<Id64String, Omit<TemporaryElementSearchResultsNode, "children">>();
    const result: ProcessedSearchResultsNodes = {
      searchResultsElements: new Map(),
    };
    this.searchResultsNodesArr.forEach((node) => {
      if (node.type === "element") {
        searchResultsTemporaryElements.set(node.id, node);
      }
    });

    const searchResultsElementsModels = await firstValueFrom(this.#props.idsCache.getFilteredElementsModels([...searchResultsTemporaryElements.keys()]));
    searchResultsTemporaryElements.forEach((element, id) => {
      const modelId = searchResultsElementsModels.get(element.id);
      assert(modelId !== undefined);
      result.searchResultsElements.set(id, { ...element, modelId });
    });
    return result;
  }

  public convertNodesToSearchTargets(
    searchResultsNodes: TemporarySearchResultsTreeNode[],
    processedSearchResultsNodes: ProcessedSearchResultsNodes,
  ): CategoriesTreeSearchTargets | undefined {
    const searchTargets: SearchTargetsInternal = {};

    searchResultsNodes.forEach((searchResultsNode) => this.collectSearchTargets(searchTargets, searchResultsNode, processedSearchResultsNodes));

    return this.convertInternalSearchTargets(searchTargets);
  }

  private convertInternalSearchTargets(searchTargets: SearchTargetsInternal): CategoriesTreeSearchTargets | undefined {
    if (
      !searchTargets.categories &&
      !searchTargets.definitionContainerIds &&
      !searchTargets.elements &&
      !searchTargets.modelIds &&
      !searchTargets.subCategories
    ) {
      return undefined;
    }
    return {
      categories: searchTargets.categories
        ? [...searchTargets.categories.entries()].map(([modelId, categoryIds]) => {
            return { modelId, categoryIds };
          })
        : undefined,
      elements: searchTargets.elements
        ? [...searchTargets.elements.entries()].map(([modelCategoryKey, elements]) => {
            const { modelId, categoryId } = this.parseModelCategoryKey(modelCategoryKey);
            return { modelId, categoryId, elements };
          })
        : undefined,
      definitionContainerIds: searchTargets.definitionContainerIds,
      modelIds: searchTargets.modelIds,
      subCategories: searchTargets.subCategories
        ? [...searchTargets.subCategories.entries()].map(([categoryId, subCategoryIds]) => {
            return { categoryId, subCategoryIds };
          })
        : undefined,
    };
  }

  private collectSearchTargets(searchTargets: SearchTargetsInternal, node: TemporarySearchResultsTreeNode, processedSearchResultsNodes: ProcessedSearchResultsNodes) {
    const searchResultsNode = node.type !== "element" ? node : processedSearchResultsNodes.searchResultsElements.get(node.id);
    assert(searchResultsNode !== undefined);
    if (searchResultsNode.isSearchTarget) {
      this.addTarget(searchTargets, searchResultsNode);
      return;
    }

    if (searchResultsNode.type === "element") {
      // need to add parent ids as search target will be an element
      this.addTarget(searchTargets, searchResultsNode);
    }

    if (!node.children) {
      return;
    }

    for (const child of node.children.values()) {
      this.collectSearchTargets(searchTargets, child, processedSearchResultsNodes);
    }
  }

  private addTarget(searchTargets: SearchTargetsInternal, node: SearchResultsTreeNode) {
    switch (node.type) {
      case "definitionContainer":
        (searchTargets.definitionContainerIds ??= new Set()).add(node.id);
        return;
      case "model":
        (searchTargets.modelIds ??= new Set()).add(node.id);
        return;
      case "subCategory":
        const subCategories = (searchTargets.subCategories ??= new Map()).get(node.categoryId);
        if (subCategories) {
          subCategories.add(node.id);
          return;
        }
        searchTargets.subCategories.set(node.categoryId, new Set([node.id]));
        return;
      case "category":
        const categories = (searchTargets.categories ??= new Map()).get(node.modelId);
        if (!categories) {
          categories.add(node.id);
          return;
        }
        searchTargets.categories.set(node.modelId, new Set([node.id]));
        return;
      case "element":
        const modelCategoryKey = this.createModelCategoryKey(node.modelId, node.categoryId);
        const elements = (searchTargets.elements ??= new Map()).get(modelCategoryKey);
        if (elements) {
          elements.set(node.id, { isSearchTarget: node.isSearchTarget });
        } else {
          searchTargets.elements.set(modelCategoryKey, new Map([[node.id, { isSearchTarget: node.isSearchTarget }]]));
        }
    }
  }

  private createModelCategoryKey(modelId: Id64String, categoryId: Id64String): ModelCategoryKey {
    return `${modelId}-${categoryId}`;
  }

  private parseModelCategoryKey(key: ModelCategoryKey): { modelId: Id64String; categoryId: Id64String } {
    const [modelId, categoryId] = key.split("-");
    return { modelId, categoryId };
  }

  public createSearchResultsTreeNode({
    type,
    id,
    isSearchTarget,
    parent,
  }: {
    type: SearchResultsTreeNode["type"];
    id: Id64String;
    isSearchTarget: boolean;
    parent: TemporarySearchResultsTreeNode | SearchResultsTreeRootNode<TemporarySearchResultsTreeNode>;
  }): TemporarySearchResultsTreeNode {
    if (type === "definitionContainer") {
      return {
        id,
        isSearchTarget,
        type,
      };
    }
    if (type === "subCategory") {
      assert("id" in parent);
      return {
        id,
        isSearchTarget,
        type,
        categoryId: parent.id,
      };
    }
    if (type === "category") {
      if ("type" in parent && parent.type === "model") {
        return {
          id,
          isSearchTarget,
          type,
          modelId: parent.id,
        };
      }
      return {
        id,
        isSearchTarget,
        type,
      };
    }
    if (type === "model") {
      assert("id" in parent);
      return {
        id,
        isSearchTarget,
        type,
        categoryId: parent.type === "category" ? parent.id : undefined,
      };
    }

    if ("type" in parent) {
      if (parent.type === "category") {
        return {
          id,
          isSearchTarget,
          type,
          categoryId: parent.id,
          modelId: undefined,
        };
      }
      assert(parent.type === "element");
      return {
        id,
        isSearchTarget,
        type,
        categoryId: parent.categoryId,
        modelId: undefined,
      };
    }

    throw new Error("Invalid parent node type");
  }

  public async getType(className: string): Promise<TemporarySearchResultsTreeNode["type"]> {
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_SubCategory)) {
      return "subCategory";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, this.#props.categoryElementClassName)) {
      return "element";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, this.#props.categoryClassName)) {
      return "category";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, this.#props.categoryModelClassName)) {
      return "model";
    }
    return "definitionContainer";
  }
}
