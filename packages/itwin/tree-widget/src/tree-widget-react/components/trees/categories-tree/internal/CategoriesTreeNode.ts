/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Id64String } from "@itwin/core-bentley";
import type { HierarchyNodeKey } from "@itwin/presentation-hierarchies";

interface CategoriesTreeNode {
  key: HierarchyNodeKey;
  extendedData?: { [id: string]: any };
}

/** @internal */
export namespace CategoriesTreeNode {
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
   * Determines if node represents a sub-category.
   */
  export const isSubCategoryNode = (node: Pick<CategoriesTreeNode, "extendedData">) =>
    node.extendedData && "isSubCategory" in node.extendedData && !!node.extendedData.isSubCategory;

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
    // Elements have modelId property set
    return node.extendedData?.categoryId;
  };
}
