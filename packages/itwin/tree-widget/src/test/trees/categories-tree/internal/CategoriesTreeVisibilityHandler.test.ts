/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import { IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import {
  CategoriesTreeDefinition,
  defaultHierarchyConfiguration,
} from "../../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeDefinition.js";
import { CategoriesTreeIdsCache } from "../../../../tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeIdsCache.js";
import { createCategoriesTreeVisibilityHandler } from "../../../../tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeVisibilityHandler.js";
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
import {
  createCategoryHierarchyNode,
  createDefinitionContainerHierarchyNode,
  createElementHierarchyNode,
  createSubCategoryHierarchyNode,
  createViewportStub,
} from "./Utils.js";
import { validateHierarchyVisibility } from "./VisibilityValidation.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { CategoriesTreeHierarchyConfiguration } from "../../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeDefinition.js";
import type { HierarchyNodeIdentifiersPath } from "@itwin/presentation-hierarchies";

describe("CategoriesTreeVisibilityHandler", () => {
  before(async () => {
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
    await TestUtils.initialize();
    // eslint-disable-next-line @itwin/no-internal
    ECSchemaRpcImpl.register();
  });

  after(async () => {
    await terminatePresentationTesting();
    TestUtils.terminate();
  });

  async function createCommonProps(imodel: IModelConnection, isVisibleOnInitialize: boolean, showElements?: boolean, hideSubCategories?: boolean) {
    const imodelAccess = createIModelAccess(imodel);
    const idsCache = new CategoriesTreeIdsCache(imodelAccess, "3d");
    const viewport = await createViewportStub({ idsCache, isVisibleOnInitialize, imodel });
    return {
      imodelAccess,
      viewport,
      idsCache,
      hierarchyConfig: {
        hideSubCategories: hideSubCategories === undefined ? defaultHierarchyConfiguration.hideSubCategories : hideSubCategories,
        showElements: showElements === undefined ? defaultHierarchyConfiguration.showElements : showElements,
      },
    };
  }

  function createProvider(props: {
    idsCache: CategoriesTreeIdsCache;
    imodelAccess: ReturnType<typeof createIModelAccess>;
    filterPaths?: HierarchyNodeIdentifiersPath[];
    hierarchyConfig: CategoriesTreeHierarchyConfiguration;
  }) {
    return createIModelHierarchyProvider({
      hierarchyDefinition: new CategoriesTreeDefinition({ ...props, viewType: "3d" }),
      imodelAccess: props.imodelAccess,
      ...(props.filterPaths ? { filtering: { paths: props.filterPaths } } : undefined),
    });
  }

  async function createVisibilityTestData({
    imodel,
    isVisibleOnInitialize,
    showElements,
    hideSubCategories,
  }: {
    imodel: IModelConnection;
    isVisibleOnInitialize: boolean;
    showElements?: boolean;
    hideSubCategories?: boolean;
  }) {
    const commonProps = await createCommonProps(imodel, isVisibleOnInitialize, showElements, hideSubCategories);
    const handler = createCategoriesTreeVisibilityHandler(commonProps);
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
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });

        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "subCategory", modelId: definitionModel.id });
      });

      const { imodel } = buildIModelResult;
      using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
      const { handler, provider, viewport } = visibilityTestData;

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
    });
    describe("definitionContainers", () => {
      it("showing definition container makes it and all of its contained elements visible", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-visible",
        });
        viewport.validateChangesCalls(
          [{ categoriesToChange: [keys.directCategory.id, keys.indirectCategory.id], isVisible: true, enableAllSubCategories: true }],
          [],
        );
      });

      it("showing definition container makes it and all of its contained elements visible and doesn't affect non contained definition containers", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.definitionContainerRoot2.id]: "hidden",
            [keys.definitionContainerRoot.id]: "visible",
            [keys.definitionContainerChild.id]: "visible",
            [keys.category2.id]: "hidden",
            [keys.indirectCategory.id]: "visible",
            [keys.subCategory2.id]: "hidden",
            [keys.indirectSubCategory.id]: "visible",
          },
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.indirectCategory.id], isVisible: true, enableAllSubCategories: true }], []);
      });

      it("showing definition container makes it and all of its contained elements visible, and parent container partially visible if it has more direct child categories", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
            [keys.definitionContainerChild.id]: "visible",
            [keys.directCategory.id]: "hidden",
            [keys.indirectCategory.id]: "visible",
          },
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.indirectCategory.id], isVisible: true, enableAllSubCategories: true }], []);
      });

      it("showing definition container makes it and all of its contained elements visible, and parent container partially visible if it has more definition containers", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
            [keys.definitionContainerChild.id]: "visible",
            [keys.definitionContainerChild2.id]: "hidden",
            [keys.indirectCategory2.id]: "hidden",
            [keys.indirectCategory.id]: "visible",
          },
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.indirectCategory.id], isVisible: true, enableAllSubCategories: true }], []);
      });

      it("showing child definition container makes it, all of its contained elements and its parent definition container visible", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-visible",
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.indirectCategory.id], isVisible: true, enableAllSubCategories: true }], []);
      });
    });

    describe("categories", () => {
      it("showing category makes it and all of its subCategories visible", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-visible",
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: true }], []);
      });

      it("showing category makes it, all of its contained subCategories visible and doesn't affect other categories", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.category2.id]: "hidden",
            [keys.category.id]: "visible",
            [keys.subCategory2.id]: "hidden",
            [keys.subCategory.id]: "visible",
          },
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: true }], []);
      });

      it("showing category makes it, all of its contained subCategories visible and doesn't affect non related definition container", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.definitionContainer.id]: "hidden",
            [keys.category2.id]: "hidden",
            [keys.category.id]: "visible",
            [keys.subCategory2.id]: "hidden",
            [keys.subCategory.id]: "visible",
          },
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: true }], []);
      });

      it("showing category makes it and all of its subcategories visible, and parent container partially visible if it has more direct child categories", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
            [keys.category2.id]: "hidden",
            [keys.category.id]: "visible",
            [keys.subCategory2.id]: "hidden",
            [keys.subCategory.id]: "visible",
          },
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: true }], []);
      });

      it("showing category makes it and all of its subCategories visible, and parent container partially visible if it has more definition containers", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
            [keys.definitionContainerChild.id]: "hidden",
            [keys.indirectCategory.id]: "hidden",
            [keys.category.id]: "visible",
            [keys.subCategory.id]: "visible",
          },
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: true }], []);
      });
    });

    describe("subCategories", () => {
      it("showing subCategory makes it visible and its parent category partially visible, and doesn't affect other subCategories", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.category.id]: "partial",
            [keys.subCategory.id]: "visible",
            [keys.subCategory2.id]: "hidden",
          },
        });
        viewport.validateChangesCalls(
          [{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: false }],
          [{ subCategoryId: keys.subCategory.id, isVisible: true }],
        );
      });

      it("showing subCategory makes it visible and its parent category partially visible, and doesn't affect other categories", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.category2.id]: "hidden",
            [keys.category.id]: "partial",
            [keys.subCategory.id]: "visible",
          },
        });
        viewport.validateChangesCalls(
          [{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: false }],
          [{ subCategoryId: keys.subCategory.id, isVisible: true }],
        );
      });

      it("showing subCategory makes it visible and parents partially visible", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
            [keys.category.id]: "partial",
            [keys.subCategory.id]: "visible",
          },
        });
        viewport.validateChangesCalls(
          [{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: false }],
          [{ subCategoryId: keys.subCategory.id, isVisible: true }],
        );
      });

      it("showing subCategory makes it visible and doesn't affect non related definition containers", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.definitionContainerRoot.id]: "hidden",
            [keys.categoryOfDefinitionContainer.id]: "hidden",
            [keys.subCategoryOfDefinitionContainer.id]: "hidden",
            [keys.category.id]: "partial",
            [keys.subCategory.id]: "visible",
          },
        });
        viewport.validateChangesCalls(
          [{ categoriesToChange: [keys.category.id], isVisible: true, enableAllSubCategories: false }],
          [{ subCategoryId: keys.subCategory.id, isVisible: true }],
        );
      });
    });

    describe("hideSubCategories set to true", () => {
      it("showing subCategory does not do anything", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize, hideSubCategories: true });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-hidden",
        });
      });
    });

    describe("showElements set to true", () => {
      describe("definitionContainers", () => {
        it("showing definition container makes it and all of its contained elements visible", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

            const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
            const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });

            const directCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory1", modelId: definitionModelRoot.id });
            insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: directCategory.id });
            const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelChild.id });
            insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
            insertSubCategory({
              builder,
              parentCategoryId: indirectCategory.id,
              codeValue: "subCategory",
              modelId: definitionModelChild.id,
            });
            return { definitionContainerRoot };
          });

          const { imodel, ...keys } = buildIModelResult;
          using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize, showElements: true });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: "all-visible",
          });
        });

        it("showing definition container makes it and all of its contained elements visible and doesn't affect non contained definition containers", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
            const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
            const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
            const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
            const indirectElement = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
            const indirectSubCategory = insertSubCategory({
              builder,
              parentCategoryId: indirectCategory.id,
              codeValue: "subCategory",
              modelId: definitionModelChild.id,
            });

            const definitionContainerRoot2 = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot2" });
            const definitionModelRoot2 = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot2.id });
            const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelRoot2.id });
            const element2 = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
            const subCategory2 = insertSubCategory({ builder, parentCategoryId: category2.id, codeValue: "subCategory2", modelId: definitionModelRoot2.id });

            return {
              definitionContainerRoot,
              definitionContainerChild,
              indirectCategory,
              indirectSubCategory,
              definitionContainerRoot2,
              category2,
              subCategory2,
              indirectElement,
              element2,
            };
          });

          const { imodel, ...keys } = buildIModelResult;
          using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize, showElements: true });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: {
              [keys.definitionContainerRoot2.id]: "hidden",
              [keys.definitionContainerRoot.id]: "visible",
              [keys.definitionContainerChild.id]: "visible",
              [keys.category2.id]: "hidden",
              [keys.element2.id]: "hidden",
              [keys.indirectCategory.id]: "visible",
              [keys.indirectElement.id]: "visible",
              [keys.subCategory2.id]: "hidden",
              [keys.indirectSubCategory.id]: "visible",
            },
          });
        });

        it("showing definition container makes it and all of its contained elements visible, and parent container partially visible if it has more direct child categories", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

            const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
            const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });

            const directCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory1", modelId: definitionModelRoot.id });
            const directElement = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: directCategory.id });
            const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelChild.id });
            const indirectElement = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
            return { definitionContainerRoot, definitionContainerChild, directCategory, indirectCategory, directElement, indirectElement };
          });

          const { imodel, ...keys } = buildIModelResult;
          using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize, showElements: true });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: {
              [keys.definitionContainerRoot.id]: "partial",
              [keys.definitionContainerChild.id]: "visible",
              [keys.directCategory.id]: "hidden",
              [keys.indirectCategory.id]: "visible",
              [keys.indirectElement.id]: "visible",
              [keys.directElement.id]: "hidden",
            },
          });
        });

        it("showing definition container makes it and all of its contained elements visible, and parent container partially visible if it has more definition containers", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

            const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
            const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
            const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
            const indirectElement = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });

            const definitionContainerChild2 = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild2", modelId: definitionModelRoot.id });
            const definitionModelChild2 = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild2.id });
            const indirectCategory2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelChild2.id });
            const indirectElement2 = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory2.id });
            return {
              definitionContainerRoot,
              definitionContainerChild,
              indirectCategory2,
              indirectCategory,
              definitionContainerChild2,
              indirectElement,
              indirectElement2,
            };
          });

          const { imodel, ...keys } = buildIModelResult;
          using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize, showElements: true });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: {
              [keys.definitionContainerRoot.id]: "partial",
              [keys.definitionContainerChild.id]: "visible",
              [keys.definitionContainerChild2.id]: "hidden",
              [keys.indirectCategory2.id]: "hidden",
              [keys.indirectCategory.id]: "visible",
              [keys.indirectElement.id]: "visible",
              [keys.indirectElement2.id]: "hidden",
            },
          });
        });

        it("showing child definition container makes it, all of its contained elements and its parent definition container visible", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });
            const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
            const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
            const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
            insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
            insertSubCategory({
              builder,
              parentCategoryId: indirectCategory.id,
              codeValue: "subCategory",
              modelId: definitionModelChild.id,
            });

            return { definitionContainerChild };
          });

          const { imodel, ...keys } = buildIModelResult;
          using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: "all-visible",
          });
        });
      });

      describe("categories", () => {
        it("showing category makes it, all of its subCategories and elements visible", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
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

          const { imodel, ...keys } = buildIModelResult;
          using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize, showElements: true });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: "all-visible",
          });
        });

        it("showing category makes it, all of its contained subCategories and elements visible and doesn't affect other categories", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
            const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            const subCategory = insertSubCategory({
              builder,
              parentCategoryId: category.id,
              codeValue: "subCategory",
            });
            const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2" });
            const element2 = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
            const subCategory2 = insertSubCategory({
              builder,
              parentCategoryId: category2.id,
              codeValue: "subCategory2",
            });

            return { category, category2, subCategory, subCategory2, element, element2 };
          });

          const { imodel, ...keys } = buildIModelResult;
          using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize, showElements: true });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: {
              [keys.category2.id]: "hidden",
              [keys.category.id]: "visible",
              [keys.element.id]: "visible",
              [keys.element2.id]: "hidden",
              [keys.subCategory2.id]: "hidden",
              [keys.subCategory.id]: "visible",
            },
          });
        });

        it("showing category makes it, all of its contained subCategories and elements visible and doesn't affect non related definition container", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
            const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            const subCategory = insertSubCategory({
              builder,
              parentCategoryId: category.id,
              codeValue: "subCategory",
            });

            const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
            const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModel.id });
            const element2 = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
            const subCategory2 = insertSubCategory({
              builder,
              parentCategoryId: category2.id,
              codeValue: "subCategory2",
              modelId: definitionContainer.id,
            });

            return { definitionContainer, category, category2, subCategory, subCategory2, element, element2 };
          });

          const { imodel, ...keys } = buildIModelResult;
          using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize, showElements: true });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: {
              [keys.definitionContainer.id]: "hidden",
              [keys.category2.id]: "hidden",
              [keys.category.id]: "visible",
              [keys.subCategory2.id]: "hidden",
              [keys.subCategory.id]: "visible",
              [keys.element.id]: "visible",
              [keys.element2.id]: "hidden",
            },
          });
        });

        it("showing category makes it, all of its subcategories and elements visible, and parent container partially visible if it has more direct child categories", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

            const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelRoot.id });
            const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            const subCategory = insertSubCategory({
              builder,
              parentCategoryId: category.id,
              codeValue: "subCategory",
              modelId: definitionModelRoot.id,
            });
            const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelRoot.id });
            const element2 = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
            const subCategory2 = insertSubCategory({
              builder,
              parentCategoryId: category2.id,
              codeValue: "subCategory2",
              modelId: definitionModelRoot.id,
            });
            return { definitionContainerRoot, category, category2, subCategory, subCategory2, element, element2 };
          });

          const { imodel, ...keys } = buildIModelResult;
          using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize, showElements: true });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: {
              [keys.definitionContainerRoot.id]: "partial",
              [keys.category2.id]: "hidden",
              [keys.category.id]: "visible",
              [keys.subCategory2.id]: "hidden",
              [keys.subCategory.id]: "visible",
              [keys.element2.id]: "hidden",
              [keys.element.id]: "visible",
            },
          });
        });

        it("showing category makes it, all of its subCategories and elements visible, and parent container partially visible if it has more definition containers", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

            const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
            const definitionModelChild = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerChild.id });
            const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
            const indirectElement = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });

            const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelRoot.id });
            const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            const subCategory = insertSubCategory({
              builder,
              parentCategoryId: category.id,
              codeValue: "subCategory",
              modelId: definitionModelRoot.id,
            });
            return { definitionContainerRoot, definitionContainerChild, category, indirectCategory, subCategory, indirectElement, element };
          });

          const { imodel, ...keys } = buildIModelResult;
          using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize, showElements: true });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: {
              [keys.definitionContainerRoot.id]: "partial",
              [keys.definitionContainerChild.id]: "hidden",
              [keys.indirectCategory.id]: "hidden",
              [keys.category.id]: "visible",
              [keys.subCategory.id]: "visible",
              [keys.indirectElement.id]: "hidden",
              [keys.element.id]: "visible",
            },
          });
        });
      });

      describe("subCategories", () => {
        it("showing subCategory makes it and category elements visible and its parent category partially visible, and doesn't affect other subCategories", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

            const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
            const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
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
            return { category, subCategory, subCategory2, element };
          });

          const { imodel, ...keys } = buildIModelResult;
          using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize, showElements: true });
          const { handler, provider, viewport } = visibilityTestData;
          await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);

          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: {
              [keys.category.id]: "partial",
              [keys.subCategory.id]: "visible",
              [keys.subCategory2.id]: "hidden",
              [keys.element.id]: "visible",
            },
          });
        });

        it("showing subCategory makes it and category elements visible and its parent category partially visible, and doesn't affect other categories", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

            const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
            const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            const subCategory = insertSubCategory({
              builder,
              parentCategoryId: category.id,
              codeValue: "subCategory",
            });
            const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2" });
            const element2 = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
            return { category, subCategory, category2, element, element2 };
          });

          const { imodel, ...keys } = buildIModelResult;
          using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize, showElements: true });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: {
              [keys.category2.id]: "hidden",
              [keys.category.id]: "partial",
              [keys.subCategory.id]: "visible",
              [keys.element.id]: "visible",
              [keys.element2.id]: "hidden",
            },
          });
        });

        it("showing subCategory makes it and category elements visible and parents partially visible", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

            const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelRoot.id });
            const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            const subCategory = insertSubCategory({
              builder,
              parentCategoryId: category.id,
              codeValue: "subCategory",
              modelId: definitionModelRoot.id,
            });
            return { category, subCategory, definitionContainerRoot, element };
          });

          const { imodel, ...keys } = buildIModelResult;
          using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize, showElements: true });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: {
              [keys.definitionContainerRoot.id]: "partial",
              [keys.category.id]: "partial",
              [keys.subCategory.id]: "visible",
              [keys.element.id]: "visible",
            },
          });
        });

        it("showing subCategory makes it and category elements visible and doesn't affect non related definition containers", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

            const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
            const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            const subCategory = insertSubCategory({
              builder,
              parentCategoryId: category.id,
              codeValue: "subCategory",
            });
            const categoryOfDefinitionContainer = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelRoot.id });
            const elementOfDefinitionContainer = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: categoryOfDefinitionContainer.id });
            const subCategoryOfDefinitionContainer = insertSubCategory({
              builder,
              parentCategoryId: categoryOfDefinitionContainer.id,
              codeValue: "subCategory2",
              modelId: definitionModelRoot.id,
            });
            return {
              category,
              subCategory,
              definitionContainerRoot,
              categoryOfDefinitionContainer,
              subCategoryOfDefinitionContainer,
              element,
              elementOfDefinitionContainer,
            };
          });

          const { imodel, ...keys } = buildIModelResult;
          using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize, showElements: true });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: {
              [keys.definitionContainerRoot.id]: "hidden",
              [keys.categoryOfDefinitionContainer.id]: "hidden",
              [keys.subCategoryOfDefinitionContainer.id]: "hidden",
              [keys.category.id]: "partial",
              [keys.subCategory.id]: "visible",
              [keys.element.id]: "visible",
              [keys.elementOfDefinitionContainer.id]: "hidden",
            },
          });
        });
      });

      describe("elements", () => {
        it("showing element makes it visible and its parent category partially visible, and doesn't affect other subCategories or elements", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

            const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
            const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            const element2 = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
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
            return { category, subCategory, subCategory2, element, element2, physicalModel };
          });

          const { imodel, ...keys } = buildIModelResult;
          using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize, showElements: true });
          const { handler, provider, viewport } = visibilityTestData;
          await handler.changeVisibility(
            createElementHierarchyNode({ modelId: keys.physicalModel.id, categoryId: keys.category.id, elementId: keys.element.id }),
            true,
          );

          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: {
              [keys.category.id]: "partial",
              [keys.subCategory.id]: "hidden",
              [keys.subCategory2.id]: "hidden",
              [keys.element.id]: "visible",
              [keys.element2.id]: "hidden",
            },
          });
        });

        it("showing element makes it visible and its parent category partially visible, and doesn't affect other categories or subCategories", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

            const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
            const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            const subCategory = insertSubCategory({
              builder,
              parentCategoryId: category.id,
              codeValue: "subCategory",
            });
            const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2" });
            const element2 = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
            return { category, subCategory, category2, element, element2, physicalModel };
          });

          const { imodel, ...keys } = buildIModelResult;
          using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize, showElements: true });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(
            createElementHierarchyNode({ modelId: keys.physicalModel.id, categoryId: keys.category.id, elementId: keys.element.id }),
            true,
          );
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: {
              [keys.category2.id]: "hidden",
              [keys.category.id]: "partial",
              [keys.subCategory.id]: "hidden",
              [keys.element.id]: "visible",
              [keys.element2.id]: "hidden",
            },
          });
        });

        it("showing element makes it visible and parents partially visible", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

            const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelRoot.id });
            const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            const subCategory = insertSubCategory({
              builder,
              parentCategoryId: category.id,
              codeValue: "subCategory",
              modelId: definitionModelRoot.id,
            });
            return { category, subCategory, definitionContainerRoot, element, physicalModel };
          });

          const { imodel, ...keys } = buildIModelResult;
          using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize, showElements: true });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(
            createElementHierarchyNode({ modelId: keys.physicalModel.id, categoryId: keys.category.id, elementId: keys.element.id }),
            true,
          );
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: {
              [keys.definitionContainerRoot.id]: "partial",
              [keys.category.id]: "partial",
              [keys.subCategory.id]: "hidden",
              [keys.element.id]: "visible",
            },
          });
        });

        it("showing subCategory makes it visible and doesn't affect non related definition containers", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainerRoot.id });

            const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
            const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            const subCategory = insertSubCategory({
              builder,
              parentCategoryId: category.id,
              codeValue: "subCategory",
            });
            const categoryOfDefinitionContainer = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelRoot.id });
            const elementOfDefinitionContainer = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: categoryOfDefinitionContainer.id });
            const subCategoryOfDefinitionContainer = insertSubCategory({
              builder,
              parentCategoryId: categoryOfDefinitionContainer.id,
              codeValue: "subCategory2",
              modelId: definitionModelRoot.id,
            });
            return {
              category,
              subCategory,
              definitionContainerRoot,
              categoryOfDefinitionContainer,
              subCategoryOfDefinitionContainer,
              element,
              elementOfDefinitionContainer,
            };
          });

          const { imodel, ...keys } = buildIModelResult;
          using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize, showElements: true });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: {
              [keys.definitionContainerRoot.id]: "hidden",
              [keys.categoryOfDefinitionContainer.id]: "hidden",
              [keys.subCategoryOfDefinitionContainer.id]: "hidden",
              [keys.category.id]: "partial",
              [keys.subCategory.id]: "visible",
              [keys.element.id]: "visible",
              [keys.elementOfDefinitionContainer.id]: "hidden",
            },
          });
        });
      });
    });
  });

  describe("disabling visibility", () => {
    const isVisibleOnInitialize = true;

    it("by default everything is visible", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });

        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "subCategory", modelId: definitionModel.id });
      });

      const { imodel } = buildIModelResult;
      using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
      const { handler, provider, viewport } = visibilityTestData;

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
    });
    describe("definitionContainers", () => {
      it("hiding definition container makes it and all of its contained elements hidden", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;
        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-hidden",
        });
        viewport.validateChangesCalls(
          [{ categoriesToChange: [keys.directCategory.id, keys.indirectCategory.id], isVisible: false, enableAllSubCategories: false }],
          [],
        );
      });

      it("hiding definition container makes it and all of its contained elements hidden and doesn't affect non contained definition containers", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.definitionContainerRoot2.id]: "visible",
            [keys.definitionContainerRoot.id]: "hidden",
            [keys.definitionContainerChild.id]: "hidden",
            [keys.indirectCategory.id]: "hidden",
            [keys.category2.id]: "visible",
            [keys.indirectSubCategory.id]: "hidden",
            [keys.subCategory2.id]: "visible",
          },
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.indirectCategory.id], isVisible: false, enableAllSubCategories: false }], []);
      });

      it("hiding definition container makes it and all of its contained elements hidden, and parent container partially visible if it has more direct child categories", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
            [keys.definitionContainerChild.id]: "hidden",
            [keys.indirectCategory.id]: "hidden",
            [keys.directCategory.id]: "visible",
          },
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.indirectCategory.id], isVisible: false, enableAllSubCategories: false }], []);
      });

      it("hiding definition container makes it and all of its contained elements hidden, and parent container partially visible if it has more definition containers", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
            [keys.definitionContainerChild.id]: "hidden",
            [keys.definitionContainerChild2.id]: "visible",
            [keys.indirectCategory.id]: "hidden",
            [keys.indirectCategory2.id]: "visible",
          },
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.indirectCategory.id], isVisible: false, enableAllSubCategories: false }], []);
      });

      it("hiding child definition container makes it, all of its contained elements and its parent definition container hidden", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-hidden",
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.indirectCategory.id], isVisible: false, enableAllSubCategories: false }], []);
      });
    });

    describe("categories", () => {
      it("hiding category makes it and all of its subCategories hidden", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-hidden",
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: false, enableAllSubCategories: false }], []);
      });

      it("hiding category makes it, all of its contained subCategories hidden and doesn't affect other categories", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.category.id]: "hidden",
            [keys.category2.id]: "visible",
            [keys.subCategory2.id]: "visible",
            [keys.subCategory.id]: "hidden",
          },
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: false, enableAllSubCategories: false }], []);
      });

      it("hiding category makes it, all of its contained subCategories hidden and doesn't affect non related definition container", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.definitionContainer.id]: "visible",
            [keys.category2.id]: "visible",
            [keys.category.id]: "hidden",
            [keys.subCategory2.id]: "visible",
            [keys.subCategory.id]: "hidden",
          },
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: false, enableAllSubCategories: false }], []);
      });

      it("hiding category makes it and all of its subcategories hidden, and parent container partially visible if it has more direct child categories", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
            [keys.category.id]: "hidden",
            [keys.category2.id]: "visible",
            [keys.subCategory.id]: "hidden",
            [keys.subCategory2.id]: "visible",
          },
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: false, enableAllSubCategories: false }], []);
      });

      it("hiding category makes it and all of its subCategories hidden, and parent container partially visible if it has more definition containers", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
            [keys.definitionContainerChild.id]: "visible",
            [keys.category.id]: "hidden",
            [keys.indirectCategory.id]: "visible",
            [keys.subCategory.id]: "hidden",
          },
        });
        viewport.validateChangesCalls([{ categoriesToChange: [keys.category.id], isVisible: false, enableAllSubCategories: false }], []);
      });
    });

    describe("subCategories", () => {
      it("hiding subCategory makes it hidden and its parent category partially visible, and doesn't affect other subCategories", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.category.id]: "partial",
            [keys.subCategory.id]: "hidden",
            [keys.subCategory2.id]: "visible",
          },
        });
        viewport.validateChangesCalls([], [{ subCategoryId: keys.subCategory.id, isVisible: false }]);
      });

      it("hiding subCategory makes it hidden and its parent category partially visible, and doesn't affect other categories", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.category.id]: "partial",
            [keys.category2.id]: "visible",
            [keys.subCategory.id]: "hidden",
          },
        });
        viewport.validateChangesCalls([], [{ subCategoryId: keys.subCategory.id, isVisible: false }]);
      });

      it("hiding subCategory makes it hidden and parents partially visible", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
            [keys.category.id]: "partial",
            [keys.subCategory.id]: "hidden",
          },
        });
        viewport.validateChangesCalls([], [{ subCategoryId: keys.subCategory.id, isVisible: false }]);
      });

      it("hiding subCategory makes it hidden and doesn't affect non related definition containers", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.definitionContainerRoot.id]: "visible",
            [keys.categoryOfDefinitionContainer.id]: "visible",
            [keys.subCategoryOfDefinitionContainer.id]: "visible",
            [keys.category.id]: "partial",
            [keys.subCategory.id]: "hidden",
          },
        });
        viewport.validateChangesCalls([], [{ subCategoryId: keys.subCategory.id, isVisible: false }]);
      });
    });

    describe("hideSubCategories set to true", () => {
      it("showing subCategory does not do anything", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
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

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, isVisibleOnInitialize, hideSubCategories: true });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-visible",
        });
      });
    });
  });
});
