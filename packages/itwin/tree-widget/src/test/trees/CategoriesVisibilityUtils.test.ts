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
  enableCategoryDisplay, enableSubCategoryDisplay, loadCategoriesFromViewport, toggleAllCategories,
} from "../../components/trees/common/CategoriesVisibilityUtils";
import { TestUtils } from "../TestUtils";

import type { ECSqlReader } from "@itwin/core-common";
import type { IModelConnection, SpatialViewState, Viewport } from "@itwin/core-frontend";
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
  const queryReaderMock = moq.Mock.ofType<ECSqlReader>();
  const categoriesMock = moq.Mock.ofType<IModelConnection.Categories>();
  const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();

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
    perModelCategoryVisibilityMock.setup((x) => x[Symbol.iterator]()).returns(() => [][Symbol.iterator]());
    viewportMock.setup((x) => x.view).returns(() => viewStateMock.object);
    viewportMock.setup((x) => x.iModel).returns(() => imodelMock.object);
    viewportMock.setup((x) => x.perModelCategoryVisibility).returns(() => perModelCategoryVisibilityMock.object);
    viewStateMock.setup((x) => x.is3d()).returns(() => true);
  });

  afterEach(() => {
    perModelCategoryVisibilityMock.reset();
    imodelMock.reset();
    queryReaderMock.reset();
    categoriesMock.reset();
    viewportMock.reset();
    viewStateMock.reset();
    sinon.restore();
  });

  describe("toggleAllCategories", () => {
    it("enables all categories", async () => {
      await toggleAllCategories(viewportMock.object, true);
      viewportMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], true, moq.It.isAny()), moq.Times.once());
    });

    it("disables all categories", async () => {
      await toggleAllCategories(viewportMock.object, false);
      viewportMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, moq.It.isAny()), moq.Times.once());
    });
  });

  describe("enableCategoryDisplay", () => {
    it("enables category", async () => {
      await enableCategoryDisplay(viewportMock.object, ["CategoryId"], true, false);
      viewportMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], true, false), moq.Times.once());
    });

    it("disables category", async () => {
      await enableCategoryDisplay(viewportMock.object, ["CategoryId"], false, false);
      viewportMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, false), moq.Times.once());
    });

    it("disables category and subcategories", async () => {
      await enableCategoryDisplay(viewportMock.object, ["CategoryId"], false, true);
      viewportMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, true), moq.Times.once());
      viewportMock.verify((x) => x.changeSubCategoryDisplay(moq.It.isAny(), moq.It.isAny()), moq.Times.once());
    });

    it("removes overrides per model when enabling category", async () => {
      const ovrs = [{ modelId: "ModelId", categoryId: "CategoryId", visible: false }];
      perModelCategoryVisibilityMock.reset();
      perModelCategoryVisibilityMock.setup((x) => x[Symbol.iterator]()).returns(() => ovrs[Symbol.iterator]());
      await enableCategoryDisplay(viewportMock.object, ["CategoryId"], true, false);
      viewportMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], true, false), moq.Times.once());
      perModelCategoryVisibilityMock.verify((x) => x.setOverride(["ModelId"], ["CategoryId"], PerModelCategoryVisibility.Override.None), moq.Times.once());
    });
  });

  describe("enableSubCategoryDisplay", () => {
    it("enables subCategory", () => {
      enableSubCategoryDisplay(viewportMock.object, "SubCategoryId", true);
      viewportMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", true), moq.Times.once());
    });

    it("disables subCategory", () => {
      enableSubCategoryDisplay(viewportMock.object, "SubCategoryId", false);
      viewportMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", false), moq.Times.once());
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
      const result = await loadCategoriesFromViewport(viewportMock.object);
      expect(result[0].subCategoryIds).to.be.undefined;
    });
  });
});
