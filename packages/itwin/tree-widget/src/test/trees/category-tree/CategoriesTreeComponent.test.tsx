/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as moq from "typemoq";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { CategoriesTreeComponent, TreeWidget } from "../../../tree-widget-react";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { mockPresentationManager, mockViewport, TestUtils } from "../../TestUtils";
import sinon from "sinon";
import { expect } from "chai";
import * as treeHeader from "../../../components/tree-header/TreeHeader";
import * as categoryVisibilityHandler from "../../../components/trees/category-tree/CategoryVisibilityHandler";
import * as categoryTree from "../../../components/trees/category-tree/CategoriesTree";
import { UiFramework } from "@itwin/appui-react";
import { Presentation } from "@itwin/presentation-frontend";
import { BeEvent } from "@itwin/core-bentley";
import { PropertyRecord } from "@itwin/appui-abstract";
import { StandardNodeTypes } from "@itwin/presentation-common";
import { Children } from "react";

import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { CategoriesTreeHeaderButtonProps, CategoryInfo } from "../../../tree-widget-react";
import type { TreeHeaderProps } from "../../../components/tree-header/TreeHeader";
import type { IFilteredPresentationTreeDataProvider, PresentationTreeNodeItem } from "@itwin/presentation-components";
import type { ECInstancesNodeKey } from "@itwin/presentation-common";
import type { TreeNodeItem } from "@itwin/components-react";

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
  const viewsMock = moq.Mock.ofType<IModelConnection.Views>();
  let vpMock = moq.Mock.ofType<Viewport>();

  beforeEach(async () => {
    vpMock = mockViewport();
    const { presentationManager } = mockPresentationManager();
    sinon.stub(Presentation, "presentation").get(() => presentationManager.object);
    imodelMock.setup((x) => x.views).returns(() => viewsMock.object);
  });

  afterEach(() => {
    imodelMock.reset();
    sinon.restore();
  });

  const createKey = (id: Id64String): ECInstancesNodeKey => {
    return {
      type: StandardNodeTypes.ECInstancesNode,
      version: 0,
      instanceKeys: [{ className: "MyDomain:SpatialCategory", id }],
      pathFromRoot: [],
    };
  };

  const categories: CategoryInfo[] = [{
    categoryId: "CategoryId",
    subCategoryIds: ["SubCategoryId1", "SubCategoryId2"],
  }];

  const filteredCategories: CategoryInfo[] = [{
    categoryId: "FilteredCategoryId",
    subCategoryIds: ["FilteredSubCategoryId1", "FilteredSubCategoryId2"],
  }];

  const viewport =  {
    onDisplayStyleChanged: new BeEvent<(vp: Viewport) => void>(),
    onViewedCategoriesChanged: new BeEvent<(vp: Viewport) => void>(),
    view: {
      is3d: () => false,
    },
  } as unknown as Viewport;

  const iModel = {
    createQueryReader: () => ({
      toArray: async () => [],
    }),
    categories: {
      getCategoryInfo: async () => new Map<Id64String, IModelConnection.Categories.CategoryInfo>(),
    },
  } as unknown as IModelConnection;

  describe("<CategoriesTreeComponent />", () => {

    it("returns null if iModel is undefined", () => {
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => ({} as Viewport));
      const categoriesTreeSpy = sinon.stub(categoryTree, "CategoryTree");
      const result = render(
        <CategoriesTreeComponent />
      );
      expect(result.container.children).to.be.empty;
      expect(categoriesTreeSpy).to.not.be.called;
    });

    it("returns null if viewport is undefined", () => {
      sinon.stub(UiFramework, "getIModelConnection").returns({} as IModelConnection);
      const categoriesTreeSpy = sinon.stub(categoryTree, "CategoryTree");
      const result = render(
        <CategoriesTreeComponent />
      );
      expect(result.container.children).to.be.empty;
      expect(categoriesTreeSpy).to.not.be.called;
    });

    it("renders `CategoryTree` when iModel and viewport are defined", async () => {
      const categoryTreeSpy = sinon.stub(categoryTree, "CategoryTree").returns(<></>);
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns(iModel);
      const result = render(
        <CategoriesTreeComponent />
      );
      expect(result.container.children).to.not.be.empty;
      expect(categoryTreeSpy).to.be.called;
    });

    it("getLabel returns translated label of the component", () => {
      const translateSpy = sinon.stub(TreeWidget, "translate").returns("test categories label");
      expect(CategoriesTreeComponent.getLabel()).to.be.eq(TreeWidget.translate("test categories label"));
      expect(translateSpy).to.be.calledWith("categories");
    });

    describe("filtered tree", () => {

      beforeEach(() => {
        sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
        sinon.stub(UiFramework, "getIModelConnection").returns(iModel);
        sinon.stub(categoryVisibilityHandler, "useCategories").returns([]);
      });

      it("renders buttons with empty `filteredCategories` list if filtered data provider does not have nodes", async () => {
        const categoryTreeSpy = sinon.stub(categoryTree, "CategoryTree").returns(<></>);
        const spy = sinon.stub().returns(<></>);
        render(
          <CategoriesTreeComponent
            headerButtons={[spy]}
          />
        );
        await waitFor(() => expect(categoryTreeSpy).to.be.called);
        categoryTreeSpy.args[0][0].onFilterApplied!({ getNodes: async () => [] } as unknown as IFilteredPresentationTreeDataProvider, 0);
        await waitFor(() => expect(spy).to.be.calledWith(sinon.match((props: CategoriesTreeHeaderButtonProps) => props.filteredCategories !== undefined)));
      });

      it("renders buttons with `filteredCategories` list containing categories from filtered data provider", async () => {
        const categoryTreeSpy = sinon.stub(categoryTree, "CategoryTree").returns(<></>);
        const spy = sinon.stub().returns(<></>);
        render(
          <CategoriesTreeComponent
            headerButtons={[spy]}
          />
        );
        await waitFor(() => expect(categoryTreeSpy).to.be.called);
        categoryTreeSpy.args[0][0].onFilterApplied!({ getNodes: async (parent?: TreeNodeItem) =>{
          if (parent?.id === "category-with-children") {
            return [{
              key: createKey("subcategory"),
              id: "subcategory",
              label: PropertyRecord.fromString("subcategory-node"),
              hasChildren: false,
            } as PresentationTreeNodeItem];
          }

          return [{
            id:"non-presentation-node",
          },
          {
            key: createKey("category-with-children"),
            id: "category-with-children",
            label: PropertyRecord.fromString("CategoryWithChildren"),
            hasChildren: true,
          },
          {
            key: createKey("category-without-children"),
            id: "category-without-children",
            label: PropertyRecord.fromString("CategoryWithoutChildren"),
            hasChildren: false,
          }];
        } } as unknown as IFilteredPresentationTreeDataProvider, 0);
        await waitFor(() => expect(spy).to.be.calledWith(sinon.match((props: CategoriesTreeHeaderButtonProps) => (
          props.filteredCategories !== undefined
          && props.filteredCategories.length === 2
          && props.filteredCategories[0].categoryId === "category-with-children"
          && props.filteredCategories[0].subCategoryIds?.length === 1
          && props.filteredCategories[0].subCategoryIds[0] === "subcategory"
          && props.filteredCategories[1].categoryId === "category-without-children"
          && props.filteredCategories[1].subCategoryIds?.length === 0))
        ));
      });
    });
  });

  describe("header buttons", () => {

    it("renders default tree header buttons", () => {
      const treewHeaderSpy = sinon.stub(treeHeader, "TreeHeader").returns(<></>);
      sinon.stub(categoryTree, "CategoryTree").returns(<></>);
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns(iModel);
      render(<CategoriesTreeComponent />);
      expect(treewHeaderSpy).to.be.calledWith(sinon.match((props: TreeHeaderProps) => Children.count(props.children) === 3));
    });

    it("renders user provided tree header buttons", () => {
      const treewHeaderSpy = sinon.stub(treeHeader, "TreeHeader").returns(<></>);
      const spy = sinon.stub().returns(<></>);
      sinon.stub(categoryTree, "CategoryTree").returns(<></>);
      sinon.stub(IModelApp.viewManager, "selectedView").get(() => viewport);
      sinon.stub(UiFramework, "getIModelConnection").returns(iModel);
      render(
        <CategoriesTreeComponent
          headerButtons={[spy]}
        />
      );
      expect(treewHeaderSpy).to.be.calledWith(sinon.match((props: TreeHeaderProps) => Children.count(props.children) === 1));
      expect(spy).to.be.called;
    });

    describe("<ShowAllButton />", () => {

      it("click on ShowAllButton calls expected function", async () => {
        const showAllSpy = sinon.stub(categoryVisibilityHandler, "showAllCategories");
        const result = render(
          <CategoriesTreeComponent.ShowAllButton
            categories={categories}
            viewport={vpMock.object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(showAllSpy).to.be.calledWith(["CategoryId"], vpMock.object);
      });

      it("calls expected function with filteredCategories when filteredCategories are not undefined", async () => {
        const showAllSpy = sinon.stub(categoryVisibilityHandler, "showAllCategories");
        const result = render(
          <CategoriesTreeComponent.ShowAllButton
            categories={categories}
            filteredCategories={filteredCategories}
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
        const hideAllSpy = sinon.stub(categoryVisibilityHandler, "hideAllCategories");
        const result = render(
          <CategoriesTreeComponent.HideAllButton
            categories={categories}
            viewport={vpMock.object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(hideAllSpy).to.be.calledWith(["CategoryId"], vpMock.object);
      });

      it("calls expected function with filteredCategories when filteredCategories are not undefined", async () => {
        const hideAllSpy = sinon.stub(categoryVisibilityHandler, "hideAllCategories");
        const result = render(
          <CategoriesTreeComponent.HideAllButton
            categories={categories}
            filteredCategories={filteredCategories}
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
        const invertAllSpy = sinon.stub(categoryVisibilityHandler, "invertAllCategories");
        const result = render(
          <CategoriesTreeComponent.InvertAllButton
            categories={categories}
            viewport={vpMock.object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(invertAllSpy).to.be.calledWith(categories, vpMock.object);
      });

      it("calls expected function with filteredCategories when filteredCategories are not undefined", async () => {
        const invertAllSpy = sinon.stub(categoryVisibilityHandler, "invertAllCategories");
        const result = render(
          <CategoriesTreeComponent.InvertAllButton
            categories={categories}
            filteredCategories={filteredCategories}
            viewport={vpMock.object}
          />
        );
        const button = await waitFor(() => result.getByRole("button"));
        fireEvent.click(button);
        expect(invertAllSpy).to.be.calledWith(filteredCategories, vpMock.object);
      });
    });
  });
});
