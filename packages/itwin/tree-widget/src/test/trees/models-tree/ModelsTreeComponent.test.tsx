/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Children } from "react";
import sinon from "sinon";
import * as moq from "typemoq";
import { UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import * as treeHeader from "../../../components/tree-header/TreeHeader";
import * as modelsVisibilityHandler from "../../../components/trees/models-tree/internal/ModelsTreeVisibilityHandler";
import * as modelsTree from "../../../components/trees/models-tree/ModelsTree";
import { ModelsTreeComponent } from "../../../components/trees/models-tree/ModelsTreeComponent";
import { TreeWidget } from "../../../TreeWidget";
import { act, mockViewport, render, TestUtils, waitFor } from "../../TestUtils";

import type { ComponentPropsWithoutRef } from "react";
import type { ModelInfo, ModelsTreeHeaderButtonProps } from "../../../components/trees/models-tree/ModelsTreeButtons";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { TreeHeaderProps } from "../../../components/tree-header/TreeHeader";

describe("<ModelsTreeComponent />", () => {
  before(async () => {
    await NoRenderApp.startup();
    await TestUtils.initialize();
  });

  after(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

  const defaultModelsTreeComponentProps: ComponentPropsWithoutRef<typeof ModelsTreeComponent> = {
    getSchemaContext: () => ({}) as any,
    selectionStorage: {} as any,
  };
  let vpMock = moq.Mock.ofType<Viewport>();

  afterEach(() => {
    sinon.restore();
    vpMock.reset();
    vpMock = mockViewport();
  });

  const models: ModelInfo[] = [{ id: "testModelId1" }, { id: "testModelId2" }];

  const viewport = {
    onViewedCategoriesPerModelChanged: new BeEvent<(vp: Viewport) => void>(),
    onViewedCategoriesChanged: new BeEvent<(vp: Viewport) => void>(),
    onViewedModelsChanged: new BeEvent<(vp: Viewport) => void>(),
    onAlwaysDrawnChanged: new BeEvent<() => void>(),
    onNeverDrawnChanged: new BeEvent<() => void>(),
    onIModelHierarchyChanged: new BeEvent<() => void>(),
  } as unknown as Viewport;

  it("returns null if iModel is undefined", async () => {
    sinon.stub(IModelApp.viewManager, "selectedView").get(() => ({}) as Viewport);
    const modelsTreeSpy = sinon.stub(modelsTree, "ModelsTree");
    const result = render(<ModelsTreeComponent {...defaultModelsTreeComponentProps} />);
    await waitFor(() => {
      expect(result.container.children).to.be.empty;
      expect(modelsTreeSpy).to.not.be.called;
    });
  });

  it("returns null if viewport is undefined", async () => {
    sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
    const modelsTreeSpy = sinon.stub(modelsTree, "ModelsTree");
    const result = render(<ModelsTreeComponent {...defaultModelsTreeComponentProps} />);
    await waitFor(() => {
      expect(result.container.children).to.be.empty;
      expect(modelsTreeSpy).to.not.be.called;
    });
  });

  it("renders `ModelsTree` when iModel and viewport are defined", async () => {
    const modelsTreeSpy = sinon.stub(modelsTree, "ModelsTree").returns(<></>);
    sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
    sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
    const result = render(<ModelsTreeComponent {...defaultModelsTreeComponentProps} />);
    await waitFor(() => {
      expect(result.container.children).to.not.be.empty;
      expect(modelsTreeSpy).to.be.called;
    });
  });

  it("getLabel returns translated label of the component", () => {
    const translateSpy = sinon.stub(TreeWidget, "translate").returns("test models label");
    expect(ModelsTreeComponent.getLabel()).to.be.eq(TreeWidget.translate("test models label"));
    expect(translateSpy).to.be.calledWith("modelsTree.label");
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
      sinon.stub(modelsTree, "ModelsTree").returns(<></>);
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
      sinon.stub(modelsTree, "ModelsTree").returns(<></>);
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
      const treewHeaderSpy = sinon.stub(treeHeader, "TreeHeader").returns(<></>);
      sinon.stub(modelsTree, "ModelsTree").returns(<></>);
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
      render(<ModelsTreeComponent {...defaultModelsTreeComponentProps} />);
      await waitFor(() => {
        expect(treewHeaderSpy).to.be.calledWith(sinon.match((props: TreeHeaderProps) => Children.count(props.children) === 6));
      });
    });

    it("renders user provided tree header buttons", async () => {
      const treewHeaderSpy = sinon.stub(treeHeader, "TreeHeader").returns(<></>);
      const spy = sinon.stub().returns(<></>);
      sinon.stub(modelsTree, "ModelsTree").returns(<></>);
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
      render(<ModelsTreeComponent {...defaultModelsTreeComponentProps} headerButtons={[spy]} />);
      await waitFor(() => {
        expect(treewHeaderSpy).to.be.calledWith(sinon.match((props: TreeHeaderProps) => Children.count(props.children) === 1));
        expect(spy).to.be.called;
      });
    });

    describe("<ShowAllButton />", () => {
      it("click on ShowAllButton calls expected function", async () => {
        const showAllSpy = sinon.stub(modelsVisibilityHandler, "showAllModels");
        const { user, getByRole } = render(<ModelsTreeComponent.ShowAllButton models={models} viewport={vpMock.object} density="enlarged" />);
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(showAllSpy).to.be.calledWith(["testModelId1", "testModelId2"], vpMock.object);
      });

      it("reports when clicked", async () => {
        const onFeatureUsedSpy = sinon.spy();
        const { user, getByRole } = render(
          <ModelsTreeComponent.ShowAllButton models={models} viewport={vpMock.object} density="enlarged" onFeatureUsed={onFeatureUsedSpy} />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(onFeatureUsedSpy).to.be.calledWith("showall");
      });
    });

    describe("<HideAllButton />", () => {
      it("click on HideAllButton calls expected function", async () => {
        const hideAllSpy = sinon.stub(modelsVisibilityHandler, "hideAllModels");
        const { user, getByRole } = render(<ModelsTreeComponent.HideAllButton models={models} viewport={vpMock.object} density="enlarged" />);
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(hideAllSpy).to.be.calledWith(["testModelId1", "testModelId2"], vpMock.object);
      });

      it("reports when clicked", async () => {
        const onFeatureUsedSpy = sinon.spy();
        const { user, getByRole } = render(
          <ModelsTreeComponent.HideAllButton models={models} viewport={vpMock.object} density="enlarged" onFeatureUsed={onFeatureUsedSpy} />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(onFeatureUsedSpy).to.be.calledWith("hideall");
      });
    });

    describe("<InvertAllButton />", () => {
      it("click on InvertAllButton calls expected function", async () => {
        const invertAllSpy = sinon.stub(modelsVisibilityHandler, "invertAllModels");
        const { user, getByRole } = render(<ModelsTreeComponent.InvertButton models={models} viewport={vpMock.object} density="enlarged" />);
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(invertAllSpy).to.be.calledWith(["testModelId1", "testModelId2"], vpMock.object);
      });

      it("reports when clicked", async () => {
        const onFeatureUsedSpy = sinon.spy();
        const { user, getByRole } = render(
          <ModelsTreeComponent.InvertButton models={models} viewport={vpMock.object} density="enlarged" onFeatureUsed={onFeatureUsedSpy} />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(onFeatureUsedSpy).to.be.calledWith("invert");
      });
    });

    describe("<View2DButton />", () => {
      it("click on View2DButton calls expected function", async () => {
        const view2DSpy = sinon.stub(modelsVisibilityHandler, "toggleModels");
        const { user, getByRole } = render(
          <ModelsTreeComponent.View2DButton models={[{ id: "modelTestId", isPlanProjection: true }]} viewport={mockViewport().object} density="enlarged" />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(view2DSpy).to.be.calledOnce;
      });

      it("renders disabled button when there are no plan projection models", async () => {
        const view2DSpy = sinon.stub(modelsVisibilityHandler, "toggleModels");
        const { user, getByRole } = render(
          <ModelsTreeComponent.View2DButton models={[{ id: "modelTestId", isPlanProjection: false }]} viewport={mockViewport().object} />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(view2DSpy).to.not.be.called;
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

      it("checks if areAllModelsVisible was called", async () => {
        const onViewedModelsChanged: BeEvent<(vp: Viewport) => void> = new BeEvent<(vp: Viewport) => void>();
        const viewportMock = mockViewport({ onViewedModelsChanged });
        viewportMock.setup((x) => x.viewsModel("modelTestId")).returns(() => true);
        viewportMock.setup((x) => x.viewsModel("modelTestId")).returns(() => true);
        viewportMock.setup((x) => x.viewsModel("modelTestId")).returns(() => false);
        const areAllModelsVisibleSpy = sinon.stub(modelsVisibilityHandler, "areAllModelsVisible");
        render(<ModelsTreeComponent.View2DButton models={[{ id: "modelTestId", isPlanProjection: false }]} viewport={viewportMock.object} />);
        await waitFor(() => expect(areAllModelsVisibleSpy).to.be.called);
        areAllModelsVisibleSpy.resetHistory();
        act(() => {
          onViewedModelsChanged.raiseEvent(viewportMock.object);
        });

        await waitFor(() => expect(areAllModelsVisibleSpy).to.be.called);
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
        expect(onFeatureUsedSpy).to.be.calledWith("view2d");
      });
    });

    describe("<View3DButton />", () => {
      it("click on View3DButton calls expected function", async () => {
        const view3DSpy = sinon.stub(modelsVisibilityHandler, "toggleModels");
        const { user, getByRole } = render(
          <ModelsTreeComponent.View3DButton models={[{ id: "modelTestId", isPlanProjection: false }]} viewport={mockViewport().object} density="enlarged" />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(view3DSpy).to.be.calledOnce;
      });

      it("renders disabled button when all models are plan projection models", async () => {
        const view3DSpy = sinon.stub(modelsVisibilityHandler, "toggleModels");
        const { user, getByRole } = render(
          <ModelsTreeComponent.View3DButton models={[{ id: "modelTestId", isPlanProjection: true }]} viewport={mockViewport().object} />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(view3DSpy).to.not.be.called;
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

      it("checks if areAllModelsVisible was called", async () => {
        const onViewedModelsChanged: BeEvent<(vp: Viewport) => void> = new BeEvent<(vp: Viewport) => void>();
        const viewportMock = mockViewport({ onViewedModelsChanged });
        viewportMock.setup((x) => x.viewsModel("modelTestId")).returns(() => true);
        viewportMock.setup((x) => x.viewsModel("modelTestId")).returns(() => true);
        viewportMock.setup((x) => x.viewsModel("modelTestId")).returns(() => false);
        const areAllModelsVisibleSpy = sinon.stub(modelsVisibilityHandler, "areAllModelsVisible");
        render(<ModelsTreeComponent.View3DButton models={[{ id: "modelTestId", isPlanProjection: false }]} viewport={viewportMock.object} />);
        await waitFor(() => expect(areAllModelsVisibleSpy).to.be.called);
        areAllModelsVisibleSpy.resetHistory();
        act(() => {
          onViewedModelsChanged.raiseEvent(viewportMock.object);
        });

        await waitFor(() => expect(areAllModelsVisibleSpy).to.be.called);
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
        expect(onFeatureUsedSpy).to.be.calledWith("view3d");
      });
    });
  });
});
