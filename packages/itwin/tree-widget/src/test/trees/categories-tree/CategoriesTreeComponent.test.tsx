/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Children } from "react";
import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import * as treeHeader from "../../../components/tree-header/TreeHeader.js";
import * as categoryTree from "../../../components/trees/categories-tree/CategoriesTree.js";
import { CategoriesTreeComponent } from "../../../components/trees/categories-tree/CategoriesTreeComponent.js";
import * as categoriesVisibilityUtilsModule from "../../../components/trees/common/CategoriesVisibilityUtils.js";
import { TreeWidget } from "../../../TreeWidget.js";
import { mockPresentationManager, render, TestUtils, waitFor } from "../../TestUtils.js";

import type { ComponentPropsWithoutRef } from "react";
import type { CategoryInfo } from "../../../components/trees/common/CategoriesVisibilityUtils.js";
import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";

type TreeHeaderProps = ComponentPropsWithoutRef<typeof treeHeader.TreeHeader>;

describe("<CategoriesTreeComponent />", () => {
  before(async () => {
    await NoRenderApp.startup();
    await TestUtils.initialize();
  });

  after(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

  const defaultCategoriesTreeComponentProps: ComponentPropsWithoutRef<typeof CategoriesTreeComponent> = {
    getSchemaContext: () => ({}) as any,
    selectionStorage: {} as any,
  };

  beforeEach(async () => {
    const { presentationManager } = mockPresentationManager();
    sinon.stub(Presentation, "presentation").get(() => presentationManager.object);
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

  it("returns null if iModel is undefined", () => {
    sinon.stub(IModelApp.viewManager, "selectedView").get(() => ({}) as Viewport);
    const categoriesTreeSpy = sinon.stub(categoryTree, "CategoriesTree");
    const result = render(<CategoriesTreeComponent {...defaultCategoriesTreeComponentProps} />);
    expect(result.container.children).to.be.empty;
    expect(categoriesTreeSpy).to.not.be.called;
  });

  it("returns null if viewport is undefined", () => {
    sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
    const categoriesTreeSpy = sinon.stub(categoryTree, "CategoriesTree");
    const result = render(<CategoriesTreeComponent {...defaultCategoriesTreeComponentProps} />);
    expect(result.container.children).to.be.empty;
    expect(categoriesTreeSpy).to.not.be.called;
  });

  it("renders `CategoryTree` when iModel and viewport are defined", async () => {
    const categoryTreeSpy = sinon.stub(categoryTree, "CategoriesTree").returns(<></>);
    sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
    sinon.stub(UiFramework, "getIModelConnection").returns(iModel);
    const result = render(<CategoriesTreeComponent {...defaultCategoriesTreeComponentProps} density="enlarged" />);
    await waitFor(() => {
      expect(result.container.children).to.not.be.empty;
      expect(categoryTreeSpy).to.be.called;
    });
  });

  it("getLabel returns translated label of the component", () => {
    const translateSpy = sinon.stub(TreeWidget, "translate").returns("test categories label");
    expect(CategoriesTreeComponent.getLabel()).to.be.eq(TreeWidget.translate("test categories label"));
    expect(translateSpy).to.be.calledWith("categoriesTree.label");
  });

  describe("header buttons", () => {
    it("renders default tree header buttons", async () => {
      const treewHeaderSpy = sinon.stub(treeHeader, "TreeHeader").returns(<></>);
      sinon.stub(categoryTree, "CategoriesTree").returns(<></>);
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns(iModel);
      render(<CategoriesTreeComponent {...defaultCategoriesTreeComponentProps} />);
      await waitFor(() => {
        expect(treewHeaderSpy).to.be.calledWith(sinon.match((props: TreeHeaderProps) => Children.count(props.children) === 3));
      });
    });

    it("renders user provided tree header buttons", async () => {
      const treewHeaderSpy = sinon.stub(treeHeader, "TreeHeader").returns(<></>);
      const spy = sinon.stub().returns(<></>);
      sinon.stub(categoryTree, "CategoriesTree").returns(<></>);
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns(iModel);
      render(<CategoriesTreeComponent {...defaultCategoriesTreeComponentProps} headerButtons={[spy]} />);

      await waitFor(() => {
        expect(treewHeaderSpy).to.be.calledWith(sinon.match((props: TreeHeaderProps) => Children.count(props.children) === 1));
        expect(spy).to.be.called;
      });
    });

    describe("<ShowAllButton />", () => {
      it("click on ShowAllButton calls expected function", async () => {
        const showAllSpy = sinon.stub(categoriesVisibilityUtilsModule, "showAllCategories");
        const { user, getByRole } = render(<CategoriesTreeComponent.ShowAllButton categories={categories} viewport={viewport} density="enlarged" />);
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(showAllSpy).to.be.calledWith(["CategoryId"], viewport);
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
        const hideAllSpy = sinon.stub(categoriesVisibilityUtilsModule, "hideAllCategories");
        const { user, getByRole } = render(<CategoriesTreeComponent.HideAllButton categories={categories} viewport={viewport} density="enlarged" />);
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(hideAllSpy).to.be.calledWith(["CategoryId"], viewport);
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
        const invertAllSpy = sinon.stub(categoriesVisibilityUtilsModule, "invertAllCategories");
        const { user, getByRole } = render(<CategoriesTreeComponent.InvertAllButton categories={categories} viewport={viewport} density="enlarged" />);
        const button = await waitFor(() => getByRole("button"));
        await user.click(button);
        expect(invertAllSpy).to.be.calledWith(categories, viewport);
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
