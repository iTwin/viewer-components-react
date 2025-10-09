/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { BeEvent, Id64 } from "@itwin/core-bentley";

import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { TreeWidgetViewport } from "../../tree-widget-react/components/trees/common/TreeWidgetViewport.js";
import type { CategoryId, ElementId, ModelId, SubCategoryId } from "../../tree-widget-react/components/trees/common/internal/Types.js";

export function createPresentationHierarchyNode(partial?: Partial<PresentationHierarchyNode>): PresentationHierarchyNode {
  return {
    id: "test-node",
    label: "test-node",
    isExpanded: false,
    isLoading: false,
    isFilterable: false,
    isFiltered: false,
    nodeData: createNonGroupingHierarchyNode(),
    children: [],
    ...partial,
  };
}

export function createNonGroupingHierarchyNode(partial?: Partial<NonGroupingHierarchyNode>): NonGroupingHierarchyNode {
  return {
    label: "test-node",
    key: { type: "instances", instanceKeys: [] },
    parentKeys: [],
    children: false,
    ...partial,
  };
}

function getDefaultSubCategoryId(categoryId: Id64String) {
  const categoryIdNumber = Number.parseInt(categoryId, 16);
  const subCategoryId = `0x${(categoryIdNumber + 1).toString(16)}`;
  return subCategoryId;
}

export type TreeWidgetTestingViewport = TreeWidgetViewport & {
  renderFrame: () => void;
} & Disposable;

