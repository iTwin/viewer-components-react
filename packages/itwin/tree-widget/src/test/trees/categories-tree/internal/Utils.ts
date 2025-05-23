/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  CLASS_NAME_DefinitionContainer,
  CLASS_NAME_Element,
  CLASS_NAME_SubCategory,
} from "../../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";
import { getClassesByView, getDistinctMapValues } from "../../../../tree-widget-react/components/trees/common/internal/Utils.js";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { ClassGroupingNodeKey, GroupingHierarchyNode, HierarchyNodeKey, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";

/** @internal */
export function createCategoryHierarchyNode(categoryId: Id64String, hasChildren = false, viewType: "2d" | "3d" = "3d"): NonGroupingHierarchyNode {
  const { categoryClass } = getClassesByView(viewType);
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: categoryClass, id: categoryId }],
    },
    children: hasChildren,
    label: "",
    parentKeys: [],
    extendedData: {
      isCategory: true,
    },
  };
}

/** @internal */
export function createSubModelCategoryHierarchyNode(
  modelId?: Id64String,
  categoryId?: Id64String,
  hasChildren?: boolean,
  viewType: "2d" | "3d" = "3d",
): NonGroupingHierarchyNode {
  const { categoryClass } = getClassesByView(viewType);
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: categoryClass, id: categoryId ?? "" }],
    },
    children: !!hasChildren,
    label: "",
    parentKeys: [],
    extendedData: {
      isCategory: true,
      modelId: modelId ?? "0x1",
      categoryId: categoryId ?? "0x2",
    },
  };
}
/** @internal */
export function createSubCategoryHierarchyNode(subCategoryId: Id64String, categoryId: Id64String): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: CLASS_NAME_SubCategory, id: subCategoryId }],
    },
    children: false,
    label: "",
    parentKeys: [],
    extendedData: {
      isSubCategory: true,
      categoryId,
    },
  };
}

/** @internal */
export function createClassGroupingHierarchyNode({
  modelElementsMap,
  parentKeys,
  ...props
}: {
  categoryId: Id64String | undefined;
  modelElementsMap: Map<Id64String, Id64Array>;
  className?: string;
  parentKeys?: HierarchyNodeKey[];
}): GroupingHierarchyNode & { key: ClassGroupingNodeKey } {
  const className = props.className ?? CLASS_NAME_Element;
  return {
    key: {
      type: "class-grouping",
      className,
    },
    children: !!modelElementsMap.size,
    groupedInstanceKeys: [...getDistinctMapValues(modelElementsMap)].map((elementId) => ({ className, id: elementId })),
    label: "",
    parentKeys: parentKeys ?? [],
    extendedData: {
      categoryId: props.categoryId,
      modelElementsMap,
    },
  };
}

/** @internal */
export function createDefinitionContainerHierarchyNode(definitionContainerId: Id64String): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: CLASS_NAME_DefinitionContainer, id: definitionContainerId }],
    },
    children: true,
    label: "",
    parentKeys: [],
    extendedData: {
      isDefinitionContainer: true,
    },
  };
}

/** @internal */
export function createElementHierarchyNode(props: {
  modelId: Id64String | undefined;
  categoryId: Id64String | undefined;
  hasChildren?: boolean;
  elementId?: Id64String;
  viewType?: "2d" | "3d";
}): NonGroupingHierarchyNode {
  const { elementClass } = getClassesByView(props.viewType ?? "3d");
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: elementClass, id: props.elementId ?? "" }],
    },
    children: !!props.hasChildren,
    label: "",
    parentKeys: [],
    extendedData: {
      modelId: props.modelId,
      categoryId: props.categoryId,
      isElement: true,
    },
  };
}

/** @internal */
export function createModelHierarchyNode(modelId?: Id64String, hasChildren?: boolean, viewType: "2d" | "3d" = "3d"): NonGroupingHierarchyNode {
  const { modelClass } = getClassesByView(viewType);
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: modelClass, id: modelId ?? "" }],
    },
    children: !!hasChildren,
    label: "",
    parentKeys: [],
    extendedData: {
      isModel: true,
      modelId: modelId ?? "0x1",
    },
  };
}
