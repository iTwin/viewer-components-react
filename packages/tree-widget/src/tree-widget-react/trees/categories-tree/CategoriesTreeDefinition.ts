/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { createCategoriesTree } from "@itwin/presentation-tree-definitions";
import { ParentElementsPath } from "../../shared/internal/Utils.js";
import { mapSearchLimitExceededError } from "../../shared/TreeErrors.js";
import { CategoriesTreeNodeInternal } from "./internal/CategoriesTreeNodeInternal.js";

import type { GuidString } from "@itwin/core-bentley";
import type {
  DefineHierarchyLevelProps,
  HierarchyDefinition,
  InstancesNodeKey,
  LimitingECSqlQueryExecutor,
  NodePostProcessor,
  NodePreProcessor,
  ProcessedHierarchyNode,
} from "@itwin/presentation-hierarchies";
import type { EC, ECSchemaProvider, Props } from "@itwin/presentation-shared";
import type { DeepRequired } from "../../shared/internal/Utils.js";
import type { CategoriesTreeIdsProvider } from "./internal/CategoriesTreeIdsProvider.js";
import type { CategoryNodeProps, ElementNodeProps } from "./internal/CategoriesTreeNodeInternal.js";

interface CategoriesTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & LimitingECSqlQueryExecutor;
  perspective: "2d" | "3d";
  idsProvider: CategoriesTreeIdsProvider;
  hierarchyConfig: RequiredCategoriesTreeHierarchyConfiguration;
}

interface CategoriesTreeInstanceKeyPathsBaseProps {
  imodelAccess: ECSchemaProvider & LimitingECSqlQueryExecutor;
  limit?: number | "unbounded";
  perspective: "2d" | "3d";
  idsProvider: CategoriesTreeIdsProvider;
  hierarchyConfig: RequiredCategoriesTreeHierarchyConfiguration;
  componentId?: GuidString;
  abortSignal?: AbortSignal;
}

/** @internal */
export interface CategoriesTreeInstanceKeyPathsFromInstanceLabelProps extends CategoriesTreeInstanceKeyPathsBaseProps {
  label: string;
}

/**
 * Defines hierarchy configuration supported by `CategoriesTree`.
 * @beta
 */
export interface CategoriesTreeHierarchyConfiguration {
  /**
   * Element node's configuration options.
   *
   * Defaults to `{ nodes: "exclude" }`.
   */
  elements?:
    | {
        /**
         * Excludes Element nodes from the hierarchy.
         */
        nodes?: "exclude";
      }
    | {
        /**
         * Includes Element nodes in the hierarchy.
         */
        nodes: "include";
        /**
         * Element classes to exclude from the hierarchy.
         *
         * Elements, whose class is or derives from one of the classes in this list, are not loaded into the hierarchy.
         * Children of such nodes are also not shown.
         *
         * Defaults to `[]`.
         */
        excludedClasses?: EC.FullClassNameDotNotation[];
      };
  /**
   * Category node's configuration options.
   *
   * Defaults to `{ withoutElements: "exclude" }`.
   */
  categories?: {
    /**
     * Controls whether categories that have no elements in the iModel are included in the hierarchy.
     *
     * Defaults to `"exclude"`.
     */
    withoutElements?: "include" | "exclude";
  };
  /**
   * SubCategory node's configuration options.
   *
   * Defaults to `{ nodes: "include" }`.
   *
   */
  subCategories?: {
    /**
     * Controls whether SubCategory nodes are included in the hierarchy.
     *
     * Defaults to `"include"`.
     */
    nodes?: "include" | "exclude";
  };
}

/** @internal */
export type RequiredCategoriesTreeHierarchyConfiguration = DeepRequired<CategoriesTreeHierarchyConfiguration>;

/** @internal */
export const defaultHierarchyConfiguration: RequiredCategoriesTreeHierarchyConfiguration = {
  elements: {
    nodes: "exclude",
  },
  categories: {
    withoutElements: "exclude",
  },
  subCategories: {
    nodes: "include",
  },
};

