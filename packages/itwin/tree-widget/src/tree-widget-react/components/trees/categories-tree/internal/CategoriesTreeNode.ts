/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { HierarchyNodeKey } from "@itwin/presentation-hierarchies";

interface CategoriesTreeNode {
  key: HierarchyNodeKey;
  extendedData?: { [id: string]: any };
}

/**
 * @internal
 */
export namespace CategoriesTreeNode {
  /**
   * Determines if node represents a definitionContainer.
   */
  export const isDefinitionContainerNode = (node: Pick<CategoriesTreeNode, "extendedData">) =>
    node.extendedData && "isDefinitionContainer" in node.extendedData && !!node.extendedData.isDefinitionContainer;

  /**
   * Determines if node represents a category.
   */
  export const isCategoryNode = (node: Pick<CategoriesTreeNode, "extendedData">) =>
    node.extendedData && "isCategory" in node.extendedData && !!node.extendedData.isCategory;

  /**
   * Determines if node represents a subCategory.
   */
  export const isSubCategoryNode = (node: Pick<CategoriesTreeNode, "extendedData">) =>
    node.extendedData && "isSubCategory" in node.extendedData && !!node.extendedData.isSubCategory;
}
