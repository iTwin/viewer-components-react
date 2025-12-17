/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { CLASS_NAME_Category, CLASS_NAME_Model, CLASS_NAME_Subject } from "../../../common/internal/ClassNameDefinitions.js";
import { createSearchResultsTree, SearchResultsNodesHandler } from "../../../common/internal/visibility/BaseSearchResultsTree.js";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchySearchPath } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId } from "../../../common/internal/Types.js";
import type { BaseSearchResultsTreeNode, SearchResultsTree, SearchResultsTreeRootNode } from "../../../common/internal/visibility/BaseSearchResultsTree.js";

interface GenericSearchResultsTreeNode extends BaseSearchResultsTreeNode<GenericSearchResultsTreeNode> {
  type: "subject" | "model";
}

interface CategorySearchResultsTreeNode extends BaseSearchResultsTreeNode<CategorySearchResultsTreeNode> {
  type: "category";
  modelId: Id64String;
}

interface ElementSearchResultsTreeNode extends BaseSearchResultsTreeNode<ElementSearchResultsTreeNode> {
  type: "element";
  modelId: Id64String;
  categoryId: Id64String;
}

type SearchResultsTreeNode = GenericSearchResultsTreeNode | CategorySearchResultsTreeNode | ElementSearchResultsTreeNode;

/** @internal */
export interface ModelsTreeSearchTargets {
  subjectIds?: Id64Set;
  modelIds?: Id64Set;
  categories?: Array<{ modelId: Id64String | undefined; categoryIds: Id64Set }>;
  elements?: Array<{ modelId: Id64String; categoryId: Id64String; elements: Map<ElementId, { isSearchTarget: boolean }> }>;
}

/** @internal */
export async function createModelsSearchResultsTree(props: {
  imodelAccess: ECClassHierarchyInspector;
  searchPaths: HierarchySearchPath[];
}): Promise<SearchResultsTree<ModelsTreeSearchTargets>> {
  const { imodelAccess, searchPaths } = props;
  return createSearchResultsTree({
    searchResultsNodesHandler: new ModelsTreeSearchResultsNodesHandler({ imodelAccess }),
    searchPaths,
  });
}

interface SearchTargetsInternal {
  subjectIds?: Id64Set;
  modelIds?: Id64Set;
  categories?: Map<ModelId, Set<CategoryId>>;
  elements?: Map<ModelCategoryKey, Map<ElementId, { isSearchTarget: boolean }>>;
}

interface ModelsTreeSearchResultsNodesHandlerProps {
  imodelAccess: ECClassHierarchyInspector;
}

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

class ModelsTreeSearchResultsNodesHandler extends SearchResultsNodesHandler<void, ModelsTreeSearchTargets, SearchResultsTreeNode> {
  readonly #props: ModelsTreeSearchResultsNodesHandlerProps;
  constructor(props: ModelsTreeSearchResultsNodesHandlerProps) {
    super();
    this.#props = props;
  }

  public convertNodesToSearchTargets(searchResultsNodes: SearchResultsTreeNode[]): ModelsTreeSearchTargets | undefined {
    const searchTargets: SearchTargetsInternal = {};

    searchResultsNodes.forEach((searchResultsNode) => this.collectSearchTargets(searchTargets, searchResultsNode));

    return this.convertInternalSearchTargets(searchTargets);
  }

  public async getProcessedSearchResultsNodes(): Promise<void> {}

  private convertInternalSearchTargets(searchTargets: SearchTargetsInternal): ModelsTreeSearchTargets | undefined {
    if (!searchTargets.categories && !searchTargets.subjectIds && !searchTargets.elements && !searchTargets.modelIds) {
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
      modelIds: searchTargets.modelIds,
      subjectIds: searchTargets.subjectIds,
    };
  }

  private collectSearchTargets(searchTargets: SearchTargetsInternal, searchResultsNode: SearchResultsTreeNode) {
    if (searchResultsNode.isSearchTarget) {
      this.addTarget(searchTargets, searchResultsNode);
      return;
    }

    if (searchResultsNode.type === "element") {
      // need to add parent ids as search target will be an element
      this.addTarget(searchTargets, searchResultsNode);
    }

    if (!searchResultsNode.children) {
      return;
    }

    for (const child of searchResultsNode.children.values()) {
      this.collectSearchTargets(searchTargets, child);
    }
  }

  private addTarget(searchTargets: SearchTargetsInternal, node: SearchResultsTreeNode) {
    switch (node.type) {
      case "subject":
        (searchTargets.subjectIds ??= new Set()).add(node.id);
        return;
      case "model":
        (searchTargets.modelIds ??= new Set()).add(node.id);
        return;
      case "category":
        const categories = (searchTargets.categories ??= new Map()).get(node.modelId);
        if (categories) {
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
    id: string;
    isSearchTarget: boolean;
    parent: SearchResultsTreeNode | SearchResultsTreeRootNode<SearchResultsTreeNode>;
  }): SearchResultsTreeNode {
    if (type === "subject" || type === "model") {
      return {
        id,
        isSearchTarget,
        type,
      };
    }

    if (type === "category") {
      assert("type" in parent && parent.type === "model");
      return {
        id,
        isSearchTarget,
        type,
        modelId: parent.id,
      };
    }

    if ("type" in parent && parent.type === "category") {
      return {
        id,
        isSearchTarget,
        type,
        modelId: parent.modelId,
        categoryId: parent.id,
      };
    }

    if ("type" in parent && parent.type === "element") {
      return {
        id,
        isSearchTarget,
        type,
        modelId: parent.modelId,
        categoryId: parent.categoryId,
      };
    }

    throw new Error("Invalid parent node type");
  }

  public async getType(className: string): Promise<SearchResultsTreeNode["type"]> {
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_Subject)) {
      return "subject";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_Model)) {
      return "model";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_Category)) {
      return "category";
    }
    return "element";
  }
}
