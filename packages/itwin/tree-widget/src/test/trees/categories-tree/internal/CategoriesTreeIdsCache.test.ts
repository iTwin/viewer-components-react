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
    it("retruns empty list when definition container contains nothing", async function () {
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

    it("returns empty lists when definition container contains empty definition container", async function () {
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

    it("returns child definition container when definition container contains definition container, that has categories", async function () {
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

    it("returns child categories when definition container contains categories", async function () {
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

    it("returns only categories when definition container contains categories and definition containers that contain nothing", async function () {
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

    it("returns child definition container and category when definition container contains categories and definition containers that contain categories", async function () {
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

    it("returns child categories when definition container with categories is contained by definition container", async function () {
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
    it("returns empty list when definition container contains nothing", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });

        return { definitionContainer };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getAllContainedCategories([keys.definitionContainer.id])).to.deep.eq([]);
    });

    it("returns indirectly contained categories when definition container contains definition container that has categories", async function () {
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

    it("returns child categories when definition container contains categories", async function () {
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

    it("returns direct and indirect categories when definition container contains categories and definition containers that contain categories", async function () {
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
      expect(expectedResult.every((id) => result.includes(id))).to.be.true;
    });
  });

  describe("getInstanceKeyPaths", () => {
    describe("from subCategory id", () => {
      it("returns empty list when subcategory doesn't exist", async function () {
        const { imodel } = await buildIModel(this, async (builder) => {
          insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        });
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
        expect(await idsCache.getInstanceKeyPaths({ subCategoryId: "0x123" })).to.deep.eq([]);
      });

      it("returns path to subCategory when category has subCategory", async function () {
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

      it("returns path to subCategory when definition container contains category that has subCategory", async function () {
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

      it("returns path to subCategory when definition container contains definition container that contains category that has subCategory", async function () {
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

    describe("from category id", () => {
      it("returns empty list when category doesn't exist", async function () {
        const { imodel } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        });
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
        expect(await idsCache.getInstanceKeyPaths({ categoryId: "0x123" })).to.deep.eq([]);
      });

      it("returns only category when only category exists", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

          return { category };
        });
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
        expect(await idsCache.getInstanceKeyPaths({ categoryId: keys.category.id })).to.deep.eq([keys.category]);
      });

      it("returns path to category when definition container contains category", async function () {
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

      it("returns path to category when definition container contains definition container that contains category", async function () {
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

    describe("from definition container id", () => {
      it("returns empty list when definition container doesn't exist", async function () {
        const { imodel } = await buildIModel(this, async (builder) => {
          insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        });
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
        expect(await idsCache.getInstanceKeyPaths({ definitionContainerId: "0x123" })).to.deep.eq([]);
      });

      it("returns definition container when definition container contains category", async function () {
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

      it("returns path to definition container when definition container is contained by definition container", async function () {
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
    it("returns empty list when no categories or definition containers exist", async function () {
      const { imodel } = await buildIModel(this, async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getAllDefinitionContainersAndCategories()).to.deep.eq({ categories: [], definitionContainers: [] });
    });

    it("returns category when only category and empty definition container exist", async function () {
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

    it("returns category when category and definition containers (that dont contain categories) exist", async function () {
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

    it("returns both definition containers and their contained category when definition container contains definition container that contains categories", async function () {
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
      expect(expectedResult.definitionContainers.every((dc) => result.definitionContainers.includes(dc))).to.be.true;
    });

    it("returns definition container and category when definition container contains category", async function () {
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

    it("returns definition container and category when definition container contains category and definition container that doesn't contain category", async function () {
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

    it("returns both definition containers and categories when definition container contains categories and definition container that contain categories", async function () {
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
      expect(expectedResult.categories.every((c) => result.categories.includes(c))).to.be.true;
      expect(expectedResult.definitionContainers.every((dc) => result.definitionContainers.includes(dc))).to.be.true;
    });
  });

  describe("getRootDefinitionContainersAndCategories", () => {
    it("returns empty list when no categories or definition containers exist", async function () {
      const { imodel } = await buildIModel(this, async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getRootDefinitionContainersAndCategories()).to.deep.eq({ categories: [], definitionContainers: [] });
    });

    it("returns category when category and definition container that doesn't contain anything exist", async function () {
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

    it("returns category when category and definition container that contains empty definition container exist", async function () {
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

    it("returns only the root definition container when definition container contains definition container that contains categories", async function () {
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

    it("returns definition container when definition container containts category", async function () {
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

    it("returns root categories and definition containers when root categories and definition containers exist", async function () {
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
      expect(expectedResult.categories.every((c) => result.categories.includes(c))).to.be.true;
      expect(expectedResult.definitionContainers.every((dc) => result.definitionContainers.includes(dc))).to.be.true;
    });
  });

  describe("getSubCategories", () => {
    it("returns empty list when category doesn't exist", async function () {
      const { imodel } = await buildIModel(this, async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getSubCategories("0x123")).to.deep.eq([]);
    });

    it("returns empty list when category has one subCategory", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        return { category };
      });
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodel), "3d");
      expect(await idsCache.getSubCategories(keys.category.id)).to.deep.eq([]);
    });

    it("returns subCategories when category has multiple subCategories", async function () {
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

    it("returns only child subCategories when multiple categories have multiple subCategories", async function () {
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
