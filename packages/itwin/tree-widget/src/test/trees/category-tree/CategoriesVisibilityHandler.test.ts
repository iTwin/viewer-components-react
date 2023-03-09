/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord } from "@itwin/appui-abstract";
import * as UiComponents from "@itwin/components-react";
import { BeEvent, using } from "@itwin/core-bentley";
import type { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { StandardNodeTypes } from "@itwin/presentation-common";
import { renderHook } from "@testing-library/react-hooks";
import { CategoryVisibilityHandler, useCategories } from "../../../components/trees/category-tree/CategoryVisibilityHandler";
import type { Id64String } from "@itwin/core-bentley";
import type {
  IModelConnection, ScreenViewport, SubCategoriesCache, ViewManager, Viewport, ViewState,
} from "@itwin/core-frontend";
import type { ECInstancesNodeKey } from "@itwin/presentation-common";
import type { Category, CategoryVisibilityHandlerParams } from "../../../components/trees/category-tree/CategoryVisibilityHandler";

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
  const selectedViewStateMock = moq.Mock.ofType<ViewState>();
  const selectedViewMock = moq.Mock.ofType<ScreenViewport>();
  const subCategoriesCacheMock = moq.Mock.ofType<SubCategoriesCache>();
  const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();

  const categoryNode = { id: "CategoryId", label: PropertyRecord.fromString("category-node"), autoExpand: true };
  const subcategoryNode = { id: "SubCategoryId", label: PropertyRecord.fromString("subcategory-node"), parentId: "CategoryId" };
  let categoryKey: ECInstancesNodeKey;
  let subcategoryKey: ECInstancesNodeKey;
  (categoryNode as any).__key = categoryKey = createKey(categoryNode.id);
  (subcategoryNode as any).__key = subcategoryKey = createKey(subcategoryNode.id);

  const categories: Category[] = [
    {
      key: "CategoryId",
      children: ["SubCategoryId"],
    },
  ];

  beforeEach(() => {
    imodelMock.reset();
    viewStateMock.reset();
    viewManagerMock.reset();
    selectedViewMock.reset();
    subCategoriesCacheMock.reset();
    perModelCategoryVisibilityMock.reset();

    imodelMock.setup((x) => x.subcategories).returns(() => subCategoriesCacheMock.object);
    subCategoriesCacheMock.setup((x) => x.getSubCategories("CategoryId")).returns(() => new Set(categories[0].children));
    viewManagerMock.setup((x) => x.selectedView).returns(() => selectedViewMock.object);
    selectedViewMock.setup((x) => x.view).returns(() => selectedViewStateMock.object);
    selectedViewMock.setup((x) => x.perModelCategoryVisibility).returns(() => perModelCategoryVisibilityMock.object);
    perModelCategoryVisibilityMock.setup((x) => x[Symbol.iterator]()).returns(() => [][Symbol.iterator]());
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
      activeView: partialProps.activeView,
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
        const enableCategorySpy = sinon.spy(handler, "enableCategory");
        await handler.changeVisibility(categoryNode, categoryKey, true);
        expect(enableCategorySpy).to.be.calledWith([categoryNode.id], true, true);
      });
    });

    it("calls enableSubcategoryCategory", async () => {
      await using(createHandler({ activeView: mockViewport().object, categories }), async (handler) => {
        const enableSubCategorySpy = sinon.spy(handler, "enableSubCategory");
        await handler.changeVisibility(subcategoryNode, subcategoryKey, false);
        expect(enableSubCategorySpy).to.be.calledWith(subcategoryNode.id, false);
      });
    });

    it("calls enableSubcategoryCategory and enableCategory to ensure that parent category is enabled", async () => {
      await using(createHandler({ activeView: mockViewport().object, categories }), async (handler) => {
        const enableCategorySpy = sinon.spy(handler, "enableCategory");
        const enableSubCategorySpy = sinon.spy(handler, "enableSubCategory");
        await handler.changeVisibility(subcategoryNode, subcategoryKey, true);
        expect(enableCategorySpy).to.be.calledWith(["CategoryId"], true, false);
        expect(enableSubCategorySpy).to.be.calledWith(subcategoryNode.id, true);
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
        handler.getVisibilityStatus(subcategoryNode, subcategoryKey);
        expect(spy).to.be.calledWith(subcategoryNode.id);
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
        expect(handler.getSubCategoryVisibility("SubCategoryId")).to.be.eq("hidden");
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
        expect(handler.getSubCategoryVisibility("SubCategoryId")).to.be.eq("hidden");
      });
    });

    it("returns 'hidden' if subCategory is not visible in view", () => {
      const viewMock = mockViewport({ viewState: viewStateMock.object });
      viewStateMock.setup((x) => x.viewsCategory("CategoryId")).returns(() => true);
      viewMock.setup((x) => x.isSubCategoryVisible("SubCategoryId")).returns(() => false);
      using(createHandler({ activeView: viewMock.object, categories }), (handler) => {
        expect(handler.getSubCategoryVisibility("SubCategoryId")).to.be.eq("hidden");
      });
    });

    it("returns 'visible' if subCategory and parent are visible in view", () => {
      const viewMock = mockViewport({ viewState: viewStateMock.object });
      viewStateMock.setup((x) => x.viewsCategory("CategoryId")).returns(() => true);
      viewMock.setup((x) => x.isSubCategoryVisible("SubCategoryId")).returns(() => true);
      using(createHandler({ activeView: viewMock.object, categories }), (handler) => {
        expect(handler.getSubCategoryVisibility("SubCategoryId")).to.be.eq("visible");
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
