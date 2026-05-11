/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

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
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import {
  CategoriesTreeDefinition,
  defaultHierarchyConfiguration,
} from "../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeDefinition.js";
import { CategoriesTreeIdsCache } from "../../../tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeIdsCache.js";
import { buildIModel } from "../../IModelUtils.js";
import { createIModelAccess } from "../Common.js";
import { NodeValidators, validateHierarchy } from "../HierarchyValidation.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { CategoriesTreeHierarchyConfiguration } from "../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeDefinition.js";

describe("Categories tree", () => {
  describe("Hierarchy definition", () => {
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

    it("does not show private 3d categories", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });

        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        const privateCategory = insertSpatialCategory({ imodel, codeValue: "Private Test SpatialCategory", isPrivate: true });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: privateCategory.id });

        return { category, privateCategory };
      });

      const { imodelConnection, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodelConnection, "3d");

      await validateHierarchy({
        provider,
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.category],
            supportsFiltering: true,
            children: false,
          }),
        ],
      });
    });

    it("does not show definition container when it doesn't contain category", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "DefinitionContainer" });
        insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });

        const category = insertSpatialCategory({ imodel, codeValue: "SpatialCategory" });

        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { category };
      });

      const { imodelConnection, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodelConnection, "3d");

      await validateHierarchy({
        provider,
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.category],
            supportsFiltering: true,
            children: false,
          }),
        ],
      });
    });

    it("does not show definition container when it contains definition container without categories", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "DefinitionContainerChild", modelId: definitionModel.id });
        insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
      });

      const { imodelConnection } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodelConnection, "3d");

      await validateHierarchy({
        provider,
        expect: [],
      });
    });

    it("does not show definition container or category when category is private", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });

        const category = insertSpatialCategory({ imodel, codeValue: "SpatialCategory", modelId: definitionModel.id, isPrivate: true });

        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });
      });

      const { imodelConnection } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodelConnection, "3d");

      await validateHierarchy({
        provider,
        expect: [],
      });
    });

    it("does not show definition container or category when category does not have elements", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });

        insertSpatialCategory({ imodel, codeValue: "SpatialCategory1", modelId: definitionModel.id });
        const category = insertSpatialCategory({ imodel, codeValue: "SpatialCategory" });

        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });
        return { category };
      });

      const { imodelConnection, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodelConnection, "3d");

      await validateHierarchy({
        provider,
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.category],
            supportsFiltering: true,
            children: false,
          }),
        ],
      });
    });

    it("shows definition container and category when category does not have elements and showEmptyCategories is true", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });

        const emptyCategory = insertSpatialCategory({ imodel, codeValue: "SpatialCategory1", modelId: definitionModel.id });
        const category = insertSpatialCategory({ imodel, codeValue: "SpatialCategory" });

        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });
        return { category, emptyCategory, definitionContainer };
      });

      const { imodelConnection, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodelConnection, "3d", { showEmptyCategories: true });

      await validateHierarchy({
        provider,
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.definitionContainer],
            supportsFiltering: true,
            children: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.emptyCategory],
                children: false,
              }),
            ],
          }),
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.category],
            supportsFiltering: true,
            children: false,
          }),
        ],
      });
    });

    it("does not show definition container or category when definition container is private", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "DefinitionContainer", isPrivate: true });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });

        const category = insertSpatialCategory({ imodel, codeValue: "SpatialCategory", modelId: definitionModel.id });

        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });
      });

      const { imodelConnection } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodelConnection, "3d");

      await validateHierarchy({
        provider,
        expect: [],
      });
    });

    it("does not show definition containers or categories when definition container contains another definition container that is private", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const definitionContainerChild = insertDefinitionContainer({
          imodel,
          codeValue: "DefinitionContainerChild",
          isPrivate: true,
          modelId: definitionModel.id,
        });
        const definitionModelChild = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });

        const category = insertSpatialCategory({ imodel, codeValue: "SpatialCategory", modelId: definitionModelChild.id });

        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });
      });

      const { imodelConnection } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodelConnection, "3d");

      await validateHierarchy({
        provider,
        expect: [],
      });
    });

    it("shows definition container when it contains category", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });

        const category = insertSpatialCategory({ imodel, codeValue: "SpatialCategory", modelId: definitionModel.id });

        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer, category };
      });

      const { imodelConnection, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodelConnection, "3d");

      await validateHierarchy({
        provider,
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.definitionContainer],
            supportsFiltering: true,
            children: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.category],
                label: "SpatialCategory",
                children: false,
              }),
            ],
          }),
        ],
      });
    });

    it("shows all definition containers when they contain category directly or indirectly", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const definitionContainerChild = insertDefinitionContainer({ imodel, codeValue: "DefinitionContainerChild", modelId: definitionModel.id });
        const definitionModelChild = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });

        const category = insertSpatialCategory({ imodel, codeValue: "SpatialCategory", modelId: definitionModelChild.id });

        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer, definitionContainerChild, category };
      });

      const { imodelConnection, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodelConnection, "3d");

      await validateHierarchy({
        provider,
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.definitionContainer],
            supportsFiltering: true,
            children: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.definitionContainerChild],
                label: "DefinitionContainerChild",
                children: [
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.category],
                    label: "SpatialCategory",
                    children: false,
                  }),
                ],
              }),
            ],
          }),
        ],
      });
    });

    it("shows root categories and definition container", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ imodel, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ imodel, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });

        const category = insertSpatialCategory({ imodel, codeValue: "SpatialCategory" });
        const childCategory = insertSpatialCategory({ imodel, codeValue: "ScChild", modelId: definitionModel.id });

        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: childCategory.id });

        return { category, definitionContainer, childCategory };
      });

      const { imodelConnection, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodelConnection, "3d");

      await validateHierarchy({
        provider,
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.definitionContainer],
            supportsFiltering: true,
            children: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.childCategory],
                label: "ScChild",
                children: false,
              }),
            ],
          }),
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.category],
            supportsFiltering: true,
            children: false,
          }),
        ],
      });
    });

    it("does not show private 3d subCategories", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });

        const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });

        const subCategory = insertSubCategory({ imodel, parentCategoryId: category.id, codeValue: "Test SpatialSubCategory" });
        const privateSubCategory = insertSubCategory({ imodel, parentCategoryId: category.id, codeValue: "Private Test SpatialSubCategory", isPrivate: true });

        return { category, subCategory, privateSubCategory };
      });

      const { imodelConnection, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodelConnection, "3d");

      await validateHierarchy({
        provider,
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.category],
            supportsFiltering: true,
            children: [
              NodeValidators.createForInstanceNode({
                label: "Test SpatialCategory",
                children: false,
              }),
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.subCategory],
                children: false,
              }),
            ],
          }),
        ],
      });
    });

    it("does not show private 2d categories", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const drawingModel = insertDrawingModelWithPartition({ imodel, codeValue: "TestDrawingModel" });

        const category = insertDrawingCategory({ imodel, codeValue: "Test Drawing Category" });
        insertDrawingGraphic({ imodel, modelId: drawingModel.id, categoryId: category.id });

        const privateCategory = insertDrawingCategory({ imodel, codeValue: "Private Test DrawingCategory", isPrivate: true });
        insertDrawingGraphic({ imodel, modelId: drawingModel.id, categoryId: privateCategory.id });

        return { category, privateCategory };
      });

      const { imodelConnection, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodelConnection, "2d");

      await validateHierarchy({
        provider,
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.category],
            supportsFiltering: true,
            children: false,
          }),
        ],
      });
    });

    it("does not show private 2d subCategories", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const drawingModel = insertDrawingModelWithPartition({ imodel, codeValue: "TestDrawingModel" });

        const category = insertDrawingCategory({ imodel, codeValue: "Test Drawing Category" });
        insertDrawingGraphic({ imodel, modelId: drawingModel.id, categoryId: category.id });

        const subCategory = insertSubCategory({ imodel, parentCategoryId: category.id, codeValue: "Test DrawingSubCategory" });
        const privateSubCategory = insertSubCategory({ imodel, parentCategoryId: category.id, codeValue: "Private Test DrawingSubCategory", isPrivate: true });

        return { category, subCategory, privateSubCategory };
      });

      const { imodelConnection, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodelConnection, "2d");

      await validateHierarchy({
        provider,
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.category],
            supportsFiltering: true,
            children: [
              NodeValidators.createForInstanceNode({
                label: "Test Drawing Category",
                children: false,
              }),
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.subCategory],
                children: false,
              }),
            ],
          }),
        ],
      });
    });
  });
});

function createCategoryTreeProvider(imodel: IModelConnection, viewType: "2d" | "3d", hierarchyConfig?: Partial<CategoriesTreeHierarchyConfiguration>) {
  const imodelAccess = createIModelAccess(imodel);
  return createIModelHierarchyProvider({
    imodelAccess,
    hierarchyDefinition: new CategoriesTreeDefinition({
      imodelAccess,
      viewType,
      idsCache: new CategoriesTreeIdsCache(imodelAccess, viewType),
      hierarchyConfig: {
        ...defaultHierarchyConfiguration,
        ...hierarchyConfig,
      },
    }),
  });
}
