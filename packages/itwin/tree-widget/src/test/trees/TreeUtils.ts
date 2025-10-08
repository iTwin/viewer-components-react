/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Code, ColorDef, IModel, RenderMode } from "@itwin/core-common";
import { IModelApp, OffScreenViewport, SpatialViewState, ViewRect } from "@itwin/core-frontend";
import { createTreeWidgetViewport } from "../../tree-widget-react/components/trees/common/TreeWidgetViewport.js";

import type { Id64Array } from "@itwin/core-bentley";
import type { IModelConnection, ViewState } from "@itwin/core-frontend";
import type { NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { TreeWidgetViewport } from "../../tree-widget-react/components/trees/common/TreeWidgetViewport.js";

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

export async function createViewState(iModel: IModelConnection, categoryIds: Id64Array, modelIds: Id64Array) {
  const model = IModel.dictionaryId;
  const viewState = SpatialViewState.createFromProps(
    {
      categorySelectorProps: { categories: categoryIds, model, code: Code.createEmpty(), classFullName: "BisCore:CategorySelector" },
      displayStyleProps: { model, code: Code.createEmpty(), classFullName: "BisCore:DisplayStyle3d" },
      viewDefinitionProps: {
        model,
        code: Code.createEmpty(),
        categorySelectorId: "",
        classFullName: "BisCore:SpatialViewDefinition",
        displayStyleId: "",
      },
      modelSelectorProps: {
        models: modelIds,
        code: Code.createEmpty(),
        model,
        classFullName: "BisCore:ModelSelector",
      },
    },
    iModel,
  );

  viewState.setAllow3dManipulations(true);

  viewState.displayStyle.backgroundColor = ColorDef.white;
  const flags = viewState.viewFlags.copy({
    grid: false,
    renderMode: RenderMode.SmoothShade,
    backgroundMap: false,
  });
  viewState.displayStyle.viewFlags = flags;

  IModelApp.viewManager.onViewOpen.addOnce((vp) => {
    if (vp.view.hasSameCoordinates(viewState)) {
      vp.applyViewState(viewState);
    }
  });
  await viewState.load();
  return viewState;
}

export type TreeWidgetTestingViewport = TreeWidgetViewport & { renderFrame: () => void } & Disposable;

export function createTreeWidgetTestingViewport({ viewState }: { viewState: ViewState }): TreeWidgetTestingViewport {
  const viewport = OffScreenViewport.create({
    view: viewState,
    viewRect: new ViewRect(),
  });
  const treeWidgetViewport = createTreeWidgetViewport(viewport);
  return {
    iModel: treeWidgetViewport.iModel,
    get alwaysDrawn() {
      return treeWidgetViewport.alwaysDrawn;
    },
    get neverDrawn() {
      return treeWidgetViewport.neverDrawn;
    },
    get viewType() {
      return treeWidgetViewport.viewType;
    },
    get isAlwaysDrawnExclusive() {
      return treeWidgetViewport.isAlwaysDrawnExclusive;
    },
    changeCategoryDisplay: (props) => treeWidgetViewport.changeCategoryDisplay(props),
    changeModelDisplay: async (props) => treeWidgetViewport.changeModelDisplay(props),
    changeSubCategoryDisplay: (props) => treeWidgetViewport.changeSubCategoryDisplay(props),
    clearNeverDrawn: () => treeWidgetViewport.clearNeverDrawn(),
    clearAlwaysDrawn: () => treeWidgetViewport.clearAlwaysDrawn(),
    setNeverDrawn: (props) => treeWidgetViewport.setNeverDrawn(props),
    setAlwaysDrawn: (props) => treeWidgetViewport.setAlwaysDrawn(props),
    setPerModelCategoryOverride: (props) => treeWidgetViewport.setPerModelCategoryOverride(props),
    getPerModelCategoryOverride: (props) => treeWidgetViewport.getPerModelCategoryOverride(props),
    clearPerModelCategoryOverrides: (props) => treeWidgetViewport.clearPerModelCategoryOverrides(props),
    get onAlwaysDrawnChanged() {
      return treeWidgetViewport.onAlwaysDrawnChanged;
    },
    get onDisplayedCategoriesChanged() {
      return treeWidgetViewport.onDisplayedCategoriesChanged;
    },
    get onDisplayedModelsChanged() {
      return treeWidgetViewport.onDisplayedModelsChanged;
    },
    get onNeverDrawnChanged() {
      return treeWidgetViewport.onNeverDrawnChanged;
    },
    get onDisplayStyleChanged() {
      return treeWidgetViewport.onDisplayStyleChanged;
    },
    get onPerModelCategoriesOverridesChanged() {
      return treeWidgetViewport.onPerModelCategoriesOverridesChanged;
    },
    get perModelCategoryOverrides() {
      return treeWidgetViewport.perModelCategoryOverrides;
    },
    viewsCategory: (props) => treeWidgetViewport.viewsCategory(props),
    viewsModel: (props) => treeWidgetViewport.viewsModel(props),
    viewsSubCategory: (props) => treeWidgetViewport.viewsSubCategory(props),
    renderFrame: () => viewport.renderFrame(),
    [Symbol.dispose]() {
      viewport[Symbol.dispose]();
    },
  };
}
