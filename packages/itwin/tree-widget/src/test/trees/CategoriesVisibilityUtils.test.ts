/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { IModelReadRpcInterface, SubCategoryAppearance } from "@itwin/core-common";
import { IModelApp, NoRenderApp, PerModelCategoryVisibility } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { invertAllCategories } from "../../tree-widget-react/components/trees/common/CategoriesVisibilityUtils.js";
import {
  enableCategoryDisplay,
  enableSubCategoryDisplay,
  loadCategoriesFromViewport,
  toggleAllCategories,
} from "../../tree-widget-react/components/trees/common/internal/VisibilityUtils.js";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory, insertSubCategory } from "../IModelUtils.js";
import { TestUtils } from "../TestUtils.js";
import { createFakeSinonViewport, createIModelMock } from "./Common.js";
import { createTreeWidgetTestingViewport, createViewState } from "./TreeUtils.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { TreeWidgetTestingViewport } from "./TreeUtils.js";

describe("CategoryVisibilityUtils", () => {
  before(async () => {
    await NoRenderApp.startup();
    await TestUtils.initialize();
  });

  after(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

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
  let viewport: TreeWidgetTestingViewport;

  beforeEach(() => {
    viewport = createFakeSinonViewport({
      queryHandler: () => [{ id: categoryId }],
      getCategoryInfo: async () => categoriesInfo,
      viewType: "3d",
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("toggleAllCategories", () => {
    it("enables all categories", async () => {
      await toggleAllCategories(viewport, true);
      expect(viewport.changeCategoryDisplay).to.be.calledOnceWith({ categoryIds: [categoryId], display: true, enableAllSubCategories: true });
    });

    it("disables all categories", async () => {
      await toggleAllCategories(viewport, false);
      expect(viewport.changeCategoryDisplay).to.be.calledOnceWith({ categoryIds: [categoryId], display: false, enableAllSubCategories: true });
    });
  });

  describe("enableCategoryDisplay", () => {
    it("enables category", async () => {
      await enableCategoryDisplay(viewport, categoryId, true, false);
      expect(viewport.changeCategoryDisplay).to.be.calledOnceWith({ categoryIds: categoryId, display: true, enableAllSubCategories: false });
    });

    it("disables category", async () => {
      await enableCategoryDisplay(viewport, categoryId, false, false);
      expect(viewport.changeCategoryDisplay).to.be.calledOnceWith({ categoryIds: categoryId, display: false, enableAllSubCategories: false });
    });

    it("disables category and subcategories", async () => {
      await enableCategoryDisplay(viewport, categoryId, false, true);
      expect(viewport.changeCategoryDisplay).to.be.calledOnceWith({ categoryIds: categoryId, display: false, enableAllSubCategories: true });
      expect(viewport.changeSubCategoryDisplay).to.be.calledOnceWith({ subCategoryId, display: false });
    });

    it("removes overrides per model when enabling category", async () => {
      const overrides = [{ modelId: "ModelId", categoryId, visible: false }];
      viewport.perModelCategoryOverrides = overrides;
      await enableCategoryDisplay(viewport, categoryId, true, false);

      expect(viewport.changeCategoryDisplay).to.be.calledOnceWith({ categoryIds: categoryId, display: true, enableAllSubCategories: false });
      expect(viewport.setPerModelCategoryOverride).to.be.calledOnceWith({
        modelIds: ["ModelId"],
        categoryIds: categoryId,
        override: PerModelCategoryVisibility.Override.None,
      });
    });
  });

  describe("enableSubCategoryDisplay", () => {
    it("enables subCategory", () => {
      enableSubCategoryDisplay(viewport, subCategoryId, true);
      expect(viewport.changeSubCategoryDisplay).to.be.calledOnceWith({ subCategoryId, display: true });
    });

    it("disables subCategory", () => {
      enableSubCategoryDisplay(viewport, subCategoryId, false);
      expect(viewport.changeSubCategoryDisplay).to.be.calledOnceWith({ subCategoryId, display: false });
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
      viewport.iModel = createIModelMock({
        queryHandler: () => [{ id: "CategoryWithoutSubcategories" }],
        getCategoryInfo: async () => categoryInfoWithoutSubcategories,
      });
      const result = await loadCategoriesFromViewport(viewport);
      expect(result[0].subCategoryIds).to.be.undefined;
    });
  });

  describe("invertAllCategories", () => {
    let imodel: IModelConnection;
    let categoryIds: Array<Id64String>;
    let modelIds: Array<Id64String>;
    let subCategoryIds: Array<Id64String>;
    let nonMockedViewport: TreeWidgetTestingViewport;
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
      nonMockedViewport = createTreeWidgetTestingViewport({ viewState: await createViewState(imodel, categoryIds, modelIds) });
    });

    after(async function () {
      nonMockedViewport[Symbol.dispose]();
      await imodel.close();
      await terminatePresentationTesting();
    });

    it("inverts visible and hidden categories", async () => {
      nonMockedViewport.changeCategoryDisplay({ categoryIds: [categoryIds[0]], display: false, enableAllSubCategories: true });
      nonMockedViewport.changeCategoryDisplay({ categoryIds: [categoryIds[1], categoryIds[2]], display: true, enableAllSubCategories: true });
      for (let i = 0; i < categoryIds.length; ++i) {
        expect(nonMockedViewport.viewsCategory(categoryIds[i])).to.eq(i > 0);
      }
      await invertAllCategories(
        categoryIds.map((id) => ({ categoryId: id })),
        nonMockedViewport,
      );
      for (let i = 0; i < categoryIds.length; ++i) {
        expect(nonMockedViewport.viewsCategory(categoryIds[i])).to.eq(i === 0);
      }
    });

    it("enables categories when they are in partial state due to subcategories", async () => {
      nonMockedViewport.changeCategoryDisplay({ categoryIds: categoryIds[0], display: true, enableAllSubCategories: true });
      nonMockedViewport.changeCategoryDisplay({ categoryIds: categoryIds[1], display: false, enableAllSubCategories: true });
      nonMockedViewport.changeSubCategoryDisplay({ subCategoryId: subCategoryIds[0], display: false });
      nonMockedViewport.changeSubCategoryDisplay({ subCategoryId: subCategoryIds[1], display: true });
      for (let i = 0; i < categoryIds.length; ++i) {
        expect(nonMockedViewport.viewsCategory(categoryIds[i])).to.eq(i === 0);
      }
      for (let i = 0; i < subCategoryIds.length; ++i) {
        expect(nonMockedViewport.viewsSubCategory(subCategoryIds[i])).to.eq(i !== 0);
      }
      await invertAllCategories(
        categoryIds.map((id, index) => ({ categoryId: id, subCategoryIds: [subCategoryIds[index]] })),
        nonMockedViewport,
      );
      for (const id of categoryIds) {
        expect(nonMockedViewport.viewsCategory(id)).to.be.true;
      }
      for (const id of subCategoryIds) {
        expect(nonMockedViewport.viewsSubCategory(id)).to.be.true;
      }
    });

    it("enables categories when they are in partial state due to per model overrides", async () => {
      nonMockedViewport.changeCategoryDisplay({ categoryIds: categoryIds[0], display: true, enableAllSubCategories: true });
      nonMockedViewport.changeCategoryDisplay({ categoryIds: categoryIds[1], display: false, enableAllSubCategories: true });
      for (let i = 0; i < categoryIds.length; ++i) {
        expect(nonMockedViewport.viewsCategory(categoryIds[i])).to.eq(i === 0);
      }
      nonMockedViewport.setPerModelCategoryOverride({ modelIds: modelIds[0], categoryIds: categoryIds[0], override: PerModelCategoryVisibility.Override.Hide });
      nonMockedViewport.setPerModelCategoryOverride({ modelIds: modelIds[1], categoryIds: categoryIds[1], override: PerModelCategoryVisibility.Override.Show });
      await invertAllCategories(
        categoryIds.map((id) => ({ categoryId: id })),
        nonMockedViewport,
      );
      for (const id of categoryIds) {
        expect(nonMockedViewport.viewsCategory(id)).to.be.true;
        expect(nonMockedViewport.getPerModelCategoryOverride({ modelId: modelIds[0], categoryId: id })).to.eq(PerModelCategoryVisibility.Override.None);
        expect(nonMockedViewport.getPerModelCategoryOverride({ modelId: modelIds[1], categoryId: id })).to.eq(PerModelCategoryVisibility.Override.None);
      }
    });

    it("inverts visible and hidden categories when they have overrides", async () => {
      nonMockedViewport.changeCategoryDisplay({ categoryIds: categoryIds[0], display: true, enableAllSubCategories: true });
      nonMockedViewport.changeCategoryDisplay({ categoryIds: categoryIds[1], display: false, enableAllSubCategories: true });

      for (let i = 0; i < categoryIds.length; ++i) {
        expect(nonMockedViewport.viewsCategory(categoryIds[i])).to.eq(i === 0);
      }
      nonMockedViewport.setPerModelCategoryOverride({ modelIds: modelIds[0], categoryIds: categoryIds[0], override: PerModelCategoryVisibility.Override.Show });
      nonMockedViewport.setPerModelCategoryOverride({ modelIds: modelIds[1], categoryIds: categoryIds[1], override: PerModelCategoryVisibility.Override.Hide });
      await invertAllCategories(
        categoryIds.map((id) => ({ categoryId: id })),
        nonMockedViewport,
      );
      for (let i = 0; i < categoryIds.length; ++i) {
        expect(nonMockedViewport.viewsCategory(categoryIds[i])).to.eq(i !== 0);
        expect(nonMockedViewport.getPerModelCategoryOverride({ modelId: modelIds[0], categoryId: categoryIds[i] })).to.eq(
          PerModelCategoryVisibility.Override.None,
        );
        expect(nonMockedViewport.getPerModelCategoryOverride({ modelId: modelIds[1], categoryId: categoryIds[i] })).to.eq(
          PerModelCategoryVisibility.Override.None,
        );
      }
    });
  });
});
