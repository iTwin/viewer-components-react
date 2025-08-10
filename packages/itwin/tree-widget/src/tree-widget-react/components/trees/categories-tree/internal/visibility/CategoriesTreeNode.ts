/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { HierarchyNode } from "@itwin/presentation-hierarchies";

import type { Id64String } from "@itwin/core-bentley";
import type {
  ClassGroupingNodeKey,
  GroupingHierarchyNode,
  HierarchyNodeKey,
  InstancesNodeKey,
  NonGroupingHierarchyNode,
} from "@itwin/presentation-hierarchies";
import type { ElementId, ModelId } from "../../../common/internal/Types.js";

interface CategoriesTreeNode {
  key: HierarchyNodeKey;
  extendedData?: { [id: string]: any };
}

/** @internal */
export namespace CategoriesTreeNode {
  /**
   * Determines if node represents an element class grouping node.
   */
  export const isElementClassGroupingNode = (
    node: CategoriesTreeNode,
  ): node is GroupingHierarchyNode & {
    key: ClassGroupingNodeKey;
    extendedData: { categoryId: Id64String; modelElementsMap: Map<ModelId, Set<ElementId>> };
  } => {
    return (
      HierarchyNode.isClassGroupingNode(node) &&
      !!node.extendedData &&
      "categoryId" in node.extendedData &&
      !!node.extendedData.categoryId &&
      "modelElementsMap" in node.extendedData &&
      !!node.extendedData.modelElementsMap
    );
  };
  /**
   * Determines if node represents a definition container.
   */
  export const isDefinitionContainerNode = (node: Pick<CategoriesTreeNode, "extendedData">) =>
    node.extendedData && "isDefinitionContainer" in node.extendedData && !!node.extendedData.isDefinitionContainer;

  /**
   * Determines if node represents a category.
   */
  export const isCategoryNode = (node: Pick<CategoriesTreeNode, "extendedData">) =>
    node.extendedData && "isCategory" in node.extendedData && !!node.extendedData.isCategory;

  /**
   * Determines if node represents a model.
   */
  export const isModelNode = (node: Pick<CategoriesTreeNode, "extendedData">) =>
    node.extendedData && "isModel" in node.extendedData && !!node.extendedData.isModel;

  /**
   * Determines if node represents an element.
   */
  export const isElementNode = (
    node: Pick<CategoriesTreeNode, "extendedData">,
  ): node is NonGroupingHierarchyNode & { key: InstancesNodeKey; extendedData: { modelId: Id64String; categoryId: Id64String } } => {
    return (
      !!node.extendedData &&
      "isElement" in node.extendedData &&
      !!node.extendedData.isElement &&
      "modelId" in node.extendedData &&
      !!node.extendedData.modelId &&
      "categoryId" in node.extendedData &&
      !!node.extendedData.categoryId
    );
  };

  /**
   * Determines if node represents a sub-category.
   */
  export const isSubCategoryNode = (
    node: Pick<CategoriesTreeNode, "extendedData">,
  ): node is NonGroupingHierarchyNode & {
    key: InstancesNodeKey;
    extendedData: { categoryId: Id64String };
  } => {
    return (
      !!node.extendedData &&
      "isSubCategory" in node.extendedData &&
      !!node.extendedData.isSubCategory &&
      "categoryId" in node.extendedData &&
      !!node.extendedData.categoryId
    );
  };

  /**
   * Retrieves model ID from node's extended data.
   */
  export const getModelId = (node: Pick<CategoriesTreeNode, "extendedData">): Id64String | undefined => {
    // Elements have modelId property set
    if (node.extendedData?.modelId) {
      return node.extendedData?.modelId;
    }

    // This is for categories:
    // a) If category is at root, then it won't have 'modelId' or 'modelIds' set - it will return undefined;
    // b) If category is under subModel then it will have 'modelIds' set just like in models tree.
    const modelIds = node.extendedData?.modelIds?.[0];
    return modelIds && (Array.isArray(modelIds) ? modelIds[0] : modelIds);
  };

  /**
   * Retrieves category ID from node's extended data.
   */
  export const getCategoryId = (node: Pick<CategoriesTreeNode, "extendedData">): Id64String | undefined => {
    // Elements have categoryId property set
    return node.extendedData?.categoryId;
  };
}
