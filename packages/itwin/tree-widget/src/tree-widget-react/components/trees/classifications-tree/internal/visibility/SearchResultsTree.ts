/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { CLASS_NAME_Classification, CLASS_NAME_ClassificationTable, CLASS_NAME_GeometricElement2d } from "../../../common/internal/ClassNameDefinitions.js";
import { createSearchResultsTree, SearchResultsNodesHandler } from "../../../common/internal/visibility/BaseSearchResultsTree.js";

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { HierarchySearchPath } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { CategoryId, ElementId, ModelId } from "../../../common/internal/Types.js";
import type { BaseSearchResultsTreeNode, SearchResultsTree, SearchResultsTreeNodeChildren } from "../../../common/internal/visibility/BaseSearchResultsTree.js";
import type { ClassificationsTreeIdsCache } from "../ClassificationsTreeIdsCache.js";

interface ClassificationTableSearchResultsTreeNode extends BaseSearchResultsTreeNode<ClassificationTableSearchResultsTreeNode> {
  type: "classificationTable";
}

interface ClassificationSearchResultsTreeNode extends BaseSearchResultsTreeNode<ClassificationSearchResultsTreeNode> {
  type: "classification";
}

interface Element2dSearchResultsTreeNode extends BaseSearchResultsTreeNode<Element2dSearchResultsTreeNode> {
  type: "element2d";
  categoryId: Id64String;
  modelId: Id64String;
}

interface Element3dSearchResultsTreeNode extends BaseSearchResultsTreeNode<Element3dSearchResultsTreeNode> {
  type: "element3d";
  categoryId: Id64String;
  modelId: Id64String;
}

type SearchResultsTreeNode = ClassificationTableSearchResultsTreeNode | ClassificationSearchResultsTreeNode | Element2dSearchResultsTreeNode | Element3dSearchResultsTreeNode;

type TemporaryElement2dSearchResultsNode = Omit<Element2dSearchResultsTreeNode, "modelId" | "categoryId" | "children"> & {
  modelId: string | undefined;
  categoryId: string | undefined;
  children?: SearchResultsTreeNodeChildren<TemporaryElement2dSearchResultsNode>;
};

type TemporaryElement3dSearchResultsNode = Omit<Element3dSearchResultsTreeNode, "modelId" | "categoryId" | "children"> & {
  modelId: string | undefined;
  categoryId: string | undefined;
  children?: SearchResultsTreeNodeChildren<TemporaryElement3dSearchResultsNode>;
};

type TemporarySearchResultsTreeNode =
  | ClassificationTableSearchResultsTreeNode
  | ClassificationSearchResultsTreeNode
  | TemporaryElement2dSearchResultsNode
  | TemporaryElement3dSearchResultsNode;

/** @internal */
export interface ClassificationsTreeSearchTargets {
  elements2d?: Array<{ modelId: Id64String; categoryId: Id64String; elements: Map<ElementId, { isSearchTarget: boolean }> }>;
  elements3d?: Array<{ modelId: Id64String; categoryId: Id64String; elements: Map<ElementId, { isSearchTarget: boolean }> }>;
  classificationTableIds?: Id64Set;
  classificationIds?: Id64Set;
}

/** @internal */
export async function createClassificationsSearchResultsTree(props: {
  imodelAccess: ECClassHierarchyInspector;
  searchPaths: HierarchySearchPath[];
  idsCache: ClassificationsTreeIdsCache;
}): Promise<SearchResultsTree<ClassificationsTreeSearchTargets>> {
  const { imodelAccess, searchPaths, idsCache } = props;
  return createSearchResultsTree({
    searchResultsNodesHandler: new ClassificationsTreeSearchResultsNodesHandler({ idsCache, imodelAccess }),
    searchPaths,
  });
}

interface SearchTargetsInternal {
  elements2d?: Map<ModelCategoryKey, Map<ElementId, { isSearchTarget: boolean }>>;
  elements3d?: Map<ModelCategoryKey, Map<ElementId, { isSearchTarget: boolean }>>;
  classificationTableIds?: Id64Set;
  classificationIds?: Id64Set;
}

interface ClassificationsTreeSearchResultsNodesHandlerProps {
  idsCache: ClassificationsTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
}

type ModelCategoryKey = `${ModelId}-${CategoryId}`;

interface ProcessedSearchResultsNodes {
  searchResults2dElements: Map<Id64String, Omit<Element2dSearchResultsTreeNode, "children">>;
  searchResults3dElements: Map<Id64String, Omit<Element3dSearchResultsTreeNode, "children">>;
}

class ClassificationsTreeSearchResultsNodesHandler extends SearchResultsNodesHandler<
  ProcessedSearchResultsNodes,
  ClassificationsTreeSearchTargets,
  TemporarySearchResultsTreeNode
