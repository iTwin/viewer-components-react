/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord } from "@itwin/appui-abstract";
import { BeEvent, using } from "@itwin/core-bentley";
import { StandardNodeTypes } from "@itwin/presentation-common";
import * as categoriesVisibilityUtils from "../../../components/trees/CategoriesVisibilityUtils";
import {
  CategoryVisibilityHandler,
  hideAllCategories,
  invertAllCategories,
  showAllCategories,
  useCategories,
} from "../../../components/trees/category-tree/CategoryVisibilityHandler";
import { act, createResolvablePromise, mockViewport, renderHook, waitFor } from "../../TestUtils";

import type { CategoryInfo } from "../../../components/trees/category-tree/CategoriesTreeButtons";
import type { Id64String } from "@itwin/core-bentley";
import type { ECSqlReader } from "@itwin/core-common";
import type { TreeNodeItem } from "@itwin/components-react";
import type { IModelConnection, ViewManager, Viewport, ViewState } from "@itwin/core-frontend";
import type { ECInstancesNodeKey } from "@itwin/presentation-common";
import type { PresentationTreeNodeItem } from "@itwin/presentation-components";
import type { CategoryVisibilityHandlerParams } from "../../../components/trees/category-tree/CategoryVisibilityHandler";
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

  const categories: CategoryInfo[] = [
    {
      categoryId: "CategoryId",
      subCategoryIds: ["SubCategoryId1", "SubCategoryId2"],
    },
  ];

  const categoryNode: PresentationTreeNodeItem = {
    key: createKey(categories[0].categoryId),
    id: categories[0].categoryId,
    label: PropertyRecord.fromString("category-node"),
    autoExpand: true,
  };
  const subCategoryNodes = [
    {
      key: createKey(categories[0].subCategoryIds![0]),
      id: categories[0].subCategoryIds![0],
      label: PropertyRecord.fromString("subcategory-node-1"),
      parentId: categories[0].categoryId,
    },
    {
      key: createKey(categories[0].subCategoryIds![1]),
      id: categories[0].subCategoryIds![1],
      label: PropertyRecord.fromString("subcategory-node-2"),
      parentId: categories[0].categoryId,
    },
  ];

  beforeEach(() => {
    imodelMock.reset();
    viewStateMock.reset();
  });

  afterEach(() => {
    sinon.restore();
  });

  const createHandler = (partialProps?: Partial<CategoryVisibilityHandlerParams>): CategoryVisibilityHandler => {
    if (!partialProps) {
      partialProps = {};
    }
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
      using(createHandler({ activeView: viewport.object }), (_) => {});
      expect(onDisplayStyleChanged.numberOfListeners).to.be.eq(0);
      expect(onViewedCategoriesChanged.numberOfListeners).to.be.eq(0);
    });
  });

  describe("changeVisibility", () => {
    it("calls enableCategory", async () => {
      viewManagerMock.setup((x) => x[Symbol.iterator]()).returns(() => [][Symbol.iterator]());

      await using(createHandler({ activeView: mockViewport().object }), async (handler) => {
        const enableCategorySpy = sinon.stub(handler, "enableCategory");
        await handler.changeVisibility(categoryNode, true);
        expect(enableCategorySpy).to.be.calledWith([categoryNode.id], true, true);
      });
    });

    it("calls enableSubcategory", async () => {
      await using(createHandler({ activeView: mockViewport().object, categories }), async (handler) => {
        const enableSubCategorySpy = sinon.stub(handler, "enableSubCategory");
        await handler.changeVisibility(subCategoryNodes[0], false);
        expect(enableSubCategorySpy).to.be.calledWith(subCategoryNodes[0].id, false);
      });
    });

    it("calls enableSubcategory and enableCategory to ensure that parent category is enabled", async () => {
      await using(createHandler({ activeView: mockViewport().object, categories }), async (handler) => {
        const enableCategorySpy = sinon.stub(handler, "enableCategory");
        const enableSubCategorySpy = sinon.stub(handler, "enableSubCategory");
        await handler.changeVisibility(subCategoryNodes[0], true);
        expect(enableCategorySpy).to.be.calledWith(["CategoryId"], true, false);
        expect(enableSubCategorySpy).to.be.calledWith(subCategoryNodes[0].id, true);
        expect(enableCategorySpy.calledBefore(enableSubCategorySpy)).to.be.true;
      });
    });

    it("does nothing if node is not PresentationTreeNodeItem", async () => {
      await using(createHandler(), async (handler) => {
        const enableCategorySpy = sinon.stub(handler, "enableCategory");
        await handler.changeVisibility({} as TreeNodeItem, false);
        expect(enableCategorySpy).to.not.be.called;
      });
    });
  });

  describe("getVisibilityStatus", () => {
    it("calls getCategoryVisibility", () => {
      using(createHandler({}), (handler) => {
        const spy = sinon.stub(handler, "getCategoryVisibility");
        handler.getVisibilityStatus(categoryNode);
        expect(spy).to.be.calledWith(categoryNode.id);
      });
    });

    it("calls getSubCategoryVisibility", () => {
      using(createHandler({ categories }), (handler) => {
        const spy = sinon.stub(handler, "getSubCategoryVisibility");
        handler.getVisibilityStatus(subCategoryNodes[0]);
        expect(spy).to.be.calledWith(subCategoryNodes[0].id);
      });
    });

    it("returns disabled if node is not PresentationTreeNodeItem", () => {
      using(createHandler({}), (handler) => {
        const result = handler.getVisibilityStatus({} as TreeNodeItem);
        expect(result.state).to.be.eq("hidden");
        expect(result.isDisabled).to.be.true;
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
    it("calls enableCategory", async () => {
      const enableCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableCategory");
      await showAllCategories(
        categories.map((category) => category.categoryId),
        mockViewport().object,
      );
      expect(enableCategorySpy.args[0][2][0]).to.be.eq("CategoryId");
      expect(enableCategorySpy.args[0][3]).to.be.eq(true);
    });
  });

  describe("hideAllCategories", () => {
    it("calls enableCateogry", async () => {
      const enableCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableCategory");
      await hideAllCategories(
        categories.map((category) => category.categoryId),
        mockViewport().object,
      );
      expect(enableCategorySpy.args[0][2][0]).to.be.eq("CategoryId");
      expect(enableCategorySpy.args[0][3]).to.be.eq(false);
    });
  });

  describe("invertAllCategories", () => {
    it("enables disabled category", async () => {
      viewStateMock.setup((x) => x.viewsCategory("CategoryId")).returns(() => false);
      const enableCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableCategory");
      const enableSubCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableSubCategory");
      await invertAllCategories(categories, mockViewport({ viewState: viewStateMock.object }).object);
      expect(enableCategorySpy.args[0][2].length).to.be.eq(0);
      expect(enableCategorySpy.args[0][3]).to.be.eq(false);
      expect(enableCategorySpy.args[1][2][0]).to.be.eq("CategoryId");
      expect(enableCategorySpy.args[1][3]).to.be.eq(true);
      expect(enableSubCategorySpy).to.be.not.called;
    });

    it("disables enabled category when all subCategories are enabled", async () => {
      viewStateMock.setup((x) => x.viewsCategory("CategoryId")).returns(() => true);
      const viewportMock = mockViewport({ viewState: viewStateMock.object });
      viewportMock.setup((x) => x.isSubCategoryVisible("SubCategoryId1")).returns(() => true);
      viewportMock.setup((x) => x.isSubCategoryVisible("SubCategoryId2")).returns(() => true);
      const enableCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableCategory");
      const enableSubCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableSubCategory");
      await invertAllCategories(categories, viewportMock.object);
      expect(enableCategorySpy.args[0][2][0]).to.be.eq("CategoryId");
      expect(enableCategorySpy.args[0][3]).to.be.eq(false);
      expect(enableCategorySpy.args[1][2].length).to.be.eq(0);
      expect(enableCategorySpy.args[1][3]).to.be.eq(true);
      expect(enableSubCategorySpy).to.be.not.called;
    });

    it("inverts subcategories when category has at least one disabled subcategory", async () => {
      viewStateMock.setup((x) => x.viewsCategory("CategoryId")).returns(() => true);
      const viewportMock = mockViewport({ viewState: viewStateMock.object });
      viewportMock.setup((x) => x.isSubCategoryVisible("SubCategoryId1")).returns(() => true);
      viewportMock.setup((x) => x.isSubCategoryVisible("SubCategoryId2")).returns(() => false);
      const enableCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableCategory");
      const enableSubCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableSubCategory");
      await invertAllCategories(categories, viewportMock.object);
      expect(enableCategorySpy.args[0][2].length).to.be.eq(0);
      expect(enableCategorySpy.args[0][3]).to.be.eq(false);
      expect(enableCategorySpy.args[1][2].length).to.be.eq(0);
      expect(enableCategorySpy.args[1][3]).to.be.eq(true);
      expect(enableSubCategorySpy.args[0][1]).to.be.eq("SubCategoryId1");
      expect(enableSubCategorySpy.args[0][2]).to.be.eq(false);
      expect(enableSubCategorySpy.args[1][1]).to.be.eq("SubCategoryId2");
      expect(enableSubCategorySpy.args[1][2]).to.be.eq(true);
    });

    it("disables category when category doesn't have any subCategories", async () => {
      viewStateMock.setup((x) => x.viewsCategory("CategoryWithoutSubCategoriesId")).returns(() => true);
      const categoryWithoutSubCategories: CategoryInfo[] = [{ categoryId: "CategoryWithoutSubCategoriesId" }];
      const enableCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableCategory");
      const enableSubCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableSubCategory");
      await invertAllCategories(categoryWithoutSubCategories, mockViewport({ viewState: viewStateMock.object }).object);
      expect(enableCategorySpy.args[0][2][0]).to.be.eq("CategoryWithoutSubCategoriesId");
      expect(enableCategorySpy.args[0][3]).to.be.eq(false);
      expect(enableCategorySpy.args[1][2].length).to.be.eq(0);
      expect(enableCategorySpy.args[1][3]).to.be.eq(true);
      expect(enableSubCategorySpy).to.not.be.called;
    });
  });

  describe("enableCategory", () => {
    it("calls expected function", async () => {
      await using(createHandler(), async (handler) => {
        const enableCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableCategory");
        await handler.enableCategory(
          categories.map((category) => category.categoryId),
          true,
        );
        expect(enableCategorySpy).to.be.calledWith(
          viewManagerMock.object,
          imodelMock.object,
          categories.map((category) => category.categoryId),
          true,
          false,
        );
      });
    });
  });

  describe("enableSubCategory", () => {
    it("calls expected function", () => {
      using(createHandler(), (handler) => {
        const enableSubCategorySpy = sinon.stub(categoriesVisibilityUtils, "enableSubCategory");
        handler.enableSubCategory("subCategoryId", true);
        expect(enableSubCategorySpy).to.be.calledWith(viewManagerMock.object, "subCategoryId", true, false);
      });
    });
  });
});

describe("useCategories", () => {
  it("returns empty array while categories load", async () => {
    const categoryId = "test-category-id";
    const categoryInfo: Map<Id64String, IModelConnection.Categories.CategoryInfo> = new Map([[categoryId, { id: categoryId, subCategories: new Map() }]]);

    const { promise, resolve } = createResolvablePromise<Array<{ id: string }>>();
    const queryReader = {
      toArray: async () => promise,
    } as ECSqlReader;
    const viewport = {
      view: {
        is3d: () => true,
      },
    } as unknown as Viewport;

    const imodelMock = moq.Mock.ofType<IModelConnection>();
    const categoriesMock = moq.Mock.ofType<IModelConnection.Categories>();
    const viewManagerMock = moq.Mock.ofType<ViewManager>();

    imodelMock.setup((x) => x.createQueryReader(moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(() => queryReader);
    imodelMock.setup((x) => x.categories).returns(() => categoriesMock.object);
    categoriesMock.setup(async (x) => x.getCategoryInfo([categoryId])).returns(async () => categoryInfo);

    const { result } = renderHook(() => useCategories(viewManagerMock.object, imodelMock.object, viewport));

    await waitFor(() => expect(result.current).to.deep.eq([]));

    act(() => {
      resolve([{ id: categoryId }]);
    });

    await waitFor(() => {
      expect(result.current).to.have.lengthOf(1);
    });
  });

  it("returns empty array if there is no viewport", async () => {
    const categoryId = "test-category-id";
    const categoryInfo: Map<Id64String, IModelConnection.Categories.CategoryInfo> = new Map([[categoryId, { id: categoryId, subCategories: new Map() }]]);

    const queryReader = {
      toArray: async () => [{ id: categoryId }],
    } as ECSqlReader;

    const imodelMock = moq.Mock.ofType<IModelConnection>();
    const categoriesMock = moq.Mock.ofType<IModelConnection.Categories>();
    const viewManagerMock = moq.Mock.ofType<ViewManager>();

    imodelMock.setup((x) => x.createQueryReader(moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(() => queryReader);
    imodelMock.setup((x) => x.categories).returns(() => categoriesMock.object);
    categoriesMock.setup(async (x) => x.getCategoryInfo([categoryId])).returns(async () => categoryInfo);

    const { result } = renderHook(() => useCategories(viewManagerMock.object, imodelMock.object));

    await waitFor(() => expect(result.current).to.deep.eq([]));
  });
});
