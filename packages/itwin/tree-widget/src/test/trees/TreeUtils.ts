/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Code, ColorDef, IModel, RenderMode } from "@itwin/core-common";
import { IModelApp, SpatialViewState } from "@itwin/core-frontend";

import type { Id64Array } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

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
