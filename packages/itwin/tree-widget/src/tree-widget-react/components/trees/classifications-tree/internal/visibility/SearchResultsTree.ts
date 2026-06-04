/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { CLASS_NAME_Classification, CLASS_NAME_ClassificationTable, CLASS_NAME_GeometricElement3d } from "../../../common/internal/ClassNameDefinitions.js";
import { getOrCreate, ParentElementsPath } from "../../../common/internal/Utils.js";
import { createSearchResultsTree, SearchResultsNodesHandler } from "../../../common/internal/visibility/BaseSearchResultsTree.js";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchySearchTree } from "@itwin/presentation-hierarchies";
import type { EC, ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId } from "../../../common/internal/Types.js";
import type {
  BaseSearchResultsTreeNode,
  SearchResultsTree,
  SearchResultsTreeNodeChildren,
  SearchResultsTreeRootNode,
} from "../../../common/internal/visibility/BaseSearchResultsTree.js";
import type { ClassificationsTreeIdsCache } from "../ClassificationsTreeIdsCache.js";

/** @internal */
export interface ClassificationsTreeSearchTargets {
  elements?: Array<{
    modelId: Id64String;
    categoryId: Id64String;
    searchTargetElements: Array<ElementId>;
    nonSearchTargetElements: Array<ElementId>;
    parentElementsPath: ParentElementsPath;
  }>;
  classificationTableIds?: Id64Set;
  classificationIds?: Id64Set;
}

/** @internal */
export async function createClassificationsSearchResultsTree(props: {
  imodelAccess: ECClassHierarchyInspector;
  searchPaths: HierarchySearchTree[];
  idsCache: ClassificationsTreeIdsCache;
}): Promise<SearchResultsTree<ClassificationsTreeSearchTargets>> {
  const { imodelAccess, searchPaths, idsCache } = props;
  return createSearchResultsTree({
    searchResultsNodesHandler: new ClassificationsTreeNodesHandler({ idsCache, imodelAccess }),
    searchPaths,
  });
}

interface ClassificationTableNode extends BaseSearchResultsTreeNode<Node> {
  type: "classificationTable";
}

interface ClassificationNode extends BaseSearchResultsTreeNode<Node> {
  type: "classification";
}

interface ElementNode extends BaseSearchResultsTreeNode<Node> {
  type: "element";
  categoryId: Id64String;
  modelId: Id64String;
  parentElementsPath: ParentElementsPath;
}

type Node = ClassificationTableNode | ClassificationNode | ElementNode;

type TemporaryClassificationTableNode = Omit<ClassificationTableNode, "children"> & {
  children?: SearchResultsTreeNodeChildren<TemporaryNode>;
};

type TemporaryClassificationNode = Omit<ClassificationNode, "children"> & {
  children?: SearchResultsTreeNodeChildren<TemporaryNode>;
};

type TemporaryElementNode = Omit<ElementNode, "modelId" | "categoryId" | "children" | "parentElementsPath"> & {
  modelId: Id64String | undefined;
  categoryId: Id64String | undefined;
  parentElementPathWithoutCategories: ParentElementsPath;
  children?: SearchResultsTreeNodeChildren<TemporaryNode>;
};

type TemporaryNode = TemporaryClassificationTableNode | TemporaryClassificationNode | TemporaryElementNode;

type InternalSearchTargetElements = Map<
  ModelId,
  Map<
    ElementId | undefined,
    {
      parentElementsPath: ParentElementsPath;
      elements: Map<CategoryId, Map<ElementId, { isSearchTarget: boolean }>>;
    }
  >
>;

interface InternalSearchTargets {
  elements?: InternalSearchTargetElements;
  classificationTableIds?: Id64Set;
  classificationIds?: Id64Set;
}

interface ClassificationsTreeNodesHandlerProps {
  idsCache: ClassificationsTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
}

interface ProcessedNodes {
  searchResultsElements: Map<ElementId, Omit<ElementNode, "children">>;
}

class ClassificationsTreeNodesHandler extends SearchResultsNodesHandler<ProcessedNodes, ClassificationsTreeSearchTargets, Node, TemporaryNode> {
  readonly #props: ClassificationsTreeNodesHandlerProps;
  constructor(props: ClassificationsTreeNodesHandlerProps) {
    super();
    this.#props = props;
  }

