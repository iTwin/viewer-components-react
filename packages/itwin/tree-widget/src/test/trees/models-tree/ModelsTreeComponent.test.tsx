/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as moq from "typemoq";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { ModelsTreeComponent, TreeWidget } from "../../../tree-widget-react";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import sinon from "sinon";
import { mockViewport, TestUtils } from "../../TestUtils";
import { expect } from "chai";
import * as modelsVisibilityHandler from "../../../components/trees/models-tree/ModelsVisibilityHandler";
import * as modelsTree from "../../../components/trees/models-tree/ModelsTree";
import * as treeHeader from "../../../components/tree-header/TreeHeader";
import { BeEvent } from "@itwin/core-bentley";
import { UiFramework } from "@itwin/appui-react";
import { Children } from "react";

import type { ModelInfo, ModelsTreeHeaderButtonProps } from "../../../tree-widget-react";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { TreeHeaderProps } from "../../../components/tree-header/TreeHeader";
import type { ModelProps } from "@itwin/core-common";

describe("<ModelsTreeComponent />", () => {

  before(async () => {
    // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
    await NoRenderApp.startup(); // eslint-disable-line @itwin/no-internal
    await TestUtils.initialize();
  });

  after(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

  let vpMock = moq.Mock.ofType<Viewport>();

  afterEach(() => {
    sinon.restore();
    vpMock.reset();
    vpMock = mockViewport();
  });

  const models: ModelInfo[] = [{ id: "testModelId1" }, { id: "testModelId2" }];

  const viewport =  {
    onViewedCategoriesPerModelChanged: new BeEvent<(vp: Viewport) => void>(),
    onViewedCategoriesChanged: new BeEvent<(vp: Viewport) => void>(),
    onViewedModelsChanged: new BeEvent<(vp: Viewport) => void>(),
    onAlwaysDrawnChanged: new BeEvent<() => void>(),
    onNeverDrawnChanged: new BeEvent<() => void>(),
    onIModelHierarchyChanged: new BeEvent<() => void>(),
  } as unknown as Viewport;

  it("returns null if iModel is undefined", () => {
    sinon.stub(IModelApp.viewManager, "selectedView").get(() => ({} as Viewport));
    const modelsTreeSpy = sinon.stub(modelsTree, "ModelsTree");
    const result = render(
      <ModelsTreeComponent />
    );
    expect(result.container.children).to.be.empty;
    expect(modelsTreeSpy).to.not.be.called;
  });

  it("returns null if viewport is undefined", () => {
    sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
    const modelsTreeSpy = sinon.stub(modelsTree, "ModelsTree");
    const result = render(
      <ModelsTreeComponent />
    );
    expect(result.container.children).to.be.empty;
    expect(modelsTreeSpy).to.not.be.called;
  });

  it("renders `ModelsTree` when iModel and viewport are defined", async () => {
    const modelsTreeSpy = sinon.stub(modelsTree, "ModelsTree").returns(<></>);
    sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
    sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
    const result = render(
      <ModelsTreeComponent />
    );
    expect(result.container.children).to.not.be.empty;
    expect(modelsTreeSpy).to.be.called;
  });

  it("getLabel returns translated label of the component", () => {
    const translateSpy = sinon.stub(TreeWidget, "translate").returns("test models label");
    expect(ModelsTreeComponent.getLabel()).to.be.eq(TreeWidget.translate("test models label"));
    expect(translateSpy).to.be.calledWith("models");
  });

  describe("available models", () => {

    it("renders button with available models", async () => {
      const iModel = {
        models: {
          queryProps: () => Promise.resolve([{
            id: "testIdFromQueryModels",
            modeledElement: {
              id: "id",
            },
            classFullName: "className",
          }]) as unknown as ModelProps[],
        } as unknown as IModelConnection.Models,
      } as unknown as IModelConnection;
      const spy = sinon.stub().returns(<></>);
      sinon.stub(modelsTree, "ModelsTree").returns(<></>);
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns(iModel);
      render(
        <ModelsTreeComponent
          headerButtons={[spy]}
        />
      );
      await waitFor(() => expect(spy).to.be.calledWith(sinon.match((props: ModelsTreeHeaderButtonProps) => (props.models.length === 1 && props.models[0].id === "testIdFromQueryModels"))));
    });

    it("renders button with empty available models list if error if thrown while querying available models", async () => {
      const spy = sinon.stub().returns(<></>);
      sinon.stub(modelsTree, "ModelsTree").returns(<></>);
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
      render(
        <ModelsTreeComponent
          headerButtons={[spy]}
        />
      );
      await waitFor(() => expect(spy).to.be.calledWith(sinon.match((props: ModelsTreeHeaderButtonProps) => (props.models.length === 0))));
    });
  });

  describe("header buttons", () => {

    it("renders default tree header buttons", () => {
      const treewHeaderSpy = sinon.stub(treeHeader, "TreeHeader").returns(<></>);
      sinon.stub(modelsTree, "ModelsTree").returns(<></>);
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
      render(<ModelsTreeComponent />);
      expect(treewHeaderSpy).to.be.calledWith(sinon.match((props: TreeHeaderProps) => Children.count(props.children) === 5));
    });

    it("renders user provided tree header buttons", () => {
      const treewHeaderSpy = sinon.stub(treeHeader, "TreeHeader").returns(<></>);
      const spy = sinon.stub().returns(<></>);
      sinon.stub(modelsTree, "ModelsTree").returns(<></>);
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
      render(
        <ModelsTreeComponent
          headerButtons={[spy]}
        />
      );
      expect(treewHeaderSpy).to.be.calledWith(sinon.match((props: TreeHeaderProps) => Children.count(props.children) === 1 ));
      expect(spy).to.be.called;
    });

    describe("<ShowAllButton />", () => {

      it("click on ShowAllButton calls expected function", async () => {
        const showAllSpy = sinon.stub(modelsVisibilityHandler, "showAllModels");
        const result = render(
          <ModelsTreeComponent.ShowAllButton
            models={models}
            viewport={vpMock.object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(showAllSpy).to.be.calledWith(["testModelId1", "testModelId2"], vpMock.object);
      });
    });

    describe("<HideAllButton />", () => {

      it("click on HideAllButton calls expected function", async () => {
        const hideAllSpy = sinon.stub(modelsVisibilityHandler, "hideAllModels");
        const result = render(
          <ModelsTreeComponent.HideAllButton
            models={models}
            viewport={vpMock.object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(hideAllSpy).to.be.calledWith(["testModelId1", "testModelId2"], vpMock.object);
      });
    });

    describe("<InvertAllButton />", () => {

      it("click on InvertAllButton calls expected function", async () => {
        const invertAllSpy = sinon.stub(modelsVisibilityHandler, "invertAllModels");
        const result = render(
          <ModelsTreeComponent.InvertButton
            models={models}
            viewport={vpMock.object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(invertAllSpy).to.be.calledWith(["testModelId1", "testModelId2"], vpMock.object);
      });
    });

    describe("<View2DButton />", () => {

      it("click on View2DButton calls expected function", async () => {
        const view2DSpy = sinon.stub(modelsVisibilityHandler, "toggleModels");
        const result = render(
          <ModelsTreeComponent.View2DButton
            models={[{ id:"modelTestId", isPlanProjection: true }]}
            viewport={mockViewport().object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(view2DSpy).to.be.calledOnce;
      });

      it("renders disabled button when there are no plan projection models", async () => {
        const view2DSpy = sinon.stub(modelsVisibilityHandler, "toggleModels");
        const result = render(
          <ModelsTreeComponent.View2DButton
            models={[{ id:"modelTestId", isPlanProjection: false }]}
            viewport={mockViewport().object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(view2DSpy).to.not.be.called;
        expect(button.getAttribute("disabled")).to.not.be.null;
      });

      it("on click changes models visibility when models are not visible", async () => {
        vpMock.setup((x) => x.viewsModel("modelTestId")).returns(() => false);
        const result = render(
          <ModelsTreeComponent.View2DButton
            models={[{ id:"modelTestId", isPlanProjection: true }]}
            viewport={vpMock.object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        vpMock.verify(async (x) => x.addViewedModels(["modelTestId"]), moq.Times.once());
      });

      it("on click changes models visibility when models are visible", async () => {
        vpMock.setup((x) => x.viewsModel("modelTestId")).returns(() => true);
        const result = render(
          <ModelsTreeComponent.View2DButton
            models={[{ id:"modelTestId", isPlanProjection: true }]}
            viewport={vpMock.object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        vpMock.verify((x) => x.changeModelDisplay(["modelTestId"], false), moq.Times.once());
      });

      it("checks if areAllModelsVisible was called", async () => {
        const onViewedModelsChanged: BeEvent<(vp: Viewport) => void> = new BeEvent<(vp: Viewport) => void>();
        const viewportMock = mockViewport({ onViewedModelsChanged });
        viewportMock.setup((x) => x.viewsModel("modelTestId")).returns(() => true);
        viewportMock.setup((x) => x.viewsModel("modelTestId")).returns(() => true);
        viewportMock.setup((x) => x.viewsModel("modelTestId")).returns(() => false);
        const areAllModelsVisibleSpy = sinon.stub(modelsVisibilityHandler, "areAllModelsVisible");
        render(
          <ModelsTreeComponent.View2DButton
            models={[{ id:"modelTestId", isPlanProjection: false }]}
            viewport={viewportMock.object}
          />
        );
        await waitFor(() => expect(areAllModelsVisibleSpy).to.be.calledOnce);
        onViewedModelsChanged.raiseEvent(viewportMock.object);
        await waitFor(() => expect(areAllModelsVisibleSpy).to.be.calledTwice);
      });
    });

    describe("<View3DButton />", () => {

      it("click on View3DButton calls expected function", async () => {
        const view3DSpy = sinon.stub(modelsVisibilityHandler, "toggleModels");
        const result = render(
          <ModelsTreeComponent.View3DButton
            models={[{ id:"modelTestId", isPlanProjection: false }]}
            viewport={mockViewport().object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(view3DSpy).to.be.calledOnce;
      });

      it("renders disabled button when all models are plan projection models", async () => {
        const view3DSpy = sinon.stub(modelsVisibilityHandler, "toggleModels");
        const result = render(
          <ModelsTreeComponent.View3DButton
            models={[{ id:"modelTestId", isPlanProjection: true }]}
            viewport={mockViewport().object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(view3DSpy).to.not.be.called;
        expect(button.getAttribute("disabled")).to.not.be.null;
      });

      it("on click changes models visibility when models are not visible", async () => {
        vpMock.setup((x) => x.viewsModel("modelTestId")).returns(() => false);
        const result = render(
          <ModelsTreeComponent.View3DButton
            models={[{ id:"modelTestId", isPlanProjection: false }]}
            viewport={vpMock.object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        vpMock.verify(async (x) => x.addViewedModels(["modelTestId"]), moq.Times.once());
      });

      it("on click changes models visibility when models are visible", async () => {
        vpMock.setup((x) => x.viewsModel("modelTestId")).returns(() => true);
        const result = render(
          <ModelsTreeComponent.View3DButton
            models={[{ id:"modelTestId", isPlanProjection: false }]}
            viewport={vpMock.object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        vpMock.verify((x) => x.changeModelDisplay(["modelTestId"], false), moq.Times.once());
      });

      it("checks if areAllModelsVisible was called", async () => {
        const onViewedModelsChanged: BeEvent<(vp: Viewport) => void> = new BeEvent<(vp: Viewport) => void>();
        const viewportMock = mockViewport({ onViewedModelsChanged });
        viewportMock.setup((x) => x.viewsModel("modelTestId")).returns(() => true);
        viewportMock.setup((x) => x.viewsModel("modelTestId")).returns(() => true);
        viewportMock.setup((x) => x.viewsModel("modelTestId")).returns(() => false);
        const areAllModelsVisibleSpy = sinon.stub(modelsVisibilityHandler, "areAllModelsVisible");
        render(
          <ModelsTreeComponent.View3DButton
            models={[{ id:"modelTestId", isPlanProjection: false }]}
            viewport={viewportMock.object}
          />
        );
        await waitFor(() => expect(areAllModelsVisibleSpy).to.be.calledOnce);
        onViewedModelsChanged.raiseEvent(viewportMock.object);
        await waitFor(() => expect(areAllModelsVisibleSpy).to.be.calledTwice);
      });
    });
  });
});
