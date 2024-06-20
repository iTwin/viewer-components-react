/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import { SubCategoryAppearance } from "@itwin/core-common";
import { IModelApp, NoRenderApp, PerModelCategoryVisibility } from "@itwin/core-frontend";
import {
  enableCategoryDisplay,
  enableSubCategoryDisplay,
  loadCategoriesFromViewport,
  toggleAllCategories,
} from "../../components/trees/common/CategoriesVisibilityUtils";
import { TestUtils } from "../TestUtils";

import type { ECSqlReader } from "@itwin/core-common";
import type { IModelConnection, ScreenViewport, SpatialViewState, ViewManager, Viewport, ViewState } from "@itwin/core-frontend";
import type { Id64String } from "@itwin/core-bentley";

describe("CategoryVisibilityUtils", () => {
  before(async () => {
    await NoRenderApp.startup();
    await TestUtils.initialize();
  });

  after(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const viewportMock = moq.Mock.ofType<Viewport>();
  const viewStateMock = moq.Mock.ofType<SpatialViewState>();
  const viewManagerMock = moq.Mock.ofType<ViewManager>();
  const selectedViewMock = moq.Mock.ofType<ScreenViewport>();
  const selectedViewStateMock = moq.Mock.ofType<ViewState>();
  const queryReaderMock = moq.Mock.ofType<ECSqlReader>();
  const categoriesMock = moq.Mock.ofType<IModelConnection.Categories>();
  const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();

  const mockViewManagerForEachViewport = (viewport: Viewport, times = moq.Times.once()) => {
    viewManagerMock.reset();
    viewManagerMock.setup((x) => x.selectedView).returns(() => selectedViewMock.object);
    viewManagerMock
      .setup((x) => x[Symbol.iterator]())
      .returns(() => [viewport as ScreenViewport][Symbol.iterator]())
      .verifiable(times);
  };

  const categoryId = "CategoryId";
  const subCategoryId = "SubCategoryId";
  const categoriesInfo = new Map([
    [
      categoryId,
      {
        id: categoryId,
        subCategories: new Map([
          [
            subCategoryId,
            {
              id: subCategoryId,
              categoryId,
              appearance: new SubCategoryAppearance(),
            },
          ],
        ]),
      },
    ],
  ]);

  beforeEach(() => {
    imodelMock.setup((x) => x.createQueryReader(moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(() => queryReaderMock.object);
    imodelMock.setup((x) => x.categories).returns(() => categoriesMock.object);
    queryReaderMock.setup(async (x) => x.toArray()).returns(async () => [{ id: categoryId }]);
    categoriesMock.setup(async (x) => x.getCategoryInfo([categoryId])).returns(async () => categoriesInfo);
    viewManagerMock.setup((x) => x.selectedView).returns(() => selectedViewMock.object);
    selectedViewMock.setup((x) => x.view).returns(() => selectedViewStateMock.object);
    selectedViewMock.setup((x) => x.perModelCategoryVisibility).returns(() => perModelCategoryVisibilityMock.object);
    perModelCategoryVisibilityMock.setup((x) => x[Symbol.iterator]()).returns(() => [][Symbol.iterator]());
    viewportMock.setup((x) => x.view).returns(() => viewStateMock.object);
    viewStateMock.setup((x) => x.is3d()).returns(() => true);
  });

  afterEach(() => {
    perModelCategoryVisibilityMock.reset();
    viewManagerMock.reset();
    imodelMock.reset();
    queryReaderMock.reset();
    categoriesMock.reset();
    viewportMock.reset();
    viewStateMock.reset();
    selectedViewMock.reset();
    selectedViewStateMock.reset();
    sinon.restore();
  });

  describe("toggleAllCategories", () => {
    it("enables all categories", async () => {
      await toggleAllCategories(viewManagerMock.object, imodelMock.object, true, viewportMock.object, false);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], true, moq.It.isAny()), moq.Times.once());
    });

    it("disables all categories", async () => {
      await toggleAllCategories(viewManagerMock.object, imodelMock.object, false, viewportMock.object, false);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, moq.It.isAny()), moq.Times.once());
    });

    it("calls enableCategoryDisplay with false when forAllViewports is undefined", async () => {
      const selectedViewMock1 = moq.Mock.ofType<ScreenViewport>();
      viewManagerMock
        .setup((x) => x[Symbol.iterator]())
        .returns(function* () {
          yield selectedViewMock1.object;
        });
      await toggleAllCategories(viewManagerMock.object, imodelMock.object, false, viewportMock.object);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, true), moq.Times.once());
      selectedViewMock1.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, true), moq.Times.never());
    });
  });

  describe("enableCategoryDisplay", () => {
    it("enables category", async () => {
      await enableCategoryDisplay(viewManagerMock.object, imodelMock.object, ["CategoryId"], true, false, false);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], true, false), moq.Times.once());
    });

    it("disables category", async () => {
      await enableCategoryDisplay(viewManagerMock.object, imodelMock.object, ["CategoryId"], false, false, false);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, false), moq.Times.once());
    });

    it("disables category and subcategories", async () => {
      await enableCategoryDisplay(viewManagerMock.object, imodelMock.object, ["CategoryId"], false, false, true);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, true), moq.Times.once());
      selectedViewMock.verify((x) => x.changeSubCategoryDisplay(moq.It.isAny(), moq.It.isAny()), moq.Times.once());
    });

    it("removes overrides per model when enabling category", async () => {
      const ovrs = [{ modelId: "ModelId", categoryId: "CategoryId", visible: false }];
      perModelCategoryVisibilityMock.reset();
      perModelCategoryVisibilityMock.setup((x) => x[Symbol.iterator]()).returns(() => ovrs[Symbol.iterator]());
      await enableCategoryDisplay(viewManagerMock.object, imodelMock.object, ["CategoryId"], true, false, false);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], true, false), moq.Times.once());
      perModelCategoryVisibilityMock.verify((x) => x.setOverride(["ModelId"], ["CategoryId"], PerModelCategoryVisibility.Override.None), moq.Times.once());
    });

    it("does not change category state if selectedView is undefined", async () => {
      viewManagerMock.reset();
      viewManagerMock.setup((x) => x.selectedView).returns(() => undefined);
      await enableCategoryDisplay(viewManagerMock.object, imodelMock.object, ["CategoryId"], false, false, false);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, false), moq.Times.never());
    });

    it("enables category in all viewports", async () => {
      viewStateMock.reset();
      viewStateMock.setup((x) => x.is3d()).returns(() => true);
      const otherViewMock = moq.Mock.ofType<Viewport>();
      otherViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
      otherViewMock.setup((x) => x.perModelCategoryVisibility).returns(() => perModelCategoryVisibilityMock.object);
      mockViewManagerForEachViewport(otherViewMock.object);
      selectedViewStateMock.setup((x) => x.is3d()).returns(() => true);

      await enableCategoryDisplay(viewManagerMock.object, imodelMock.object, ["CategoryId"], true, true, false);
      viewManagerMock.verifyAll();
      otherViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], true, false), moq.Times.once());
    });

    it("disables category in all viewports", async () => {
      viewStateMock.reset();
      viewStateMock.setup((x) => x.is3d()).returns(() => true);
      const otherViewMock = moq.Mock.ofType<Viewport>();
      otherViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
      otherViewMock.setup((x) => x.perModelCategoryVisibility).returns(() => perModelCategoryVisibilityMock.object);
      mockViewManagerForEachViewport(otherViewMock.object, moq.Times.exactly(2));
      selectedViewStateMock.setup((x) => x.is3d()).returns(() => true);

      await enableCategoryDisplay(viewManagerMock.object, imodelMock.object, ["CategoryId"], false, true, false);
      viewManagerMock.verifyAll();
      otherViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, false), moq.Times.once());
    });

    it("does not change category if viewport and selected view has different types", async () => {
      viewStateMock.reset();
      viewStateMock.setup((x) => x.is3d()).returns(() => false);
      const otherViewMock = moq.Mock.ofType<Viewport>();
      otherViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
      otherViewMock.setup((x) => x.perModelCategoryVisibility).returns(() => perModelCategoryVisibilityMock.object);
      mockViewManagerForEachViewport(otherViewMock.object);
      selectedViewStateMock.setup((x) => x.is3d()).returns(() => true);

      await enableCategoryDisplay(viewManagerMock.object, imodelMock.object, ["CategoryId"], false, true, false);
      otherViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, false), moq.Times.never());
    });
  });

  describe("enableSubCategoryDisplay", () => {
    it("enables subCategory", () => {
      enableSubCategoryDisplay(viewManagerMock.object, "SubCategoryId", true);
      selectedViewMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", true), moq.Times.once());
    });

    it("disables subCategory", () => {
      enableSubCategoryDisplay(viewManagerMock.object, "SubCategoryId", false);
      selectedViewMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", false), moq.Times.once());
    });

    it("does not change subCategory state if selectedView is undefined", () => {
      viewManagerMock.reset();
      viewManagerMock.setup((x) => x.selectedView).returns(() => undefined);

      enableSubCategoryDisplay(viewManagerMock.object, "SubCategoryId", false);
      selectedViewMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", false), moq.Times.never());
    });

    it("enables subCategory in all viewports", () => {
      viewStateMock.reset();
      viewStateMock.setup((x) => x.is3d()).returns(() => true);
      const otherViewMock = moq.Mock.ofType<Viewport>();
      otherViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
      mockViewManagerForEachViewport(otherViewMock.object);
      selectedViewStateMock.setup((x) => x.is3d()).returns(() => true);

      enableSubCategoryDisplay(viewManagerMock.object, "SubCategoryId", true, true);
      viewManagerMock.verifyAll();
      otherViewMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", true), moq.Times.once());
    });

    it("disables subCategory in all viewports", () => {
      viewStateMock.reset();
      viewStateMock.setup((x) => x.is3d()).returns(() => true);
      const otherViewMock = moq.Mock.ofType<Viewport>();
      otherViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
      mockViewManagerForEachViewport(otherViewMock.object);
      selectedViewStateMock.setup((x) => x.is3d()).returns(() => true);

      enableSubCategoryDisplay(viewManagerMock.object, "SubCategoryId", false, true);
      viewManagerMock.verifyAll();
      otherViewMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", false), moq.Times.once());
    });

    it("does not change subCategory state if viewport and selectedView has different types", () => {
      viewStateMock.reset();
      viewStateMock.setup((x) => x.is3d()).returns(() => false);
      const otherViewMock = moq.Mock.ofType<Viewport>();
      otherViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
      mockViewManagerForEachViewport(otherViewMock.object);
      selectedViewStateMock.setup((x) => x.is3d()).returns(() => true);

      enableSubCategoryDisplay(viewManagerMock.object, "SubCategoryId", false, true);
      viewManagerMock.verifyAll();
      otherViewMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", false), moq.Times.never());
    });
  });

  describe("loadCategoriesFromViewport", () => {
    it("loadCategoriesFromViewport sets subCategories as undefined when subCategories size is 0", async () => {
      const categoryInfoWithoutSubcategories: Map<Id64String, IModelConnection.Categories.CategoryInfo> = new Map([
        [
          categoryId,
          {
            id: categoryId,
            subCategories: new Map(),
          },
        ],
      ]);
      queryReaderMock.reset();
      categoriesMock.reset();
      queryReaderMock.setup(async (x) => x.toArray()).returns(async () => [{ id: "CategoryWithoutSubcategories" }]);
      categoriesMock.setup(async (x) => x.getCategoryInfo(["CategoryWithoutSubcategories"])).returns(async () => categoryInfoWithoutSubcategories);
      const result = await loadCategoriesFromViewport(imodelMock.object, viewportMock.object);
      expect(result[0].subCategoryIds).to.be.undefined;
    });
  });
});