export function createTreeWidgetTestingViewport({
  iModel,
  viewType,
  subCategoriesOfCategories,
  visibleByDefault = false,
}: Pick<TreeWidgetViewport, "iModel" | "viewType"> & {
  subCategoriesOfCategories?: Array<{ categoryId: Id64String; subCategories: Id64Arg }>;
  visibleByDefault: boolean;
}): TreeWidgetTestingViewport {
  const models = new Map<ModelId, { isVisible: boolean }>();
  const categories = new Map<CategoryId, { isVisible: boolean }>();
  const subCategories = new Map<CategoryId, Map<SubCategoryId, { isVisible: boolean }>>();
  for (const entry of subCategoriesOfCategories ?? []) {
    const subCategoryMap = new Map<Id64String, { isVisible: boolean }>();
    subCategories.set(entry.categoryId, subCategoryMap);
    for (const subCategoryId of Id64.iterable(entry.subCategories)) {
      subCategoryMap.set(subCategoryId, { isVisible: visibleByDefault });
    }
    subCategoryMap.set(getDefaultSubCategoryId(entry.categoryId), { isVisible: visibleByDefault });
  }
  let alwaysDrawn = new Set<ElementId>();
  let neverDrawn = new Set<ElementId>();
  const perModelCategoryOverrides = new Map<ModelId, Map<CategoryId, { override: "show" | "hide" | "none" }>>();
  let isExclusive = false;
  const onAlwaysDrawnChanged = { shouldFireOnRender: false, event: new BeEvent<() => void>() };
  const onNeverDrawnChanged = { shouldFireOnRender: false, event: new BeEvent<() => void>() };
  const onDisplayedCategoriesChanged = { shouldFireOnRender: false, event: new BeEvent<() => void>() };
  const onPerModelCategoriesOverridesChanged = { shouldFireOnRender: false, event: new BeEvent<() => void>() };
  const onDisplayedModelsChanged = { shouldFireOnRender: false, event: new BeEvent<() => void>() };
  const onDisplayStyleChanged = new BeEvent<() => void>();
  return {
    iModel,
    get alwaysDrawn() {
      return alwaysDrawn;
    },
    get neverDrawn() {
      return neverDrawn;
    },
    get viewType() {
      return viewType;
    },
    get isAlwaysDrawnExclusive() {
      return isExclusive;
    },
    changeCategoryDisplay: (props) => {
      for (const categoryId of Id64.iterable(props.categoryIds)) {
        categories.set(categoryId, { isVisible: props.display });
        if (props.enableAllSubCategories && props.display) {
          const entry = subCategories.get(categoryId);
          if (entry) {
            const subCategoryIds = [...entry.keys()];
            subCategoryIds.forEach((subCategoryId) => entry.set(subCategoryId, { isVisible: true }));
          }
        }
      }
      onDisplayedCategoriesChanged.shouldFireOnRender = true;
    },
    changeModelDisplay: (props) => {
      for (const modelId of Id64.iterable(props.modelIds)) {
        models.set(modelId, { isVisible: props.display });
      }
      onDisplayedModelsChanged.shouldFireOnRender = true;
    },
    changeSubCategoryDisplay: (props) => {
      subCategories.forEach((subCategoryMap) => {
        if (subCategoryMap.has(props.subCategoryId)) {
          subCategoryMap.set(props.subCategoryId, { isVisible: props.display });
          return;
        }
      });
    },
    clearNeverDrawn: () => {
      neverDrawn = new Set();
      onNeverDrawnChanged.shouldFireOnRender = true;
    },
    clearAlwaysDrawn: () => {
      alwaysDrawn = new Set();
      onAlwaysDrawnChanged.shouldFireOnRender = true;
    },
    setNeverDrawn: (props) => {
      neverDrawn = props.elementIds;
      onNeverDrawnChanged.shouldFireOnRender = true;
    },
    setAlwaysDrawn: (props) => {
      alwaysDrawn = props.elementIds;
      isExclusive = !!props.exclusive;
      onAlwaysDrawnChanged.shouldFireOnRender = true;
    },
    setPerModelCategoryOverride: (props) => {
      for (const modelId of Id64.iterable(props.modelIds)) {
        let entry = perModelCategoryOverrides.get(modelId);
        if (!entry) {
          entry = new Map();
          perModelCategoryOverrides.set(modelId, entry);
        }
        for (const categoryId of Id64.iterable(props.categoryIds)) {
          entry.set(categoryId, { override: props.override });
        }
      }
      onPerModelCategoriesOverridesChanged.shouldFireOnRender = true;
    },
    getPerModelCategoryOverride: (props) => {
      const entry = perModelCategoryOverrides.get(props.modelId)?.get(props.categoryId);
      if (entry) {
        return entry.override;
      }
      return "none";
    },
    clearPerModelCategoryOverrides: (props) => {
      perModelCategoryOverrides.forEach((categoryMap, modelId) => {
        if (props?.modelIds && !Id64.has(props.modelIds, modelId)) {
          return;
        }
        const categoryIds = [...categoryMap.keys()];
        categoryIds.forEach((categoryId) => categoryMap.set(categoryId, { override: "none" }));
      });
      onPerModelCategoriesOverridesChanged.shouldFireOnRender = true;
    },
    get onAlwaysDrawnChanged() {
      return onAlwaysDrawnChanged.event;
    },
    get onDisplayedCategoriesChanged() {
      return onDisplayedCategoriesChanged.event;
    },
    get onDisplayedModelsChanged() {
      return onDisplayedModelsChanged.event;
    },
    get onNeverDrawnChanged() {
      return onNeverDrawnChanged.event;
    },
    get onDisplayStyleChanged() {
      return onDisplayStyleChanged;
    },
    get onPerModelCategoriesOverridesChanged() {
      return onPerModelCategoriesOverridesChanged.event;
    },
    get perModelCategoryOverrides() {
      const result = new Array<{ modelId: Id64String; categoryId: Id64String; visible: boolean }>();
      for (const [modelId, categoryMap] of perModelCategoryOverrides) {
        for (const [categoryId, { override }] of categoryMap) {
          if (override === "none") {
            continue;
          }
          result.push({ modelId, categoryId, visible: override === "show" });
        }
      }

      return result;
    },
    viewsCategory: (categoryId) => {
      const entry = categories.get(categoryId);
      if (!entry) {
        return visibleByDefault;
      }
      return entry.isVisible;
    },
    viewsModel: (modelId) => {
      const entry = models.get(modelId);
      if (!entry) {
        return visibleByDefault;
      }
      return entry.isVisible;
    },
    viewsSubCategory: (subCategoryId) => {
      for (const subCategoriesMap of subCategories.values()) {
        const entry = subCategoriesMap.get(subCategoryId);
        if (entry) {
          return entry.isVisible;
        }
      }
      return visibleByDefault;
    },
    renderFrame: () => {
      if (onAlwaysDrawnChanged.shouldFireOnRender) {
        onAlwaysDrawnChanged.shouldFireOnRender = false;
        onAlwaysDrawnChanged.event.raiseEvent();
      }
      if (onNeverDrawnChanged.shouldFireOnRender) {
        onNeverDrawnChanged.shouldFireOnRender = false;
        onNeverDrawnChanged.event.raiseEvent();
      }
      if (onDisplayedModelsChanged.shouldFireOnRender) {
        onDisplayedModelsChanged.shouldFireOnRender = false;
        onDisplayedModelsChanged.event.raiseEvent();
      }
      if (onDisplayedCategoriesChanged.shouldFireOnRender) {
        onDisplayedCategoriesChanged.shouldFireOnRender = false;
        onDisplayedCategoriesChanged.event.raiseEvent();
      }
      if (onPerModelCategoriesOverridesChanged.shouldFireOnRender) {
        onPerModelCategoriesOverridesChanged.shouldFireOnRender = false;
        onPerModelCategoriesOverridesChanged.event.raiseEvent();
      }
    },
    [Symbol.dispose]() {
      onPerModelCategoriesOverridesChanged.event.clear();
      onDisplayedCategoriesChanged.event.clear();
      onDisplayStyleChanged.clear();
      onDisplayedModelsChanged.event.clear();
      onAlwaysDrawnChanged.event.clear();
      onNeverDrawnChanged.event.clear();
    },
  };
}
