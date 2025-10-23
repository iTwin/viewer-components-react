/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { mock } from "node:test";
import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import { UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import * as modelsVisibilityHandlerModule from "../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeVisibilityHandler.js";
import * as modelsTreeModule from "../../../tree-widget-react/components/trees/models-tree/ModelsTree.js";
import { TreeWidget } from "../../../tree-widget-react/TreeWidget.js";
import { mockViewport, render, waitFor } from "../../TestUtils.js";

import type { ComponentPropsWithoutRef } from "react";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { ModelInfo, ModelsTreeHeaderButtonProps } from "../../../tree-widget-react/components/trees/models-tree/ModelsTreeButtons.js";
import type * as modelsTreeComponentModule from "../../../tree-widget-react/components/trees/models-tree/ModelsTreeComponent.js";

describe("<ModelsTreeComponent />", () => {
  const defaultModelsTreeComponentProps: ComponentPropsWithoutRef<typeof modelsTreeComponentModule.ModelsTreeComponent> = {
    getSchemaContext: () => ({}) as any,
    selectionStorage: {} as any,
    headerButtons: [],
  };

  const models: ModelInfo[] = [{ id: "testModelId1" }, { id: "testModelId2" }];

  const viewport = {
    onViewedCategoriesPerModelChanged: new BeEvent<(vp: Viewport) => void>(),
    onViewedCategoriesChanged: new BeEvent<(vp: Viewport) => void>(),
    onViewedModelsChanged: new BeEvent<(vp: Viewport) => void>(),
    onAlwaysDrawnChanged: new BeEvent<() => void>(),
    onNeverDrawnChanged: new BeEvent<() => void>(),
    onIModelHierarchyChanged: new BeEvent<() => void>(),
  } as unknown as Viewport;

  let vpMock: ReturnType<typeof mockViewport>;

  let ModelsTreeComponent: typeof modelsTreeComponentModule.ModelsTreeComponent;
  const stubModelsTree = sinon.stub();
  const stubModelsVisibilityHandler = {
    showAllModels: sinon.stub(),
    hideAllModels: sinon.stub(),
    invertAllModels: sinon.stub(),
  };

  before(async () => {
    mock.module("../../../tree-widget-react/components/trees/models-tree/ModelsTree.js", {
      namedExports: {
        ...modelsTreeModule,
        ModelsTree: stubModelsTree,
      },
    });
    mock.module("../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeVisibilityHandler.js", {
      namedExports: {
        ...modelsVisibilityHandlerModule,
        ...stubModelsVisibilityHandler,
      },
    });
    ModelsTreeComponent = (await import("../../../tree-widget-react/components/trees/models-tree/ModelsTreeComponent.js")).ModelsTreeComponent;

    await NoRenderApp.startup({ localization: new EmptyLocalization() });
    await UiFramework.initialize();
    await TreeWidget.initialize();
  });

  after(async () => {
    TreeWidget.terminate();
    UiFramework.terminate();
    await IModelApp.shutdown();
    mock.reset();
  });

  beforeEach(async () => {
    vpMock = mockViewport();
    stubModelsTree.returns(<>Tree stub</>);
  });

  afterEach(() => {
    sinon.restore();
  });

  it("returns null if iModel is undefined", async () => {
    sinon.stub(IModelApp.viewManager, "selectedView").get(() => ({}) as Viewport);
    const result = render(<ModelsTreeComponent {...defaultModelsTreeComponentProps} />);
    await waitFor(() => {
      expect(result.container.children).to.be.empty;
      expect(stubModelsTree).to.not.be.called;
    });
  });

  it("returns null if viewport is undefined", async () => {
    sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
    const result = render(<ModelsTreeComponent {...defaultModelsTreeComponentProps} />);
    await waitFor(() => {
      expect(result.container.children).to.be.empty;
      expect(stubModelsTree).to.not.be.called;
    });
  });

  it("renders `ModelsTree` when iModel and viewport are defined", async () => {
    sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
    sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
    const result = render(<ModelsTreeComponent {...defaultModelsTreeComponentProps} />);
    await waitFor(() => {
      expect(result.container.children).to.not.be.empty;
      expect(stubModelsTree).to.be.called;
    });
  });

  describe("available models", () => {
    it("renders button with available models", async () => {
      const iModel = {
        models: {
          queryProps: async () => [
            {
              id: "testIdFromQueryModels",
              modeledElement: {
                id: "id",
              },
              classFullName: "className",
            },
          ],
        },
      } as unknown as IModelConnection;
      const spy = sinon.stub().returns(<></>);
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns(iModel);
      render(<ModelsTreeComponent {...defaultModelsTreeComponentProps} headerButtons={[spy]} />);
      await waitFor(() =>
        expect(spy).to.be.calledWith(
          sinon.match((props: ModelsTreeHeaderButtonProps) => props.models.length === 1 && props.models[0].id === "testIdFromQueryModels"),
        ),
      );
    });

    it("renders button with empty available models list if error if thrown while querying available models", async () => {
      const spy = sinon.stub().returns(<></>);
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns({
        models: {
          queryProps: () => {
            throw new Error();
          },
        },
      } as unknown as IModelConnection);
      render(<ModelsTreeComponent {...defaultModelsTreeComponentProps} headerButtons={[spy]} />);
      await waitFor(() => expect(spy).to.be.calledWith(sinon.match((props: ModelsTreeHeaderButtonProps) => props.models.length === 0)));
    });
  });

  describe("header buttons", () => {
    it("renders default tree header buttons", async () => {
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
      const { getByText, container } = render(<ModelsTreeComponent {...defaultModelsTreeComponentProps} headerButtons={undefined} />);
      await waitFor(() => {
        getByText("modelsTree.buttons.showAll.tooltip");
        getByText("modelsTree.buttons.hideAll.tooltip");
        getByText("modelsTree.buttons.invert.tooltip");
        getByText("modelsTree.buttons.toggle2d.tooltip");
        getByText("modelsTree.buttons.toggle3d.tooltip");
        getByText("modelsTree.buttons.toggleFocusMode.enable.tooltip");
        expect(container.querySelectorAll(".tree-widget-tree-header > .button-container button").length).to.eq(6);
      });
    });

    it("renders user provided tree header buttons", async () => {
      const button = () => {
        return <button>Test button</button>;
      };
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
      const { getByText, container } = render(<ModelsTreeComponent {...defaultModelsTreeComponentProps} headerButtons={[button]} />);
      await waitFor(() => {
        getByText("Test button");
        expect(container.querySelectorAll(".tree-widget-tree-header > .button-container button").length).to.eq(1);
      });
    });

    describe("<ShowAllButton />", () => {
      it("click on ShowAllButton calls expected function", async () => {
        const { user, getByRole } = render(<ModelsTreeComponent.ShowAllButton models={models} viewport={vpMock.object} density="enlarged" />);
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(stubModelsVisibilityHandler.showAllModels).to.be.calledWith(["testModelId1", "testModelId2"], vpMock.object);
      });

      it("reports when clicked", async () => {
        const onFeatureUsedSpy = sinon.spy();
        const { user, getByRole } = render(
          <ModelsTreeComponent.ShowAllButton models={models} viewport={vpMock.object} density="enlarged" onFeatureUsed={onFeatureUsedSpy} />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        // cspell:disable-next-line
        expect(onFeatureUsedSpy).to.be.calledWith("models-tree-showall");
      });
    });

    describe("<HideAllButton />", () => {
      it("click on HideAllButton calls expected function", async () => {
        const { user, getByRole } = render(<ModelsTreeComponent.HideAllButton models={models} viewport={vpMock.object} density="enlarged" />);
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(stubModelsVisibilityHandler.hideAllModels).to.be.calledWith(["testModelId1", "testModelId2"], vpMock.object);
      });

      it("reports when clicked", async () => {
        const onFeatureUsedSpy = sinon.spy();
        const { user, getByRole } = render(
          <ModelsTreeComponent.HideAllButton models={models} viewport={vpMock.object} density="enlarged" onFeatureUsed={onFeatureUsedSpy} />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        // cspell:disable-next-line
        expect(onFeatureUsedSpy).to.be.calledWith("models-tree-hideall");
      });
    });

    describe("<InvertAllButton />", () => {
      it("click on InvertAllButton calls expected function", async () => {
        const { user, getByRole } = render(<ModelsTreeComponent.InvertButton models={models} viewport={vpMock.object} density="enlarged" />);
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(stubModelsVisibilityHandler.invertAllModels).to.be.calledWith(["testModelId1", "testModelId2"], vpMock.object);
      });

      it("reports when clicked", async () => {
        const onFeatureUsedSpy = sinon.spy();
        const { user, getByRole } = render(
          <ModelsTreeComponent.InvertButton models={models} viewport={vpMock.object} density="enlarged" onFeatureUsed={onFeatureUsedSpy} />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(onFeatureUsedSpy).to.be.calledWith("models-tree-invert");
      });
    });

    describe("<View2DButton />", () => {
      it("renders disabled button when there are no plan projection models", async () => {
        const { getByRole } = render(
          <ModelsTreeComponent.View2DButton models={[{ id: "modelTestId", isPlanProjection: false }]} viewport={mockViewport().object} />,
        );
        const button = await waitFor(() => getByRole("button"));
        expect(button.getAttribute("aria-disabled")).to.not.be.null;
      });

      it("on click changes models visibility when models are not visible", async () => {
        vpMock.setup((x) => x.viewsModel("modelTestId")).returns(() => false);
        const { user, getByRole } = render(
          <ModelsTreeComponent.View2DButton models={[{ id: "modelTestId", isPlanProjection: true }]} viewport={vpMock.object} />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        vpMock.verify(async (x) => x.addViewedModels(["modelTestId"]), moq.Times.once());
      });

      it("on click changes models visibility when models are visible", async () => {
        vpMock.setup((x) => x.viewsModel("modelTestId")).returns(() => true);
        const { user, getByRole } = render(
          <ModelsTreeComponent.View2DButton models={[{ id: "modelTestId", isPlanProjection: true }]} viewport={vpMock.object} />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        vpMock.verify((x) => x.changeModelDisplay(["modelTestId"], false), moq.Times.once());
      });

      it("reports when clicked", async () => {
        const onFeatureUsedSpy = sinon.spy();
        const { user, getByRole } = render(
          <ModelsTreeComponent.View2DButton
            models={[{ id: "modelTestId", isPlanProjection: true }]}
            viewport={mockViewport().object}
            density="enlarged"
            onFeatureUsed={onFeatureUsedSpy}
          />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(onFeatureUsedSpy).to.be.calledWith("models-tree-view2d");
      });
    });

    describe("<View3DButton />", () => {
      it("renders disabled button when all models are plan projection models", async () => {
        const { getByRole } = render(
          <ModelsTreeComponent.View3DButton models={[{ id: "modelTestId", isPlanProjection: true }]} viewport={mockViewport().object} />,
        );
        const button = await waitFor(() => getByRole("button"));
        expect(button.getAttribute("aria-disabled")).to.not.be.null;
      });

      it("on click changes models visibility when models are not visible", async () => {
        vpMock.setup((x) => x.viewsModel("modelTestId")).returns(() => false);
        const { user, getByRole } = render(
          <ModelsTreeComponent.View3DButton models={[{ id: "modelTestId", isPlanProjection: false }]} viewport={vpMock.object} />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        vpMock.verify(async (x) => x.addViewedModels(["modelTestId"]), moq.Times.once());
      });

      it("on click changes models visibility when models are visible", async () => {
        vpMock.setup((x) => x.viewsModel("modelTestId")).returns(() => true);
        const { user, getByRole } = render(
          <ModelsTreeComponent.View3DButton models={[{ id: "modelTestId", isPlanProjection: false }]} viewport={vpMock.object} />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        vpMock.verify((x) => x.changeModelDisplay(["modelTestId"], false), moq.Times.once());
      });

      it("reports when clicked", async () => {
        const onFeatureUsedSpy = sinon.spy();
        const { user, getByRole } = render(
          <ModelsTreeComponent.View3DButton
            models={[{ id: "modelTestId", isPlanProjection: false }]}
            viewport={mockViewport().object}
            density="enlarged"
            onFeatureUsed={onFeatureUsedSpy}
          />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(onFeatureUsedSpy).to.be.calledWith("models-tree-view3d");
      });
    });
  });
});