> {
  readonly #props: ClassificationsTreeSearchResultsNodesHandlerProps;
  constructor(props: ClassificationsTreeSearchResultsNodesHandlerProps) {
    super();
    this.#props = props;
  }

  public async getProcessedSearchResultsNodes(): Promise<ProcessedSearchResultsNodes> {
    const searchResultsTemporary2dElements = new Map<Id64String, Omit<TemporaryElement2dSearchResultsNode, "children">>();
    const searchResultsTemporary3dElements = new Map<Id64String, Omit<TemporaryElement3dSearchResultsNode, "children">>();
    const result: ProcessedSearchResultsNodes = {
      searchResults2dElements: new Map(),
      searchResults3dElements: new Map(),
    };
    for (const node of this.searchResultsNodesArr) {
      if (node.type === "element2d") {
        searchResultsTemporary2dElements.set(node.id, node);
      } else if (node.type === "element3d") {
        searchResultsTemporary3dElements.set(node.id, node);
      }
    }

    const searchResultsElementsModels = await firstValueFrom(
      this.#props.idsCache.getFilteredElementsData({
        element2dIds: [...searchResultsTemporary2dElements.keys()],
        element3dIds: [...searchResultsTemporary3dElements.keys()],
      }),
    );
    searchResultsTemporary2dElements.forEach((element, id) => {
      const entry = searchResultsElementsModels.get(element.id);
      assert(entry !== undefined);
      result.searchResults2dElements.set(id, { ...element, modelId: entry.modelId, categoryId: entry.categoryId });
    });
    searchResultsTemporary3dElements.forEach((element, id) => {
      const entry = searchResultsElementsModels.get(element.id);
      assert(entry !== undefined);
      result.searchResults3dElements.set(id, { ...element, modelId: entry.modelId, categoryId: entry.categoryId });
    });
    return result;
  }

  public convertNodesToSearchTargets(
    searchResultsNodes: TemporarySearchResultsTreeNode[],
    processedSearchResultsNodes: ProcessedSearchResultsNodes,
  ): ClassificationsTreeSearchTargets | undefined {
    const searchTargets: SearchTargetsInternal = {};

    searchResultsNodes.forEach((searchResultsNode) => this.collectSearchTargets(searchTargets, searchResultsNode, processedSearchResultsNodes));

    return this.convertInternalSearchTargets(searchTargets);
  }

  private convertInternalSearchTargets(searchTargets: SearchTargetsInternal): ClassificationsTreeSearchTargets | undefined {
    if (!searchTargets.classificationIds && !searchTargets.classificationIds && !searchTargets.elements2d && !searchTargets.elements3d) {
      return undefined;
    }

    return {
      classificationIds: searchTargets.classificationIds,
      classificationTableIds: searchTargets.classificationIds,
      elements2d: searchTargets.elements2d
        ? [...searchTargets.elements2d?.entries()].map(([modelCategoryKey, elements]) => {
            const { modelId, categoryId } = this.parseModelCategoryKey(modelCategoryKey);
            return { modelId, categoryId, elements };
          })
        : undefined,
      elements3d: searchTargets.elements3d
        ? [...searchTargets.elements3d?.entries()].map(([modelCategoryKey, elements]) => {
            const { modelId, categoryId } = this.parseModelCategoryKey(modelCategoryKey);
            return { modelId, categoryId, elements };
          })
        : undefined,
    };
  }

  private collectSearchTargets(searchTargets: SearchTargetsInternal, node: TemporarySearchResultsTreeNode, processedSearchResultsNodes: ProcessedSearchResultsNodes) {
    const searchResultsNode =
      node.type === "element2d"
        ? processedSearchResultsNodes.searchResults2dElements.get(node.id)
        : node.type === "element3d"
          ? processedSearchResultsNodes.searchResults3dElements.get(node.id)
          : node;
    assert(searchResultsNode !== undefined);
    if (searchResultsNode.isSearchTarget) {
      this.addTarget(searchTargets, searchResultsNode);
      return;
    }

    if (searchResultsNode.type === "element2d" || searchResultsNode.type === "element3d") {
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
      case "classificationTable":
        (searchTargets.classificationTableIds ??= new Set()).add(node.id);
        return;
      case "classification":
        (searchTargets.classificationIds ??= new Set()).add(node.id);
        return;
      case "element2d":
        const element2dKey = this.createModelCategoryKey(node.modelId, node.categoryId);
        const elements2d = (searchTargets.elements2d ??= new Map()).get(element2dKey);
        if (elements2d) {
          elements2d.set(node.id, { isSearchTarget: node.isSearchTarget });
        } else {
          searchTargets.elements2d.set(element2dKey, new Map([[node.id, { isSearchTarget: node.isSearchTarget }]]));
        }
        return;
      case "element3d":
        const element3dKey = this.createModelCategoryKey(node.modelId, node.categoryId);
        const elements3d = (searchTargets.elements3d ??= new Map()).get(element3dKey);
        if (elements3d) {
          elements3d.set(node.id, { isSearchTarget: node.isSearchTarget });
        } else {
          searchTargets.elements3d.set(element3dKey, new Map([[node.id, { isSearchTarget: node.isSearchTarget }]]));
        }
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

  public createSearchResultsTreeNode({
    type,
    id,
    isSearchTarget,
  }: {
    type: SearchResultsTreeNode["type"];
    id: Id64String;
    isSearchTarget: boolean;
  }): TemporarySearchResultsTreeNode {
    if (type === "element2d" || type === "element3d") {
      return {
        id,
        isSearchTarget,
        type,
        modelId: undefined,
        categoryId: undefined,
      };
    }
    return {
      id,
      isSearchTarget,
      type,
    };
  }

  public async getType(className: string): Promise<TemporarySearchResultsTreeNode["type"]> {
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
