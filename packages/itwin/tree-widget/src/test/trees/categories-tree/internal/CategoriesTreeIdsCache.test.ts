/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { firstValueFrom } from "rxjs";
import {
  HierarchyCacheMode,
  initializeCore,
  insertDefinitionContainer,
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
import { CategoriesTreeIdsCache } from "../../../../tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeIdsCache.js";
import { buildIModel } from "../../../IModelUtils.js";
import { createIModelAccess } from "../../Common.js";

describe("CategoriesTreeIdsCache", () => {
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

  describe("getDirectChildDefinitionContainersAndCategories", () => {
    it("returns empty list when definition container contains nothing", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(
        await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionContainer.id] })),
      ).to.deep.eq({
        categories: [],
        definitionContainers: [],
      });
    });

    it("returns empty lists when definition container contains empty definition container", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        return { definitionContainerRoot };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(
        await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionContainerRoot.id] })),
      ).to.deep.eq({
        categories: [],
        definitionContainers: [],
      });
    });

    it("returns child definition container when definition container contains definition container, that has categories", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, definitionContainerChild };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(
        await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionContainerRoot.id] })),
      ).to.deep.eq({
        categories: [],
        definitionContainers: [keys.definitionContainerChild.id],
      });
    });

    it("returns child definition container when definition container contains definition container, that has empty categories and includeEmpty is true", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });

        return { definitionContainerRoot, definitionContainerChild };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(
        await firstValueFrom(
          idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionContainerRoot.id], includeEmpty: true }),
        ),
      ).to.deep.eq({
        categories: [],
        definitionContainers: [keys.definitionContainerChild.id],
      });
    });

    it("returns empty when definition container contains definition container, that has empty categories and includeEmpty is false", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });

        return { definitionContainerRoot, definitionContainerChild };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(
        await firstValueFrom(
          idsCache.getDirectChildDefinitionContainersAndCategories({
            parentDefinitionContainerIds: [keys.definitionContainerRoot.id],
            includeEmpty: false,
          }),
        ),
      ).to.deep.eq({
        categories: [],
        definitionContainers: [],
      });
    });

    it("returns child categories when definition container contains categories", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, category };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(
        await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionContainerRoot.id] })),
      ).to.deep.eq({
        categories: [{ id: keys.category.id, childCount: 1, hasElements: true }],
        definitionContainers: [],
      });
    });

    it("returns child categories when definition container contains empty categories and includeEmpty is true", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });

        return { definitionContainerRoot, category };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(
        await firstValueFrom(
          idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionContainerRoot.id], includeEmpty: true }),
        ),
      ).to.deep.eq({
        categories: [{ id: keys.category.id, childCount: 1, hasElements: false }],
        definitionContainers: [],
      });
    });

    it("returns empty when definition container contains empty categories", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });

        return { definitionContainerRoot, category };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(
        await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionContainerRoot.id] })),
      ).to.deep.eq({
        categories: [],
        definitionContainers: [],
      });
    });

    it("returns only categories when definition container contains categories and definition containers that contain nothing", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, category };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(
        await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionContainerRoot.id] })),
      ).to.deep.eq({
        categories: [{ id: keys.category.id, childCount: 1, hasElements: true }],
        definitionContainers: [],
      });
    });

    it("returns child definition container and category when definition container contains categories and definition containers that contain categories", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const directCategory = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: directCategory.id });

        const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const indirectCategory = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: indirectCategory.id });

        return { definitionContainerRoot, directCategory, definitionModelChild };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(
        await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionContainerRoot.id] })),
      ).to.deep.eq({
        categories: [{ id: keys.directCategory.id, childCount: 1, hasElements: true }],
        definitionContainers: [keys.definitionModelChild.id],
      });
    });

    it("returns child categories when definition container with categories is contained by definition container", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

        const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const indirectCategory = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: indirectCategory.id });

        return { definitionModelChild, indirectCategory };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(
        await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionModelChild.id] })),
      ).to.deep.eq({
        categories: [{ id: keys.indirectCategory.id, childCount: 1, hasElements: true }],
        definitionContainers: [],
      });
    });
  });

  describe("getAllContainedCategories", () => {
    it("returns empty list when definition container contains nothing", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });

        return { definitionContainer };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getAllContainedCategories({ definitionContainerIds: [keys.definitionContainer.id] }))).to.deep.eq(new Set());
    });

    it("returns empty list when definition container contains empty categories", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModel.id });

        return { definitionContainer };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getAllContainedCategories({ definitionContainerIds: [keys.definitionContainer.id] }))).to.deep.eq(new Set());
    });

    it("returns contained categories when definition container contains empty categories and includeEmptyCategories is true", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModel.id });

        return { definitionContainer, category };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(
        await firstValueFrom(idsCache.getAllContainedCategories({ definitionContainerIds: [keys.definitionContainer.id], includeEmptyCategories: true })),
      ).to.deep.eq(new Set([keys.category.id]));
    });

    it("returns indirectly contained categories when definition container contains definition container that has categories", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, category };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getAllContainedCategories({ definitionContainerIds: [keys.definitionContainerRoot.id] }))).to.deep.eq(
        new Set([keys.category.id]),
      );
    });

    it("returns child categories when definition container contains categories", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer, category };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getAllContainedCategories({ definitionContainerIds: [keys.definitionContainer.id] }))).to.deep.eq(
        new Set([keys.category.id]),
      );
    });

    it("returns direct and indirect categories when definition container contains categories and definition containers that contain categories", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const directCategory = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: directCategory.id });

        const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const indirectCategory = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: indirectCategory.id });

        return { definitionContainerRoot, directCategory, indirectCategory };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      const result = await firstValueFrom(idsCache.getAllContainedCategories({ definitionContainerIds: [keys.definitionContainerRoot.id] }));
      const expectedResult = [keys.indirectCategory.id, keys.directCategory.id];
      expect(expectedResult.every((id) => result.has(id))).to.be.true;
    });
  });

  describe("getInstanceKeyPaths", () => {
    describe("from subCategory id", () => {
      it("returns empty list when subcategory doesn't exist", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        });
        const { imodelConnection } = buildIModelResult;
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
        expect(await firstValueFrom(idsCache.getInstanceKeyPaths({ subCategoryId: "0x123" }))).to.deep.eq([]);
      });

      it("returns path to subCategory when category has subCategory", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
          const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" });
          insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

          const subCategory = insertSubCategory({ imodel, parentCategoryId: category.id, codeValue: "Test SpatialSubCategory" });
          return { subCategory, category };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
        expect(await firstValueFrom(idsCache.getInstanceKeyPaths({ subCategoryId: keys.subCategory.id }))).to.deep.eq([keys.category, keys.subCategory]);
      });

      it("returns path to subCategory when definition container contains category that has subCategory", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
          const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
          const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
          const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
          insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

          const subCategory = insertSubCategory({ imodel, parentCategoryId: category.id, codeValue: "Test SpatialSubCategory", modelId: definitionModel.id });
          return { subCategory, category, definitionContainer };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
        expect(await firstValueFrom(idsCache.getInstanceKeyPaths({ subCategoryId: keys.subCategory.id }))).to.deep.eq([
          keys.definitionContainer,
          keys.category,
          keys.subCategory,
        ]);
      });

      it("returns path to subCategory when definition container contains definition container that contains category that has subCategory", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
          const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
          const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
          const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

          const subCategory = insertSubCategory({
            imodel,
            parentCategoryId: category.id,
            codeValue: "Test SpatialSubCategory",
            modelId: definitionModelChild.id,
          });
          return { subCategory, category, definitionContainerChild, definitionContainerRoot };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
        expect(await firstValueFrom(idsCache.getInstanceKeyPaths({ subCategoryId: keys.subCategory.id }))).to.deep.eq([
          keys.definitionContainerRoot,
          keys.definitionContainerChild,
          keys.category,
          keys.subCategory,
        ]);
      });
    });

    describe("from category id", () => {
      it("returns empty list when category doesn't exist", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
          const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" });
          insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });
        });
        const { imodelConnection } = buildIModelResult;
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
        expect(await firstValueFrom(idsCache.getInstanceKeyPaths({ categoryId: "0x123" }))).to.deep.eq([]);
      });

      it("returns only category when only category exists", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
          const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" });
          insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

          return { category };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
        expect(await firstValueFrom(idsCache.getInstanceKeyPaths({ categoryId: keys.category.id }))).to.deep.eq([keys.category]);
      });

      it("returns path to category when definition container contains category", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
          const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
          const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
          const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
          insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

          return { category, definitionContainer };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
        expect(await firstValueFrom(idsCache.getInstanceKeyPaths({ categoryId: keys.category.id }))).to.deep.eq([keys.definitionContainer, keys.category]);
      });

      it("returns path to category when definition container contains definition container that contains category", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
          const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
          const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
          const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

          return { category, definitionContainerChild, definitionContainerRoot };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
        expect(await firstValueFrom(idsCache.getInstanceKeyPaths({ categoryId: keys.category.id }))).to.deep.eq([
          keys.definitionContainerRoot,
          keys.definitionContainerChild,
          keys.category,
        ]);
      });
    });

    describe("from definition container id", () => {
      it("returns empty list when definition container doesn't exist", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        });
        const { imodelConnection } = buildIModelResult;
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
        expect(await firstValueFrom(idsCache.getInstanceKeyPaths({ definitionContainerId: "0x123" }))).to.deep.eq([]);
      });

      it("returns definition container when definition container contains category", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
          const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
          const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
          const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
          insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

          return { category, definitionContainer };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
        expect(await firstValueFrom(idsCache.getInstanceKeyPaths({ definitionContainerId: keys.definitionContainer.id }))).to.deep.eq([
          keys.definitionContainer,
        ]);
      });

      it("returns path to definition container when definition container is contained by definition container", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
          const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
          const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
          const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

          return { category, definitionContainerChild, definitionContainerRoot };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
        expect(await firstValueFrom(idsCache.getInstanceKeyPaths({ definitionContainerId: keys.definitionContainerChild.id }))).to.deep.eq([
          keys.definitionContainerRoot,
          keys.definitionContainerChild,
        ]);
      });
    });
  });

  describe("getAllDefinitionContainersAndCategories", () => {
    it("returns empty list when no categories or definition containers exist", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
      });
      const { imodelConnection } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories())).to.deep.eq({ categories: [], definitionContainers: [] });
    });

    it("returns empty list when only empty categories exist", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
      });
      const { imodelConnection } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories())).to.deep.eq({ categories: [], definitionContainers: [] });
    });

    it("returns empty categories and their definitionContainers when includeEmpty is set to true", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
        return { category, definitionContainer };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories({ includeEmpty: true }))).to.deep.eq({
        categories: [keys.category.id],
        definitionContainers: [keys.definitionContainer.id],
      });
    });

    it("returns category when only category and empty definition container exist", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { category };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories())).to.deep.eq({
        categories: [keys.category.id],
        definitionContainers: [],
      });
    });

    it("returns category when category and definition containers (that don't contain categories) exist", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { category };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories())).to.deep.eq({
        categories: [keys.category.id],
        definitionContainers: [],
      });
    });

    it("returns both definition containers and their contained category when definition container contains definition container that contains categories", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, definitionContainerChild, category };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      const result = await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories());
      const expectedResult = {
        categories: [keys.category.id],
        definitionContainers: [keys.definitionContainerRoot.id, keys.definitionContainerChild.id],
      };
      expect(result.categories).to.deep.eq(expectedResult.categories);
      expect(expectedResult.definitionContainers.every((dc) => result.definitionContainers.includes(dc))).to.be.true;
    });

    it("returns definition container and category when definition container contains category", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, category };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories())).to.deep.eq({
        categories: [keys.category.id],
        definitionContainers: [keys.definitionContainerRoot.id],
      });
    });

    it("returns definition container and category when definition container contains category and definition container that doesn't contain category", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, category };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories())).to.deep.eq({
        categories: [keys.category.id],
        definitionContainers: [keys.definitionContainerRoot.id],
      });
    });

    it("returns both definition containers and categories when definition container contains categories and definition container that contain categories", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const directCategory = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: directCategory.id });

        const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const indirectCategory = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: indirectCategory.id });

        return { definitionContainerRoot, directCategory, definitionModelChild, indirectCategory };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      const result = await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories());
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
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
      });
      const { imodelConnection } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories())).to.deep.eq({ categories: [], definitionContainers: [] });
    });

    it("returns empty list when only empty categories exist", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
        insertSpatialCategory({ imodel, codeValue: "Root SpatialCategory" });
      });
      const { imodelConnection } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories())).to.deep.eq({
        categories: [],
        definitionContainers: [],
      });
    });

    it("returns category when only empty categories exist and includeEmpty is set to true", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
        const rootCategory = insertSpatialCategory({ imodel, codeValue: "Root SpatialCategory" });
        return { definitionContainer, rootCategory };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories({ includeEmpty: true }))).to.deep.eq({
        categories: [{ id: keys.rootCategory.id, childCount: 1, hasElements: false }],
        definitionContainers: [keys.definitionContainer.id],
      });
    });

    it("returns category when category and definition container that doesn't contain anything exist", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { category };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories())).to.deep.eq({
        categories: [{ id: keys.category.id, childCount: 1, hasElements: true }],
        definitionContainers: [],
      });
    });

    it("returns category when category and definition container that contains empty definition container exist", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { category };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories())).to.deep.eq({
        categories: [{ id: keys.category.id, childCount: 1, hasElements: true }],
        definitionContainers: [],
      });
    });

    it("returns only the root definition container when definition container contains definition container that contains categories", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories())).to.deep.eq({
        categories: [],
        definitionContainers: [keys.definitionContainerRoot.id],
      });
    });

    it("returns definition container when definition container contains category", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories())).to.deep.eq({
        categories: [],
        definitionContainers: [keys.definitionContainerRoot.id],
      });
    });

    it("returns root categories and definition containers when root categories and definition containers exist", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

        const definitionContainerRootNoChildren = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainerNoChild" });
        insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRootNoChildren.id });

        const definitionContainerRoot2 = insertDefinitionContainer({ imodel, codeValue: "Test DefinitionContainer2" });
        const definitionModelRoot2 = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot2.id });

        const rootCategory1 = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: rootCategory1.id });
        const rootCategory2 = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory2" });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: rootCategory2.id });

        const childCategory = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategoryChild", modelId: definitionModelRoot.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: childCategory.id });
        const childCategory2 = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategoryChild2", modelId: definitionModelRoot2.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: childCategory2.id });

        return { definitionContainerRoot, rootCategory1, definitionContainerRoot2, rootCategory2 };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      const result = await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories());
      const expectedResult = {
        categories: [
          { id: keys.rootCategory1.id, childCount: 1, hasElements: true },
          { id: keys.rootCategory2.id, childCount: 1, hasElements: true },
        ],
        definitionContainers: [keys.definitionContainerRoot.id, keys.definitionContainerRoot2.id],
      };
      expect(
        expectedResult.categories.every((expectedCategory) =>
          result.categories.find((category) => category.id === expectedCategory.id && category.childCount === expectedCategory.childCount),
        ),
      ).to.be.true;
      expect(expectedResult.definitionContainers.every((dc) => result.definitionContainers.includes(dc))).to.be.true;
    });
  });

  describe("getSubCategories", () => {
    it("returns empty list when category doesn't exist", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
      });
      const { imodelConnection } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getSubCategories("0x123"))).to.deep.eq(new Set());
    });

    it("returns empty list when category has one subCategory", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });
        return { category };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      expect(await firstValueFrom(idsCache.getSubCategories(keys.category.id))).to.deep.eq(new Set());
    });

    it("returns subCategories when category has multiple subCategories", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });
        const subCategory = insertSubCategory({ imodel, parentCategoryId: category.id, codeValue: "subC 1" });

        return { subCategory, category };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      const result = await firstValueFrom(idsCache.getSubCategories(keys.category.id));
      expect(result.has(keys.subCategory.id)).to.be.true;
      expect(result.size).to.be.eq(2);
    });

    it("returns only child subCategories when multiple categories have multiple subCategories", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });
        insertSubCategory({ imodel, parentCategoryId: category.id, codeValue: "subC 1" });

        const category2 = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory2" });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category2.id });
        const subCategory2 = insertSubCategory({ imodel, parentCategoryId: category2.id, codeValue: "subC 2" });

        return { subCategory2, category2 };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      const idsCache = new CategoriesTreeIdsCache(createIModelAccess(imodelConnection), "3d");
      const result = await firstValueFrom(idsCache.getSubCategories(keys.category2.id));
      expect(result.has(keys.subCategory2.id)).to.be.true;
      expect(result.size).to.be.eq(2);
    });
  });
});
