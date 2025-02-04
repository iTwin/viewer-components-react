/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import { IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { CategoriesTreeDefinition } from "../../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeDefinition.js";
import { CategoriesTreeIdsCache } from "../../../../tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeIdsCache.js";
import { CategoriesVisibilityHandler } from "../../../../tree-widget-react/components/trees/categories-tree/internal/CategoriesVisibilityHandler.js";
import {
  buildIModel,
  insertDefinitionContainer,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
  insertSubCategory,
  insertSubModel,
} from "../../../IModelUtils.js";
import { TestUtils } from "../../../TestUtils.js";
import { createIModelAccess } from "../../Common.js";
import { createCategoryHierarchyNode, createDefinitionContainerHierarchyNode, createSubCategoryHierarchyNode, createViewportStub } from "./Utils.js";
import { validateHierarchyVisibility, VisibilityExpectations } from "./VisibilityValidation.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchyNodeIdentifiersPath } from "@itwin/presentation-hierarchies";

describe("CategoriesVisibilityHandler", () => {
  before(async () => {
    await NoRenderApp.startup();
    await TestUtils.initialize();
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

  after(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
    await terminatePresentationTesting();
  });

  async function createCommonProps(imodel: IModelConnection, isVisibleOnInitialize: boolean) {
    const imodelAccess = createIModelAccess(imodel);
    const idsCache = new CategoriesTreeIdsCache(imodelAccess, "3d");

    const viewport = await createViewportStub(idsCache, isVisibleOnInitialize);
    return {
      imodelAccess,
      viewport,
      idsCache,
    };
  }

  function createProvider(props: {
    idsCache: CategoriesTreeIdsCache;
    imodelAccess: ReturnType<typeof createIModelAccess>;
    filterPaths?: HierarchyNodeIdentifiersPath[];
  }) {
    return createIModelHierarchyProvider({
      hierarchyDefinition: new CategoriesTreeDefinition({ ...props, viewType: "3d" }),
      imodelAccess: props.imodelAccess,
      ...(props.filterPaths ? { filtering: { paths: props.filterPaths } } : undefined),
    });
  }

  async function createVisibilityTestData({ imodel, isVisibleOnInitialize }: { imodel: IModelConnection; isVisibleOnInitialize: boolean }) {
    const commonProps = await createCommonProps(imodel, isVisibleOnInitialize);
    const handler = new CategoriesVisibilityHandler(commonProps);
    const provider = createProvider({ ...commonProps });
    return {
      handler,
      provider,
      ...commonProps,
      [Symbol.dispose]() {
        handler[Symbol.dispose]();
        provider[Symbol.dispose]();
      },
    };
  }

  describe("enabling visibility", () => {
    const isVisibleOnInitialize = false;

    it("by default everything is hidden", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });

        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        const subCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "subCategory", modelId: definitionModel.id });
        return { definitionContainer, category, subCategory };
      });
      const expectedIds = [keys.category.id, keys.definitionContainer.id, keys.subCategory.id];
      using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
      const { handler, provider, viewport } = visibilityTestData;
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: VisibilityExpectations.all("hidden"),
        expectedIds,
      });
    });
    describe("definitionContainers", () => {
      it("showing definition container makes it and all of its contained elements visible", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });

          const directCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory1", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: directCategory.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
          const indirectSubCategory = insertSubCategory({
            builder,
            parentCategoryId: indirectCategory.id,
            codeValue: "subCategory",
            modelId: definitionModelChild.id,
          });
          return { definitionContainerRoot, definitionContainerChild, directCategory, indirectCategory, indirectSubCategory };
        });

        const expectedIds = [
          keys.definitionContainerRoot.id,
          keys.definitionContainerChild.id,
          keys.directCategory.id,
          keys.indirectCategory.id,
          keys.indirectSubCategory.id,
        ];
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          expectedIds,
        });
        viewport.validateChangesCalls(
          [{ categoriesToChange: [keys.directCategory.id, keys.indirectCategory.id], isVisible: true, enableAllSubCategories: true }],
          [],
        );
      });

      it("showing definition container makes it and all of its contained elements visible and doesn't affect non contained definition containers", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
          const indirectSubCategory = insertSubCategory({
            builder,
            parentCategoryId: indirectCategory.id,
            codeValue: "subCategory",
            modelId: definitionModelChild.id,
          });

          const definitionContainerRoot2 = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot2" });
          const definitionModelRoot2 = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot2.id });
          const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelRoot2.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
          const subCategory2 = insertSubCategory({ builder, parentCategoryId: category2.id, codeValue: "subCategory2", modelId: definitionModelRoot2.id });

          return {
            definitionContainerRoot,
            definitionContainerChild,
            indirectCategory,
            indirectSubCategory,
            definitionContainerRoot2,
            category2,
            subCategory2,
          };
        });

        const expectedIds = [
          keys.definitionContainerRoot.id,
          keys.definitionContainerChild.id,
          keys.definitionContainerRoot2.id,
          keys.category2.id,
          keys.indirectCategory.id,
          keys.indirectSubCategory.id,
          keys.subCategory2.id,
        ];
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.category2.id ? "hidden" : "visible"),
            subCategory: (parentCategoryId) => (parentCategoryId === keys.category2.id ? "hidden" : "visible"),
            definitionContainer: (definitionContainerId) => (definitionContainerId === keys.definitionContainerRoot2.id ? "hidden" : "visible"),
          },
          expectedIds,
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.indirectCategory.id], isVisible: true, enableAllSubCategories: true }], []);
      });

      it("showing definition container makes it and all of its contained elements visible, and parent container partially visible if it has more direct child categories", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });

          const directCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory1", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: directCategory.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
          return { definitionContainerRoot, definitionContainerChild, directCategory, indirectCategory };
        });

        const expectedIds = [keys.definitionContainerRoot.id, keys.definitionContainerChild.id, keys.directCategory.id, keys.indirectCategory.id];

        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.directCategory.id ? "hidden" : "visible"),
            definitionContainer: (definitionContainerId) => (definitionContainerId === keys.definitionContainerRoot.id ? "partial" : "visible"),
          },
          expectedIds,
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.indirectCategory.id], isVisible: true, enableAllSubCategories: true }], []);
      });

      it("showing definition container makes it and all of its contained elements visible, and parent container partially visible if it has more definition containers", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });

          const definitionContainerChild2 = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild2", modelId: definitionModelRoot.id });
          const definitionModelChild2 = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild2.id });
          const indirectCategory2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelChild2.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory2.id });
          return { definitionContainerRoot, definitionContainerChild, indirectCategory2, indirectCategory, definitionContainerChild2 };
        });

        const expectedIds = [
          keys.definitionContainerRoot.id,
          keys.definitionContainerChild.id,
          keys.indirectCategory.id,
          keys.definitionContainerChild2.id,
          keys.indirectCategory2.id,
        ];

        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.indirectCategory2.id ? "hidden" : "visible"),
            definitionContainer: (definitionContainerId) => {
              if (definitionContainerId === keys.definitionContainerRoot.id) {
                return "partial";
              }
              if (definitionContainerId === keys.definitionContainerChild2.id) {
                return "hidden";
              }
              return "visible";
            },
          },
          expectedIds,
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.indirectCategory.id], isVisible: true, enableAllSubCategories: true }], []);
      });

      it("showing child definition container makes it, all of its contained elements and its parent definition container visible", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
          const indirectSubCategory = insertSubCategory({
            builder,
            parentCategoryId: indirectCategory.id,
            codeValue: "subCategory",
            modelId: definitionModelChild.id,
          });

          return { definitionContainerRoot, definitionContainerChild, indirectCategory, indirectSubCategory };
        });

        const expectedIds = [keys.definitionContainerRoot.id, keys.definitionContainerChild.id, keys.indirectCategory.id, keys.indirectSubCategory.id];

        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          expectedIds,
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.indirectCategory.id], isVisible: true, enableAllSubCategories: true }], []);
      });
    });

    describe("categories", () => {
      it("showing category makes it and all of its subCategories visible", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
          });
          return { category, subCategory };
        });

        const expectedIds = [keys.category.id, keys.subCategory.id];
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          expectedIds,
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: true }], []);
      });

      it("showing category makes it, all of its contained subCategories visible and doesn't affect other categories", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
          });
          const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
          const subCategory2 = insertSubCategory({
            builder,
            parentCategoryId: category2.id,
            codeValue: "subCategory2",
          });

          return { category, category2, subCategory, subCategory2 };
        });

        const expectedIds = [keys.category.id, keys.category2.id, keys.subCategory.id, keys.subCategory2.id];
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.category2.id ? "hidden" : "visible"),
            subCategory: (parentCategoryId) => (parentCategoryId === keys.category2.id ? "hidden" : "visible"),
          },
          expectedIds,
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: true }], []);
      });

      it("showing category makes it, all of its contained subCategories visible and doesn't affect non related definition container", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
          });

          const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
          const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModel.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
          const subCategory2 = insertSubCategory({
            builder,
            parentCategoryId: category2.id,
            codeValue: "subCategory2",
            modelId: definitionContainer.id,
          });

          return { definitionContainer, category, category2, subCategory, subCategory2 };
        });

        const expectedIds = [keys.definitionContainer.id, keys.category.id, keys.category2.id, keys.subCategory.id, keys.subCategory2.id];
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.category2.id ? "hidden" : "visible"),
            subCategory: (parentCategoryId) => (parentCategoryId === keys.category2.id ? "hidden" : "visible"),
            definitionContainer: () => "hidden",
          },
          expectedIds,
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: true }], []);
      });

      it("showing category makes it and all of its subcategories visible, and parent container partially visible if it has more direct child categories", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
            modelId: definitionModelRoot.id,
          });
          const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
          const subCategory2 = insertSubCategory({
            builder,
            parentCategoryId: category2.id,
            codeValue: "subCategory2",
            modelId: definitionModelRoot.id,
          });
          return { definitionContainerRoot, category, category2, subCategory, subCategory2 };
        });

        const expectedIds = [keys.definitionContainerRoot.id, keys.category.id, keys.category2.id, keys.subCategory.id, keys.subCategory2.id];

        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.category2.id ? "hidden" : "visible"),
            subCategory: (parentCategoryId) => (parentCategoryId === keys.category2.id ? "hidden" : "visible"),
            definitionContainer: () => "partial",
          },
          expectedIds,
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: true }], []);
      });

      it("showing category makes it and all of its subCategories visible, and parent container partially visible if it has more definition containers", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
            modelId: definitionModelRoot.id,
          });
          return { definitionContainerRoot, definitionContainerChild, category, indirectCategory, subCategory };
        });

        const expectedIds = [
          keys.definitionContainerRoot.id,
          keys.definitionContainerChild.id,
          keys.indirectCategory.id,
          keys.category.id,
          keys.subCategory.id,
        ];

        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.indirectCategory.id ? "hidden" : "visible"),
            subCategory: () => "visible",
            definitionContainer: (definitionContainerId) => {
              if (definitionContainerId === keys.definitionContainerRoot.id) {
                return "partial";
              }
              return "hidden";
            },
          },
          expectedIds,
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: true }], []);
      });
    });

    describe("subCategories", () => {
      it("showing subCategory makes it visible and its parent category partially visible, and doesn't affect other subCategories", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
          });
          const subCategory2 = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory2",
          });
          return { category, subCategory, subCategory2 };
        });

        const expectedIds = [keys.category.id, keys.subCategory.id, keys.subCategory2.id];
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: () => "partial",
            subCategory: (_, subCategoryId) => (subCategoryId === keys.subCategory.id ? "visible" : "hidden"),
          },
          expectedIds,
        });
        viewport.validateChangesCalls(
          [{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: false }],
          [{ subCategoryId: keys.subCategory.id, isVisible: true }],
        );
      });

      it("showing subCategory makes it visible and its parent category partially visible, and doesn't affect other categories", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
          });
          const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
          return { category, subCategory, category2 };
        });

        const expectedIds = [keys.category.id, keys.subCategory.id, keys.category2.id];
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.category.id ? "partial" : "hidden"),
            subCategory: (_, subCategoryId) => (subCategoryId === keys.subCategory.id ? "visible" : "hidden"),
          },
          expectedIds,
        });
        viewport.validateChangesCalls(
          [{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: false }],
          [{ subCategoryId: keys.subCategory.id, isVisible: true }],
        );
      });

      it("showing subCategory makes it visible and parents partially visible", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
            modelId: definitionModelRoot.id,
          });
          return { category, subCategory, definitionContainerRoot };
        });

        const expectedIds = [keys.category.id, keys.subCategory.id, keys.definitionContainerRoot.id];
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: () => "partial",
            subCategory: (_, subCategoryId) => (subCategoryId === keys.subCategory.id ? "visible" : "hidden"),
            definitionContainer: () => "partial",
          },
          expectedIds,
        });
        viewport.validateChangesCalls(
          [{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: false }],
          [{ subCategoryId: keys.subCategory.id, isVisible: true }],
        );
      });

      it("showing subCategory makes it visible and doesn't affect non related definition containers", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
          });
          const categoryOfDefinitionContainer = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: categoryOfDefinitionContainer.id });
          const subCategoryOfDefinitionContainer = insertSubCategory({
            builder,
            parentCategoryId: categoryOfDefinitionContainer.id,
            codeValue: "subCategory2",
            modelId: definitionModelRoot.id,
          });
          return { category, subCategory, definitionContainerRoot, categoryOfDefinitionContainer, subCategoryOfDefinitionContainer };
        });

        const expectedIds = [
          keys.category.id,
          keys.subCategory.id,
          keys.definitionContainerRoot.id,
          keys.categoryOfDefinitionContainer.id,
          keys.subCategoryOfDefinitionContainer.id,
        ];
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.category.id ? "partial" : "hidden"),
            subCategory: (_, subCategoryId) => (subCategoryId === keys.subCategory.id ? "visible" : "hidden"),
            definitionContainer: () => "hidden",
          },
          expectedIds,
        });
        viewport.validateChangesCalls(
          [{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: false }],
          [{ subCategoryId: keys.subCategory.id, isVisible: true }],
        );
      });
    });
  });

  describe("disabling visibility", () => {
    const isVisibleOnInitialize = true;

    it("by default everything is visible", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });

        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        const subCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "subCategory", modelId: definitionModel.id });
        return { definitionContainer, category, subCategory };
      });
      const expectedIds = [keys.category.id, keys.definitionContainer.id, keys.subCategory.id];
      using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
      const { handler, provider, viewport } = visibilityTestData;
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: VisibilityExpectations.all("visible"),
        expectedIds,
      });
    });
    describe("definitionContainers", () => {
      it("hiding definition container makes it and all of its contained elements hidden", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });

          const directCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory1", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: directCategory.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
          const indirectSubCategory = insertSubCategory({
            builder,
            parentCategoryId: indirectCategory.id,
            codeValue: "subCategory",
            modelId: definitionModelChild.id,
          });
          return { definitionContainerRoot, definitionContainerChild, directCategory, indirectCategory, indirectSubCategory };
        });

        const expectedIds = [
          keys.definitionContainerRoot.id,
          keys.definitionContainerChild.id,
          keys.directCategory.id,
          keys.indirectCategory.id,
          keys.indirectSubCategory.id,
        ];
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("hidden"),
          expectedIds,
        });
        viewport.validateChangesCalls(
          [{ categoriesToChange: [keys.directCategory.id, keys.indirectCategory.id], isVisible: false, enableAllSubCategories: false }],
          [],
        );
      });

      it("hiding definition container makes it and all of its contained elements hidden and doesn't affect non contained definition containers", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
          const indirectSubCategory = insertSubCategory({
            builder,
            parentCategoryId: indirectCategory.id,
            codeValue: "subCategory",
            modelId: definitionModelChild.id,
          });

          const definitionContainerRoot2 = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot2" });
          const definitionModelRoot2 = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot2.id });
          const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelRoot2.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
          const subCategory2 = insertSubCategory({ builder, parentCategoryId: category2.id, codeValue: "subCategory2", modelId: definitionModelRoot2.id });

          return {
            definitionContainerRoot,
            definitionContainerChild,
            indirectCategory,
            indirectSubCategory,
            definitionContainerRoot2,
            category2,
            subCategory2,
          };
        });

        const expectedIds = [
          keys.definitionContainerRoot.id,
          keys.definitionContainerChild.id,
          keys.definitionContainerRoot2.id,
          keys.category2.id,
          keys.indirectCategory.id,
          keys.indirectSubCategory.id,
          keys.subCategory2.id,
        ];
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.indirectCategory.id ? "hidden" : "visible"),
            subCategory: (parentCategoryId) => (parentCategoryId === keys.indirectCategory.id ? "hidden" : "visible"),
            definitionContainer: (definitionContainerId) => (definitionContainerId !== keys.definitionContainerRoot2.id ? "hidden" : "visible"),
          },
          expectedIds,
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.indirectCategory.id], isVisible: false, enableAllSubCategories: false }], []);
      });

      it("hiding definition container makes it and all of its contained elements hidden, and parent container partially visible if it has more direct child categories", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });

          const directCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory1", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: directCategory.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
          return { definitionContainerRoot, definitionContainerChild, directCategory, indirectCategory };
        });

        const expectedIds = [keys.definitionContainerRoot.id, keys.definitionContainerChild.id, keys.directCategory.id, keys.indirectCategory.id];

        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.indirectCategory.id ? "hidden" : "visible"),
            definitionContainer: (definitionContainerId) => (definitionContainerId === keys.definitionContainerRoot.id ? "partial" : "hidden"),
          },
          expectedIds,
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.indirectCategory.id], isVisible: false, enableAllSubCategories: false }], []);
      });

      it("hiding definition container makes it and all of its contained elements hidden, and parent container partially visible if it has more definition containers", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });

          const definitionContainerChild2 = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild2", modelId: definitionModelRoot.id });
          const definitionModelChild2 = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild2.id });
          const indirectCategory2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelChild2.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory2.id });
          return { definitionContainerRoot, definitionContainerChild, indirectCategory2, indirectCategory, definitionContainerChild2 };
        });

        const expectedIds = [
          keys.definitionContainerRoot.id,
          keys.definitionContainerChild.id,
          keys.indirectCategory.id,
          keys.definitionContainerChild2.id,
          keys.indirectCategory2.id,
        ];

        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.indirectCategory.id ? "hidden" : "visible"),
            definitionContainer: (definitionContainerId) => {
              if (definitionContainerId === keys.definitionContainerRoot.id) {
                return "partial";
              }
              if (definitionContainerId === keys.definitionContainerChild.id) {
                return "hidden";
              }
              return "visible";
            },
          },
          expectedIds,
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.indirectCategory.id], isVisible: false, enableAllSubCategories: false }], []);
      });

      it("hiding child definition container makes it, all of its contained elements and its parent definition container hidden", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
          const indirectSubCategory = insertSubCategory({
            builder,
            parentCategoryId: indirectCategory.id,
            codeValue: "subCategory",
            modelId: definitionModelChild.id,
          });

          return { definitionContainerRoot, definitionContainerChild, indirectCategory, indirectSubCategory };
        });

        const expectedIds = [keys.definitionContainerRoot.id, keys.definitionContainerChild.id, keys.indirectCategory.id, keys.indirectSubCategory.id];

        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("hidden"),
          expectedIds,
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.indirectCategory.id], isVisible: false, enableAllSubCategories: false }], []);
      });
    });

    describe("categories", () => {
      it("hiding category makes it and all of its subCategories hidden", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
          });
          return { category, subCategory };
        });

        const expectedIds = [keys.category.id, keys.subCategory.id];
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("hidden"),
          expectedIds,
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: false, enableAllSubCategories: false }], []);
      });

      it("hiding category makes it, all of its contained subCategories hidden and doesn't affect other categories", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
          });
          const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
          const subCategory2 = insertSubCategory({
            builder,
            parentCategoryId: category2.id,
            codeValue: "subCategory2",
          });

          return { category, category2, subCategory, subCategory2 };
        });

        const expectedIds = [keys.category.id, keys.category2.id, keys.subCategory.id, keys.subCategory2.id];
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.category.id ? "hidden" : "visible"),
            subCategory: (parentCategoryId) => (parentCategoryId === keys.category.id ? "hidden" : "visible"),
          },
          expectedIds,
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: false, enableAllSubCategories: false }], []);
      });

      it("hiding category makes it, all of its contained subCategories hidden and doesn't affect non related definition container", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
          });

          const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
          const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModel.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
          const subCategory2 = insertSubCategory({
            builder,
            parentCategoryId: category2.id,
            codeValue: "subCategory2",
            modelId: definitionContainer.id,
          });

          return { definitionContainer, category, category2, subCategory, subCategory2 };
        });

        const expectedIds = [keys.definitionContainer.id, keys.category.id, keys.category2.id, keys.subCategory.id, keys.subCategory2.id];
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.category.id ? "hidden" : "visible"),
            subCategory: (parentCategoryId) => (parentCategoryId === keys.category.id ? "hidden" : "visible"),
            definitionContainer: () => "visible",
          },
          expectedIds,
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: false, enableAllSubCategories: false }], []);
      });

      it("hiding category makes it and all of its subcategories hidden, and parent container partially visible if it has more direct child categories", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
            modelId: definitionModelRoot.id,
          });
          const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
          const subCategory2 = insertSubCategory({
            builder,
            parentCategoryId: category2.id,
            codeValue: "subCategory2",
            modelId: definitionModelRoot.id,
          });
          return { definitionContainerRoot, category, category2, subCategory, subCategory2 };
        });

        const expectedIds = [keys.definitionContainerRoot.id, keys.category.id, keys.category2.id, keys.subCategory.id, keys.subCategory2.id];

        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.category.id ? "hidden" : "visible"),
            subCategory: (parentCategoryId) => (parentCategoryId === keys.category.id ? "hidden" : "visible"),
            definitionContainer: () => "partial",
          },
          expectedIds,
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: false, enableAllSubCategories: false }], []);
      });

      it("hiding category makes it and all of its subCategories hidden, and parent container partially visible if it has more definition containers", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
            modelId: definitionModelRoot.id,
          });
          return { definitionContainerRoot, definitionContainerChild, category, indirectCategory, subCategory };
        });

        const expectedIds = [
          keys.definitionContainerRoot.id,
          keys.definitionContainerChild.id,
          keys.indirectCategory.id,
          keys.category.id,
          keys.subCategory.id,
        ];

        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.category.id ? "hidden" : "visible"),
            subCategory: () => "hidden",
            definitionContainer: (definitionContainerId) => {
              if (definitionContainerId === keys.definitionContainerRoot.id) {
                return "partial";
              }
              return "visible";
            },
          },
          expectedIds,
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: false, enableAllSubCategories: false }], []);
      });
    });

    describe("subCategories", () => {
      it("hiding subCategory makes it hidden and its parent category partially visible, and doesn't affect other subCategories", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
          });
          const subCategory2 = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory2",
          });
          return { category, subCategory, subCategory2 };
        });

        const expectedIds = [keys.category.id, keys.subCategory.id, keys.subCategory2.id];
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: () => "partial",
            subCategory: (_, subCategoryId) => (subCategoryId === keys.subCategory.id ? "hidden" : "visible"),
          },
          expectedIds,
        });
        viewport.validateChangesCalls([], [{ subCategoryId: keys.subCategory.id, isVisible: false }]);
      });

      it("showing subCategory makes it visible and its parent category partially visible, and doesn't affect other categories", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
          });
          const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
          return { category, subCategory, category2 };
        });

        const expectedIds = [keys.category.id, keys.subCategory.id, keys.category2.id];
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.category.id ? "partial" : "visible"),
            subCategory: (_, subCategoryId) => (subCategoryId === keys.subCategory.id ? "hidden" : "visible"),
          },
          expectedIds,
        });
        viewport.validateChangesCalls([], [{ subCategoryId: keys.subCategory.id, isVisible: false }]);
      });

      it("hiding subCategory makes it hidden and parents partially visible", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
            modelId: definitionModelRoot.id,
          });
          return { category, subCategory, definitionContainerRoot };
        });

        const expectedIds = [keys.category.id, keys.subCategory.id, keys.definitionContainerRoot.id];
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: () => "partial",
            subCategory: (_, subCategoryId) => (subCategoryId === keys.subCategory.id ? "hidden" : "visible"),
            definitionContainer: () => "partial",
          },
          expectedIds,
        });
        viewport.validateChangesCalls([], [{ subCategoryId: keys.subCategory.id, isVisible: false }]);
      });

      it("hiding subCategory makes it hidden and doesn't affect non related definition containers", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
          });
          const categoryOfDefinitionContainer = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: categoryOfDefinitionContainer.id });
          const subCategoryOfDefinitionContainer = insertSubCategory({
            builder,
            parentCategoryId: categoryOfDefinitionContainer.id,
            codeValue: "subCategory2",
            modelId: definitionModelRoot.id,
          });
          return { category, subCategory, definitionContainerRoot, categoryOfDefinitionContainer, subCategoryOfDefinitionContainer };
        });

        const expectedIds = [
          keys.category.id,
          keys.subCategory.id,
          keys.definitionContainerRoot.id,
          keys.categoryOfDefinitionContainer.id,
          keys.subCategoryOfDefinitionContainer.id,
        ];
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.category.id ? "partial" : "visible"),
            subCategory: (_, subCategoryId) => (subCategoryId === keys.subCategory.id ? "hidden" : "visible"),
            definitionContainer: () => "visible",
          },
          expectedIds,
        });
        viewport.validateChangesCalls([], [{ subCategoryId: keys.subCategory.id, isVisible: false }]);
      });
    });
  });
});
