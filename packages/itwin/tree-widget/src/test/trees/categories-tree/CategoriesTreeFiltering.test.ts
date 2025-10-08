/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import {
  CategoriesTreeDefinition,
  defaultHierarchyConfiguration,
} from "../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeDefinition.js";
import { CategoriesTreeIdsCache } from "../../../tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeIdsCache.js";
import { CLASS_NAME_DefinitionModel } from "../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";
import {
  buildIModel,
  insertDefinitionContainer,
  insertDrawingCategory,
  insertDrawingGraphic,
  insertDrawingModelWithPartition,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
  insertSubCategory,
  insertSubModel,
} from "../../IModelUtils.js";
import { createIModelAccess } from "../Common.js";

// cspell:words egory
// cspell complains about Cat_egory and Cat%egory

describe("Categories tree", () => {
  describe("Hierarchy filtering", () => {
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
    });

    after(async function () {
      await terminatePresentationTesting();
    });

    it("finds definition container by label", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer", userLabel: "Test" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      const viewType = "3d";
      using idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);
      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "Test",
          viewType,
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.definitionContainer], options: { autoExpand: true } }]);
    });

    it("filtering by label aborts when abort signal fires", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer", userLabel: "Test" });
        const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        return { definitionContainer };
      });
      const { imodel, ...ids } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      const viewType = "3d";
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);

      const abortController1 = new AbortController();
      const pathsPromiseAborted = CategoriesTreeDefinition.createInstanceKeyPaths({
        imodelAccess,
        hierarchyConfig: defaultHierarchyConfiguration,
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
        hierarchyConfig: defaultHierarchyConfiguration,
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
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const definitionContainerChild = insertDefinitionContainer({
          builder,
          codeValue: "DefinitionContainerChild",
          userLabel: "Test",
          modelId: definitionModel.id,
        });
        const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer, definitionContainerChild };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      const viewType = "3d";
      using idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);
      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "Test",
          viewType,
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.definitionContainer, keys.definitionContainerChild], options: { autoExpand: true } }]);
    });

    it("does not find definition container by label when it doesn't contain categories", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer", userLabel: "Test" });
        insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
      });
      const { imodel } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      const viewType = "3d";
      using idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);
      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "Test",
          viewType,
          idsCache,
        }),
      ).to.deep.eq([]);
    });

    it("finds category by label when it is contained by definition container", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", userLabel: "Test", modelId: definitionModel.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer, category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      const viewType = "3d";
      using idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);
      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "Test",
          viewType,
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.definitionContainer, keys.category], options: { autoExpand: true } }]);
    });

    it("finds subCategory by label when its parent category is contained by definition container", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        const subCategory1 = insertSubCategory({ builder, codeValue: "SubCategory1", parentCategoryId: category.id, modelId: definitionModel.id });

        return { definitionContainer, category, subCategory1 };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      const viewType = "3d";
      using idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);
      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "SubCategory1",
          viewType,
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.definitionContainer, keys.category, keys.subCategory1], options: { autoExpand: true } }]);
    });

    it("finds 3d categories by label containing special SQLite characters", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

        const category1 = insertSpatialCategory({ builder, codeValue: "Test SpatialCat_egory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category1.id });

        const category2 = insertSpatialCategory({ builder, codeValue: "Test SpatialCat%egory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });

        return { category1, category2 };
      });

      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      const viewType = "3d";
      using idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "_",
          viewType: "3d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category1], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "%",
          viewType: "3d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category2], options: { autoExpand: true } }]);
    });

    it("finds 3d subcategories by label containing special SQLite characters", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        const subCategory1 = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "SubCat_egory1" });
        const subCategory2 = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "SubCat%egory2" });

        return { category, subCategory1, subCategory2 };
      });

      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      const viewType = "3d";
      using idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "_",
          viewType: "3d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category, keys.subCategory1], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "%",
          viewType: "3d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category, keys.subCategory2], options: { autoExpand: true } }]);
    });

    it("finds 3d categories by label when subCategory count is 1 and labels of category and subCategory differ", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        // SubCategory gets inserted by default
        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", userLabel: "Test" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { category };
      });

      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      const viewType = "3d";
      using idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "Test",
          viewType: "3d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "SpatialCategory",
          viewType: "3d",
          idsCache,
        }),
      ).to.deep.eq([]);
    });

    it("finds 3d categories and subCategories by label when subCategory count is > 1", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", userLabel: "Test" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        const subCategory1 = insertSubCategory({ builder, codeValue: "SubCategory1", parentCategoryId: category.id });

        const subCategory2 = insertSubCategory({ builder, codeValue: "SubCategory2", parentCategoryId: category.id });

        return { category, subCategory1, subCategory2 };
      });

      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      const viewType = "3d";
      using idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "Test",
          viewType: "3d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "SubCategory1",
          viewType: "3d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category, keys.subCategory1], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "SubCategory2",
          viewType: "3d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category, keys.subCategory2], options: { autoExpand: true } }]);
    });

    it("finds 2d categories by label containing special SQLite characters", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const drawingModel = insertDrawingModelWithPartition({ builder, codeValue: "TestDrawingModel" });

        const category1 = insertDrawingCategory({ builder, codeValue: "Test Drawing Cat_egory" });
        insertDrawingGraphic({ builder, modelId: drawingModel.id, categoryId: category1.id });

        const category2 = insertDrawingCategory({ builder, codeValue: "Test Drawing Cat%egory" });
        insertDrawingGraphic({ builder, modelId: drawingModel.id, categoryId: category2.id });

        return { category1, category2 };
      });

      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      const viewType = "2d";
      using idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "_",
          viewType: "2d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category1], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "%",
          viewType: "2d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category2], options: { autoExpand: true } }]);
    });

    it("finds 2d subcategories by label containing special SQLite characters", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const drawingModel = insertDrawingModelWithPartition({ builder, codeValue: "TestDrawingModel" });

        const category = insertDrawingCategory({ builder, codeValue: "Test Drawing Category" });
        insertDrawingGraphic({ builder, modelId: drawingModel.id, categoryId: category.id });

        const subCategory1 = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Test Drawing SubCat_egory" });
        const subCategory2 = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Test Drawing SubCat%egory" });

        return { category, subCategory1, subCategory2 };
      });

      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      const viewType = "2d";
      using idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "_",
          viewType: "2d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category, keys.subCategory1], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "%",
          viewType: "2d",
          idsCache,
        }),
      ).to.deep.eq([{ path: [keys.category, keys.subCategory2], options: { autoExpand: true } }]);
    });
  });
});
