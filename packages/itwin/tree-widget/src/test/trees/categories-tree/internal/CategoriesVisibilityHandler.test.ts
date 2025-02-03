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
import { createCategoryHierarchyNode, createDefinitionContainerHierarchyNode, createSubCategoryHierarchyNode, ViewportMock } from "./Utils.js";
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

  async function createCommonProps(imodel: IModelConnection) {
    const imodelAccess = createIModelAccess(imodel);
    const idsCache = new CategoriesTreeIdsCache(imodelAccess, "3d");

    const viewportMock = new ViewportMock(idsCache);
    const viewport = await viewportMock.createViewportStub();
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

  async function createVisibilityTestData({ imodel }: { imodel: IModelConnection }) {
    const commonProps = await createCommonProps(imodel);
    const handler = new CategoriesVisibilityHandler(commonProps);
    const provider = createProvider({ ...commonProps });
    return {
      handler,
      provider,
      ...commonProps,
      [Symbol.dispose]() {
        handler[Symbol.dispose]();
      },
    };
  }

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
    const nodesToExpect = [keys.category.id, keys.definitionContainer.id, keys.subCategory.id];
    using visibilityTestData = await createVisibilityTestData({ imodel });
    const { handler, provider, viewport } = visibilityTestData;
    await validateHierarchyVisibility({
      provider,
      handler,
      viewport,
      visibilityExpectations: VisibilityExpectations.all("hidden"),
      nodesToExpect,
    });
  });

  describe("enabling visibility", () => {
    describe("definitionContainers", () => {
      it("showing definitionContainer makes it and all of its contained elements visible", async function () {
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

        const nodesToExpect = [
          keys.definitionContainerRoot.id,
          keys.definitionContainerChild.id,
          keys.directCategory.id,
          keys.indirectCategory.id,
          keys.indirectSubCategory.id,
        ];
        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(
          viewport,
          [{ categoriesToChange: [keys.directCategory.id, keys.indirectCategory.id], isVisible: true, enableAllSubCategories: true }],
          [],
        );
      });

      it("showing definitionContainer makes it and all of its contained elements visible and doesn't affect non contained definitionContainers", async function () {
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

        const nodesToExpect = [
          keys.definitionContainerRoot.id,
          keys.definitionContainerChild.id,
          keys.definitionContainerRoot2.id,
          keys.category2.id,
          keys.indirectCategory.id,
          keys.indirectSubCategory.id,
          keys.subCategory2.id,
        ];
        using visibilityTestData = await createVisibilityTestData({ imodel });
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
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [{ categoriesToChange: [keys.indirectCategory.id], isVisible: true, enableAllSubCategories: true }], []);
      });

      it("showing definitionContainer makes it and all of its contained elements visible, and parent container partially visible if it has more direct child categories", async function () {
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

        const nodesToExpect = [keys.definitionContainerRoot.id, keys.definitionContainerChild.id, keys.directCategory.id, keys.indirectCategory.id];

        using visibilityTestData = await createVisibilityTestData({ imodel });
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
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [{ categoriesToChange: [keys.indirectCategory.id], isVisible: true, enableAllSubCategories: true }], []);
      });

      it("showing definitionContainer makes it and all of its contained elements visible, and parent container partially visible if it has more definitionContainers", async function () {
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

        const nodesToExpect = [
          keys.definitionContainerRoot.id,
          keys.definitionContainerChild.id,
          keys.indirectCategory.id,
          keys.definitionContainerChild2.id,
          keys.indirectCategory2.id,
        ];

        using visibilityTestData = await createVisibilityTestData({ imodel });
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
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [{ categoriesToChange: [keys.indirectCategory.id], isVisible: true, enableAllSubCategories: true }], []);
      });

      it("showing child definitionContainer makes it, all of its contained elements and its parent definitionContainer visible", async function () {
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

        const nodesToExpect = [keys.definitionContainerRoot.id, keys.definitionContainerChild.id, keys.indirectCategory.id, keys.indirectSubCategory.id];

        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [{ categoriesToChange: [keys.indirectCategory.id], isVisible: true, enableAllSubCategories: true }], []);
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

        const nodesToExpect = [keys.category.id, keys.subCategory.id];
        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: true }], []);
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

        const nodesToExpect = [keys.category.id, keys.category2.id, keys.subCategory.id, keys.subCategory2.id];
        using visibilityTestData = await createVisibilityTestData({ imodel });
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
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: true }], []);
      });

      it("showing category makes it, all of its contained subCategories visible and doesn't affect non related definitionContainer", async function () {
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

        const nodesToExpect = [keys.definitionContainer.id, keys.category.id, keys.category2.id, keys.subCategory.id, keys.subCategory2.id];
        using visibilityTestData = await createVisibilityTestData({ imodel });
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
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: true }], []);
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

        const nodesToExpect = [keys.definitionContainerRoot.id, keys.category.id, keys.category2.id, keys.subCategory.id, keys.subCategory2.id];

        using visibilityTestData = await createVisibilityTestData({ imodel });
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
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: true }], []);
      });

      it("showing category makes it and all of its subCategories visible, and parent container partially visible if it has more definitionContainers", async function () {
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

        const nodesToExpect = [
          keys.definitionContainerRoot.id,
          keys.definitionContainerChild.id,
          keys.indirectCategory.id,
          keys.category.id,
          keys.subCategory.id,
        ];

        using visibilityTestData = await createVisibilityTestData({ imodel });
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
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: true }], []);
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

        const nodesToExpect = [keys.category.id, keys.subCategory.id, keys.subCategory2.id];
        using visibilityTestData = await createVisibilityTestData({ imodel });
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
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(
          viewport,
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

        const nodesToExpect = [keys.category.id, keys.subCategory.id, keys.category2.id];
        using visibilityTestData = await createVisibilityTestData({ imodel });
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
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(
          viewport,
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

        const nodesToExpect = [keys.category.id, keys.subCategory.id, keys.definitionContainerRoot.id];
        using visibilityTestData = await createVisibilityTestData({ imodel });
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
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(
          viewport,
          [{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: false }],
          [{ subCategoryId: keys.subCategory.id, isVisible: true }],
        );
      });

      it("showing subCategory makes it visible and doesn't affect non related definitionContainers", async function () {
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

        const nodesToExpect = [
          keys.category.id,
          keys.subCategory.id,
          keys.definitionContainerRoot.id,
          keys.categoryOfDefinitionContainer.id,
          keys.subCategoryOfDefinitionContainer.id,
        ];
        using visibilityTestData = await createVisibilityTestData({ imodel });
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
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(
          viewport,
          [{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: false }],
          [{ subCategoryId: keys.subCategory.id, isVisible: true }],
        );
      });
    });
  });

  describe("disabling visibility", () => {
    describe("definitionContainers", () => {
      it("hiding definitionContainer makes it and all of its contained elements hidden", async function () {
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

        const nodesToExpect = [
          keys.definitionContainerRoot.id,
          keys.definitionContainerChild.id,
          keys.directCategory.id,
          keys.indirectCategory.id,
          keys.indirectSubCategory.id,
        ];
        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          nodesToExpect,
        });
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("hidden"),
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(
          viewport,
          [{ categoriesToChange: [keys.directCategory.id, keys.indirectCategory.id], isVisible: false, enableAllSubCategories: false }],
          [],
        );
      });

      it("hiding definitionContainer makes it and all of its contained elements hidden and doesn't affect non contained definitionContainers", async function () {
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

        const nodesToExpect = [
          keys.definitionContainerRoot.id,
          keys.definitionContainerChild.id,
          keys.definitionContainerRoot2.id,
          keys.category2.id,
          keys.indirectCategory.id,
          keys.indirectSubCategory.id,
          keys.subCategory2.id,
        ];
        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot2.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          nodesToExpect,
        });
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
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [{ categoriesToChange: [keys.indirectCategory.id], isVisible: false, enableAllSubCategories: false }], []);
      });

      it("hiding definitionContainer makes it and all of its contained elements hidden, and parent container partially visible if it has more direct child categories", async function () {
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

        const nodesToExpect = [keys.definitionContainerRoot.id, keys.definitionContainerChild.id, keys.directCategory.id, keys.indirectCategory.id];

        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          nodesToExpect,
        });

        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.indirectCategory.id ? "hidden" : "visible"),
            definitionContainer: (definitionContainerId) => (definitionContainerId === keys.definitionContainerRoot.id ? "partial" : "hidden"),
          },
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [{ categoriesToChange: [keys.indirectCategory.id], isVisible: false, enableAllSubCategories: false }], []);
      });

      it("hiding definitionContainer makes it and all of its contained elements hidden, and parent container partially visible if it has more definitionContainers", async function () {
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

        const nodesToExpect = [
          keys.definitionContainerRoot.id,
          keys.definitionContainerChild.id,
          keys.indirectCategory.id,
          keys.definitionContainerChild2.id,
          keys.indirectCategory2.id,
        ];

        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          nodesToExpect,
        });

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
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [{ categoriesToChange: [keys.indirectCategory.id], isVisible: false, enableAllSubCategories: false }], []);
      });

      it("hiding child definitionContainer makes it, all of its contained elements and its parent definitionContainer hidden", async function () {
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

        const nodesToExpect = [keys.definitionContainerRoot.id, keys.definitionContainerChild.id, keys.indirectCategory.id, keys.indirectSubCategory.id];

        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          nodesToExpect,
        });

        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("hidden"),
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [{ categoriesToChange: [keys.indirectCategory.id], isVisible: false, enableAllSubCategories: false }], []);
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

        const nodesToExpect = [keys.category.id, keys.subCategory.id];
        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          nodesToExpect,
        });

        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("hidden"),
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [{ categoriesToChange: [keys.category.id], isVisible: false, enableAllSubCategories: false }], []);
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

        const nodesToExpect = [keys.category.id, keys.category2.id, keys.subCategory.id, keys.subCategory2.id];
        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
        await handler.changeVisibility(createCategoryHierarchyNode(keys.category2.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          nodesToExpect,
        });

        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.category.id ? "hidden" : "visible"),
            subCategory: (parentCategoryId) => (parentCategoryId === keys.category.id ? "hidden" : "visible"),
          },
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [{ categoriesToChange: [keys.category.id], isVisible: false, enableAllSubCategories: false }], []);
      });

      it("hiding category makes it, all of its contained subCategories hidden and doesn't affect non related definitionContainer", async function () {
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

        const nodesToExpect = [keys.definitionContainer.id, keys.category.id, keys.category2.id, keys.subCategory.id, keys.subCategory2.id];
        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainer.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          nodesToExpect,
        });

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
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [{ categoriesToChange: [keys.category.id], isVisible: false, enableAllSubCategories: false }], []);
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

        const nodesToExpect = [keys.definitionContainerRoot.id, keys.category.id, keys.category2.id, keys.subCategory.id, keys.subCategory2.id];

        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          nodesToExpect,
        });

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
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [{ categoriesToChange: [keys.category.id], isVisible: false, enableAllSubCategories: false }], []);
      });

      it("hiding category makes it and all of its subCategories hidden, and parent container partially visible if it has more definitionContainers", async function () {
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

        const nodesToExpect = [
          keys.definitionContainerRoot.id,
          keys.definitionContainerChild.id,
          keys.indirectCategory.id,
          keys.category.id,
          keys.subCategory.id,
        ];

        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          nodesToExpect,
        });

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
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [{ categoriesToChange: [keys.category.id], isVisible: false, enableAllSubCategories: false }], []);
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

        const nodesToExpect = [keys.category.id, keys.subCategory.id, keys.subCategory2.id];
        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          nodesToExpect,
        });

        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: () => "partial",
            subCategory: (_, subCategoryId) => (subCategoryId === keys.subCategory.id ? "hidden" : "visible"),
          },
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [], [{ subCategoryId: keys.subCategory.id, isVisible: false }]);
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

        const nodesToExpect = [keys.category.id, keys.subCategory.id, keys.category2.id];
        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
        await handler.changeVisibility(createCategoryHierarchyNode(keys.category2.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          nodesToExpect,
        });

        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            category: (categoryId) => (categoryId === keys.category.id ? "partial" : "visible"),
            subCategory: (_, subCategoryId) => (subCategoryId === keys.subCategory.id ? "hidden" : "visible"),
          },
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [], [{ subCategoryId: keys.subCategory.id, isVisible: false }]);
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

        const nodesToExpect = [keys.category.id, keys.subCategory.id, keys.definitionContainerRoot.id];
        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          nodesToExpect,
        });

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
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [], [{ subCategoryId: keys.subCategory.id, isVisible: false }]);
      });

      it("hiding subCategory makes it hidden and doesn't affect non related definitionContainers", async function () {
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

        const nodesToExpect = [
          keys.category.id,
          keys.subCategory.id,
          keys.definitionContainerRoot.id,
          keys.categoryOfDefinitionContainer.id,
          keys.subCategoryOfDefinitionContainer.id,
        ];
        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
          nodesToExpect,
        });

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
          nodesToExpect,
        });
        ViewportMock.validateChangesCalls(viewport, [], [{ subCategoryId: keys.subCategory.id, isVisible: false }]);
      });
    });
  });
});
