/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { HierarchyNode } from "@itwin/presentation-hierarchies";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { ClassGroupingNodeKey, GroupingHierarchyNode, InstancesNodeKey, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";

/**
 * Contains utility functions for working with Categories Tree nodes.
 * @beta
 */
export namespace CategoriesTreeNode {
  /** Checks if the given node represents a `BisCore.DefinitionContainer` element. */
  export const isDefinitionContainerNode = (node: Pick<HierarchyNode, "extendedData">): node is NonGroupingHierarchyNode & { key: InstancesNodeKey } =>
    !!node.extendedData && "isDefinitionContainer" in node.extendedData && !!node.extendedData.isDefinitionContainer;

  /**
   * Checks if the given node represents a `BisCore.Category` element.
   *
   * If it does, the node's `extendedData` will contain the following properties:
   * - `description`: Optional description of the category
   * - `hasSubCategories`: Indicates whether the category has sub-categories
   * - `isCategoryOfSubModel`: Indicates that this node is located under a SubModel
   * - `modelIds`: (only if `isCategoryOfSubModel` is true) Ids of models that this category node is contained under
   */
  export const isCategoryNode = (
    node: Pick<HierarchyNode, "extendedData">,
  ): node is Omit<NonGroupingHierarchyNode, "extendedData"> & { key: InstancesNodeKey } & {
    extendedData: {
      description?: string;
      hasSubCategories?: boolean;
    } & (
      | {
          isCategoryOfSubModel?: false;
        }
      | {
          /** Ids of models that this category node is contained under. */
          modelIds: Id64Array;
          isCategoryOfSubModel: true;
        }
    );
  } => !!node.extendedData && "isCategory" in node.extendedData && !!node.extendedData.isCategory;

  /** Checks if the given node represents a `BisCore.Model`. */
  export const isModelNode = (node: Pick<HierarchyNode, "extendedData">): node is NonGroupingHierarchyNode & { key: InstancesNodeKey } =>
    !!node.extendedData && "isModel" in node.extendedData && !!node.extendedData.isModel;

  /**
   * Checks if the given node represents a `BisCore.GeometricElement` element.
   *
   * If it does, the node's `extendedData` will contain the following properties:
   * - `modelId`: `Id64String` of the model containing the element
   * - `categoryId`: `Id64String` of the category of the element
   */
  export const isElementNode = (
    node: Pick<HierarchyNode, "extendedData">,
  ): node is Omit<NonGroupingHierarchyNode, "extendedData"> & { key: InstancesNodeKey } & {
    extendedData: {
      modelId: Id64String;
      categoryId: Id64String;
    };
  } => !!node.extendedData && "isElement" in node.extendedData && !!node.extendedData.isElement;

  /**
   * Checks if the given node is a class grouping node of `BisCore.GeometricElement` nodes.
   *
   * If it does, the node's `extendedData` will contain the following properties:
   * - `categoryId`: `Id64String` of the category of the element
   * - `modelElementsMap`: A map of model's `Id64String` -> Set of elements' `Id64String`s contained within this grouping node
   */
  export const isElementClassGroupingNode = (
    node: Pick<HierarchyNode, "key">,
  ): node is Omit<GroupingHierarchyNode, "extendedData"> & { key: ClassGroupingNodeKey } & {
    extendedData: {
      categoryId: Id64String;
      modelElementsMap: Map<Id64String, Set<Id64String>>;
    };
  } => HierarchyNode.isClassGroupingNode(node);

  /**
   * Checks if the given node represents a `BisCore.SubCategory` element.
   *
   * If it does, the node's `extendedData` will contain the following properties:
   * - `categoryId`: `Id64String` of the parent category
   */
  export const isSubCategoryNode = (
    node: Pick<HierarchyNode, "extendedData">,
  ): node is Omit<NonGroupingHierarchyNode, "extendedData"> & { key: InstancesNodeKey } & {
    extendedData: {
      categoryId: Id64String;
    };
  } => !!node.extendedData && "isSubCategory" in node.extendedData && !!node.extendedData.isSubCategory;
}