type CategoriesTreeInstanceKeyPaths = ReturnType<ReturnType<typeof createCategoriesTree>["createInstanceKeyPaths"]>;

/**
 * Categories tree hierarchy definition. Uses `@itwin/presentation-tree-definitions` categories tree definition under the hood and
 * additionally assigns `parentElementsPath` to category, element and element class grouping nodes.
 * @internal
 */
export class CategoriesTreeDefinition implements HierarchyDefinition {
  #impl: HierarchyDefinition;

  public constructor(props: CategoriesTreeDefinitionProps) {
    this.#impl = createCategoriesTree({
      imodelAccess: props.imodelAccess,
      idsProvider: props.idsProvider,
      hierarchyConfig: { ...props.hierarchyConfig, perspective: props.perspective },
    }).hierarchyDefinition;
  }

  public preProcessNode: NodePreProcessor = async (props) => (this.#impl.preProcessNode ? this.#impl.preProcessNode(props) : props.node);

  public postProcessNode: NodePostProcessor = async (props) => {
    const node = this.#impl.postProcessNode ? await this.#impl.postProcessNode(props) : props.node;
    return assignParentElementsPath({ node, parentNode: props.parentNode });
  };

  public async defineHierarchyLevel(props: DefineHierarchyLevelProps) {
    return this.#impl.defineHierarchyLevel(props);
  }

  public static createInstanceKeyPaths(props: CategoriesTreeInstanceKeyPathsFromInstanceLabelProps): CategoriesTreeInstanceKeyPaths {
    const { imodelAccess, idsProvider, hierarchyConfig, perspective, componentId, label, limit, abortSignal } = props;
    const { createInstanceKeyPaths } = createCategoriesTree({
      imodelAccess,
      idsProvider,
      hierarchyConfig: { ...hierarchyConfig, perspective },
      uniqueId: componentId,
    });
    return mapSearchLimitExceededError(createInstanceKeyPaths({ label, limit, abortSignal }));
  }
}

function extendPathWithElement(elementNode: { key: InstancesNodeKey; extendedData: ElementNodeProps }): ParentElementsPath {
  return ParentElementsPath.appendToPath({
    path: elementNode.extendedData.parentElementsPath,
    ids: elementNode.key.instanceKeys.map(({ id }) => id),
    categoryId: elementNode.extendedData.categoryId,
  });
}

function getInheritedParentElementsPath(parentNode: NonNullable<Props<NodePostProcessor>["parentNode"]>): ParentElementsPath {
  if (CategoriesTreeNodeInternal.isElementClassGroupingNode(parentNode) || CategoriesTreeNodeInternal.isCategoryNode(parentNode)) {
    return parentNode.extendedData.parentElementsPath;
  }
  throw new Error("Expected node's parent to be category, or class grouping node");
}

function assignParentElementsPath({ node, parentNode }: Pick<Props<NodePostProcessor>, "node" | "parentNode">): ProcessedHierarchyNode {
  if (CategoriesTreeNodeInternal.isRawCategoryNode(node)) {
    const modelIds: CategoryNodeProps["modelIds"] = node.extendedData.modelIds;
    // When the parent is an element that actually contains this category, the category continues the element path.
    // Otherwise (top-level category, or category of a sub-model) the path is reset.
    const parentIsContainingElement =
      parentNode !== undefined && CategoriesTreeNodeInternal.isElementNode(parentNode) && parentNode.key.instanceKeys.every(({ id }) => !modelIds.includes(id));
    node.extendedData = {
      ...node.extendedData,
      parentElementsPath: parentIsContainingElement ? extendPathWithElement(parentNode) : [],
    };
    return node;
  }
  if (CategoriesTreeNodeInternal.isRawElementNode(node) || CategoriesTreeNodeInternal.isRawElementClassGroupingNode(node)) {
    assert(parentNode !== undefined, "Expected node to have a parent node");
    node.extendedData = {
      ...node.extendedData,
      parentElementsPath: CategoriesTreeNodeInternal.isElementNode(parentNode) ? extendPathWithElement(parentNode) : getInheritedParentElementsPath(parentNode),
    };
    return node;
  }
  return node;
}
