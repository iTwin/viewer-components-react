/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  insertDrawingCategory,
  insertDrawingGraphic,
  insertDrawingModelWithPartition,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertPhysicalSubModel,
  insertSpatialCategory,
  insertSubModel,
} from "test-utilities";
import {
  CLASS_NAME_DefinitionContainer,
  CLASS_NAME_Element,
  CLASS_NAME_SubCategory,
} from "../../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";
import { getClassesByView } from "../../../../tree-widget-react/components/trees/common/internal/Utils.js";
import { TestSchema } from "../../../IModelUtils.js";

import type { EditTxn } from "@itwin/core-backend";
import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { ClassGroupingNodeKey, GroupingHierarchyNode, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { EC, InstanceKey } from "@itwin/presentation-shared";
import type { ElementId, ModelId } from "../../../../tree-widget-react/components/trees/common/internal/Types.js";
import type { ParentElementsPath } from "../../../../tree-widget-react/components/trees/common/internal/Utils.js";

/** @internal */
export function createCategoryHierarchyNode(props: {
  id: Id64String;
  hasChildren?: boolean;
  viewType?: "2d" | "3d";
  parentKeys?: Array<InstanceKey | ClassGroupingNodeKey>;
  search?: NonGroupingHierarchyNode["search"];
  modelIds?: Id64Array;
  hasSubCategories?: boolean;
  parentElementsPath?: ParentElementsPath;
}): NonGroupingHierarchyNode {
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
      type: "category",
      parentElementsPath: props.parentElementsPath ?? [],
      modelIds: props.modelIds ?? [],
      hasSubCategories: props.hasSubCategories,
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
      type: "sub-category",
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
  modelElementsMap: Map<ModelId, { elementIds: Set<ElementId> }>;
  className?: EC.FullClassNameDotNotation;
  parentKeys?: Array<InstanceKey | ClassGroupingNodeKey>;
  hasDirectNonSearchTargets?: boolean;
  hasSearchTargetAncestor?: boolean;
}): GroupingHierarchyNode & { key: ClassGroupingNodeKey } {
  const className = props.className ?? CLASS_NAME_Element;
  return {
    key: {
      type: "class-grouping",
      className,
    },
    children: !!modelElementsMap.size,
    groupedInstanceKeys: [...modelElementsMap.values()]
      .map(({ elementIds }) => [...elementIds])
      .flat()
      .map((elementId) => ({ className, id: elementId })),
    label: "",
    parentKeys: parentKeys ? parentKeys.map((parentKey) => ("type" in parentKey ? parentKey : { type: "instances", instanceKeys: [parentKey] })) : [],
    extendedData: {
      categoryId: props.categoryId,
      modelElementsMap,
      parentElementsPath: [],
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
      type: "definition-container",
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
  parentElementsPath?: ParentElementsPath;
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
      type: "element",
      parentElementsPath: props.parentElementsPath ?? [],
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
      type: "model",
      modelId: props.id,
    },
  };
}

export function getInsertFunctionByViewType(viewType: "2d" | "3d") {
  const insertCategory = viewType === "3d" ? insertSpatialCategory : insertDrawingCategory;
  const insertElement = viewType === "3d" ? insertPhysicalElement : insertDrawingGraphic;
  const insertElementsModel = viewType === "3d" ? insertPhysicalModelWithPartition : insertDrawingModelWithPartition;
  const insertElementsSubModel =
    viewType === "3d"
      ? insertPhysicalSubModel
      : (props: { txn: EditTxn; modeledElementId: string }) =>
          insertSubModel({
            ...props,
            classFullName: `${TestSchema.Name}.${TestSchema.SubModel2dClassName}`,
          });
  const insertModeledElement = (props: { txn: EditTxn; modelId: Id64String; categoryId: Id64String; parentId?: ElementId; userLabel?: string }) =>
    insertElement({
      ...props,
      classFullName: `${TestSchema.Name}.${viewType === "3d" ? TestSchema.ModeledElement3dClassName : TestSchema.ModeledElement2dClassName}`,
    });
  return { insertCategory, insertElement, insertElementsModel, insertElementsSubModel, insertModeledElement };
}
