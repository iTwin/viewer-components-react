/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import * as moq from "typemoq";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { CategoriesTreeComponent } from "../../../tree-widget-react";
import { IModelApp, IModelConnection, NoRenderApp, Viewport, ViewState } from "@itwin/core-frontend";
import { TestUtils } from "../../TestUtils";
import sinon from "sinon";
import { expect } from "chai";
import { BeEvent } from "@itwin/core-bentley";
import * as categoriesVisibilityHandler from "../../../components/trees/category-tree/CategoryVisibilityHandler";

describe("<CategoriesTreeComponent />", () => {
  before(async () => {
    // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
    await NoRenderApp.startup(); // eslint-disable-line @itwin/no-internal
    await TestUtils.initialize();
  });

  after(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

  const imodelMock = moq.Mock.ofType<IModelConnection>();

  afterEach(() => {
    imodelMock.reset();
    sinon.restore();
  });

  interface ViewportMockProps {
    viewState?: ViewState;
    onDisplayStyleChanged?: BeEvent<(vp: Viewport) => void>;
    onViewedCategoriesChanged?: BeEvent<(vp: Viewport) => void>;
  }

  const mockViewport = (props?: ViewportMockProps) => {
    if (!props)
      props = {};
    if (!props.viewState)
      props.viewState = moq.Mock.ofType<ViewState>().object;
    if (!props.onDisplayStyleChanged)
      props.onDisplayStyleChanged = new BeEvent<(vp: Viewport) => void>();
    if (!props.onViewedCategoriesChanged)
      props.onViewedCategoriesChanged = new BeEvent<(vp: Viewport) => void>();
    const vpMock = moq.Mock.ofType<Viewport>();
    vpMock.setup((x) => x.iModel).returns(() => imodelMock.object);
    vpMock.setup((x) => x.view).returns(() => props!.viewState!);
    vpMock.setup((x) => x.onDisplayStyleChanged).returns(() => props!.onDisplayStyleChanged!);
    vpMock.setup((x) => x.onViewedCategoriesChanged).returns(() => props!.onViewedCategoriesChanged!);
    return vpMock;
  };

  describe("Categories tree header buttons", () => {

    describe("ShowAllButton", () => {
      it("Renders show all button", async () => {
        const result = render(
          <CategoriesTreeComponent.ShowAllButton
            categories={[]}
            viewport={mockViewport().object}
          />
        );
        await waitFor(() => result.getByRole("button"));
      });

      it("Click on ShowAllButton calls expected function", async () => {
        const showAllSpy = sinon.stub(categoriesVisibilityHandler, "showAllCategories");
        const result = render(
          <CategoriesTreeComponent.ShowAllButton
            categories={[]}
            viewport={mockViewport().object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(showAllSpy).to.be.calledOnce;
      });
    });

    describe("HideAllButton", () => {
      it("Renders hide all button", async () => {
        const result = render(
          <CategoriesTreeComponent.HideAllButton
            categories={[]}
            viewport={mockViewport().object}
          />
        );
        await waitFor (() => result.getByRole("button"));
      });

      it("Click on hide all button calls expected function", async () => {
        const hideAllSpy = sinon.stub(categoriesVisibilityHandler, "hideAllCategories");
        const result = render(
          <CategoriesTreeComponent.HideAllButton
            categories={[]}
            viewport={mockViewport().object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(hideAllSpy).to.be.calledOnce;
      });
    });

    describe("InvertAllButton", () => {
      it("Renders invert all button", async () => {
        const result = render(
          <CategoriesTreeComponent.InvertAllButton
            categories={[]}
            viewport={mockViewport().object}
          />
        );
        await waitFor(() => result.getByRole("button"));
      });

      it("Click on invert all button calls expected function", async () => {
        const invertAllSpy = sinon.stub(categoriesVisibilityHandler, "invertAllCategories");
        const result = render(
          <CategoriesTreeComponent.InvertAllButton
            categories={[]}
            viewport={mockViewport().object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(invertAllSpy).to.be.calledOnce;
      });
    });
  });
});
