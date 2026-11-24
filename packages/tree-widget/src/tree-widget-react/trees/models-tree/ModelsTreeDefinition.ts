/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { createModelsTree } from "@itwin/presentation-tree-definitions";
import { CLASS_NAMES } from "../../shared/internal/ClassNameDefinitions.js";
import { ParentElementsPath } from "../../shared/internal/Utils.js";
import { mapSearchLimitExceededError } from "../../shared/TreeErrors.js";
import { ModelsTreeNodeInternal } from "./internal/ModelsTreeNodeInternal.js";

import type { GuidString, Id64String } from "@itwin/core-bentley";
import type {
  ClassGroupingNodeKey,
  DefineHierarchyLevelProps,
  GroupingHierarchyNode,
  HierarchyDefinition,
  InstancesNodeKey,
  LimitingECSqlQueryExecutor,
  NodePostProcessor,
  NodePreProcessor,
  ProcessedHierarchyNode,
} from "@itwin/presentation-hierarchies";
import type { EC, ECSchemaProvider, InstanceKey, Props } from "@itwin/presentation-shared";
import type { ModelsTreeIdsProvider } from "@itwin/presentation-tree-definitions";
import type { DeepRequired } from "../../shared/internal/Utils.js";
import type { CategoryNodeProps, ElementNodeProps } from "./internal/ModelsTreeNodeInternal.js";

/** @beta */
export type ClassGroupingHierarchyNode = GroupingHierarchyNode & { key: ClassGroupingNodeKey };

/**
 * Defines hierarchy configuration supported by `ModelsTree`.
 * @beta
 */
export interface ModelsTreeHierarchyConfiguration {
  /**
   * Controls whether hierarchy levels are filterable.
   *
   * Defaults to `"enable"`.
   */
  hierarchyLevelFiltering?: "enable" | "disable";
  /**
   * Subject node's configuration options.
   *
   * Defaults to `{ root: "include" }`.
   */
  subjects?: {
    /**
     * Controls whether the root Subject node is included in the hierarchy.
     *
     * Defaults to `"include"`.
     */
    root?: "include" | "exclude";
  };
  /**
   * Element node's configuration options.
   *
   * Defaults to `{ baseClass: "BisCore.GeometricElement3d", classGrouping: "enable", excludedClasses: [] }`.
   */
  elements?: {
    /**
     * Full class name of a `GeometricElement3d` sub-class that should be used to load element nodes.
     *
     * Defaults to `BisCore.GeometricElement3d`.
     */
    baseClass?: EC.FullClassNameDotNotation;
    /**
     * Element classes to exclude from the hierarchy.
     *
     * Elements, whose class is or derives from one of the classes in this list, are not loaded into the hierarchy.
     * Children of such nodes are also not shown.
     *
     * Defaults to `[]`.
     */
    excludedClasses?: EC.FullClassNameDotNotation[];
    /**
     * Controls how element nodes are grouped.
     *
     * Defaults to `"enable"`.
     */
    classGrouping?: "enable" | "enable-with-counts" | "disable";
  };
  /**
   * Model node's configuration options.
   *
   * Defaults to `{ withoutElements: "exclude" }`.
   */
  models?: {
    /**
     * Controls whether models that have no elements in the iModel are included in the hierarchy.
     *
     * Defaults to `"exclude"`.
     */
    withoutElements?: "include" | "exclude";
  };
}

/** @internal */
export type RequiredModelsTreeHierarchyConfiguration = DeepRequired<ModelsTreeHierarchyConfiguration>;

/** @internal */
export const defaultHierarchyConfiguration: RequiredModelsTreeHierarchyConfiguration = {
  subjects: {
    root: "include",
  },
  elements: {
    baseClass: CLASS_NAMES.GeometricElement3d,
    excludedClasses: [],
    classGrouping: "enable",
  },
  models: {
    withoutElements: "exclude",
  },
  hierarchyLevelFiltering: "enable",
};

interface ModelsTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & LimitingECSqlQueryExecutor;
  idsProvider: ModelsTreeIdsProvider;
  hierarchyConfig: RequiredModelsTreeHierarchyConfiguration;
  componentId?: GuidString;
}

/** @beta */
export interface ElementsGroupInfo {
  parent:
    | {
        ids: Id64String[];
        type: "element";
      }
    | {
        ids: Id64String[];
        modelIds: Id64String[];
        type: "category";
      };
  groupingNode: ClassGroupingHierarchyNode;
}

