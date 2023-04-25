/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord } from "@itwin/appui-abstract";
import * as UiComponents from "@itwin/components-react";
import { BeEvent, Id64String, using } from "@itwin/core-bentley";
import {
  IModelConnection, PerModelCategoryVisibility, ViewManager, Viewport, ViewState,
} from "@itwin/core-frontend";
import { ECInstancesNodeKey, StandardNodeTypes } from "@itwin/presentation-common";
import { renderHook } from "@testing-library/react-hooks";
import {
  CategoryInfo, CategoryVisibilityHandler, CategoryVisibilityHandlerParams, hideAllCategories, invertAllCategories, showAllCategories, useCategories,
} from "../../../components/trees/category-tree/CategoryVisibilityHandler";
import * as categoriesVisibilityUtils from "../../../components/trees/CategoriesVisibilityUtils";

const createKey = (id: Id64String): ECInstancesNodeKey => {
  return {
    type: StandardNodeTypes.ECInstancesNode,
    version: 0,
    instanceKeys: [{ className: "MyDomain:SpatialCategory", id }],
    pathFromRoot: [],
  };
};

describe("CategoryVisibilityHandler", () => {

  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const viewManagerMock = moq.Mock.ofType<ViewManager>();
  const viewStateMock = moq.Mock.ofType<ViewState>();
  const iModelCategoriesMock = moq.Mock.ofType<IModelConnection.Categories>();

  const categories: CategoryInfo[] = [{
    categoryId: "CategoryId",
    subCategoryIds: ["SubCategoryId1", "SubCategoryId2"],
  }];

  const filteredCategories: CategoryInfo[] = [{
    categoryId: "FilteredCategoryId",
    subCategoryIds: ["FilteredSubCategoryId1", "FilteredSubCategoryId2"],
  }];

  const categoryNode = { id: categories[0].categoryId, label: PropertyRecord.fromString("category-node"), autoExpand: true };
  const subCategoryNodes = [{ id: categories[0].subCategoryIds![0], label: PropertyRecord.fromString("subcategory-node"), parentId: categories[0].categoryId }, { id: categories[0].subCategoryIds![1], label: PropertyRecord.fromString("subcategory-node"), parentId: categories[0].categoryId }];
  let categoryKey: ECInstancesNodeKey;
  const subcategoryKeys: ECInstancesNodeKey[] = new Array(2);
  (categoryNode as any).__key = categoryKey = createKey(categoryNode.id);
  (subCategoryNodes[0] as any).__key = subcategoryKeys[0] = createKey(subCategoryNodes[0].id);
  (subCategoryNodes[1] as any).__key = subcategoryKeys[1] = createKey(subCategoryNodes[1].id);

  beforeEach(() => {
    imodelMock.reset();
    viewStateMock.reset();
  });

  afterEach(() => {
    sinon.restore();
  });

  interface ViewportMockProps {
    viewState?: ViewState;
    perModelCategoryVisibility?: PerModelCategoryVisibility.Overrides;
    onViewedCategoriesChanged?: BeEvent<(vp: Viewport) => void>;
    onDisplayStyleChanged?: BeEvent<(vp: Viewport) => void>;
  }

  const mockViewport = (props?: ViewportMockProps) => {
    if (!props)
      props = {};
    if (!props.viewState)
      props.viewState = moq.Mock.ofType<ViewState>().object;
    if (!props.perModelCategoryVisibility)
      props.perModelCategoryVisibility = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>().object;
    if (!props.onDisplayStyleChanged)
      props.onDisplayStyleChanged = new BeEvent<(vp: Viewport) => void>();
    if (!props.onViewedCategoriesChanged)
      props.onViewedCategoriesChanged = new BeEvent<(vp: Viewport) => void>();
    const vpMock = moq.Mock.ofType<Viewport>();
    vpMock.setup((x) => x.iModel).returns(() => imodelMock.object);
    vpMock.setup((x) => x.view).returns(() => props!.viewState!);
    vpMock.setup((x) => x.perModelCategoryVisibility).returns(() => props!.perModelCategoryVisibility!);
    vpMock.setup((x) => x.onViewedCategoriesChanged).returns(() => props!.onViewedCategoriesChanged!);
    vpMock.setup((x) => x.onDisplayStyleChanged).returns(() => props!.onDisplayStyleChanged!);
    return vpMock;
  };

  const createHandler = (partialProps?: Partial<CategoryVisibilityHandlerParams>): CategoryVisibilityHandler => {
    if (!partialProps)
      partialProps = {};
    const props: CategoryVisibilityHandlerParams = {
      viewManager: partialProps.viewManager || viewManagerMock.object,
      imodel: partialProps.imodel || imodelMock.object,
      activeView: partialProps.activeView ?? mockViewport().object,
      categories: partialProps.categories || [],
      allViewports: partialProps.allViewports,
    };
    return new CategoryVisibilityHandler(props);
  };

  describe("dispose", () => {

    it("removes listeners from viewport events", () => {
      const onDisplayStyleChanged = new BeEvent<(vp: Viewport) => void>();
      const onViewedCategoriesChanged = new BeEvent<(vp: Viewport) => void>();
      const viewport = mockViewport({ onDisplayStyleChanged, onViewedCategoriesChanged });
      using(createHandler({ activeView: viewport.object }), (_) => { });
      expect(onDisplayStyleChanged.numberOfListeners).to.be.eq(0);
      expect(onViewedCategoriesChanged.numberOfListeners).to.be.eq(0);
    });

  });

  describe("changeVisibility", () => {

    it("calls enableCategory", async () => {
      viewManagerMock
        .setup((x) => x[Symbol.iterator]())
        .returns(() => [][Symbol.iterator]());

      await using(createHandler({ activeView: mockViewport().object }), async (handler) => {
        const enableCategorySpy = sinon.stub(handler, "enableCategory");
        await handler.changeVisibility(categoryNode, categoryKey, true);
        expect(enableCategorySpy).to.be.calledWith([categoryNode.id], true, true);
      });
    });

    it("calls enableSubcategoryCategory", async () => {
      await using(createHandler({ activeView: mockViewport().object, categories }), async (handler) => {
        const enableSubCategorySpy = sinon.stub(handler, "enableSubCategory");
        await handler.changeVisibility(subCategoryNodes[0], subcategoryKeys[0], false);
        expect(enableSubCategorySpy).to.be.calledWith(subCategoryNodes[0].id, false);
      });
    });

    it("calls enableSubcategoryCategory and enableCategory to ensure that parent category is enabled", async () => {
      await using(createHandler({ activeView: mockViewport().object, categories }), async (handler) => {
        const enableCategorySpy = sinon.stub(handler, "enableCategory");
        const enableSubCategorySpy = sinon.stub(handler, "enableSubCategory");
        await handler.changeVisibility(subCategoryNodes[0], subcategoryKeys[0], true);
        expect(enableCategorySpy).to.be.calledWith(["CategoryId"], true, false);
        expect(enableSubCategorySpy).to.be.calledWith(subCategoryNodes[0].id, true);
        expect(enableCategorySpy.calledBefore(enableSubCategorySpy)).to.be.true;
      });
    });

  });

  describe("getVisibilityStatus", () => {

    it("calls getCategoryVisibility", () => {
      using(createHandler({}), (handler) => {
        const spy = sinon.stub(handler, "getCategoryVisibility");
        handler.getVisibilityStatus(categoryNode, categoryKey);
        expect(spy).to.be.calledWith(categoryNode.id);
      });
    });

    it("calls getSubCategoryVisibility", () => {
      using(createHandler({ categories }), (handler) => {
        const spy = sinon.stub(handler, "getSubCategoryVisibility");
        handler.getVisibilityStatus(subCategoryNodes[0], subcategoryKeys[0]);
        expect(spy).to.be.calledWith(subCategoryNodes[0].id);
      });
    });

  });

  describe("getCategoryVisibility", () => {

    beforeEach(() => {
      viewStateMock.reset();
    });

    it("returns 'hidden' if active viewport is not supplied", () => {
      using(createHandler({}), (handler) => {
        expect(handler.getCategoryVisibility("CategoryId")).to.be.eq("hidden");
      });
    });

    it("returns 'hidden' if category is not visible", () => {
      viewStateMock.setup((x) => x.viewsCategory("CategoryId")).returns(() => false);
      const viewMock = mockViewport({ viewState: viewStateMock.object });
      using(createHandler({ activeView: viewMock.object }), (handler) => {
        expect(handler.getCategoryVisibility("CategoryId")).to.be.eq("hidden");
      });
    });

    it("returns 'visible' if category is visible", () => {
      viewStateMock.setup((x) => x.viewsCategory("CategoryId")).returns(() => true);
      const viewMock = mockViewport({ viewState: viewStateMock.object });
      using(createHandler({ activeView: viewMock.object }), (handler) => {
        expect(handler.getCategoryVisibility("CategoryId")).to.be.eq("visible");
      });
    });

  });

  describe("getSubCategoryVisibility", () => {

    beforeEach(() => {
      viewStateMock.reset();
    });

    it("returns 'hidden' if active viewport is not supplied", () => {
      using(createHandler({ categories }), (handler) => {
        expect(handler.getSubCategoryVisibility("SubCategoryId1")).to.be.eq("hidden");
      });
    });

    it("returns 'hidden' if parent category is not found", () => {
      using(createHandler({ activeView: mockViewport().object, categories }), (handler) => {
        expect(handler.getSubCategoryVisibility("SubCategoryWithoutParent")).to.be.eq("hidden");
      });
    });

    it("returns 'hidden' if parent category is not visible in view", () => {
      const viewMock = mockViewport({ viewState: viewStateMock.object });
      viewStateMock.setup((x) => x.viewsCategory("CategoryId")).returns(() => false);
      using(createHandler({ activeView: viewMock.object, categories }), (handler) => {
        expect(handler.getSubCategoryVisibility("SubCategoryId1")).to.be.eq("hidden");
      });
    });

    it("returns 'hidden' if subCategory is not visible in view", () => {
      const viewMock = mockViewport({ viewState: viewStateMock.object });
      viewStateMock.setup((x) => x.viewsCategory("CategoryId")).returns(() => true);
      viewMock.setup((x) => x.isSubCategoryVisible("SubCategoryId1")).returns(() => false);
      using(createHandler({ activeView: viewMock.object, categories }), (handler) => {
        expect(handler.getSubCategoryVisibility("SubCategoryId1")).to.be.eq("hidden");
      });
    });

    it("returns 'visible' if subCategory and parent are visible in view", () => {
      const viewMock = mockViewport({ viewState: viewStateMock.object });
      viewStateMock.setup((x) => x.viewsCategory("CategoryId")).returns(() => true);
      viewMock.setup((x) => x.isSubCategoryVisible("SubCategoryId1")).returns(() => true);
      using(createHandler({ activeView: viewMock.object, categories }), (handler) => {
        expect(handler.getSubCategoryVisibility("SubCategoryId1")).to.be.eq("visible");
      });
    });

  });

  describe("visibility change callback", () => {

    it("calls the callback on `onDisplayStyleChanged` event", async () => {
      const vpMock = mockViewport();
      const onDisplayStyleChanged = new BeEvent<(vp: Viewport) => void>();
      await using(createHandler({ activeView: mockViewport({ onDisplayStyleChanged }).object }), async (handler) => {
        const spy = sinon.spy();
        handler.onVisibilityChange.addListener(spy);
        onDisplayStyleChanged.raiseEvent(vpMock.object);
        await new Promise((resolve) => setTimeout(resolve));
        expect(spy).to.be.calledOnce;
      });
    });

    it("calls the callback on `onViewedCategoriesChanged` event", async () => {
      const vpMock = mockViewport();
      const onViewedCategoriesChanged = new BeEvent<(vp: Viewport) => void>();
      await using(createHandler({ activeView: mockViewport({ onViewedCategoriesChanged }).object }), async (handler) => {
        const spy = sinon.spy();
        handler.onVisibilityChange.addListener(spy);
        onViewedCategoriesChanged.raiseEvent(vpMock.object);
        await new Promise((resolve) => setTimeout(resolve));
        expect(spy).to.be.calledOnce;
      });
    });

    it("calls the callback only once when multiple events are raised", async () => {
      const vpMock = mockViewport();
      const onDisplayStyleChanged = new BeEvent<(vp: Viewport) => void>();
      const onViewedCategoriesChanged = new BeEvent<(vp: Viewport) => void>();
      await using(createHandler({ activeView: mockViewport({ onDisplayStyleChanged, onViewedCategoriesChanged }).object }), async (handler) => {
        const spy = sinon.spy();
        handler.onVisibilityChange.addListener(spy);
        onViewedCategoriesChanged.raiseEvent(vpMock.object);
        onDisplayStyleChanged.raiseEvent(vpMock.object);
        await new Promise((resolve) => setTimeout(resolve));
        expect(spy).to.be.calledOnce;
      });
    });
  });

  describe("showAllCategories", () => {

    it("Calls enableCategory", async () => {
      const enableCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableCategory");
      await showAllCategories({ categories, viewport: mockViewport().object });
      expect(enableCategorySpy.args[0][2][0]).to.be.eq("CategoryId");
      expect(enableCategorySpy.args[0][3]).to.be.eq(true);
    });

    it("Calls enableCategory with filtered categories when filtered categories are provided", async () => {
      const enableCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableCategory");
      await showAllCategories({ categories, filteredCategories, viewport: mockViewport().object });
      expect(enableCategorySpy.args[0][2][0]).to.be.eq("FilteredCategoryId");
      expect(enableCategorySpy.args[0][3]).to.be.eq(true);
    });
  });

  describe("hideAllCategories", () => {

    it("Calls enableCateogry", async () => {
      const enableCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableCategory");
      await hideAllCategories({ categories, viewport: mockViewport().object });
      expect(enableCategorySpy.args[0][2][0]).to.be.eq("CategoryId");
      expect(enableCategorySpy.args[0][3]).to.be.eq(false);
    });

    it("Calls enableCategory with filtered categories when filtered categories are provided", async () => {
      const enableCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableCategory");
      await hideAllCategories({ categories, filteredCategories, viewport: mockViewport().object });
      expect(enableCategorySpy.args[0][2][0]).to.be.eq("FilteredCategoryId");
      expect(enableCategorySpy.args[0][3]).to.be.eq(false);
    });
  });

  describe("invertAllCategories", () => {
    beforeEach(() => {
      iModelCategoriesMock.reset();
      imodelMock.setup((x) => x.categories).returns(() => iModelCategoriesMock.object);
    });

    it("Enables disabled category", async () => {
      viewStateMock.setup((x) => x.viewsCategory("CategoryId")).returns(() => false);
      const enableCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableCategory");
      const enableSubCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableSubCategory");
      await invertAllCategories({ categories, viewport: mockViewport({ viewState: viewStateMock.object }).object });
      expect(enableCategorySpy.args[0][2].length).to.be.eq(0);
      expect(enableCategorySpy.args[0][3]).to.be.eq(false);
      expect(enableCategorySpy.args[1][2][0]).to.be.eq("CategoryId");
      expect(enableCategorySpy.args[1][3]).to.be.eq(true);
      expect(enableSubCategorySpy).to.be.not.called;
    });

    it("Disables enabled category when all subCategories are enabled", async () => {
      viewStateMock.setup((x) => x.viewsCategory("CategoryId")).returns(() => true);
      const viewportMock = mockViewport({ viewState: viewStateMock.object });
      viewportMock.setup((x) => x.isSubCategoryVisible("SubCategoryId1")).returns(() => true);
      viewportMock.setup((x) => x.isSubCategoryVisible("SubCategoryId2")).returns(() => true);
      const enableCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableCategory");
      const enableSubCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableSubCategory");
      await invertAllCategories({ categories, viewport: viewportMock.object });
      expect(enableCategorySpy.args[0][2][0]).to.be.eq("CategoryId");
      expect(enableCategorySpy.args[0][3]).to.be.eq(false);
      expect(enableCategorySpy.args[1][2].length).to.be.eq(0);
      expect(enableCategorySpy.args[1][3]).to.be.eq(true);
      expect(enableSubCategorySpy).to.be.not.called;
    });

    it("Inverts subcategories when category has at least one disabled subcategory", async () => {
      viewStateMock.setup((x) => x.viewsCategory("CategoryId")).returns(() => true);
      const viewportMock = mockViewport({ viewState: viewStateMock.object });
      viewportMock.setup((x) => x.isSubCategoryVisible("SubCategoryId1")).returns(() => true);
      viewportMock.setup((x) => x.isSubCategoryVisible("SubCategoryId2")).returns(() => false);
      const enableCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableCategory");
      const enableSubCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableSubCategory");
      await invertAllCategories({ categories, viewport: viewportMock.object });
      expect(enableCategorySpy.args[0][2].length).to.be.eq(0);
      expect(enableCategorySpy.args[0][3]).to.be.eq(false);
      expect(enableCategorySpy.args[1][2].length).to.be.eq(0);
      expect(enableCategorySpy.args[1][3]).to.be.eq(true);
      expect(enableSubCategorySpy.args[0][1]).to.be.eq("SubCategoryId1");
      expect(enableSubCategorySpy.args[0][2]).to.be.eq(false);
      expect(enableSubCategorySpy.args[1][1]).to.be.eq("SubCategoryId2");
      expect(enableSubCategorySpy.args[1][2]).to.be.eq(true);
    });

    it("Disables category when category doesn't have any subCategories", async () => {
      viewStateMock.setup((x) => x.viewsCategory("CategoryWithoutSubCategoriesId")).returns(() => true);
      const categoryWithoutSubCategories: CategoryInfo[] = [{ categoryId: "CategoryWithoutSubCategoriesId" }];
      const enableCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableCategory");
      const enableSubCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableSubCategory");
      await invertAllCategories({ categories: categoryWithoutSubCategories, viewport: mockViewport({ viewState: viewStateMock.object }).object });
      expect(enableCategorySpy.args[0][2][0]).to.be.eq("CategoryWithoutSubCategoriesId");
      expect(enableCategorySpy.args[0][3]).to.be.eq(false);
      expect(enableCategorySpy.args[1][2].length).to.be.eq(0);
      expect(enableCategorySpy.args[1][3]).to.be.eq(true);
      expect(enableSubCategorySpy).to.not.be.called;
    });

    it("Enables disabled filtered category", async () => {
      viewStateMock.setup((x) => x.viewsCategory("FilteredCategoryId")).returns(() => false);
      const enableCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableCategory");
      const enableSubCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableSubCategory");
      await invertAllCategories({ categories, filteredCategories, viewport: mockViewport({ viewState: viewStateMock.object }).object });
      expect(enableCategorySpy.args[0][2].length).to.be.eq(0);
      expect(enableCategorySpy.args[0][3]).to.be.eq(false);
      expect(enableCategorySpy.args[1][2][0]).to.be.eq("FilteredCategoryId");
      expect(enableCategorySpy.args[1][3]).to.be.eq(true);
      expect(enableSubCategorySpy).to.be.not.called;
    });

    it("Disables enabled filtered category when all subCategories are enabled", async () => {
      viewStateMock.setup((x) => x.viewsCategory("FilteredCategoryId")).returns(() => true);
      const viewportMock = mockViewport({ viewState: viewStateMock.object });
      viewportMock.setup((x) => x.isSubCategoryVisible("FilteredSubCategoryId1")).returns(() => true);
      viewportMock.setup((x) => x.isSubCategoryVisible("FilteredSubCategoryId2")).returns(() => true);
      const enableCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableCategory");
      const enableSubCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableSubCategory");
      await invertAllCategories({ categories, filteredCategories, viewport: viewportMock.object });
      expect(enableCategorySpy.args[0][2][0]).to.be.eq("FilteredCategoryId");
      expect(enableCategorySpy.args[0][3]).to.be.eq(false);
      expect(enableCategorySpy.args[1][2].length).to.be.eq(0);
      expect(enableCategorySpy.args[1][3]).to.be.eq(true);
      expect(enableSubCategorySpy).to.be.not.called;
    });

    it("Inverts filtered subcategories when filteredcategory has at least one disabled subcategory", async () => {
      viewStateMock.setup((x) => x.viewsCategory("FilteredCategoryId")).returns(() => true);
      const viewportMock = mockViewport({ viewState: viewStateMock.object });
      viewportMock.setup((x) => x.isSubCategoryVisible("FilteredSubCategoryId1")).returns(() => true);
      viewportMock.setup((x) => x.isSubCategoryVisible("FilteredSubCategoryId2")).returns(() => false);
      const enableCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableCategory");
      const enableSubCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableSubCategory");
      await invertAllCategories({ categories, filteredCategories, viewport: viewportMock.object });
      expect(enableCategorySpy.args[0][2].length).to.be.eq(0);
      expect(enableCategorySpy.args[0][3]).to.be.eq(false);
      expect(enableCategorySpy.args[1][2].length).to.be.eq(0);
      expect(enableCategorySpy.args[1][3]).to.be.eq(true);
      expect(enableSubCategorySpy.args[0][1]).to.be.eq("FilteredSubCategoryId1");
      expect(enableSubCategorySpy.args[0][2]).to.be.eq(false);
      expect(enableSubCategorySpy.args[1][1]).to.be.eq("FilteredSubCategoryId2");
      expect(enableSubCategorySpy.args[1][2]).to.be.eq(true);
    });

    it("Disables filtered category when category doesn't have any subCategories", async () => {
      viewStateMock.setup((x) => x.viewsCategory("FilteredCategoryWithoutSubCategoriesId")).returns(() => true);
      const viewportMock = mockViewport({ viewState: viewStateMock.object });
      const categoryWithoutSubCategories: CategoryInfo[] = [{ categoryId: "FilteredCategoryWithoutSubCategoriesId" }];
      const enableCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableCategory");
      const enableSubCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableSubCategory");
      await invertAllCategories({ categories, filteredCategories: categoryWithoutSubCategories, viewport: viewportMock.object });
      expect(enableCategorySpy.args[0][2][0]).to.be.eq("FilteredCategoryWithoutSubCategoriesId");
      expect(enableCategorySpy.args[0][3]).to.be.eq(false);
      expect(enableCategorySpy.args[1][2].length).to.be.eq(0);
      expect(enableCategorySpy.args[1][3]).to.be.eq(true);
      expect(enableSubCategorySpy).to.not.be.called;
    });
  });
});

describe("useCategories", () => {

  afterEach(() => {
    sinon.restore();
  });

  it("returns empty array while categories load", async () => {
    sinon.stub(UiComponents, "useAsyncValue").returns(undefined);

    const imodelMock = moq.Mock.ofType<IModelConnection>();
    const viewManagerMock = moq.Mock.ofType<ViewManager>();
    const { result, rerender } = renderHook(() => useCategories(viewManagerMock.object, imodelMock.object));

    const initialResult = result.current;
    expect(initialResult).to.deep.eq([]);

    rerender();
    const resultAfterRerender = result.current;
    expect(resultAfterRerender).to.eq(initialResult);
  });

});
