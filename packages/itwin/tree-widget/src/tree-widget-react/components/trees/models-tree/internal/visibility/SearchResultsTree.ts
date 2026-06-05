/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { CLASS_NAME_Category, CLASS_NAME_GeometricElement3d, CLASS_NAME_Model, CLASS_NAME_Subject } from "../../../common/internal/ClassNameDefinitions.js";
import { getOrCreate } from "../../../common/internal/Utils.js";
import { createSearchResultsTree, SearchResultsNodesHandler } from "../../../common/internal/visibility/BaseSearchResultsTree.js";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchySearchTree } from "@itwin/presentation-hierarchies";
import type { EC, ECClassHierarchyInspector, InstanceKey } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId } from "../../../common/internal/Types.js";
import type {
  BaseSearchResultsTreeNode,
  SearchResultsNodeIdentifierAsString,
  SearchResultsTree,
  SearchResultsTreeNodeChildren,
  SearchResultsTreeRootNode,
} from "../../../common/internal/visibility/BaseSearchResultsTree.js";

/** @internal */
export interface ModelsTreeSearchTargets {
  subjectIds?: Id64Set;
  modelIds?: Id64Set;
  categories?: Array<{ modelId: Id64String; categoryIds: Id64Set }>;
  elements?: Array<{
    pathToElements: InstanceKey[];
    modelId: Id64String;
    categoryId: Id64String;
    searchTargetElements: Array<ElementId>;
    nonSearchTargetElements: Array<ElementId>;
    topMostParentElementId?: Id64String;
  }>;
}

/** @internal */
export async function createModelsSearchResultsTree(props: {
  imodelAccess: ECClassHierarchyInspector;
  searchPaths: HierarchySearchTree[];
}): Promise<SearchResultsTree<ModelsTreeSearchTargets>> {
  const { imodelAccess, searchPaths } = props;
  return createSearchResultsTree({
    searchResultsNodesHandler: new ModelsTreeSearchResultsNodesHandler({ imodelAccess }),
    searchPaths,
  });
}

interface SubjectNode extends BaseSearchResultsTreeNode<Node> {
  type: "subject";
}

interface ModelNode extends BaseSearchResultsTreeNode<Node> {
  type: "model";
}
interface CategoryNode extends BaseSearchResultsTreeNode<Node> {
  type: "category";
  modelId: Id64String;
}

interface ElementNode extends BaseSearchResultsTreeNode<Node> {
  type: "element";
  modelId: Id64String;
  categoryId: Id64String;
}

type Node = SubjectNode | ModelNode | CategoryNode | ElementNode;

type RawSubjectNode = Omit<SubjectNode, "children"> & {
  children?: SearchResultsTreeNodeChildren<RawNode>;
};
type RawModelNode = Omit<ModelNode, "children"> & {
  children?: SearchResultsTreeNodeChildren<RawNode>;
};
type RawCategoryNode = Omit<CategoryNode, "children"> & {
  children?: SearchResultsTreeNodeChildren<RawNode>;
};
type RawElementNode = Omit<ElementNode, "children"> & {
  children?: SearchResultsTreeNodeChildren<RawNode>;
};

type RawNode = RawElementNode | RawModelNode | RawSubjectNode | RawCategoryNode;

type InternalSearchTargetElements = Map<
  SearchResultsNodeIdentifierAsString,
  {
    children?: InternalSearchTargetElements;
    topMostParentElementId?: Id64String;
    modelCategoryElements?: Map<ModelCategoryKey, { searchTargets: Array<ElementId>; nonSearchTargets: Array<ElementId> }>;
  }
>;
interface InternalSearchTargets {
  subjectIds?: Id64Set;
  modelIds?: Id64Set;
  categories?: Map<ModelId, Set<CategoryId>>;
  elements?: InternalSearchTargetElements;
}

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

interface ModelsTreeSearchResultsNodesHandlerProps {
  imodelAccess: ECClassHierarchyInspector;
}

class ModelsTreeSearchResultsNodesHandler extends SearchResultsNodesHandler<void, ModelsTreeSearchTargets, RawNode> {
  readonly #props: ModelsTreeSearchResultsNodesHandlerProps;
  constructor(props: ModelsTreeSearchResultsNodesHandlerProps) {
    super();
    this.#props = props;
  }

  public convertNodesToSearchTargets(rawNodes: RawNode[]): ModelsTreeSearchTargets | undefined {
    const internalSearchTargets: InternalSearchTargets = {};

    rawNodes.forEach((rawNode) => this.collectSearchTargets(internalSearchTargets, rawNode));

    return this.convertInternalSearchTargets(internalSearchTargets);
  }

