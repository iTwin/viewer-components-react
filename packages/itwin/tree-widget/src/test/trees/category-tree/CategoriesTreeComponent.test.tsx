/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import * as moq from "typemoq";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { CategoriesTreeComponent } from "../../../tree-widget-react";
import { IModelApp, IModelConnection, NoRenderApp, Viewport } from "@itwin/core-frontend";
import { mockViewport, testCategories, testFilteredCategories, TestUtils } from "../../TestUtils";
import sinon from "sinon";
import { expect } from "chai";
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
  let vpMock = moq.Mock.ofType<Viewport>();

  afterEach(() => {
    imodelMock.reset();
    sinon.restore();
    vpMock = mockViewport();
  });

  describe("categories tree header buttons", () => {

    describe("<ShowAllButton />", () => {

      it("click on ShowAllButton calls expected function", async () => {
        const showAllSpy = sinon.stub(categoriesVisibilityHandler, "showAllCategories");
        const result = render(
          <CategoriesTreeComponent.ShowAllButton
            categories={testCategories}
            viewport={vpMock.object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(showAllSpy).to.be.calledWith(["CategoryId"], vpMock.object);
      });

      it("calls expected function with filteredCategories when filteredCategories are not undefined", async () => {
        const showAllSpy = sinon.stub(categoriesVisibilityHandler, "showAllCategories");
        const result = render(
          <CategoriesTreeComponent.ShowAllButton
            categories={testCategories}
            filteredCategories={testFilteredCategories}
            viewport={vpMock.object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(showAllSpy).to.be.calledWith(["FilteredCategoryId"], vpMock.object);
      });
    });

    describe("<HideAllButton />", () => {

      it("click on HideAllButton calls expected function", async () => {
        const hideAllSpy = sinon.stub(categoriesVisibilityHandler, "hideAllCategories");
        const result = render(
          <CategoriesTreeComponent.HideAllButton
            categories={testCategories}
            viewport={vpMock.object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(hideAllSpy).to.be.calledWith(["CategoryId"], vpMock.object);
      });

      it("calls expected function with filteredCategories when filteredCategories are not undefined", async () => {
        const hideAllSpy = sinon.stub(categoriesVisibilityHandler, "hideAllCategories");
        const result = render(
          <CategoriesTreeComponent.HideAllButton
            categories={testCategories}
            filteredCategories={testFilteredCategories}
            viewport={vpMock.object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(hideAllSpy).to.be.calledWith(["FilteredCategoryId"], vpMock.object);
      });
    });

    describe("<InvertAllButton />", () => {

      it("click on InvertAllButton calls expected function", async () => {
        const invertAllSpy = sinon.stub(categoriesVisibilityHandler, "invertAllCategories");
        const result = render(
          <CategoriesTreeComponent.InvertAllButton
            categories={testCategories}
            viewport={vpMock.object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(invertAllSpy).to.be.calledWith(testCategories, vpMock.object);
      });

      it("calls expected function with filteredCategories when filteredCategories are not undefined", async () => {
        const invertAllSpy = sinon.stub(categoriesVisibilityHandler, "invertAllCategories");
        const result = render(
          <CategoriesTreeComponent.InvertAllButton
            categories={testCategories}
            filteredCategories={testFilteredCategories}
            viewport={vpMock.object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(invertAllSpy).to.be.calledWith(testFilteredCategories, vpMock.object);
      });
    });
  });
});
