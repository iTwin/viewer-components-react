/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import { BeEvent } from "@itwin/core-bentley";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { fireEvent, render, waitFor } from "@testing-library/react";
import * as modelsVisibilityHandler from "../../../components/trees/models-tree/ModelsVisibilityHandler";
import { ModelsTreeComponent } from "../../../tree-widget-react";
import { mockViewport, TestUtils } from "../../TestUtils";

import type { ModelInfo} from "../../../tree-widget-react";
import type { Viewport } from "@itwin/core-frontend";

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

  const models: ModelInfo[] = [{id: "testModelId1"}, {id: "testModelId2"}];

  describe("models tree header buttons", () => {

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