  public async getProcessedNodes(): Promise<ProcessedNodes> {
    const temporaryElementsArray = new Array<Omit<TemporaryElementNode, "children">>();
    const result: ProcessedNodes = {
      searchResultsElements: new Map(),
    };
    for (const node of this.searchResultsNodesArr) {
      if (node.type === "element") {
        temporaryElementsArray.push(node);
      }
    }

    const searchResultsElementsData = await firstValueFrom(
      this.#props.idsCache.getFilteredElementsData({
        elementIds: temporaryElementsArray.map((element) => element.id),
      }),
    );
    for (const element of temporaryElementsArray) {
      const entry = searchResultsElementsData.get(element.id);
      assert(entry !== undefined);
      const parentElementsPath: ParentElementsPath = [];
      for (const { parentIds } of element.parentElementPathWithoutCategories) {
        assert(parentIds.length === 1);
        const categoryId = searchResultsElementsData.get(parentIds[0])?.categoryId;
        assert(categoryId !== undefined);
        ParentElementsPath.appendToPath({
          path: parentElementsPath,
          ids: parentIds[0],
          categoryId,
        });
      }
      result.searchResultsElements.set(element.id, {
        ...element,
        modelId: entry.modelId,
        categoryId: entry.categoryId,
        parentElementsPath,
      });
    }
    return result;
  }

  public convertNodesToSearchTargets(temporaryNodes: TemporaryNode[], processedNodes: ProcessedNodes): ClassificationsTreeSearchTargets | undefined {
    const internalSearchTargets: InternalSearchTargets = {};

    temporaryNodes.forEach((temporaryNode) => this.collectSearchTargets(internalSearchTargets, temporaryNode, processedNodes));

    return this.convertInternalSearchTargets(internalSearchTargets);
  }

  private convertInternalSearchTargetElements(
    internalSearchTargetElements: InternalSearchTargetElements,
  ): Required<ClassificationsTreeSearchTargets>["elements"] {
    const result: Required<ClassificationsTreeSearchTargets>["elements"] = [];
    for (const [modelId, modelEntry] of internalSearchTargetElements) {
      for (const { parentElementsPath, elements } of modelEntry.values()) {
        for (const [categoryId, categoryEntry] of elements) {
          const searchTargets = new Array<ElementId>();
          const nonSearchTargets = new Array<ElementId>();
          for (const [elementId, { isSearchTarget }] of categoryEntry) {
            if (isSearchTarget) {
              searchTargets.push(elementId);
            } else {
              nonSearchTargets.push(elementId);
            }
          }
          result.push({
            categoryId,
            modelId,
            parentElementsPath,
            nonSearchTargetElements: nonSearchTargets,
            searchTargetElements: searchTargets,
          });
        }
      }
    }
    return result;
  }

  private convertInternalSearchTargets(searchTargets: InternalSearchTargets): ClassificationsTreeSearchTargets | undefined {
    if (!searchTargets.classificationTableIds && !searchTargets.classificationIds && !searchTargets.elements) {
      return undefined;
    }

    return {
      classificationTableIds: searchTargets.classificationTableIds,
      classificationIds: searchTargets.classificationIds,
      elements: searchTargets.elements ? this.convertInternalSearchTargetElements(searchTargets.elements) : undefined,
    };
  }

  private collectSearchTargets(internalSearchTargets: InternalSearchTargets, node: TemporaryNode, processedNodes: ProcessedNodes) {
    const searchResultsNode = node.type === "element" ? processedNodes.searchResultsElements.get(node.id) : node;
    assert(searchResultsNode !== undefined);
    if (searchResultsNode.isSearchTarget) {
      this.addInternalTarget(internalSearchTargets, searchResultsNode);
      return;
    }

    if (searchResultsNode.type === "element") {
      // need to add parent ids as search target will be an element
      this.addInternalTarget(internalSearchTargets, searchResultsNode);
    }

    if (!node.children) {
      return;
    }

    for (const child of node.children.values()) {
      this.collectSearchTargets(internalSearchTargets, child, processedNodes);
    }
  }

  private addInternalTarget(
    internalSearchTargets: InternalSearchTargets,
    node: { type: "classificationTable" | "classification"; id: Id64String; isSearchTarget: boolean } | Omit<ElementNode, "children">,
  ) {
    switch (node.type) {
      case "classificationTable":
        (internalSearchTargets.classificationTableIds ??= new Set()).add(node.id);
        return;
      case "classification":
        (internalSearchTargets.classificationIds ??= new Set()).add(node.id);
        return;
      case "element": {
        internalSearchTargets.elements ??= new Map();
        const modelEntry = getOrCreate({ map: internalSearchTargets.elements, key: node.modelId, createFunc: () => new Map() });
        const lastParentId = ParentElementsPath.getSingleLastParentId(node.parentElementsPath);
        const parentEntry = getOrCreate({
          map: modelEntry,
          key: lastParentId,
          createFunc: () => ({
            parentElementsPath: node.parentElementsPath,
            elements: new Map(),
          }),
        });
        const categoryEntry = getOrCreate({ map: parentEntry.elements, key: node.categoryId, createFunc: () => new Map() });
        categoryEntry.set(node.id, { isSearchTarget: node.isSearchTarget });
      }
    }
  }

  public createTemporaryNode({
    type,
    id,
    isSearchTarget,
    parent,
  }: {
    type: TemporaryNode["type"];
    id: Id64String;
    isSearchTarget: boolean;
    parent: TemporaryNode | SearchResultsTreeRootNode<TemporaryNode>;
  }): TemporaryNode {
    if (type === "classificationTable" || type === "classification") {
      return {
        id,
        isSearchTarget,
        type,
      };
    }

    // type === "element"
    if ("type" in parent && parent.type === "element") {
      return {
        id,
        isSearchTarget,
        type,
        categoryId: undefined,
        modelId: undefined,
        parentElementPathWithoutCategories: ParentElementsPath.appendToPath({
          path: parent.parentElementPathWithoutCategories,
          ids: parent.id,
          categoryId: "",
        }),
      };
    }
    // Parent is classification or root
    return {
      id,
      isSearchTarget,
      type,
      categoryId: undefined,
      modelId: undefined,
      parentElementPathWithoutCategories: [],
    };
  }

  public async getType(className: EC.FullClassName): Promise<TemporaryNode["type"]> {
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_ClassificationTable)) {
      return "classificationTable";
    }
    if (await this.#props.imodelAccess.classDerivesFrom(className, CLASS_NAME_Classification)) {
      return "classification";
    }
    return "element";
  }

  public getClassName(type: TemporaryNode["type"]): EC.FullClassName {
    switch (type) {
      case "classificationTable":
        return CLASS_NAME_ClassificationTable;
      case "classification":
        return CLASS_NAME_Classification;
      case "element":
        return CLASS_NAME_GeometricElement3d;
    }
  }
}
