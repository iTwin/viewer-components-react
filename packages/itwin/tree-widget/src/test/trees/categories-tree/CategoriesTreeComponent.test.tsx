/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { mock } from "node:test";
import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import * as categoriesTreeModule from "../../../tree-widget-react/components/trees/categories-tree/CategoriesTree.js";
import * as categoriesVisibilityUtilsModule from "../../../tree-widget-react/components/trees/common/CategoriesVisibilityUtils.js";
import { TreeWidget } from "../../../tree-widget-react/TreeWidget.js";
import { mockPresentationManager, render, waitFor } from "../../TestUtils.js";

import type * as categoriesTreeComponentModule from "../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeComponent.js";
import type { ComponentPropsWithoutRef } from "react";
import type { CategoryInfo } from "../../../tree-widget-react/components/trees/common/CategoriesVisibilityUtils.js";
import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";

describe("<CategoriesTreeComponent />", () => {
  const defaultCategoriesTreeComponentProps: ComponentPropsWithoutRef<typeof categoriesTreeComponentModule.CategoriesTreeComponent> = {
    getSchemaContext: () => ({}) as any,
    selectionStorage: {} as any,
    headerButtons: [],
  };

  let CategoriesTreeComponent: typeof categoriesTreeComponentModule.CategoriesTreeComponent;
  const stubCategoriesTree = sinon.stub();
  const stubCategoriesVisibilityUtils = {
    showAllCategories: sinon.stub(),
    invertAllCategories: sinon.stub(),
    hideAllCategories: sinon.stub(),
  };

  before(async () => {
    mock.module("../../../tree-widget-react/components/trees/categories-tree/CategoriesTree.js", {
      namedExports: {
        ...categoriesTreeModule,
        CategoriesTree: stubCategoriesTree,
      },
    });
    mock.module("../../../tree-widget-react/components/trees/common/CategoriesVisibilityUtils.js", {
      namedExports: {
        ...categoriesVisibilityUtilsModule,
        ...stubCategoriesVisibilityUtils,
      },
    });
    CategoriesTreeComponent = (await import("../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeComponent.js")).CategoriesTreeComponent;

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

  beforeEach(() => {
    const { presentationManager } = mockPresentationManager();
    sinon.stub(Presentation, "presentation").get(() => presentationManager.object);
    sinon.stub(Presentation, "localization").get(() => new EmptyLocalization());
    stubCategoriesTree.returns(<>Tree stub</>);
  });

  afterEach(() => {
    sinon.restore();
  });

  const categories: CategoryInfo[] = [
    {
      categoryId: "CategoryId",
      subCategoryIds: ["SubCategoryId1", "SubCategoryId2"],
    },
  ];

  const iModel = {
    createQueryReader: () => ({
      toArray: async () => [],
    }),
    categories: {
      getCategoryInfo: async () => new Map<Id64String, IModelConnection.Categories.CategoryInfo>(),
    },
    views: {},
  } as unknown as IModelConnection;

  const viewport = {
    onDisplayStyleChanged: new BeEvent<(vp: Viewport) => void>(),
    onViewedCategoriesChanged: new BeEvent<(vp: Viewport) => void>(),
    view: {
      is3d: () => false,
    },
    iModel,
  } as unknown as Viewport;

  it("returns null if iModel is undefined", async () => {
    sinon.stub(IModelApp.viewManager, "selectedView").get(() => ({}) as Viewport);
    const result = render(<CategoriesTreeComponent {...defaultCategoriesTreeComponentProps} />);
    expect(result.container.children).to.be.empty;
    expect(stubCategoriesTree).to.not.be.called;
  });

  it("returns null if viewport is undefined", async () => {
    sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
    const result = render(<CategoriesTreeComponent {...defaultCategoriesTreeComponentProps} />);
    expect(result.container.children).to.be.empty;
    expect(stubCategoriesTree).to.not.be.called;
  });

  it("renders `CategoryTree` when iModel and viewport are defined", async () => {
    sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
    sinon.stub(UiFramework, "getIModelConnection").returns(iModel);
    const result = render(<CategoriesTreeComponent {...defaultCategoriesTreeComponentProps} density="enlarged" />);
    await waitFor(() => {
      expect(result.container.children).to.not.be.empty;
      expect(stubCategoriesTree).to.be.called;
    });
  });

  describe("header buttons", () => {
    it("renders default tree header buttons", async () => {
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns(iModel);
      const { getByText, container } = render(<CategoriesTreeComponent {...defaultCategoriesTreeComponentProps} headerButtons={undefined} />);
      await waitFor(() => {
        getByText("categoriesTree.buttons.showAll.tooltip");
        getByText("categoriesTree.buttons.hideAll.tooltip");
        getByText("categoriesTree.buttons.invert.tooltip");
        expect(container.querySelectorAll(".tree-widget-tree-header > .button-container button").length).to.eq(3);
      });
    });

    it("renders user provided tree header buttons", async () => {
      const button = () => {
        return <button>Test button</button>;
      };
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns(iModel);
      const { getByText, container } = render(<CategoriesTreeComponent {...defaultCategoriesTreeComponentProps} headerButtons={[button]} />);

      await waitFor(() => {
        getByText("Test button");
        expect(container.querySelectorAll(".tree-widget-tree-header > .button-container button").length).to.eq(1);
      });
    });

    describe("<ShowAllButton />", () => {
      it("click on ShowAllButton calls expected function", async () => {
        const { user, getByRole } = render(<CategoriesTreeComponent.ShowAllButton categories={categories} viewport={viewport} density="enlarged" />);
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(stubCategoriesVisibilityUtils.showAllCategories).to.be.calledWith(["CategoryId"], viewport);
      });

      it("report on click", async () => {
        const onFeatureUsedSpy = sinon.spy();
        const { user, getByRole } = render(
          <CategoriesTreeComponent.ShowAllButton categories={categories} viewport={viewport} density="enlarged" onFeatureUsed={onFeatureUsedSpy} />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(onFeatureUsedSpy).to.be.calledWith("categories-tree-showall");
      });
    });

    describe("<HideAllButton />", () => {
      it("click on HideAllButton calls expected function", async () => {
        const { user, getByRole } = render(<CategoriesTreeComponent.HideAllButton categories={categories} viewport={viewport} density="enlarged" />);
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(stubCategoriesVisibilityUtils.hideAllCategories).to.be.calledWith(["CategoryId"], viewport);
      });

      it("reports on click", async () => {
        const onFeatureUsedSpy = sinon.spy();
        const { user, getByRole } = render(
          <CategoriesTreeComponent.HideAllButton categories={categories} viewport={viewport} density="enlarged" onFeatureUsed={onFeatureUsedSpy} />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(onFeatureUsedSpy).to.be.calledWith("categories-tree-hideall");
      });
    });

    describe("<InvertAllButton />", () => {
      it("click on InvertAllButton calls expected function", async () => {
        const { user, getByRole } = render(<CategoriesTreeComponent.InvertAllButton categories={categories} viewport={viewport} density="enlarged" />);
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(stubCategoriesVisibilityUtils.invertAllCategories).to.be.calledWith(categories, viewport);
      });

      it("reports on click", async () => {
        const onFeatureUsedSpy = sinon.spy();
        const { user, getByRole } = render(
          <CategoriesTreeComponent.InvertAllButton categories={categories} viewport={viewport} density="enlarged" onFeatureUsed={onFeatureUsedSpy} />,
        );
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(onFeatureUsedSpy).to.be.calledWith("categories-tree-invert");
      });
    });
  });
});
