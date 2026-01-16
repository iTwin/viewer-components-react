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
import type { ClassGroupingNodeKey, GroupingHierarchyNode, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";

/** @internal */
export function createCategoryHierarchyNode(
  props: {
    id: Id64String;
    hasChildren?: boolean;
    viewType?: "2d" | "3d";
    parentKeys?: Array<InstanceKey | ClassGroupingNodeKey>;
    search?: NonGroupingHierarchyNode["search"];
  } & ({ isCategoryOfSubModel?: false; hasSubCategories?: boolean } | { isCategoryOfSubModel: true; modelIds: Id64Array }),
): NonGroupingHierarchyNode {
  const { categoryClass } = getClassesByView(props.viewType ?? "3d");
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: categoryClass, id: props.id }],
    },
    children: !!props.hasChildren,
    search: props.search,
    label: "",
    parentKeys: props.parentKeys
      ? props.parentKeys.map((parentKey) => ("type" in parentKey ? parentKey : { type: "instances", instanceKeys: [parentKey] }))
      : [],
    extendedData: {
      isCategory: true,
      modelIds: props.isCategoryOfSubModel ? props.modelIds : undefined,
      categoryId: props.id,
      isCategoryOfSubModel: !!props.isCategoryOfSubModel,
      hasSubCategories: !props.isCategoryOfSubModel ? !!props.hasSubCategories : undefined,
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
export function createSubCategoryHierarchyNode(props: {
  id: Id64String;
  categoryId: Id64String;
  parentKeys?: InstanceKey[];
  search?: NonGroupingHierarchyNode["search"];
}): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: CLASS_NAME_SubCategory, id: props.id }],
    },
    children: false,
    label: "",
    parentKeys: props.parentKeys ? props.parentKeys.map((key) => ({ type: "instances", instanceKeys: [key] })) : [],
    extendedData: {
      isSubCategory: true,
      categoryId: props.categoryId,
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
  parentKeys?: Array<InstanceKey | ClassGroupingNodeKey>;
  hasDirectNonSearchTargets?: boolean;
  hasSearchTargetAncestor?: boolean;
  childrenCount?: number;
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
    parentKeys: parentKeys ? parentKeys.map((parentKey) => ("type" in parentKey ? parentKey : { type: "instances", instanceKeys: [parentKey] })) : [],
    extendedData: {
      categoryId: props.categoryId,
      modelElementsMap,
      childrenCount: props.childrenCount !== undefined ? props.childrenCount : 0,
      ...(props.hasDirectNonSearchTargets ? { hasDirectNonSearchTargets: props.hasDirectNonSearchTargets } : {}),
      ...(props.hasSearchTargetAncestor ? { hasSearchTargetAncestor: props.hasSearchTargetAncestor } : {}),
    },
  };
}

/** @internal */
export function createDefinitionContainerHierarchyNode(props: {
  id: Id64String;
  parentKeys?: InstanceKey[];
  search?: NonGroupingHierarchyNode["search"];
}): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: CLASS_NAME_DefinitionContainer, id: props.id }],
    },
    children: true,
    label: "",
    parentKeys: props.parentKeys ? props.parentKeys.map((key) => ({ type: "instances", instanceKeys: [key] })) : [],
    search: props.search,
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
  elementId: Id64String;
  viewType?: "2d" | "3d";
  parentKeys?: Array<InstanceKey | ClassGroupingNodeKey>;
  childrenCount?: number;
  search?: NonGroupingHierarchyNode["search"];
}): NonGroupingHierarchyNode {
  const { elementClass } = getClassesByView(props.viewType ?? "3d");
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: elementClass, id: props.elementId }],
    },
    children: !!props.hasChildren,
    label: "",
    parentKeys: props.parentKeys
      ? props.parentKeys.map((parentKey) => ("type" in parentKey ? parentKey : { type: "instances", instanceKeys: [parentKey] }))
      : [],
    search: props.search,
    extendedData: {
      modelId: props.modelId,
      categoryId: props.categoryId,
      isElement: true,
      childrenCount: props.childrenCount !== undefined ? props.childrenCount : 0,
    },
  };
}

/** @internal */
export function createModelHierarchyNode(props: { id: Id64String; hasChildren?: boolean; viewType?: "2d" | "3d" }): NonGroupingHierarchyNode {
  const { modelClass } = getClassesByView(props.viewType ?? "3d");
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: modelClass, id: props.id }],
    },
    children: !!props.hasChildren,
    label: "",
    parentKeys: [],
    extendedData: {
      isModel: true,
      modelId: props.id,
    },
  };
}
