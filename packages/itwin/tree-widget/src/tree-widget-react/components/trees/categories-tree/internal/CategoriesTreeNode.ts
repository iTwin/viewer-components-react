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
}

/** @internal */
export const getModelId = (node: Pick<CategoriesTreeNode, "extendedData">): Id64String | undefined => {
  if (node.extendedData?.modelId) {
    return node.extendedData?.modelId;
  }

  const modelIds = node.extendedData?.modelIds?.[0];
  return modelIds && (Array.isArray(modelIds) ? modelIds[0] : modelIds);
};
