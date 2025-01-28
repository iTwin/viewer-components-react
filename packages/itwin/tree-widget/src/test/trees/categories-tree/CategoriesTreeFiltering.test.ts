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
import { CategoriesTreeDefinition } from "../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeDefinition.js";
import {
  buildIModel,
  insertDrawingCategory,
  insertDrawingGraphic,
  insertDrawingModelWithPartition,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
  insertSubCategory,
} from "../../IModelUtils.js";
import { createIModelAccess } from "../Common.js";

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
        rpcs: [SnapshotIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
      });
      // eslint-disable-next-line @itwin/no-internal
      ECSchemaRpcImpl.register();
    });

    after(async function () {
      await terminatePresentationTesting();
    });

    it("finds 3d categories by label containing special SQLite characters", async function () {
      const { imodel, keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

        const category1 = insertSpatialCategory({ builder, codeValue: "Test SpatialCat_egory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category1.id });

        const category2 = insertSpatialCategory({ builder, codeValue: "Test SpatialCat%egory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });

        return {
          keys: {
            category1,
            category2,
          },
        };
      });

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess: createIModelAccess(imodel),
          label: "_",
          viewType: "3d",
        }),
      ).to.deep.eq([{ path: [keys.category1], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess: createIModelAccess(imodel),
          label: "%",
          viewType: "3d",
        }),
      ).to.deep.eq([{ path: [keys.category2], options: { autoExpand: true } }]);
    });

    it("finds 3d subcategories by label containing special SQLite characters", async function () {
      const { imodel, keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        const subCategory1 = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "SubCat_egory1" });
        const subCategory2 = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "SubCat%egory2" });

        return {
          keys: {
            category,
            subCategory1,
            subCategory2,
          },
        };
      });

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess: createIModelAccess(imodel),
          label: "_",
          viewType: "3d",
        }),
      ).to.deep.eq([{ path: [keys.category, keys.subCategory1], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess: createIModelAccess(imodel),
          label: "%",
          viewType: "3d",
        }),
      ).to.deep.eq([{ path: [keys.category, keys.subCategory2], options: { autoExpand: true } }]);
    });

    it("finds 3d categories by label when subCategory count is 1 and labels of category and subCategory differ", async function () {
      const { imodel, keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        // SubCategory gets inserted by default
        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", userLabel: "Test" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return {
          keys: {
            category,
          },
        };
      });
      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess: createIModelAccess(imodel),
          label: "Test",
          viewType: "3d",
        }),
      ).to.deep.eq([{ path: [keys.category], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess: createIModelAccess(imodel),
          label: "SpatialCategory",
          viewType: "3d",
        }),
      ).to.deep.eq([]);
    });

    it("finds 3d categories and subCategories by label when subCategory count is > 1", async function () {
      const { imodel, keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", userLabel: "Test" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        const subCategory1 = insertSubCategory({ builder, codeValue: "SubCategory1", parentCategoryId: category.id });

        const subCategory2 = insertSubCategory({ builder, codeValue: "SubCategory2", parentCategoryId: category.id });

        return {
          keys: {
            category,
            subCategory1,
            subCategory2,
          },
        };
      });

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess: createIModelAccess(imodel),
          label: "Test",
          viewType: "3d",
        }),
      ).to.deep.eq([{ path: [keys.category], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess: createIModelAccess(imodel),
          label: "SubCategory1",
          viewType: "3d",
        }),
      ).to.deep.eq([{ path: [keys.category, keys.subCategory1], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess: createIModelAccess(imodel),
          label: "SubCategory2",
          viewType: "3d",
        }),
      ).to.deep.eq([{ path: [keys.category, keys.subCategory2], options: { autoExpand: true } }]);
    });

    it("finds 2d categories by label containing special SQLite characters", async function () {
      const { imodel, keys } = await buildIModel(this, async (builder) => {
        const drawingModel = insertDrawingModelWithPartition({ builder, codeValue: "TestDrawingModel" });

        const category1 = insertDrawingCategory({ builder, codeValue: "Test Drawing Cat_egory" });
        insertDrawingGraphic({ builder, modelId: drawingModel.id, categoryId: category1.id });

        const category2 = insertDrawingCategory({ builder, codeValue: "Test Drawing Cat%egory" });
        insertDrawingGraphic({ builder, modelId: drawingModel.id, categoryId: category2.id });

        return {
          keys: {
            category1,
            category2,
          },
        };
      });

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess: createIModelAccess(imodel),
          label: "_",
          viewType: "2d",
        }),
      ).to.deep.eq([{ path: [keys.category1], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess: createIModelAccess(imodel),
          label: "%",
          viewType: "2d",
        }),
      ).to.deep.eq([{ path: [keys.category2], options: { autoExpand: true } }]);
    });

    it("finds 2d subcategories by label containing special SQLite characters", async function () {
      const { imodel, keys } = await buildIModel(this, async (builder) => {
        const drawingModel = insertDrawingModelWithPartition({ builder, codeValue: "TestDrawingModel" });

        const category = insertDrawingCategory({ builder, codeValue: "Test Drawing Category" });
        insertDrawingGraphic({ builder, modelId: drawingModel.id, categoryId: category.id });

        const subCategory1 = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Test Drawing SubCat_egory" });
        const subCategory2 = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Test Drawing SubCat%egory" });

        return {
          keys: {
            category,
            subCategory1,
            subCategory2,
          },
        };
      });

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess: createIModelAccess(imodel),
          label: "_",
          viewType: "2d",
        }),
      ).to.deep.eq([{ path: [keys.category, keys.subCategory1], options: { autoExpand: true } }]);

      expect(
        await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess: createIModelAccess(imodel),
          label: "%",
          viewType: "2d",
        }),
      ).to.deep.eq([{ path: [keys.category, keys.subCategory2], options: { autoExpand: true } }]);
    });
  });
});
