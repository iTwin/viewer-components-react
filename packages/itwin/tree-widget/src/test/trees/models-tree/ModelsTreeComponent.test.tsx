/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import * as moq from "typemoq";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { ModelsTreeComponent } from "../../../tree-widget-react";
import { IModelApp, IModelConnection, NoRenderApp, PerModelCategoryVisibility, Viewport, ViewState } from "@itwin/core-frontend";
import sinon from "sinon";
import { TestUtils } from "../../TestUtils";
import { BeEvent } from "@itwin/core-bentley";
import { expect } from "chai";
import * as modelsVisibilityHandler from "../../../components/trees/models-tree/ModelsVisibilityHandler";

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

  afterEach(() => {
    sinon.restore();
  });

  const imodelMock = moq.Mock.ofType<IModelConnection>();

  interface ViewportMockProps {
    viewState?: ViewState;
    perModelCategoryVisibility?: PerModelCategoryVisibility.Overrides;
    onViewedCategoriesPerModelChanged?: BeEvent<(vp: Viewport) => void>;
    onViewedCategoriesChanged?: BeEvent<(vp: Viewport) => void>;
    onViewedModelsChanged?: BeEvent<(vp: Viewport) => void>;
    onAlwaysDrawnChanged?: BeEvent<() => void>;
    onNeverDrawnChanged?: BeEvent<() => void>;
  }

  const mockViewport = (props?: ViewportMockProps) => {
    if (!props)
      props = {};
    if (!props.viewState)
      props.viewState = moq.Mock.ofType<ViewState>().object;
    if (!props.perModelCategoryVisibility)
      props.perModelCategoryVisibility = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>().object;
    if (!props.onViewedCategoriesPerModelChanged)
      props.onViewedCategoriesPerModelChanged = new BeEvent<(vp: Viewport) => void>();
    if (!props.onViewedCategoriesChanged)
      props.onViewedCategoriesChanged = new BeEvent<(vp: Viewport) => void>();
    if (!props.onViewedModelsChanged)
      props.onViewedModelsChanged = new BeEvent<(vp: Viewport) => void>();
    if (!props.onAlwaysDrawnChanged)
      props.onAlwaysDrawnChanged = new BeEvent<() => void>();
    if (!props.onNeverDrawnChanged)
      props.onNeverDrawnChanged = new BeEvent<() => void>();
    const vpMock = moq.Mock.ofType<Viewport>();
    vpMock.setup((x) => x.iModel).returns(() => imodelMock.object);
    vpMock.setup((x) => x.view).returns(() => props!.viewState!);
    vpMock.setup((x) => x.perModelCategoryVisibility).returns(() => props!.perModelCategoryVisibility!);
    vpMock.setup((x) => x.onViewedCategoriesPerModelChanged).returns(() => props!.onViewedCategoriesPerModelChanged!);
    vpMock.setup((x) => x.onViewedCategoriesChanged).returns(() => props!.onViewedCategoriesChanged!);
    vpMock.setup((x) => x.onViewedModelsChanged).returns(() => props!.onViewedModelsChanged!);
    vpMock.setup((x) => x.onAlwaysDrawnChanged).returns(() => props!.onAlwaysDrawnChanged!);
    vpMock.setup((x) => x.onNeverDrawnChanged).returns(() => props!.onNeverDrawnChanged!);
    return vpMock;
  };

  describe("Models tree header buttons", () => {

    describe("ShowAllButton", () => {

      it("Renders ShowAllButton", async () => {
        const result = render(
          <ModelsTreeComponent.ShowAllButton
            models={[]}
            viewport={mockViewport().object}
          />
        );
        await waitFor(() => result.getByRole("button"));
      });

      it("Click on ShowAllButton calls expected function", async () => {
        const showAllSpy = sinon.stub(modelsVisibilityHandler, "showAllModels");
        const result = render(
          <ModelsTreeComponent.ShowAllButton
            models={[]}
            viewport={mockViewport().object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(showAllSpy).to.be.calledOnce;
      });
    });

    describe("HideAllButton", () => {

      it("Renders HideAllButton", async () => {
        const result = render(
          <ModelsTreeComponent.HideAllButton
            models={[]}
            viewport={mockViewport().object}
          />
        );
        await waitFor(() => result.getByRole("button"));
      });

      it("Click on HideAllButton calls expected function", async () => {
        const hideAllSpy = sinon.stub(modelsVisibilityHandler, "hideAllModels");
        const result = render(
          <ModelsTreeComponent.HideAllButton
            models={[]}
            viewport={mockViewport().object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(hideAllSpy).to.be.calledOnce;
      });
    });

    describe("InvertAllButton", () => {

      it("Renders InvertAllButton", async () => {
        const result = render(
          <ModelsTreeComponent.InvertButton
            models={[]}
            viewport={mockViewport().object}
          />
        );
        await waitFor(() => result.getByRole("button"));
      });

      it("Click on InvertAllButton calls expected function", async () => {
        const invertAllSpy = sinon.stub(modelsVisibilityHandler, "invertAllModels");
        const result = render(
          <ModelsTreeComponent.InvertButton
            models={[]}
            viewport={mockViewport().object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(invertAllSpy).to.be.calledOnce;
      });
    });

    describe("View2DButton", () => {

      it("Renders View2DButton", async () => {
        const result = render(
          <ModelsTreeComponent.View2DButton
            models={[]}
            viewport={mockViewport().object}
          />
        );
        await waitFor(() => result.getByRole("button"));
      });

      it("Click on View2DButton calls expected function", async () => {
        const view2DSpy = sinon.stub(modelsVisibilityHandler, "view2DModels");
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
        const view2DSpy = sinon.stub(modelsVisibilityHandler, "view2DModels");
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

      it("On click changes models visibility when models are not visible", async () => {
        const vpMock = mockViewport();
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

      it("On click changes models visibility when models are visible", async () => {
        const vpMock = mockViewport();
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
    });

    describe("View3DButton", () => {

      it("Renders View3DButton", async () => {
        const result = render(
          <ModelsTreeComponent.View3DButton
            models={[]}
            viewport={mockViewport().object}
          />
        );
        await waitFor(() => result.getByRole("button"));
      });

      it("Click on View3DButton calls expected function", async () => {
        const view3DSpy = sinon.stub(modelsVisibilityHandler, "view3DModels");
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
        const vie3DSpy = sinon.stub(modelsVisibilityHandler, "view3DModels");
        const result = render(
          <ModelsTreeComponent.View3DButton
            models={[{ id:"modelTestId", isPlanProjection: true }]}
            viewport={mockViewport().object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(vie3DSpy).to.not.be.called;
        expect(button.getAttribute("disabled")).to.not.be.null;
      });

      it("On click changes models visibility when models are not visible", async () => {
        const vpMock = mockViewport();
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

      it("On click changes models visibility when models are visible", async () => {
        const vpMock = mockViewport();
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
    });
  });
});
