/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as sinon from "sinon";
import * as moq from "typemoq";
import {
  IModelApp, IModelConnection, NoRenderApp, PerModelCategoryVisibility, ScreenViewport, SpatialViewState, ViewManager, Viewport,
  ViewState,
} from "@itwin/core-frontend";
import { KeySet } from "@itwin/presentation-common";
import { Presentation, PresentationManager, SelectionChangeEvent, SelectionManager } from "@itwin/presentation-frontend";
import { enableCategory, enableSubCategory, toggleAllCategories } from "../../components/trees/CategoriesVisibilityUtils";
import { CategoryInfo } from "../../components/trees/category-tree/CategoryVisibilityHandler";
import { mockPresentationManager, TestUtils } from "../TestUtils";
import { ECSqlReader, QueryRowProxy, SubCategoryAppearance } from "@itwin/core-common";

describe("CategoryVisibilityUtils", () => {
  before(async () => {
    // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
    await NoRenderApp.startup(); // eslint-disable-line @itwin/no-internal
    await TestUtils.initialize();
  });

  after(async () => {
    TestUtils.terminate();
    Presentation.terminate();
    await IModelApp.shutdown();
  });

  afterEach(() => {
    sinon.restore();
  });

  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
  let presentationManagerMock: moq.IMock<PresentationManager>;
  const viewportMock = moq.Mock.ofType<Viewport>();
  const viewStateMock = moq.Mock.ofType<SpatialViewState>();
  const viewManagerMock = moq.Mock.ofType<ViewManager>();
  const selectedViewMock = moq.Mock.ofType<ScreenViewport>();
  const selectedViewStateMock = moq.Mock.ofType<ViewState>();
  const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();
  const categoriesMock = moq.Mock.ofType<IModelConnection.Categories>();
  const queryReaderMock = moq.Mock.ofType<ECSqlReader>();

  const mockViewManagerForEachViewport = (viewport: Viewport, times = moq.Times.once()) => {
    viewManagerMock.reset();
    viewManagerMock.setup((x) => x.selectedView).returns(() => selectedViewMock.object);
    viewManagerMock
      .setup((x) => x[Symbol.iterator]())
      .returns(() => [viewport as ScreenViewport][Symbol.iterator]())
      .verifiable(times);
  };

  const categories: CategoryInfo[] = [
    {
      categoryId: "CategoryId",
      subCategoryIds: ["SubCategoryId"],
    },
  ];

  const categoriesInfo = new Map(
    [[
      categories[0].categoryId,
      {
        id: categories[0].categoryId,
        subCategories: new Map(
          [[
            categories[0].subCategoryIds![0],
            {
              id: categories[0].subCategoryIds![0],
              categoryId: categories[0].categoryId,
              appearance: new SubCategoryAppearance(),
            },
          ]]
        ),
      },
    ]]
  )

  beforeEach(() => {
    viewManagerMock.reset();
    imodelMock.reset();
    selectionManagerMock.reset();
    viewportMock.reset();
    viewStateMock.reset();
    selectedViewMock.reset();
    perModelCategoryVisibilityMock.reset();

    const selectionChangeEvent = new SelectionChangeEvent();
    selectionManagerMock.setup((x) => x.selectionChange).returns(() => selectionChangeEvent);
    selectionManagerMock.setup((x) => x.getSelectionLevels(imodelMock.object)).returns(() => []);
    selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAny())).returns(() => new KeySet());

    const mocks = mockPresentationManager();
    presentationManagerMock = mocks.presentationManager;

    void Presentation.initialize({ presentation: presentationManagerMock.object, selection: selectionManagerMock.object });

    imodelMock.setup((x) => x.createQueryReader(moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(() => queryReaderMock.object);
    queryReaderMock.setup(async (x) => x.toArray()).returns(async () => []);
    viewManagerMock.setup((x) => x.selectedView).returns(() => selectedViewMock.object);
    selectedViewMock.setup((x) => x.view).returns(() => selectedViewStateMock.object);
    selectedViewMock.setup((x) => x.perModelCategoryVisibility).returns(() => perModelCategoryVisibilityMock.object);
    viewportMock.setup((x) => x.view).returns(() => viewStateMock.object);
    // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
    viewStateMock.setup((x) => x.is3d()).returns(() => true); // eslint-disable-line @itwin/no-internal
    perModelCategoryVisibilityMock.setup((x) => x[Symbol.iterator]()).returns(() => [][Symbol.iterator]());
  });

  describe("toggleAllCategories", () => {

    beforeEach(() => {
      imodelMock.reset();
      queryReaderMock.reset();

      imodelMock.setup((x) => x.createQueryReader(moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(() => queryReaderMock.object);
      queryReaderMock.setup(async (x) => x.toArray()).returns(async () => ["CategoryId"]);
      imodelMock.setup((x) => x.categories).returns(() => categoriesMock.object);
      categoriesMock.setup(async (x) => x.getCategoryInfo(["CategoryId"])).returns(async () => categoriesInfo);
    });

    it("enables all categories", async () => {
      await toggleAllCategories(viewManagerMock.object, imodelMock.object, true, viewportMock.object, false);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], true, moq.It.isAny()), moq.Times.once());
    });

    it("disables all categories", async () => {
      await toggleAllCategories(viewManagerMock.object, imodelMock.object, false, viewportMock.object, false);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, moq.It.isAny()), moq.Times.once());
    });
  });

  describe("enableCategory", () => {

    beforeEach(() => {
      perModelCategoryVisibilityMock.reset();
      selectedViewMock.reset();
      imodelMock.reset();
      categoriesMock.reset();

      selectedViewMock.setup((x) => x.view).returns(() => selectedViewStateMock.object);
      selectedViewMock.setup((x) => x.perModelCategoryVisibility).returns(() => perModelCategoryVisibilityMock.object);
      imodelMock.setup((x) => x.categories).returns(() => categoriesMock.object);
      categoriesMock.setup(async (x) => x.getCategoryInfo(["CategoryId"])).returns(async () => categoriesInfo)
      perModelCategoryVisibilityMock.setup((x) => x[Symbol.iterator]()).returns(() => [][Symbol.iterator]());
    });

    it("enables category", () => {
      enableCategory(viewManagerMock.object, imodelMock.object, ["CategoryId"], true, false, false);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], true, false), moq.Times.once());
    });

    it("disables category", () => {
      enableCategory(viewManagerMock.object, imodelMock.object, ["CategoryId"], false, false, false);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, false), moq.Times.once());
    });

    it("disables category and subcategories", () => {
      enableCategory(viewManagerMock.object, imodelMock.object, ["CategoryId"], false, false, true);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, true), moq.Times.once());
      selectedViewMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", false), moq.Times.once());
    });

    it("removes overrides per model when enabling category", () => {
      const ovrs = [{ modelId: "ModelId", categoryId: "CategoryId", visible: false }];
      perModelCategoryVisibilityMock.reset();
      perModelCategoryVisibilityMock.setup((x) => x[Symbol.iterator]()).returns(() => ovrs[Symbol.iterator]());
      enableCategory(viewManagerMock.object, imodelMock.object, ["CategoryId"], true, false, false);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], true, false), moq.Times.once());
      perModelCategoryVisibilityMock.verify((x) => x.setOverride(["ModelId"], ["CategoryId"], PerModelCategoryVisibility.Override.None), moq.Times.once());
    });

    it("does not change category state if selectedView is undefined", () => {
      viewManagerMock.reset();
      viewManagerMock.setup((x) => x.selectedView).returns(() => undefined);
      enableCategory(viewManagerMock.object, imodelMock.object, ["CategoryId"], false, false, false);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, false), moq.Times.never());
    });

    it("enables category in all viewports", () => {
      viewStateMock.reset();
      // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
      viewStateMock.setup((x) => x.is3d()).returns(() => true); // eslint-disable-line @itwin/no-internal
      const otherViewMock = moq.Mock.ofType<Viewport>();
      otherViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
      otherViewMock.setup((x) => x.perModelCategoryVisibility).returns(() => perModelCategoryVisibilityMock.object);
      mockViewManagerForEachViewport(otherViewMock.object);
      selectedViewStateMock.setup((x) => x.is3d()).returns(() => true);

      enableCategory(viewManagerMock.object, imodelMock.object, ["CategoryId"], true, true, false);
      viewManagerMock.verifyAll();
      otherViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], true, false), moq.Times.once());
    });

    it("disables category in all viewports", () => {
      viewStateMock.reset();
      // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
      viewStateMock.setup((x) => x.is3d()).returns(() => true); // eslint-disable-line @itwin/no-internal
      const otherViewMock = moq.Mock.ofType<Viewport>();
      otherViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
      otherViewMock.setup((x) => x.perModelCategoryVisibility).returns(() => perModelCategoryVisibilityMock.object);
      mockViewManagerForEachViewport(otherViewMock.object, moq.Times.exactly(2));
      selectedViewStateMock.setup((x) => x.is3d()).returns(() => true);

      enableCategory(viewManagerMock.object, imodelMock.object, ["CategoryId"], false, true, false);
      viewManagerMock.verifyAll();
      otherViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, false), moq.Times.once());
    });

    it("does not change category if viewport and selected view has different types", () => {
      viewStateMock.reset();
      // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
      viewStateMock.setup((x) => x.is3d()).returns(() => false); // eslint-disable-line @itwin/no-internal
      const otherViewMock = moq.Mock.ofType<Viewport>();
      otherViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
      otherViewMock.setup((x) => x.perModelCategoryVisibility).returns(() => perModelCategoryVisibilityMock.object);
      mockViewManagerForEachViewport(otherViewMock.object);
      selectedViewStateMock.setup((x) => x.is3d()).returns(() => true);

      enableCategory(viewManagerMock.object, imodelMock.object, ["CategoryId"], false, true, false);
      otherViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, false), moq.Times.never());
    });
  });

  describe("enableSubCategory", () => {

    beforeEach(() => {
      selectedViewMock.reset();
      selectedViewMock.setup((x) => x.view).returns(() => selectedViewStateMock.object);
    });

    it("enables subCategory", () => {
      enableSubCategory(viewManagerMock.object, "SubCategoryId", true);
      selectedViewMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", true), moq.Times.once());
    });

    it("disables subCategory", () => {
      enableSubCategory(viewManagerMock.object, "SubCategoryId", false);
      selectedViewMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", false), moq.Times.once());
    });

    it("does not change subCategory state if selectedView is undefined", () => {
      viewManagerMock.reset();
      viewManagerMock.setup((x) => x.selectedView).returns(() => undefined);

      enableSubCategory(viewManagerMock.object, "SubCategoryId", false);
      selectedViewMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", false), moq.Times.never());
    });

    it("enables subCategory in all viewports", () => {
      viewStateMock.reset();
      // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
      viewStateMock.setup((x) => x.is3d()).returns(() => true); // eslint-disable-line @itwin/no-internal
      const otherViewMock = moq.Mock.ofType<Viewport>();
      otherViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
      mockViewManagerForEachViewport(otherViewMock.object);
      selectedViewStateMock.setup((x) => x.is3d()).returns(() => true);

      enableSubCategory(viewManagerMock.object, "SubCategoryId", true, true);
      viewManagerMock.verifyAll();
      otherViewMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", true), moq.Times.once());
    });

    it("disables subCategory in all viewports", () => {
      viewStateMock.reset();
      // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
      viewStateMock.setup((x) => x.is3d()).returns(() => true); // eslint-disable-line @itwin/no-internal
      const otherViewMock = moq.Mock.ofType<Viewport>();
      otherViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
      mockViewManagerForEachViewport(otherViewMock.object);
      selectedViewStateMock.setup((x) => x.is3d()).returns(() => true);

      enableSubCategory(viewManagerMock.object, "SubCategoryId", false, true);
      viewManagerMock.verifyAll();
      otherViewMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", false), moq.Times.once());
    });

    it("does not change subCategory state if viewport and selectedView has different types", () => {
      viewStateMock.reset();
      // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
      viewStateMock.setup((x) => x.is3d()).returns(() => false); // eslint-disable-line @itwin/no-internal
      const otherViewMock = moq.Mock.ofType<Viewport>();
      otherViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
      mockViewManagerForEachViewport(otherViewMock.object);
      selectedViewStateMock.setup((x) => x.is3d()).returns(() => true);

      enableSubCategory(viewManagerMock.object, "SubCategoryId", false, true);
      viewManagerMock.verifyAll();
      otherViewMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", false), moq.Times.never());
    });

  });
});
