/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { Code, ColorDef, IModel, RenderMode } from "@itwin/core-common";
import { IModelApp, OffScreenViewport, SpatialViewState, ViewRect } from "@itwin/core-frontend";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { createTreeWidgetViewport } from "../../../tree-widget-react.js";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory, insertSubCategory } from "../../IModelUtils.js";

import type { Id64Array } from "@itwin/core-bentley";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";

describe("TreeWidgetViewport", () => {
  const listeners = new Array<() => void>();
  before(async () => {
    await initializePresentationTesting({
      backendProps: {
        caching: {
          hierarchies: {
            mode: HierarchyCacheMode.Memory,
          },
        },
      },
    });
  });

  after(async () => {
    await terminatePresentationTesting();
    listeners.forEach((listener) => listener());
  });

  it("triggers onChange events when visibility changes", async function () {
    await using buildIModelResult = await buildIModel(this, async (builder) => {
      const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

      const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory1" });
      const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
      const subCategory = insertSubCategory({
        builder,
        parentCategoryId: category.id,
        codeValue: "subCategory",
      });
      return { category, model: physicalModel, subCategory, element };
    });

    const { imodel, ...keys } = buildIModelResult;

    using viewport = await createViewport({
      iModelConnection: imodel,
      testData: {
        models: [keys.model.id],
        categories: [keys.category.id],
      },
    });
    const treeWidgetViewport = createTreeWidgetViewport(viewport);
    const onChangeListener = sinon.stub();
    listeners.push(treeWidgetViewport.onAlwaysDrawnChanged.addListener(() => onChangeListener("always")));
    listeners.push(treeWidgetViewport.onDisplayStyleChanged.addListener(() => onChangeListener("displayStyle")));
    listeners.push(treeWidgetViewport.onDisplayedCategoriesChanged.addListener(() => onChangeListener("categories")));
    listeners.push(treeWidgetViewport.onDisplayedModelsChanged.addListener(() => onChangeListener("models")));
    listeners.push(treeWidgetViewport.onNeverDrawnChanged.addListener(() => onChangeListener("never")));
    listeners.push(treeWidgetViewport.onPerModelCategoriesOverridesChanged.addListener(() => onChangeListener("override")));

    treeWidgetViewport.changeCategoryDisplay({ categoryIds: keys.category.id, display: false });
    viewport.renderFrame();
    expect(onChangeListener).to.be.calledWith("categories");
    sinon.resetHistory();

    treeWidgetViewport.changeModelDisplay({ modelIds: keys.model.id, display: false });
    viewport.renderFrame();
    expect(onChangeListener).to.be.calledWith("models");
    sinon.resetHistory();

    treeWidgetViewport.changeSubCategoryDisplay({ subCategoryId: keys.subCategory.id, display: false });
    viewport.renderFrame();
    expect(onChangeListener).to.be.calledWith("displayStyle");
    sinon.resetHistory();

    treeWidgetViewport.setAlwaysDrawn({ elementIds: new Set([keys.element.id]) });
    viewport.renderFrame();
    expect(onChangeListener).to.be.calledWith("always");
    sinon.resetHistory();

    treeWidgetViewport.setNeverDrawn({ elementIds: new Set([keys.element.id]) });
    viewport.renderFrame();
    expect(onChangeListener).to.be.calledWith("never");
    sinon.resetHistory();

    treeWidgetViewport.setPerModelCategoryOverride({ categoryIds: keys.category.id, modelIds: keys.model.id, override: "show" });
    viewport.renderFrame();
    expect(onChangeListener).to.be.calledWith("override");
    sinon.resetHistory();
  });
});

async function createViewport({
  iModelConnection,
  testData,
}: {
  iModelConnection: IModelConnection;
  testData: {
    categories: Id64Array;
    models: Id64Array;
  };
}): Promise<Viewport> {
  const model = IModel.dictionaryId;
  const viewState = SpatialViewState.createFromProps(
    {
      categorySelectorProps: {
        categories: testData.categories,
        model,
        code: Code.createEmpty(),
        classFullName: "BisCore:CategorySelector",
      },
      displayStyleProps: { model, code: Code.createEmpty(), classFullName: "BisCore:DisplayStyle3d" },
      viewDefinitionProps: {
        model,
        code: Code.createEmpty(),
        categorySelectorId: "",
        classFullName: "BisCore:SpatialViewDefinition",
        displayStyleId: "",
      },
      modelSelectorProps: {
        models: testData.models,
        code: Code.createEmpty(),
        model,
        classFullName: "BisCore:ModelSelector",
      },
    },
    iModelConnection,
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
  return OffScreenViewport.create({
    view: viewState,
    viewRect: new ViewRect(),
  });
}
