/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import {
  HierarchyCacheMode,
  initializeCore,
  insertDefinitionContainer,
  insertDrawingCategory,
  insertDrawingGraphic,
  insertDrawingModelWithPartition,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
  insertSubCategory,
  insertSubModel,
  terminateCore,
} from "test-utilities";
import { IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { CategoriesTreeDefinition } from "../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeDefinition.js";
import { CategoriesTreeIdsCache } from "../../../tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeIdsCache.js";
import { buildIModel } from "../../IModelUtils.js";
import { createIModelAccess } from "../Common.js";

// cspell:words egory
// cspell complains about Cat_egory and Cat%egory

describe("Categories tree", () => {
  describe("Hierarchy filtering", () => {
    before(async function () {
      await initializeCore({
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
    });

    after(async function () {
      await terminateCore();
    });

    it("finds definition container by label", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "DefinitionContainer", userLabel: "Test" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ imodel, codeValue: "SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      const viewType = "3d";
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);
      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "Test",
          viewType,
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.definitionContainer], options: { autoExpand: true } }]);
    });

    it("filtering by label aborts when abort signal fires", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "DefinitionContainer", userLabel: "Test" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ imodel, codeValue: "SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });
        return { definitionContainer };
      });
      const { imodelConnection, ...ids } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      const viewType = "3d";
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);

      const abortController1 = new AbortController();
      const pathsPromiseAborted = CategoriesTreeDefinition.createInstanceKeyPaths({
        imodelAccess,
        label: "Test",
        viewType,
        idsCache,
        abortSignal: abortController1.signal,
      });
      abortController1.abort();
      expect(await pathsPromiseAborted).to.deep.eq([]);

      const abortController2 = new AbortController();
      const pathsPromise = CategoriesTreeDefinition.createInstanceKeyPaths({
        imodelAccess,
        label: "Test",
        viewType,
        idsCache,
        abortSignal: abortController2.signal,
      });
      expect(await pathsPromise).to.deep.eq([
        { path: [{ className: "BisCore.DefinitionContainer", id: ids.definitionContainer.id }], options: { autoExpand: true } },
      ]);
    });

    it("finds definition container by label when it is contained by another definition container", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const definitionContainerChild = insertDefinitionContainer({
          imodel,
          codeValue: "DefinitionContainerChild",
          userLabel: "Test",
          modelId: definitionModel.id,
        });
        const definitionModelChild = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ imodel, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer, definitionContainerChild };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      const viewType = "3d";
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);
      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "Test",
          viewType,
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.definitionContainer, keys.definitionContainerChild], options: { autoExpand: true } }]);
    });

    it("does not find definition container by label when it doesn't contain categories", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "DefinitionContainer", userLabel: "Test" });
        insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ imodel, codeValue: "SpatialCategory" });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });
      });
      const { imodelConnection } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      const viewType = "3d";
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);
      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "Test",
          viewType,
          idsCache,
        }),
      ).to.deep.eq([]);
    });

    it("finds category by label when it is contained by definition container", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ imodel, codeValue: "SpatialCategory", userLabel: "Test", modelId: definitionModel.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer, category };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      const viewType = "3d";
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);
      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "Test",
          viewType,
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.definitionContainer, keys.category], options: { autoExpand: true } }]);
    });

    it("finds subCategory by label when its parent category is contained by definition container", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ imodel, codeValue: "SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });
        const subCategory1 = insertSubCategory({ imodel, codeValue: "SubCategory1", parentCategoryId: category.id, modelId: definitionModel.id });

        return { definitionContainer, category, subCategory1 };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      const viewType = "3d";
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);
      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "SubCategory1",
          viewType,
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.definitionContainer, keys.category, keys.subCategory1], options: { autoExpand: true } }]);
    });

    it("finds 3d categories by label containing special SQLite characters", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });

        const category1 = insertSpatialCategory({ imodel, codeValue: "Test SpatialCat_egory" });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category1.id });

        const category2 = insertSpatialCategory({ imodel, codeValue: "Test SpatialCat%egory" });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category2.id });

        return { category1, category2 };
      });

      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      const viewType = "3d";
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "_",
          viewType: "3d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category1], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "%",
          viewType: "3d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category2], options: { autoExpand: true } }]);
    });

    it("finds 3d subcategories by label containing special SQLite characters", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });

        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        const subCategory1 = insertSubCategory({ imodel, parentCategoryId: category.id, codeValue: "SubCat_egory1" });
        const subCategory2 = insertSubCategory({ imodel, parentCategoryId: category.id, codeValue: "SubCat%egory2" });

        return { category, subCategory1, subCategory2 };
      });

      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      const viewType = "3d";
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "_",
          viewType: "3d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category, keys.subCategory1], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "%",
          viewType: "3d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category, keys.subCategory2], options: { autoExpand: true } }]);
    });

    it("finds 3d categories by label when subCategory count is 1 and labels of category and subCategory differ", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        // SubCategory gets inserted by default
        const category = insertSpatialCategory({ imodel, codeValue: "SpatialCategory", userLabel: "Test" });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { category };
      });

      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      const viewType = "3d";
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "Test",
          viewType: "3d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "SpatialCategory",
          viewType: "3d",
          idsCache,
        }),
      ).to.deep.eq([]);
    });

    it("finds 3d categories and subCategories by label when subCategory count is > 1", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });

        const category = insertSpatialCategory({ imodel, codeValue: "SpatialCategory", userLabel: "Test" });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        const subCategory1 = insertSubCategory({ imodel, codeValue: "SubCategory1", parentCategoryId: category.id });

        const subCategory2 = insertSubCategory({ imodel, codeValue: "SubCategory2", parentCategoryId: category.id });

        return { category, subCategory1, subCategory2 };
      });

      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      const viewType = "3d";
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "Test",
          viewType: "3d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "SubCategory1",
          viewType: "3d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category, keys.subCategory1], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "SubCategory2",
          viewType: "3d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category, keys.subCategory2], options: { autoExpand: true } }]);
    });

    it("finds 2d categories by label containing special SQLite characters", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const drawingModel = insertDrawingModelWithPartition({ imodel, codeValue: "TestDrawingModel" });

        const category1 = insertDrawingCategory({ imodel, codeValue: "Test Drawing Cat_egory" });
        insertDrawingGraphic({ imodel, modelId: drawingModel.id, categoryId: category1.id });

        const category2 = insertDrawingCategory({ imodel, codeValue: "Test Drawing Cat%egory" });
        insertDrawingGraphic({ imodel, modelId: drawingModel.id, categoryId: category2.id });

        return { category1, category2 };
      });

      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      const viewType = "2d";
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "_",
          viewType: "2d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category1], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "%",
          viewType: "2d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category2], options: { autoExpand: true } }]);
    });

    it("finds 2d subcategories by label containing special SQLite characters", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const drawingModel = insertDrawingModelWithPartition({ imodel, codeValue: "TestDrawingModel" });

        const category = insertDrawingCategory({ imodel, codeValue: "Test Drawing Category" });
        insertDrawingGraphic({ imodel, modelId: drawingModel.id, categoryId: category.id });

        const subCategory1 = insertSubCategory({ imodel, parentCategoryId: category.id, codeValue: "Test Drawing SubCat_egory" });
        const subCategory2 = insertSubCategory({ imodel, parentCategoryId: category.id, codeValue: "Test Drawing SubCat%egory" });

        return { category, subCategory1, subCategory2 };
      });

      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      const viewType = "2d";
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "_",
          viewType: "2d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category, keys.subCategory1], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "%",
          viewType: "2d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category, keys.subCategory2], options: { autoExpand: true } }]);
    });
  });
});
