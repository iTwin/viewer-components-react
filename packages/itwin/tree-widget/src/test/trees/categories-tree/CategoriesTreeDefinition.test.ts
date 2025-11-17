/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
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
import { NodeValidators, validateHierarchy } from "../HierarchyValidation.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchyProvider } from "@itwin/presentation-hierarchies";
import type { CategoriesTreeHierarchyConfiguration } from "../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeDefinition.js";

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
        rpcs: [IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
      });
      // eslint-disable-next-line @itwin/no-internal
      ECSchemaRpcImpl.register();
    });

    after(async function () {
      await terminatePresentationTesting();
    });

    it("does not show private 3d categories", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        const privateCategory = insertSpatialCategory({ builder, codeValue: "Private Test SpatialCategory", isPrivate: true });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: privateCategory.id });

        return { category, privateCategory };
      });

      const { imodel, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodel, "3d");

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
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });

        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { category };
      });

      const { imodel, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodel, "3d");

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
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModel.id });
        insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
      });

      const { imodel } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodel, "3d");

      await validateHierarchy({
        provider,
        expect: [],
      });
    });

    it("does not show definition container or category when category is private", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id, isPrivate: true });

        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
      });

      const { imodel } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodel, "3d");

      await validateHierarchy({
        provider,
        expect: [],
      });
    });

    it("does not show definition container or category when category does not have elements", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

        insertSpatialCategory({ builder, codeValue: "SpatialCategory1", modelId: definitionModel.id });
        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });

        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        return { category };
      });

      const { imodel, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodel, "3d");

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
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });

        const emptyCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory1", modelId: definitionModel.id });
        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });

        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        return { category, emptyCategory, definitionContainer };
      });

      const { imodel, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodel, "3d", { showEmptyCategories: true });

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
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer", isPrivate: true });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id });

        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
      });

      const { imodel } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodel, "3d");

      await validateHierarchy({
        provider,
        expect: [],
      });
    });

    it("does not show definition containers or categories when definition container contains another definition container that is private", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const definitionContainerChild = insertDefinitionContainer({
          builder,
          codeValue: "DefinitionContainerChild",
          isPrivate: true,
          modelId: definitionModel.id,
        });
        const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });

        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });

        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
      });

      const { imodel } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodel, "3d");

      await validateHierarchy({
        provider,
        expect: [],
      });
    });

    it("shows definition container when it contains category", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id });

        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer, category };
      });

      const { imodel, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodel, "3d");

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

    it("shows element when showElements is set to true", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id });

        const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer, category, element };
      });

      const { imodel, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodel, "3d", { showElements: true });

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
                children: [
                  NodeValidators.createForClassGroupingNode({
                    className: keys.element.className,
                    children: [
                      NodeValidators.createForInstanceNode({
                        instanceKeys: [keys.element],
                        children: false,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      });
    });

    it("shows element and subCategories when showElements is set to true", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id });

        const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        const subCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Test SpatialSubCategory", modelId: definitionModel.id });

        return { definitionContainer, category, element, subCategory };
      });

      const { imodel, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodel, "3d", { showElements: true });

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
                children: [
                  NodeValidators.createForClassGroupingNode({
                    className: keys.element.className,
                    children: [
                      NodeValidators.createForInstanceNode({
                        instanceKeys: [keys.element],
                        children: false,
                      }),
                    ],
                  }),
                  NodeValidators.createForInstanceNode({
                    label: "SpatialCategory",
                    children: false,
                  }),
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.subCategory],
                    children: false,
                  }),
                ],
              }),
            ],
          }),
        ],
      });
    });

    it("shows element and hides subCategories when showElements and hideSubCategories are set to true", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id });

        const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        const subCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Test SpatialSubCategory", modelId: definitionModel.id });

        return { definitionContainer, category, element, subCategory };
      });

      const { imodel, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodel, "3d", { showElements: true, hideSubCategories: true });

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
                children: [
                  NodeValidators.createForClassGroupingNode({
                    className: keys.element.className,
                    children: [
                      NodeValidators.createForInstanceNode({
                        instanceKeys: [keys.element],
                        children: false,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      });
    });

    it("shows all definition containers when they contain category directly or indirectly", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModel.id });
        const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });

        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });

        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer, definitionContainerChild, category };
      });

      const { imodel, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodel, "3d");

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
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
        const childCategory = insertSpatialCategory({ builder, codeValue: "ScChild", modelId: definitionModel.id });

        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: childCategory.id });

        return { category, definitionContainer, childCategory };
      });

      const { imodel, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodel, "3d");

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
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        const subCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Test SpatialSubCategory" });
        const privateSubCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Private Test SpatialSubCategory", isPrivate: true });

        return { category, subCategory, privateSubCategory };
      });

      const { imodel, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodel, "3d");

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
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const drawingModel = insertDrawingModelWithPartition({ builder, codeValue: "TestDrawingModel" });

        const category = insertDrawingCategory({ builder, codeValue: "Test Drawing Category" });
        insertDrawingGraphic({ builder, modelId: drawingModel.id, categoryId: category.id });

        const privateCategory = insertDrawingCategory({ builder, codeValue: "Private Test DrawingCategory", isPrivate: true });
        insertDrawingGraphic({ builder, modelId: drawingModel.id, categoryId: privateCategory.id });

        return { category, privateCategory };
      });

      const { imodel, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodel, "2d");

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
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const drawingModel = insertDrawingModelWithPartition({ builder, codeValue: "TestDrawingModel" });

        const category = insertDrawingCategory({ builder, codeValue: "Test Drawing Category" });
        insertDrawingGraphic({ builder, modelId: drawingModel.id, categoryId: category.id });

        const subCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Test DrawingSubCategory" });
        const privateSubCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Private Test DrawingSubCategory", isPrivate: true });

        return { category, subCategory, privateSubCategory };
      });

      const { imodel, ...keys } = buildIModelResult;
      using provider = createCategoryTreeProvider(imodel, "2d");

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

function createCategoryTreeProvider(
  imodel: IModelConnection,
  viewType: "2d" | "3d",
  hierarchyConfig?: Partial<CategoriesTreeHierarchyConfiguration>,
): HierarchyProvider & Disposable {
  const imodelAccess = createIModelAccess(imodel);
  const idsCache = new CategoriesTreeIdsCache(imodelAccess, viewType);
  const hierarchyProvider = createIModelHierarchyProvider({
    imodelAccess,
    hierarchyDefinition: new CategoriesTreeDefinition({
      imodelAccess,
      viewType,
      idsCache,
      hierarchyConfig: {
        ...defaultHierarchyConfiguration,
        ...hierarchyConfig,
      },
    }),
  });
  return {
    hierarchyChanged: hierarchyProvider.hierarchyChanged,
    getNodes: (props) => hierarchyProvider.getNodes(props),
    getNodeInstanceKeys: (props) => hierarchyProvider.getNodeInstanceKeys(props),
    setFormatter: (formatter) => hierarchyProvider.setFormatter(formatter),
    setHierarchyFilter: (props) => hierarchyProvider.setHierarchyFilter(props),
    [Symbol.dispose]() {
      hierarchyProvider[Symbol.dispose]();
      idsCache[Symbol.dispose]();
    },
  };
}