  public async getProcessedNodes(): Promise<void> {}

  private convertInternalSearchTargetElementsRecursively(
    internalSearchTargetElements: InternalSearchTargetElements,
    currentPath: InstanceKey[],
  ): Required<ModelsTreeSearchTargets>["elements"] {
    const result: Required<ModelsTreeSearchTargets>["elements"] = [];
    // Internal search target elements are stored in a tree structure, need to convert that to array structure.
    for (const [identifierAsString, entry] of internalSearchTargetElements) {
      const identifier = this.convertSearchResultsNodeIdentifierStringToHierarchyNodeIdentifier(identifierAsString);
      if (entry.modelCategoryElements) {
        for (const [modelCategoryKey, { searchTargets, nonSearchTargets }] of entry.modelCategoryElements) {
          const { modelId, categoryId } = this.parseModelCategoryKey(modelCategoryKey);
          result.push({
            pathToElements: [...currentPath, identifier],
            modelId,
            categoryId,
            nonSearchTargetElements: nonSearchTargets,
            searchTargetElements: searchTargets,
            topMostParentElementId: entry.topMostParentElementId,
          });
        }
      }
      if (entry.children) {
        this.convertInternalSearchTargetElementsRecursively(entry.children, [...currentPath, identifier]).forEach((childValue) => result.push(childValue));
      }
    }
    return result;
  }

  private convertInternalSearchTargets(searchTargets: InternalSearchTargets): ModelsTreeSearchTargets | undefined {
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

  private collectSearchTargets(internalSearchTargets: InternalSearchTargets, rawNode: RawNode) {
    if (rawNode.isSearchTarget) {
      this.addInternalTarget(internalSearchTargets, rawNode);
      return;
    }

    if (rawNode.type === "element") {
      // need to add parent ids as search target will be an element
      this.addInternalTarget(internalSearchTargets, rawNode);
    }

    if (!rawNode.children) {
      return;
    }

    for (const child of rawNode.children.values()) {
      this.collectSearchTargets(internalSearchTargets, child);
    }
  }

  private addInternalTarget(internalSearchTargets: InternalSearchTargets, node: RawSubjectNode | RawModelNode | RawCategoryNode | RawElementNode) {
    switch (node.type) {
      case "subject": {
        (internalSearchTargets.subjectIds ??= new Set()).add(node.id);
        return;
      }
      case "model": {
        (internalSearchTargets.modelIds ??= new Set()).add(node.id);
        return;
      }
      case "category": {
        const categories = getOrCreate({ map: (internalSearchTargets.categories ??= new Map()), key: node.modelId, createFunc: () => new Set<CategoryId>() });
        categories.add(node.id);
        return;
      }
      case "element": {
        // Internal search target elements need to have path saved in some way.
        // For this, a tree structure is used, where keys are stringified identifiers of parent nodes depending on the hierarchy.
        const modelCategoryKey = this.createModelCategoryKey(node.modelId, node.categoryId);
        internalSearchTargets.elements ??= new Map();
        let entry = internalSearchTargets.elements;
        let topMostParentElementId: Id64String | undefined;
        for (let i = 0; i < node.pathToNode.length; ++i) {
          if (topMostParentElementId === undefined && node.pathToNode[i].type === "element") {
            topMostParentElementId = node.pathToNode[i].id;
          }
          const identifierAsString = this.convertSearchResultsNodeIdentifierToString(node.pathToNode[i]);
          const identifierEntry = getOrCreate({ map: entry, key: identifierAsString, createFunc: () => ({ topMostParentElementId }) });
          // last entry in the path don't need to have children
          if (i < node.pathToNode.length - 1) {
            identifierEntry.children ??= new Map();
            entry = identifierEntry.children;
            continue;
          }

          // Add elements who share the same path to the modelCategoryElements map
          identifierEntry.modelCategoryElements ??= new Map();
          const elements = getOrCreate({
            map: identifierEntry.modelCategoryElements,
            key: modelCategoryKey,
            createFunc: () => ({ searchTargets: [], nonSearchTargets: [] }),
          });
          if (node.isSearchTarget) {
            elements.searchTargets.push(node.id);
          } else {
            elements.nonSearchTargets.push(node.id);
          }
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

  public createNode({
    type,
    id,
    isSearchTarget,
    parent,
  }: {
    type: RawNode["type"];
    id: Id64String;
    isSearchTarget: boolean;
    parent: RawNode | SearchResultsTreeRootNode<RawNode>;
  }): RawNode {
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

  public async getType(className: EC.FullClassName): Promise<Node["type"]> {
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

  public getClassName(type: Node["type"]): EC.FullClassName {
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
