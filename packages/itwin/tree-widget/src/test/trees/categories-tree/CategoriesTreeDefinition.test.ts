/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { join } from "path";
import { IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import {
  HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting,
} from "@itwin/presentation-testing";
import { CategoriesTreeDefinition } from "../../../components/trees/categories-tree/CategoriesTreeDefinition.js";
import {
  buildIModel, insertDrawingCategory, insertDrawingGraphic, insertDrawingModelWithPartition, insertPhysicalElement, insertPhysicalModelWithPartition,
  insertSpatialCategory, insertSubCategory,
} from "../../IModelUtils.js";
import { createIModelAccess } from "../Common.js";
import { NodeValidators, validateHierarchy } from "../HierarchyValidation.js";

import type { IModelConnection } from "@itwin/core-frontend";

describe("Categories tree", () => {
  describe("Hierarchy definition", () => {
    before(async function () {
      await initializePresentationTesting({
        backendProps: {
          caching: {
            hierarchies: {
              mode: HierarchyCacheMode.Memory,
            },
          },
        },
        testOutputDir: join(__dirname, "output"),
        backendHostProps: {
          cacheDir: join(__dirname, "cache"),
        },
        rpcs: [SnapshotIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
      });
      // eslint-disable-next-line @itwin/no-internal
      ECSchemaRpcImpl.register();
    });

    after(async function () {
      await terminatePresentationTesting();
    });

    it("does not show private 3d categories", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        const privateCategory = insertSpatialCategory({ builder, codeValue: "Private Test SpatialCategory", isPrivate: true });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: privateCategory.id });

        return { category, privateCategory };
      });
      await validateHierarchy({
        provider: createCategoryTreeProvider(imodel, "3d"),
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.category],
            supportsFiltering: true,
            children: false,
          }),
        ],
      });
    });

    it("does not show private 3d subCategories", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        const subCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Test SpatialSubCategory" });
        const privateSubCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Private Test SpatialSubCategory", isPrivate: true });

        return { category, subCategory, privateSubCategory };
      });
      await validateHierarchy({
        provider: createCategoryTreeProvider(imodel, "3d"),
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
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const drawingModel = insertDrawingModelWithPartition({ builder, codeValue: "TestDrawingModel" });

        const category = insertDrawingCategory({ builder, codeValue: "Test Drawing Category" });
        insertDrawingGraphic({ builder, modelId: drawingModel.id, categoryId: category.id });

        const privateCategory = insertDrawingCategory({ builder, codeValue: "Private Test DrawingCategory", isPrivate: true });
        insertDrawingGraphic({ builder, modelId: drawingModel.id, categoryId: privateCategory.id });

        return { category, privateCategory };
      });
      await validateHierarchy({
        provider: createCategoryTreeProvider(imodel, "2d"),
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
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const drawingModel = insertDrawingModelWithPartition({ builder, codeValue: "TestDrawingModel" });

        const category = insertDrawingCategory({ builder, codeValue: "Test Drawing Category" });
        insertDrawingGraphic({ builder, modelId: drawingModel.id, categoryId: category.id });

        const subCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Test DrawingSubCategory" });
        const privateSubCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Private Test DrawingSubCategory", isPrivate: true });

        return { category, subCategory, privateSubCategory };
      });
      await validateHierarchy({
        provider: createCategoryTreeProvider(imodel, "2d"),
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

function createCategoryTreeProvider(imodel: IModelConnection, viewType: "2d" | "3d") {
  const imodelAccess = createIModelAccess(imodel);
  return createIModelHierarchyProvider({
    imodelAccess,
    hierarchyDefinition: new CategoriesTreeDefinition({ imodelAccess, viewType }),
  });
}
