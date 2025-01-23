/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Children } from "react";
import sinon from "sinon";
import * as td from "testdouble";
import * as moq from "typemoq";
import { BeEvent } from "@itwin/core-bentley";
import * as treeHeaderModule from "../../../components/tree-header/TreeHeader.js";
import * as modelsVisibilityHandlerModule from "../../../components/trees/models-tree/internal/ModelsTreeVisibilityHandler.js";
import * as modelsTreeModule from "../../../components/trees/models-tree/ModelsTree.js";
import * as treeWidgetModule from "../../../TreeWidget.js";
import { mockViewport, render, waitFor } from "../../TestUtils.js";

import type { ComponentPropsWithoutRef } from "react";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { ModelInfo, ModelsTreeHeaderButtonProps } from "../../../components/trees/models-tree/ModelsTreeButtons.js";
import type * as modelsTreeComponentModule from "../../../components/trees/models-tree/ModelsTreeComponent.js";

type TreeHeaderProps = ComponentPropsWithoutRef<typeof treeHeaderModule.TreeHeader>;

describe("<ModelsTreeComponent />", () => {
  async function initialize() {
    const { IModelApp, NoRenderApp } = await import("@itwin/core-frontend");
    await NoRenderApp.startup();

    const { UiFramework } = await import("@itwin/appui-react");
    await UiFramework.initialize();

    return { IModelApp, UiFramework };
  }

  const defaultModelsTreeComponentProps: ComponentPropsWithoutRef<typeof modelsTreeComponentModule.ModelsTreeComponent> = {
    getSchemaContext: () => ({}) as any,
    selectionStorage: {} as any,
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
  let stubModelsTree: sinon.SinonStub;
  let stubTreeHeader: sinon.SinonStub;
  let stubTreeWidgetTranslate: sinon.SinonStub;
  let stubModelsVisibilityHandler: {
    showAllModels: sinon.SinonStub;
    hideAllModels: sinon.SinonStub;
    invertAllModels: sinon.SinonStub;
  };

  beforeEach(async () => {
    vpMock = mockViewport();

    stubModelsTree = sinon.stub().returns(<></>);
    await td.replaceEsm("../../../components/trees/models-tree/ModelsTree.js", {
      ...modelsTreeModule,
      ModelsTree: stubModelsTree,
    });

    stubTreeHeader = sinon.stub().returns(<></>);
    await td.replaceEsm("../../../components/tree-header/TreeHeader.js", {
      ...treeHeaderModule,
      TreeHeader: stubTreeHeader,
    });

    stubTreeWidgetTranslate = sinon.stub().returns("test translated string");
    await td.replaceEsm("../../../TreeWidget.js", {
      ...treeWidgetModule,
      TreeWidget: {
        ...treeWidgetModule.TreeWidget,
        translate: stubTreeWidgetTranslate,
      },
    });

    stubModelsVisibilityHandler = {
      showAllModels: sinon.stub(),
      hideAllModels: sinon.stub(),
      invertAllModels: sinon.stub(),
    };
    await td.replaceEsm("../../../components/trees/models-tree/internal/ModelsTreeVisibilityHandler.js", {
      ...modelsVisibilityHandlerModule,
      ...stubModelsVisibilityHandler,
    });

    ModelsTreeComponent = (await import("../../../components/trees/models-tree/ModelsTreeComponent.js")).ModelsTreeComponent;
  });

  afterEach(() => {
    td.reset();
    sinon.restore();
  });

  it("returns null if iModel is undefined", async () => {
    const { IModelApp } = await initialize();
    sinon.stub(IModelApp.viewManager, "selectedView").get(() => ({}) as Viewport);
    const result = render(<ModelsTreeComponent {...defaultModelsTreeComponentProps} />);
    await waitFor(() => {
      expect(result.container.children).to.be.empty;
      expect(stubModelsTree).to.not.be.called;
    });
  });

  it("returns null if viewport is undefined", async () => {
    const { UiFramework } = await initialize();
    sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
    const result = render(<ModelsTreeComponent {...defaultModelsTreeComponentProps} />);
    await waitFor(() => {
      expect(result.container.children).to.be.empty;
      expect(stubModelsTree).to.not.be.called;
    });
  });

  it("renders `ModelsTree` when iModel and viewport are defined", async () => {
    const { IModelApp, UiFramework } = await initialize();
    sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
    sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
    const result = render(<ModelsTreeComponent {...defaultModelsTreeComponentProps} />);
    await waitFor(() => {
      expect(result.container.children).to.not.be.empty;
      expect(stubModelsTree).to.be.called;
    });
  });

  it("getLabel returns translated label of the component", () => {
    expect(ModelsTreeComponent.getLabel()).to.be.eq("test translated string");
    expect(stubTreeWidgetTranslate).to.be.calledWith("modelsTree.label");
  });

  describe("available models", () => {
    it("renders button with available models", async () => {
      const { IModelApp, UiFramework } = await initialize();
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
      const { IModelApp, UiFramework } = await initialize();
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
      const { IModelApp, UiFramework } = await initialize();
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
      render(<ModelsTreeComponent {...defaultModelsTreeComponentProps} />);
      await waitFor(() => {
        expect(stubTreeHeader).to.be.calledWith(sinon.match((props: TreeHeaderProps) => Children.count(props.children) === 6));
      });
    });

    it("renders user provided tree header buttons", async () => {
      const { IModelApp, UiFramework } = await initialize();
      const spy = sinon.stub().returns(<></>);
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
      render(<ModelsTreeComponent {...defaultModelsTreeComponentProps} headerButtons={[spy]} />);
      await waitFor(() => {
        expect(stubTreeHeader).to.be.calledWith(sinon.match((props: TreeHeaderProps) => Children.count(props.children) === 1));
        expect(spy).to.be.called;
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
