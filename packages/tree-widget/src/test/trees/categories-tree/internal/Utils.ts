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
import { CLASS_NAMES } from "../../../../tree-widget-react/shared/internal/ClassNameDefinitions.js";
import { createSharedIdsProvider } from "../../../../tree-widget-react/shared/internal/idsProviders/SharedIdsProvider.js";
import { getClassesByPerspective } from "../../../../tree-widget-react/shared/internal/Utils.js";
import { createCategoriesTreeIdsProvider } from "../../../../tree-widget-react/trees/categories-tree/internal/CategoriesTreeIdsProvider.js";
import { TestSchema } from "../../../IModelUtils.js";
import { validateHierarchyVisibility } from "../../../shared/VisibilityValidation.js";
import { createIModelAccess } from "../../Common.js";
import { validateNodeVisibility } from "./VisibilityValidation.js";

import type { EditTxn } from "@itwin/core-backend";
import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { ClassGroupingNodeKey, GroupingHierarchyNode, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { EC, InstanceKey, Props } from "@itwin/presentation-shared";
import type { SharedIdsProvider } from "../../../../tree-widget-react/shared/internal/idsProviders/SharedIdsProvider.js";
import type { ElementId, ModelId } from "../../../../tree-widget-react/shared/internal/Types.js";
import type { ParentElementsPath } from "../../../../tree-widget-react/shared/internal/Utils.js";
import type { CategoriesTreeIdsProvider } from "../../../../tree-widget-react/trees/categories-tree/internal/CategoriesTreeIdsProvider.js";
import type { IModelAccess } from "../../Common.js";
import type { TreeWidgetTestingViewport } from "../../TreeUtils.js";

/** @internal */
export function createCategoryHierarchyNode(props: {
  id: Id64String;
  hasChildren?: boolean;
  perspective?: "2d" | "3d";
  parentKeys?: Array<InstanceKey | ClassGroupingNodeKey>;
  search?: NonGroupingHierarchyNode["search"];
  modelIds?: Id64Array;
  hasSubCategories?: boolean;
  parentElementsPath?: ParentElementsPath;
}): NonGroupingHierarchyNode {
  const { categoryClass } = getClassesByPerspective(props.perspective ?? "3d");
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
      instanceKeys: [{ className: CLASS_NAMES.SubCategory, id: props.id }],
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
  const className = props.className ?? CLASS_NAMES.Element;
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
      instanceKeys: [{ className: CLASS_NAMES.DefinitionContainer, id: props.id }],
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
  perspective?: "2d" | "3d";
  parentKeys?: Array<InstanceKey | ClassGroupingNodeKey>;
  parentElementsPath?: ParentElementsPath;
  search?: NonGroupingHierarchyNode["search"];
}): NonGroupingHierarchyNode {
  const { elementClass } = getClassesByPerspective(props.perspective ?? "3d");
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
export function createModelHierarchyNode(props: { id: Id64String; hasChildren?: boolean; perspective?: "2d" | "3d" }): NonGroupingHierarchyNode {
  const { modelClass } = getClassesByPerspective(props.perspective ?? "3d");
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

export function getInsertFunctionByPerspective(perspective: "2d" | "3d") {
  const insertCategory = perspective === "3d" ? insertSpatialCategory : insertDrawingCategory;
  const insertElement = perspective === "3d" ? insertPhysicalElement : insertDrawingGraphic;
  const insertElementsModel = perspective === "3d" ? insertPhysicalModelWithPartition : insertDrawingModelWithPartition;
  const insertElementsSubModel =
    perspective === "3d"
      ? insertPhysicalSubModel
      : (props: { txn: EditTxn; modeledElementId: string }) =>
          insertSubModel({
            ...props,
            classFullName: `${TestSchema.Name}.${TestSchema.SubModel2dClassName}`,
          });
  const insertModeledElement = (props: { txn: EditTxn; modelId: Id64String; categoryId: Id64String; parentId?: ElementId; userLabel?: string }) =>
    insertElement({
      ...props,
      classFullName: `${TestSchema.Name}.${perspective === "3d" ? TestSchema.ModeledElement3dClassName : TestSchema.ModeledElement2dClassName}`,
    });
  return { insertCategory, insertElement, insertElementsModel, insertElementsSubModel, insertModeledElement };
}

interface VisibilityInfo {
  id: Id64String;
  visible: boolean;
}

export function setupInitialDisplayState(props: {
  viewport: TreeWidgetTestingViewport;
  categories?: Array<VisibilityInfo>;
  subCategories?: Array<VisibilityInfo>;
  models?: Array<VisibilityInfo>;
  elements?: Array<VisibilityInfo>;
}) {
  const { viewport } = props;
  const categories = props.categories ?? [];
  const elements = props.elements ?? [];
  const subCategories = props.subCategories ?? [];
  const models = props.models ?? [];
  for (const subCategoryInfo of subCategories) {
    viewport.changeSubCategoryDisplay({ subCategoryId: subCategoryInfo.id, display: subCategoryInfo.visible });
  }
  for (const categoryInfo of categories) {
    viewport.changeCategoryDisplay({ categoryIds: categoryInfo.id, display: categoryInfo.visible, enableAllSubCategories: false });
  }
  const alwaysDrawn = elements.filter(({ visible }) => visible).map(({ id }) => id);
  if (alwaysDrawn.length > 0) {
    viewport.setAlwaysDrawn({ elementIds: new Set([...alwaysDrawn, ...(viewport.alwaysDrawn ?? [])]) });
  }
  const neverDrawn = elements.filter(({ visible }) => !visible).map(({ id }) => id);
  if (neverDrawn.length > 0) {
    viewport.setNeverDrawn({ elementIds: new Set([...neverDrawn, ...(viewport.neverDrawn ?? [])]) });
  }

  viewport.changeModelDisplay({ modelIds: models.filter(({ visible }) => visible).map(({ id }) => id), display: true });
  viewport.changeModelDisplay({ modelIds: models.filter(({ visible }) => !visible).map(({ id }) => id), display: false });
  viewport.renderFrame();
}

export async function validateCategoriesTreeHierarchyVisibility(props: Omit<Props<typeof validateHierarchyVisibility>, "validateNodeVisibility">) {
  return validateHierarchyVisibility({
    ...props,
    validateNodeVisibility,
  });
}

export function createAccessAndIdsProvider({
  imodelConnection,
  perspective,
  excludedElementClassNames,
}: {
  imodelConnection: IModelConnection;
  perspective: "2d" | "3d";
  excludedElementClassNames?: EC.FullClassNameDotNotation[];
}): {
  imodelAccess: IModelAccess;
  idsProvider: CategoriesTreeIdsProvider;
  sharedIdsProvider: SharedIdsProvider;
} {
  const imodelAccess = createIModelAccess(imodelConnection);
  const sharedIdsProvider = createSharedIdsProvider({
    imodelAccess,
    elementClassName: getClassesByPerspective(perspective).elementClass,
    excludedElementClassNames,
  });
  const idsProvider = createCategoriesTreeIdsProvider({ imodelAccess, perspective, sharedIdsProvider });

  return {
    imodelAccess,
    idsProvider,
    sharedIdsProvider,
  };
}
