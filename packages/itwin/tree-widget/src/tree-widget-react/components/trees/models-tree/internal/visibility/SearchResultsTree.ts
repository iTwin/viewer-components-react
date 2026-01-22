/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { CLASS_NAME_Category, CLASS_NAME_GeometricElement3d, CLASS_NAME_Model, CLASS_NAME_Subject } from "../../../common/internal/ClassNameDefinitions.js";
import { createSearchResultsTree, SearchResultsNodesHandler } from "../../../common/internal/visibility/BaseSearchResultsTree.js";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchySearchPath } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector, InstanceKey } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId } from "../../../common/internal/Types.js";
import type {
  BaseSearchResultsTreeNode,
  SearchResultsNodeIdentifierAsString,
  SearchResultsTree,
  SearchResultsTreeRootNode,
} from "../../../common/internal/visibility/BaseSearchResultsTree.js";

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
  elements?: Array<{ pathToElements: InstanceKey[]; modelId: Id64String; categoryId: Id64String; elements: Map<ElementId, { isSearchTarget: boolean }> }>;
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

type SearchTargetsInternalElements = Map<
  SearchResultsNodeIdentifierAsString,
  { children?: SearchTargetsInternalElements; modelCategoryElements?: Map<ModelCategoryKey, Map<ElementId, { isSearchTarget: boolean }>> }
>;

interface SearchTargetsInternal {
  subjectIds?: Id64Set;
  modelIds?: Id64Set;
  categories?: Map<ModelId, Set<CategoryId>>;
  elements?: SearchTargetsInternalElements;
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

  private convertInternalSearchTargetElementsRecursively(
    searchTargetsInternalElements: SearchTargetsInternalElements,
    currentPath: InstanceKey[],
  ): Required<ModelsTreeSearchTargets>["elements"] {
    const result: Required<ModelsTreeSearchTargets>["elements"] = [];
    // Internal search target elements are stored in a tree structure, need to convert that to array structure.
    searchTargetsInternalElements.forEach((entry, identifierAsString) => {
      const identifier = this.convertSearchResultsNodeIdentifierStringToHierarchyNodeIdentifier(identifierAsString);
      if (entry.modelCategoryElements) {
        entry.modelCategoryElements.forEach((elements, modelCategoryKey) => {
          const { modelId, categoryId } = this.parseModelCategoryKey(modelCategoryKey);
          result.push({ pathToElements: [...currentPath, identifier], modelId, categoryId, elements });
        });
      }
      if (entry.children) {
        result.push(...this.convertInternalSearchTargetElementsRecursively(entry.children, [...currentPath, identifier]));
      }
    });
    return result;
  }

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
      elements: searchTargets.elements ? this.convertInternalSearchTargetElementsRecursively(searchTargets.elements, []) : undefined,
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
        // Internal search target elements need to have path saved in some way.
        // For this, a tree structure is used, where keys are stringified identifiers of parent nodes depending on the hierarchy.
        const modelCategoryKey = this.createModelCategoryKey(node.modelId, node.categoryId);
        searchTargets.elements ??= new Map();
        let entry = searchTargets.elements;
        for (let i = 0; i < node.pathToNode.length; ++i) {
          const identifierAsString = this.convertSearchResultsNodeIdentifierToString(node.pathToNode[i]);
          let identifierEntry = entry.get(identifierAsString);
          // create a new entry for parent node if it does not exist
          if (!identifierEntry) {
            identifierEntry = {};
            entry.set(identifierAsString, identifierEntry);
          }
          // last entry in the path don't need to have children
          if (i < node.pathToNode.length - 1) {
            identifierEntry.children ??= new Map();
            entry = identifierEntry.children;
            continue;
          }

          if (!identifierEntry.modelCategoryElements) {
            identifierEntry.modelCategoryElements = new Map();
          }
          // Add elements who share the same path to the modelCategoryElements map
          const elements = (identifierEntry.modelCategoryElements ??= new Map()).get(modelCategoryKey);
          if (elements) {
            elements.set(node.id, { isSearchTarget: node.isSearchTarget });
          } else {
            identifierEntry.modelCategoryElements.set(modelCategoryKey, new Map([[node.id, { isSearchTarget: node.isSearchTarget }]]));
          }
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
    const pathToNode = "pathToNode" in parent ? [...parent.pathToNode, { type: parent.type, id: parent.id }] : [];
    if (type === "subject" || type === "model") {
      return {
        id,
        isSearchTarget,
        type,
        pathToNode,
        children: undefined,
      };
    }

    if (type === "category") {
      assert("type" in parent && parent.type === "model");
      return {
        id,
        isSearchTarget,
        type,
        modelId: parent.id,
        pathToNode,
      };
    }

    if ("type" in parent && parent.type === "category") {
      return {
        id,
        isSearchTarget,
        type,
        modelId: parent.modelId,
        categoryId: parent.id,
        pathToNode,
      };
    }

    if ("type" in parent && parent.type === "element") {
      return {
        id,
        isSearchTarget,
        type,
        modelId: parent.modelId,
        categoryId: parent.categoryId,
        pathToNode,
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

  public getClassName(type: SearchResultsTreeNode["type"]): string {
    switch (type) {
      case "subject":
        return CLASS_NAME_Subject;
      case "model":
        return CLASS_NAME_Model;
      case "category":
        return CLASS_NAME_Category;
      default:
        return CLASS_NAME_GeometricElement3d;
    }
  }
}
