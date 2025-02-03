/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { CategoriesTreeIdsCache } from "../../../../tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeIdsCache.js";
import {
  buildIModel,
  insertDefinitionContainer,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
  insertSubCategory,
  insertSubModel,
} from "../../../IModelUtils.js";
import { createIModelAccess } from "../../Common.js";

describe("CategoriesTreeIdsCache", () => {
  before(async function () {
    await initializePresentationTesting({
      backendProps: {
        caching: {
          hierarchies: {
            mode: HierarchyCacheMode.Memory,
          },
        },
      },
      rpcs: [SnapshotIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
    });
    // eslint-disable-next-line @itwin/no-internal
    ECSchemaRpcImpl.register();
  });

  after(async function () {
    await terminatePresentationTesting();
  });

  describe("getDirectChildDefinitionContainersAndCategories", () => {
    it("when definitionContainer contains nothing", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getDirectChildDefinitionContainersAndCategories([keys.definitionContainer.id])).to.deep.eq({
        categories: [],
        definitionContainers: [],
      });
    });

    it("when definitionContainer contains definitionContainer", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        return { definitionContainerRoot };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getDirectChildDefinitionContainersAndCategories([keys.definitionContainerRoot.id])).to.deep.eq({
        categories: [],
        definitionContainers: [],
      });
    });

    it("when definitionContainer contains definitionContainer, that has categories", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, definitionContainerChild };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getDirectChildDefinitionContainersAndCategories([keys.definitionContainerRoot.id])).to.deep.eq({
        categories: [],
        definitionContainers: [keys.definitionContainerChild.id],
      });
    });

    it("when definitionContainer contains categories", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, category };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getDirectChildDefinitionContainersAndCategories([keys.definitionContainerRoot.id])).to.deep.eq({
        categories: [keys.category.id],
        definitionContainers: [],
      });
    });

    it("when definitionContainer contains categories and definitionContainers that contain nothing", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, category };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getDirectChildDefinitionContainersAndCategories([keys.definitionContainerRoot.id])).to.deep.eq({
        categories: [keys.category.id],
        definitionContainers: [],
      });
    });

    it("when definitionContainer contains categories and definitionContainers that contain categories", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const directCategory = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: directCategory.id });

        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const indirectCategory = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });

        return { definitionContainerRoot, directCategory, definitionModelChild };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getDirectChildDefinitionContainersAndCategories([keys.definitionContainerRoot.id])).to.deep.eq({
        categories: [keys.directCategory.id],
        definitionContainers: [keys.definitionModelChild.id],
      });
    });

    it("when definitionContainer with categories is contained by definitionContainer", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const indirectCategory = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });

        return { definitionModelChild, indirectCategory };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getDirectChildDefinitionContainersAndCategories([keys.definitionModelChild.id])).to.deep.eq({
        categories: [keys.indirectCategory.id],
        definitionContainers: [],
      });
    });
  });

  describe("getAllContainedCategories", () => {
    it("when definitionContainer contains nothing", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });

        return { definitionContainer };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getAllContainedCategories([keys.definitionContainer.id])).to.deep.eq([]);
    });

    it("when definitionContainer contains definitionContainer that has categories", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, category };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getAllContainedCategories([keys.definitionContainerRoot.id])).to.deep.eq([keys.category.id]);
    });

    it("when definitionContainer contains categories", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer, category };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getAllContainedCategories([keys.definitionContainer.id])).to.deep.eq([keys.category.id]);
    });

    it("when definitionContainer contains categories and definitionContainers that contain categories", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const directCategory = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: directCategory.id });

        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const indirectCategory = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });

        return { definitionContainerRoot, directCategory, indirectCategory };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      const result = await idsCache.getAllContainedCategories([keys.definitionContainerRoot.id]);
      const expectedResult = [keys.indirectCategory.id, keys.directCategory.id];
      expect(result.every((id) => expectedResult.includes(id))).to.be.true;
    });
  });

  describe("getInstanceKeyPaths", () => {
    describe("from subCategory", () => {
      it("when subcategory doesn't exist", async function () {
        const { imodel } = await buildIModel(this, async (builder) => {
          insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        });
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
        expect(await idsCache.getInstanceKeyPaths({ subCategoryId: "0x123" })).to.deep.eq([]);
      });

      it("with category > subCategory hierarchy", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

          const subCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Test SpatialSubCategory" });
          return { subCategory, category };
        });
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
        expect(await idsCache.getInstanceKeyPaths({ subCategoryId: keys.subCategory.id })).to.deep.eq([keys.category, keys.subCategory]);
      });

      it("with definitionContainer > category > subCategory hierarchy", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
          const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
          const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

          const subCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Test SpatialSubCategory", modelId: definitionModel.id });
          return { subCategory, category, definitionContainer };
        });
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
        expect(await idsCache.getInstanceKeyPaths({ subCategoryId: keys.subCategory.id })).to.deep.eq([
          keys.definitionContainer,
          keys.category,
          keys.subCategory,
        ]);
      });

      it("with definitionContainer > definitionContainer > category > subCategory hierarchy", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
          const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "Test SpatialSubCategory",
            modelId: definitionModelChild.id,
          });
          return { subCategory, category, definitionContainerChild, definitionContainerRoot };
        });
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
        expect(await idsCache.getInstanceKeyPaths({ subCategoryId: keys.subCategory.id })).to.deep.eq([
          keys.definitionContainerRoot,
          keys.definitionContainerChild,
          keys.category,
          keys.subCategory,
        ]);
      });
    });

    describe("from category", () => {
      it("when category doesn't exist", async function () {
        const { imodel } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        });
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
        expect(await idsCache.getInstanceKeyPaths({ categoryId: "0x123" })).to.deep.eq([]);
      });

      it("with only category in hierarchy", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

          return { category };
        });
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
        expect(await idsCache.getInstanceKeyPaths({ categoryId: keys.category.id })).to.deep.eq([keys.category]);
      });

      it("with definitionContainer > category hierarchy", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
          const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
          const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

          return { category, definitionContainer };
        });
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
        expect(await idsCache.getInstanceKeyPaths({ categoryId: keys.category.id })).to.deep.eq([keys.definitionContainer, keys.category]);
      });

      it("with definitionContainer > definitionContainer > category hierarchy", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
          const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

          return { category, definitionContainerChild, definitionContainerRoot };
        });
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
        expect(await idsCache.getInstanceKeyPaths({ categoryId: keys.category.id })).to.deep.eq([
          keys.definitionContainerRoot,
          keys.definitionContainerChild,
          keys.category,
        ]);
      });
    });

    describe("from definitionContainer", () => {
      it("when definitionContainer doesn't exist", async function () {
        const { imodel } = await buildIModel(this, async (builder) => {
          insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        });
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
        expect(await idsCache.getInstanceKeyPaths({ definitionContainerId: "0x123" })).to.deep.eq([]);
      });

      it("when only a single definitionContainer exists", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
          const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
          const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

          return { category, definitionContainer };
        });
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
        expect(await idsCache.getInstanceKeyPaths({ definitionContainerId: keys.definitionContainer.id })).to.deep.eq([keys.definitionContainer]);
      });

      it("with definitionContainer > definitionContainer hierarchy", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
          const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

          return { category, definitionContainerChild, definitionContainerRoot };
        });
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
        expect(await idsCache.getInstanceKeyPaths({ definitionContainerId: keys.definitionContainerChild.id })).to.deep.eq([
          keys.definitionContainerRoot,
          keys.definitionContainerChild,
        ]);
      });
    });
  });

  describe("getAllDefinitionContainersAndCategories", () => {
    it("hierarchy without categories or definitionContainers", async function () {
      const { imodel } = await buildIModel(this, async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getAllDefinitionContainersAndCategories()).to.deep.eq({ categories: [], definitionContainers: [] });
    });

    it("with category and empty definitionContainer", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { category };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getAllDefinitionContainersAndCategories()).to.deep.eq({
        categories: [keys.category.id],
        definitionContainers: [],
      });
    });

    it("with category and definitionContainers (that dont contain categories)", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { category };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getAllDefinitionContainersAndCategories()).to.deep.eq({
        categories: [keys.category.id],
        definitionContainers: [],
      });
    });

    it("with definitionContainer that contains definitionContainer that contains categories", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, definitionContainerChild, category };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      const result = await idsCache.getAllDefinitionContainersAndCategories();
      const expectedResult = {
        categories: [keys.category.id],
        definitionContainers: [keys.definitionContainerRoot.id, keys.definitionContainerChild.id],
      };
      expect(result.categories).to.deep.eq(expectedResult.categories);
      expect(result.definitionContainers.every((dc) => expectedResult.definitionContainers.includes(dc))).to.be.true;
    });

    it("with definitionContainer that contains category", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, category };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getAllDefinitionContainersAndCategories()).to.deep.eq({
        categories: [keys.category.id],
        definitionContainers: [keys.definitionContainerRoot.id],
      });
    });

    it("with definitionContainer that contains category and definitionContainer that doesn't contain category", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, category };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getAllDefinitionContainersAndCategories()).to.deep.eq({
        categories: [keys.category.id],
        definitionContainers: [keys.definitionContainerRoot.id],
      });
    });

    it("with definitionContainer that contains categories and definitionContainers that contain categories", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const directCategory = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: directCategory.id });

        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const indirectCategory = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });

        return { definitionContainerRoot, directCategory, definitionModelChild, indirectCategory };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      const result = await idsCache.getAllDefinitionContainersAndCategories();
      const expectedResult = {
        categories: [keys.directCategory.id, keys.indirectCategory.id],
        definitionContainers: [keys.definitionModelChild.id, keys.definitionContainerRoot.id],
      };
      expect(result.categories.every((c) => expectedResult.categories.includes(c))).to.be.true;
      expect(result.definitionContainers.every((dc) => expectedResult.definitionContainers.includes(dc))).to.be.true;
    });
  });

  describe("getRootDefinitionContainersAndCategories", () => {
    it("hierarchy without categories or definitionContainers", async function () {
      const { imodel } = await buildIModel(this, async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getRootDefinitionContainersAndCategories()).to.deep.eq({ categories: [], definitionContainers: [] });
    });

    it("with category and definitionContainer that doesn't contain anything", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { category };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getRootDefinitionContainersAndCategories()).to.deep.eq({
        categories: [keys.category.id],
        definitionContainers: [],
      });
    });

    it("with category and definitionContainers that contains definitionContainer that doesn't contain categories", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { category };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getRootDefinitionContainersAndCategories()).to.deep.eq({
        categories: [keys.category.id],
        definitionContainers: [],
      });
    });

    it("with definitionContainer that contains definitionContainer that contains categories", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getRootDefinitionContainersAndCategories()).to.deep.eq({
        categories: [],
        definitionContainers: [keys.definitionContainerRoot.id],
      });
    });

    it("with definitionContainer that containts category", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getRootDefinitionContainersAndCategories()).to.deep.eq({
        categories: [],
        definitionContainers: [keys.definitionContainerRoot.id],
      });
    });

    it("with definitionContainers and categories", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

        const definitionContainerRootNoChildren = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainerNoChild" });
        insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRootNoChildren.id });

        const definitionContainerRoot2 = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer2" });
        const definitionModelRoot2 = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot2.id });

        const rootCategory1 = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: rootCategory1.id });
        const rootCategory2 = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory2" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: rootCategory2.id });

        const childCategory = insertSpatialCategory({ builder, codeValue: "Test SpatialCategoryChild", modelId: definitionModelRoot.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: childCategory.id });
        const childCategory2 = insertSpatialCategory({ builder, codeValue: "Test SpatialCategoryChild2", modelId: definitionModelRoot2.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: childCategory2.id });

        return { definitionContainerRoot, rootCategory1, definitionContainerRoot2, rootCategory2 };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      const result = await idsCache.getRootDefinitionContainersAndCategories();
      const expectedResult = {
        categories: [keys.rootCategory1.id, keys.rootCategory2.id],
        definitionContainers: [keys.definitionContainerRoot.id, keys.definitionContainerRoot2.id],
      };
      expect(result.categories.every((c) => expectedResult.categories.includes(c))).to.be.true;
      expect(result.definitionContainers.every((dc) => expectedResult.definitionContainers.includes(dc))).to.be.true;
    });
  });

  describe("getSubCategories", () => {
    it("when category doesn't exist", async function () {
      const { imodel } = await buildIModel(this, async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getSubCategories("0x123")).to.deep.eq([]);
    });

    it("when category has one subCategory", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        return { category };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getSubCategories(keys.category.id)).to.deep.eq([]);
    });

    it("when category has multiple subCategories", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        const subCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "subc 1" });

        return { subCategory, category };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      const result = await idsCache.getSubCategories(keys.category.id);
      expect(result.includes(keys.subCategory.id)).to.be.true;
      expect(result.length).to.be.eq(2);
    });

    it("when multiple categories have multiple subCategories", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "subc 1" });

        const category2 = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory2" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
        const subCategory2 = insertSubCategory({ builder, parentCategoryId: category2.id, codeValue: "subc 2" });

        return { subCategory2, category2 };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      const result = await idsCache.getSubCategories(keys.category2.id);
      expect(result.includes(keys.subCategory2.id)).to.be.true;
      expect(result.length).to.be.eq(2);
    });
  });
});