interface ModelsTreeInstanceKeyPathsBaseProps {
  imodelAccess: ECSchemaProvider & LimitingECSqlQueryExecutor;
  idsProvider: ModelsTreeIdsProvider;
  hierarchyConfig: RequiredModelsTreeHierarchyConfiguration;
  limit?: number | "unbounded";
  abortSignal?: AbortSignal;
  componentId?: string;
}

type ModelsTreeInstanceKeyPathsFromTargetItemsProps = {
  targetItems: Array<InstanceKey | ElementsGroupInfo>;
} & ModelsTreeInstanceKeyPathsBaseProps;

type ModelsTreeInstanceKeyPathsFromInstanceLabelProps = {
  label: string;
} & ModelsTreeInstanceKeyPathsBaseProps;

/** @internal */
export type ModelsTreeInstanceKeyPathsProps = ModelsTreeInstanceKeyPathsFromTargetItemsProps | ModelsTreeInstanceKeyPathsFromInstanceLabelProps;

// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace ModelsTreeInstanceKeyPathsProps {
  export function isLabelProps(props: ModelsTreeInstanceKeyPathsProps): props is ModelsTreeInstanceKeyPathsFromInstanceLabelProps {
    return !!(props as ModelsTreeInstanceKeyPathsFromInstanceLabelProps).label;
  }
}

type ModelsTreeInstanceKeyPaths = ReturnType<ReturnType<typeof createModelsTree>["createInstanceKeyPaths"]>;

/**
 * Models tree hierarchy definition. Uses `@itwin/presentation-tree-definitions` models tree definition under the hood and
 * additionally assigns `parentElementsPath` to category, element and element class grouping nodes.
 * @internal
 */
export class ModelsTreeDefinition implements HierarchyDefinition {
  #impl: HierarchyDefinition;

  public constructor(props: ModelsTreeDefinitionProps) {
    this.#impl = createModelsTree({
      imodelAccess: props.imodelAccess,
      idsProvider: props.idsProvider,
      hierarchyConfig: props.hierarchyConfig,
      uniqueId: props.componentId,
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

  public static createInstanceKeyPaths(props: ModelsTreeInstanceKeyPathsProps): ModelsTreeInstanceKeyPaths {
    const { imodelAccess, idsProvider, hierarchyConfig, componentId, limit, abortSignal } = props;
    const { createInstanceKeyPaths } = createModelsTree({ imodelAccess, idsProvider, hierarchyConfig, uniqueId: componentId });
    return mapSearchLimitExceededError(
      ModelsTreeInstanceKeyPathsProps.isLabelProps(props)
        ? createInstanceKeyPaths({ label: props.label, limit, abortSignal })
        : createInstanceKeyPaths({ targetItems: props.targetItems, limit, abortSignal }),
    );
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
  if (ModelsTreeNodeInternal.isElementClassGroupingNode(parentNode) || ModelsTreeNodeInternal.isCategoryNode(parentNode)) {
    return parentNode.extendedData.parentElementsPath;
  }
  throw new Error("Expected node's parent to be category, or class grouping node");
}

function assignParentElementsPath({ node, parentNode }: Pick<Props<NodePostProcessor>, "node" | "parentNode">): ProcessedHierarchyNode {
  if (ModelsTreeNodeInternal.isRawCategoryNode(node)) {
    const modelIds: CategoryNodeProps["modelIds"] = node.extendedData.modelIds;
    if (parentNode === undefined) {
      // If subjects are not shown and model has PhysicalPartition.Model.Content or GraphicalPartition3d.Model.Content property,
      // then such models are not shown and category might have no parent node
      node.extendedData = {
        ...node.extendedData,
        parentElementsPath: [],
      };
      return node;
    }
    // When the parent is an element that actually contains this category, the category continues the element path.
    // Otherwise (parent is a model, or a sub-model boundary) the path is reset.
    const parentIsContainingElement = ModelsTreeNodeInternal.isElementNode(parentNode) && parentNode.key.instanceKeys.every(({ id }) => !modelIds.includes(id));
    node.extendedData = {
      ...node.extendedData,
      parentElementsPath: parentIsContainingElement ? extendPathWithElement(parentNode) : [],
    };
    return node;
  }
  if (ModelsTreeNodeInternal.isRawElementNode(node) || ModelsTreeNodeInternal.isRawElementClassGroupingNode(node)) {
    assert(parentNode !== undefined, "Expected node to have a parent node");
    node.extendedData = {
      ...node.extendedData,
      parentElementsPath: ModelsTreeNodeInternal.isElementNode(parentNode) ? extendPathWithElement(parentNode) : getInheritedParentElementsPath(parentNode),
    };
    return node;
  }
  return node;
}
