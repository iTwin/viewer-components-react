/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import { IModelReadRpcInterface, SubCategoryAppearance } from "@itwin/core-common";
import { IModelApp, NoRenderApp, OffScreenViewport, PerModelCategoryVisibility, ViewRect } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import {
  enableCategoryDisplay,
  enableSubCategoryDisplay,
  invertAllCategories,
  loadCategoriesFromViewport,
} from "../../tree-widget-react/components/trees/common/CategoriesVisibilityUtils.js";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory, insertSubCategory } from "../IModelUtils.js";
import { TestUtils } from "../TestUtils.js";
import { createViewState } from "./TreeUtils.js";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { ECSqlReader } from "@itwin/core-common";
import type { IModelConnection, SpatialViewState, Viewport } from "@itwin/core-frontend";

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

  describe("enableCategoryDisplay", () => {
    it("enables category", async () => {
      await enableCategoryDisplay(viewportMock.object, ["CategoryId"], true, false);
      viewportMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], true, false, true), moq.Times.once());
    });

    it("disables category", async () => {
      await enableCategoryDisplay(viewportMock.object, ["CategoryId"], false, false);
      viewportMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, false, true), moq.Times.once());
    });

    it("disables category and subcategories", async () => {
      await enableCategoryDisplay(viewportMock.object, ["CategoryId"], false, true);
      viewportMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, true, true), moq.Times.once());
      viewportMock.verify((x) => x.changeSubCategoryDisplay(moq.It.isAny(), moq.It.isAny()), moq.Times.once());
    });

    it("removes overrides per model when enabling category", async () => {
      const overrides = [{ modelId: "ModelId", categoryId: "CategoryId", visible: false }];
      perModelCategoryVisibilityMock.reset();
      perModelCategoryVisibilityMock.setup((x) => x[Symbol.iterator]()).returns(() => overrides[Symbol.iterator]());
      await enableCategoryDisplay(viewportMock.object, ["CategoryId"], true, false);
      viewportMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], true, false, true), moq.Times.once());
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

  describe("invertAllCategories", () => {
    let imodel: IModelConnection;
    let categoryIds: Array<Id64String>;
    let modelIds: Array<Id64String>;
    let subCategoryIds: Array<Id64String>;
    let viewport: Viewport;
    async function createIModel(
      context: Mocha.Context,
    ): Promise<{ imodel: IModelConnection } & { models: Id64Array; categories: Id64Array; subCategories: Id64Array }> {
      return buildIModel(context, async (builder) => {
        const physicalModel1 = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel1" }).id;
        const physicalModel2 = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel2" }).id;
        const category1 = insertSpatialCategory({ builder, codeValue: "SpatialCategory1" }).id;
        const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2" }).id;
        const subCategory1 = insertSubCategory({ builder, codeValue: "SubCategory1", parentCategoryId: category1 }).id;
        const subCategory2 = insertSubCategory({ builder, codeValue: "SubCategory2", parentCategoryId: category2 }).id;
        insertPhysicalElement({ builder, codeValue: "element1", categoryId: category1, modelId: physicalModel1 }).id;
        insertPhysicalElement({ builder, codeValue: "element2", categoryId: category2, modelId: physicalModel2 }).id;
        return {
          models: [physicalModel1, physicalModel2],
          categories: [category1, category2],
          subCategories: [subCategory1, subCategory2],
        };
      });
    }
    before(async function () {
      await initializePresentationTesting({
        backendProps: {
          caching: {
            hierarchies: {
              // eslint-disable-next-line @typescript-eslint/no-deprecated
              mode: HierarchyCacheMode.Memory,
            },
          },
        },
        rpcs: [IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
      });
      // eslint-disable-next-line @itwin/no-internal
      ECSchemaRpcImpl.register();
      const buildIModelResult = await createIModel(this);
      imodel = buildIModelResult.imodel;
      categoryIds = buildIModelResult.categories;
      modelIds = buildIModelResult.models;
      subCategoryIds = buildIModelResult.subCategories;
      viewport = OffScreenViewport.create({
        view: await createViewState(imodel, categoryIds, modelIds),
        viewRect: new ViewRect(),
      });
    });

    after(async function () {
      viewport[Symbol.dispose]();
      await imodel.close();
      await terminatePresentationTesting();
    });

    it("inverts visible and hidden categories", async () => {
      viewport.changeCategoryDisplay([categoryIds[0]], false, true, true);
      viewport.changeCategoryDisplay([categoryIds[1], categoryIds[2]], true, true, true);
      for (let i = 0; i < categoryIds.length; ++i) {
        expect(viewport.view.viewsCategory(categoryIds[i])).to.eq(i > 0);
      }
      await invertAllCategories(
        categoryIds.map((id) => ({ categoryId: id })),
        viewport,
      );
      for (let i = 0; i < categoryIds.length; ++i) {
        expect(viewport.view.viewsCategory(categoryIds[i])).to.eq(i === 0);
      }
    });

    it("enables categories when they are in partial state due to subcategories", async () => {
      viewport.changeCategoryDisplay(categoryIds[0], true, true, true);
      viewport.changeCategoryDisplay(categoryIds[1], false, true, true);
      viewport.changeSubCategoryDisplay(subCategoryIds[0], false);
      viewport.changeSubCategoryDisplay(subCategoryIds[1], true);
      for (let i = 0; i < categoryIds.length; ++i) {
        expect(viewport.view.viewsCategory(categoryIds[i])).to.eq(i === 0);
      }
      for (let i = 0; i < subCategoryIds.length; ++i) {
        expect(viewport.isSubCategoryVisible(subCategoryIds[i])).to.eq(i !== 0);
      }
      await invertAllCategories(
        categoryIds.map((id, index) => ({ categoryId: id, subCategoryIds: [subCategoryIds[index]] })),
        viewport,
      );
      for (const id of categoryIds) {
        expect(viewport.view.viewsCategory(id)).to.be.true;
      }
      for (const id of subCategoryIds) {
        expect(viewport.isSubCategoryVisible(id)).to.be.true;
      }
    });

    it("enables categories when they are in partial state due to per model overrides", async () => {
      viewport.changeCategoryDisplay(categoryIds[0], true, true, true);
      viewport.changeCategoryDisplay(categoryIds[1], false, true, true);
      for (let i = 0; i < categoryIds.length; ++i) {
        expect(viewport.view.viewsCategory(categoryIds[i])).to.eq(i === 0);
      }
      viewport.perModelCategoryVisibility.setOverride(modelIds[0], categoryIds[0], PerModelCategoryVisibility.Override.Hide);
      viewport.perModelCategoryVisibility.setOverride(modelIds[1], categoryIds[1], PerModelCategoryVisibility.Override.Show);
      await invertAllCategories(
        categoryIds.map((id) => ({ categoryId: id })),
        viewport,
      );
      for (const id of categoryIds) {
        expect(viewport.view.viewsCategory(id)).to.be.true;
        expect(viewport.perModelCategoryVisibility.getOverride(modelIds[0], id)).to.eq(PerModelCategoryVisibility.Override.None);
        expect(viewport.perModelCategoryVisibility.getOverride(modelIds[1], id)).to.eq(PerModelCategoryVisibility.Override.None);
      }
    });

    it("inverts visible and hidden categories when they have overrides", async () => {
      viewport.changeCategoryDisplay(categoryIds[0], true, true, true);
      viewport.changeCategoryDisplay(categoryIds[1], false, true, true);

      for (let i = 0; i < categoryIds.length; ++i) {
        expect(viewport.view.viewsCategory(categoryIds[i])).to.eq(i === 0);
      }
      viewport.perModelCategoryVisibility.setOverride(modelIds[0], categoryIds[0], PerModelCategoryVisibility.Override.Show);
      viewport.perModelCategoryVisibility.setOverride(modelIds[1], categoryIds[1], PerModelCategoryVisibility.Override.Hide);
      await invertAllCategories(
        categoryIds.map((id) => ({ categoryId: id })),
        viewport,
      );
      for (let i = 0; i < categoryIds.length; ++i) {
        expect(viewport.view.viewsCategory(categoryIds[i])).to.eq(i !== 0);
        expect(viewport.perModelCategoryVisibility.getOverride(modelIds[0], categoryIds[i])).to.eq(PerModelCategoryVisibility.Override.None);
        expect(viewport.perModelCategoryVisibility.getOverride(modelIds[1], categoryIds[i])).to.eq(PerModelCategoryVisibility.Override.None);
      }
    });
  });
});
