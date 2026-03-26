/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom, toArray } from "rxjs";
import { IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { CategoriesTreeIdsCache } from "../../../../tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeIdsCache.js";
import { BaseIdsCache } from "../../../../tree-widget-react/components/trees/common/internal/caches/BaseIdsCache.js";
import { getClassesByView } from "../../../../tree-widget-react/components/trees/common/internal/Utils.js";
import {
  buildIModel,
  insertDefinitionContainer,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertPhysicalSubModel,
  insertSpatialCategory,
  insertSubCategory,
  insertSubModel,
} from "../../../IModelUtils.js";
import { createIModelAccess } from "../../Common.js";
import { CLASS_NAME_DefinitionModel, getDefaultSubCategoryId } from "../../TreeUtils.js";

describe("CategoriesTreeIdsCache", () => {
  beforeAll(async () => {
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
  });

  afterAll(async () => {
    await terminatePresentationTesting();
  });

  describe("getDirectChildDefinitionContainersAndCategories", () => {
    it("returns empty list when definition container contains nothing", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(
        await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionContainer.id] })),
      ).toEqual({
        categories: [],
        definitionContainers: [],
      });
    });

    it("returns empty lists when definition container contains empty definition container", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
        return { definitionContainerRoot };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(
        await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionContainerRoot.id] })),
      ).toEqual({
        categories: [],
        definitionContainers: [],
      });
    });

    it("returns child definition container when definition container contains definition container, that has categories", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, definitionContainerChild };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(
        await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionContainerRoot.id] })),
      ).toEqual({
        categories: [],
        definitionContainers: [keys.definitionContainerChild.id],
      });
    });

    it("returns child definition container when definition container contains definition container, that has empty categories and includeEmpty is true", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });

        return { definitionContainerRoot, definitionContainerChild };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(
        await firstValueFrom(
          idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionContainerRoot.id], includeEmpty: true }),
        ),
      ).toEqual({
        categories: [],
        definitionContainers: [keys.definitionContainerChild.id],
      });
    });

    it("returns empty when definition container contains definition container, that has empty categories and includeEmpty is false", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
        insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });

        return { definitionContainerRoot, definitionContainerChild };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(
        await firstValueFrom(
          idsCache.getDirectChildDefinitionContainersAndCategories({
            parentDefinitionContainerIds: [keys.definitionContainerRoot.id],
            includeEmpty: false,
          }),
        ),
      ).toEqual({
        categories: [],
        definitionContainers: [],
      });
    });

    it("returns child categories when definition container contains categories", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(
        await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionContainerRoot.id] })),
      ).toEqual({
        categories: [{ id: keys.category.id, subCategoryChildCount: 1, hasElements: true }],
        definitionContainers: [],
      });
    });

    it("returns child categories when definition container contains empty categories and includeEmpty is true", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });

        return { definitionContainerRoot, category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(
        await firstValueFrom(
          idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionContainerRoot.id], includeEmpty: true }),
        ),
      ).toEqual({
        categories: [{ id: keys.category.id, subCategoryChildCount: 1, hasElements: false }],
        definitionContainers: [],
      });
    });

    it("returns empty when definition container contains empty categories", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });

        return { definitionContainerRoot, category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(
        await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionContainerRoot.id] })),
      ).toEqual({
        categories: [],
        definitionContainers: [],
      });
    });

    it("returns only categories when definition container contains categories and definition containers that contain nothing", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(
        await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionContainerRoot.id] })),
      ).toEqual({
        categories: [{ id: keys.category.id, subCategoryChildCount: 1, hasElements: true }],
        definitionContainers: [],
      });
    });

    it("returns child definition container and category when definition container contains categories and definition containers that contain categories", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
        const directCategory = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: directCategory.id });

        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
        const indirectCategory = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });

        return { definitionContainerRoot, directCategory, definitionModelChild };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(
        await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionContainerRoot.id] })),
      ).toEqual({
        categories: [{ id: keys.directCategory.id, subCategoryChildCount: 1, hasElements: true }],
        definitionContainers: [keys.definitionModelChild.id],
      });
    });

    it("returns child categories when definition container with categories is contained by definition container", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
        const indirectCategory = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });

        return { definitionModelChild, indirectCategory };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(
        await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.definitionModelChild.id] })),
      ).toEqual({
        categories: [{ id: keys.indirectCategory.id, subCategoryChildCount: 1, hasElements: true }],
        definitionContainers: [],
      });
    });
  });

  describe("getAllContainedCategories", () => {
    it("returns empty list when definition container contains nothing", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

        return { definitionContainer };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getAllContainedCategories({ definitionContainerIds: [keys.definitionContainer.id] }))).toEqual(new Set());
    });

    it("returns empty list when definition container contains empty categories", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModel.id });

        return { definitionContainer };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getAllContainedCategories({ definitionContainerIds: [keys.definitionContainer.id] }))).toEqual(new Set());
    });

    it("returns contained categories when definition container contains empty categories and includeEmptyCategories is true", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModel.id });

        return { definitionContainer, category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(
        await firstValueFrom(idsCache.getAllContainedCategories({ definitionContainerIds: [keys.definitionContainer.id], includeEmptyCategories: true })),
      ).toEqual(new Set([keys.category.id]));
    });

    it("returns indirectly contained categories when definition container contains definition container that has categories", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getAllContainedCategories({ definitionContainerIds: [keys.definitionContainerRoot.id] }))).toEqual(
        new Set([keys.category.id]),
      );
    });

    it("returns child categories when definition container contains categories", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer, category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getAllContainedCategories({ definitionContainerIds: [keys.definitionContainer.id] }))).toEqual(
        new Set([keys.category.id]),
      );
    });

    it("returns direct and indirect categories when definition container contains categories and definition containers that contain categories", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
        const directCategory = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: directCategory.id });

        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
        const indirectCategory = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });

        return { definitionContainerRoot, directCategory, indirectCategory };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      const result = await firstValueFrom(idsCache.getAllContainedCategories({ definitionContainerIds: [keys.definitionContainerRoot.id] }));
      const expectedResult = [keys.indirectCategory.id, keys.directCategory.id];
      expect(expectedResult.every((id) => result.has(id))).toBe(true);
    });
  });

  describe("getSubCategoriesSearchPaths", () => {
    it("returns empty list when subcategory doesn't exist", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
      });
      const { imodel } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getSubCategoriesSearchPaths({ subCategoryIds: "0x123" }))).toEqual([]);
    });

    it("returns path to subCategory when category has subCategory", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        const subCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Test SpatialSubCategory" });
        return { subCategory, category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getSubCategoriesSearchPaths({ subCategoryIds: keys.subCategory.id }))).toEqual([keys.category, keys.subCategory]);
    });

    it("returns path to subCategory when definition container contains category that has subCategory", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        const subCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Test SpatialSubCategory", modelId: definitionModel.id });
        return { subCategory, category, definitionContainer };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getSubCategoriesSearchPaths({ subCategoryIds: keys.subCategory.id }))).toEqual([
        keys.definitionContainer,
        keys.category,
        keys.subCategory,
      ]);
    });

    it("returns path to subCategory when definition container contains definition container that contains category that has subCategory", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
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
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getSubCategoriesSearchPaths({ subCategoryIds: keys.subCategory.id }))).toEqual([
        keys.definitionContainerRoot,
        keys.definitionContainerChild,
        keys.category,
        keys.subCategory,
      ]);
    });
  });

  describe("getCategoriesSearchPaths", () => {
    it("returns empty list when category doesn't exist", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
      });
      const { imodel } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getCategoriesSearchPaths({ categoryIds: "0x123", includePathsWithSubModels: false }))).toEqual([]);
    });

    it("returns only category when only category exists", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getCategoriesSearchPaths({ categoryIds: keys.category.id, includePathsWithSubModels: false }))).toEqual([
        keys.category,
      ]);
    });

    it("returns category path when it exist under sub-model", async () => {
      await using buildIModelResult = await buildIModel(async (builder, testSchema) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
        const modeledElement = insertPhysicalElement({
          builder,
          categoryId: category.id,
          classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
          modelId: physicalModel.id,
        });
        const subModel = insertPhysicalSubModel({
          builder,
          modeledElementId: modeledElement.id,
        });
        const elementOfSubModel = insertPhysicalElement({
          builder,
          categoryId: category.id,
          modelId: subModel.id,
        });
        return { category, definitionContainer, modeledElement, elementOfSubModel, subModel };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(
        await firstValueFrom(idsCache.getCategoriesSearchPaths({ categoryIds: keys.category.id, includePathsWithSubModels: false }).pipe(toArray())),
      ).toEqual([[keys.definitionContainer, keys.category]]);
      expect(
        (await firstValueFrom(idsCache.getCategoriesSearchPaths({ categoryIds: keys.category.id, includePathsWithSubModels: true }).pipe(toArray()))).sort(
          (path1, path2) => path1.length - path2.length,
        ),
      ).toEqual([
        [keys.definitionContainer, keys.category],
        [
          keys.definitionContainer,
          keys.category,
          { className: getClassesByView("3d").elementClass, id: keys.modeledElement.id },
          { className: getClassesByView("3d").modelClass, id: keys.subModel.id },
          keys.category,
        ],
      ]);
    });

    it("returns path to category when definition container contains category", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { category, definitionContainer };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getCategoriesSearchPaths({ categoryIds: keys.category.id, includePathsWithSubModels: false }))).toEqual([
        keys.definitionContainer,
        keys.category,
      ]);
    });

    it("returns path to category when definition container contains definition container that contains category", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { category, definitionContainerChild, definitionContainerRoot };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getCategoriesSearchPaths({ categoryIds: keys.category.id, includePathsWithSubModels: false }))).toEqual([
        keys.definitionContainerRoot,
        keys.definitionContainerChild,
        keys.category,
      ]);
    });
  });

  describe("getDefinitionContainersSearchPaths", () => {
    it("returns empty list when definition container doesn't exist", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
      });
      const { imodel } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getDefinitionContainersSearchPaths({ definitionContainerIds: "0x123" }))).toEqual([]);
    });

    it("returns definition container when definition container contains category", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { category, definitionContainer };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getDefinitionContainersSearchPaths({ definitionContainerIds: keys.definitionContainer.id }))).toEqual([
        keys.definitionContainer,
      ]);
    });

    it("returns path to definition container when definition container is contained by definition container", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { category, definitionContainerChild, definitionContainerRoot };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getDefinitionContainersSearchPaths({ definitionContainerIds: keys.definitionContainerChild.id }))).toEqual([
        keys.definitionContainerRoot,
        keys.definitionContainerChild,
      ]);
    });
  });

  describe("getAllDefinitionContainersAndCategories", () => {
    it("returns empty list when no categories or definition containers exist", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
      });
      const { imodel } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories())).toEqual({ categories: [], definitionContainers: [] });
    });

    it("returns empty list when only empty categories exist", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
      });
      const { imodel } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories())).toEqual({ categories: [], definitionContainers: [] });
    });

    it("returns empty categories and their definitionContainers when includeEmpty is set to true", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
        return { category, definitionContainer };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories({ includeEmpty: true }))).toEqual({
        categories: [keys.category.id],
        definitionContainers: [keys.definitionContainer.id],
      });
    });

    it("returns category when only category and empty definition container exist", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories())).toEqual({
        categories: [keys.category.id],
        definitionContainers: [],
      });
    });

    it("returns category when category and definition containers (that don't contain categories) exist", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories())).toEqual({
        categories: [keys.category.id],
        definitionContainers: [],
      });
    });

    it("returns both definition containers and their contained category when definition container contains definition container that contains categories", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, definitionContainerChild, category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      const result = await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories());
      const expectedResult = {
        categories: [keys.category.id],
        definitionContainers: [keys.definitionContainerRoot.id, keys.definitionContainerChild.id],
      };
      expect(result.categories).toEqual(expectedResult.categories);
      expect(expectedResult.definitionContainers.every((dc) => result.definitionContainers.includes(dc))).toBe(true);
    });

    it("returns definition container and category when definition container contains category", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories())).toEqual({
        categories: [keys.category.id],
        definitionContainers: [keys.definitionContainerRoot.id],
      });
    });

    it("returns definition container and category when definition container contains category and definition container that doesn't contain category", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot, category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories())).toEqual({
        categories: [keys.category.id],
        definitionContainers: [keys.definitionContainerRoot.id],
      });
    });

    it("returns both definition containers and categories when definition container contains categories and definition container that contain categories", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
        const directCategory = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: directCategory.id });

        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
        const indirectCategory = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });

        return { definitionContainerRoot, directCategory, definitionModelChild, indirectCategory };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      const result = await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories());
      const expectedResult = {
        categories: [keys.directCategory.id, keys.indirectCategory.id],
        definitionContainers: [keys.definitionModelChild.id, keys.definitionContainerRoot.id],
      };
      expect(expectedResult.categories.every((c) => result.categories.includes(c))).toBe(true);
      expect(expectedResult.definitionContainers.every((dc) => result.definitionContainers.includes(dc))).toBe(true);
    });
  });

  describe("getRootDefinitionContainersAndCategories", () => {
    it("returns empty list when no categories or definition containers exist", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
      });
      const { imodel } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories())).toEqual({ categories: [], definitionContainers: [] });
    });

    it("returns empty list when only empty categories exist", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
        insertSpatialCategory({ builder, codeValue: "Root SpatialCategory" });
      });
      const { imodel } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories())).toEqual({
        categories: [],
        definitionContainers: [],
      });
    });

    it("returns empty categories and definition containers when only `includeEmpty` is set to true", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModel.id });
        const rootCategory = insertSpatialCategory({ builder, codeValue: "Root SpatialCategory" });
        return { definitionContainer, rootCategory };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories({ includeEmpty: true }))).toEqual({
        categories: [{ id: keys.rootCategory.id, subCategoryChildCount: 1, hasElements: false }],
        definitionContainers: [keys.definitionContainer.id],
      });
    });

    it("returns category when category and definition container that doesn't contain anything exist", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories())).toEqual({
        categories: [{ id: keys.category.id, subCategoryChildCount: 1, hasElements: true }],
        definitionContainers: [],
      });
    });

    it("returns category when category and definition container that contains empty definition container exist", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories())).toEqual({
        categories: [{ id: keys.category.id, subCategoryChildCount: 1, hasElements: true }],
        definitionContainers: [],
      });
    });

    it("returns only the root definition container when definition container contains definition container that contains categories", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer", modelId: definitionModelRoot.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories())).toEqual({
        categories: [],
        definitionContainers: [keys.definitionContainerRoot.id],
      });
    });

    it("returns definition container when definition container contains category", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory", modelId: definitionModelRoot.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainerRoot };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories())).toEqual({
        categories: [],
        definitionContainers: [keys.definitionContainerRoot.id],
      });
    });

    it("returns root categories and definition containers when root categories and definition containers exist", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer" });
        const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

        const definitionContainerRootNoChildren = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainerNoChild" });
        insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRootNoChildren.id });

        const definitionContainerRoot2 = insertDefinitionContainer({ builder, codeValue: "Test DefinitionContainer2" });
        const definitionModelRoot2 = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot2.id });

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
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      const result = await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories());
      const expectedResult = {
        categories: [
          { id: keys.rootCategory1.id, subCategoryChildCount: 1, hasElements: true },
          { id: keys.rootCategory2.id, subCategoryChildCount: 1, hasElements: true },
        ],
        definitionContainers: [keys.definitionContainerRoot.id, keys.definitionContainerRoot2.id],
      };
      expect(
        expectedResult.categories.every((expectedCategory) =>
          result.categories.find(
            (category) => category.id === expectedCategory.id && category.subCategoryChildCount === expectedCategory.subCategoryChildCount,
          ),
        ),
      ).toBe(true);
      expect(expectedResult.definitionContainers.every((dc) => result.definitionContainers.includes(dc))).toBe(true);
    });
  });

  describe("getSubCategories", () => {
    it("returns empty list when category doesn't exist", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
      });
      const { imodel } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getSubCategories({ categoryId: "0x123" }))).toEqual([]);
    });

    it("returns sub-category when category has one sub-category", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        return { category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      expect(await firstValueFrom(idsCache.getSubCategories({ categoryId: keys.category.id }))).toEqual([getDefaultSubCategoryId(keys.category.id)]);
    });

    it("returns sub-categories when category has multiple sub-categories", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        const subCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "subC 1" });

        return { subCategory, category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      const result = await firstValueFrom(idsCache.getSubCategories({ categoryId: keys.category.id }));
      expect(result.includes(keys.subCategory.id)).toBe(true);
      expect(result.length).toBe(2);
    });

    it("returns only child subCategories when multiple categories have multiple subCategories", async () => {
      await using buildIModelResult = await buildIModel(async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "subC 1" });

        const category2 = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory2" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
        const subCategory2 = insertSubCategory({ builder, parentCategoryId: category2.id, codeValue: "subC 2" });

        return { subCategory2, category2 };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, type: "3d", elementClassName: getClassesByView("3d").elementClass });
      using idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      const result = await firstValueFrom(idsCache.getSubCategories({ categoryId: keys.category2.id }));
      expect(result).toBeDefined();
      expect(result.includes(keys.subCategory2.id)).toBe(true);
      expect(result.length).toBe(2);
    });
  });
});
