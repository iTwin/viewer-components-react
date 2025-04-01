/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import type { Id64Array, Id64String } from "@itwin/core-bentley";
import { Code, ColorDef, IModel, IModelReadRpcInterface, RenderMode, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { IModelApp, OffScreenViewport, SpatialViewState, ViewRect } from "@itwin/core-frontend";
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
  insertPhysicalPartition,
  insertPhysicalSubModel,
  insertSpatialCategory,
  insertSubCategory,
  insertSubModel,
} from "../../../IModelUtils.js";
import { TestUtils, waitFor } from "../../../TestUtils.js";
import { createIModelAccess } from "../../Common.js";
import {
  createCategoryHierarchyNode,
  createClassGroupingHierarchyNode,
  createDefinitionContainerHierarchyNode,
  createElementHierarchyNode,
  createModelHierarchyNode,
  createSubCategoryHierarchyNode,
  createSubModelCategoryHierarchyNode,
} from "./Utils.js";
import { validateHierarchyVisibility } from "./VisibilityValidation.js";

import type { VisibilityExpectations } from "./VisibilityValidation.js";
import type { InstanceKey } from "@itwin/presentation-common";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { CategoriesTreeHierarchyConfiguration } from "../../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeDefinition.js";
import type { GroupingHierarchyNode, HierarchyNodeIdentifiersPath, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";

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

  async function createCommonProps({
    imodel,
    hierarchyConfig,
    categoryIds,
  }: {
    imodel: IModelConnection;
    hierarchyConfig: CategoriesTreeHierarchyConfiguration;
    categoryIds: Id64Array;
  }) {
    const imodelAccess = createIModelAccess(imodel);
    const idsCache = new CategoriesTreeIdsCache(imodelAccess, "3d");
    const viewport = OffScreenViewport.create({
      view: await createViewState(imodel, categoryIds),
      viewRect: new ViewRect(),
    });
    return {
      imodelAccess,
      viewport,
      idsCache,
      hierarchyConfig,
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
    hierarchyConfig,
    categoryIds,
    testDataVisibilityInitializer,
  }: {
    imodel: IModelConnection;
    testDataVisibilityInitializer?: TestDataVisibilityInitializer;
    hierarchyConfig?: Partial<CategoriesTreeHierarchyConfiguration>;
    categoryIds: Id64Array;
  }) {
    const hierarchyConfiguration = {
      ...defaultHierarchyConfiguration,
      ...hierarchyConfig,
    };
    const commonProps = await createCommonProps({ imodel, hierarchyConfig: hierarchyConfiguration, categoryIds });
    const handler = createCategoriesTreeVisibilityHandler(commonProps);
    const provider = createProvider({ ...commonProps });
    testDataVisibilityInitializer?.initialize(commonProps.viewport);
    return {
      handler,
      provider,
      ...commonProps,
      [Symbol.dispose]() {
        commonProps.idsCache[Symbol.dispose]();
        commonProps.viewport.dispose();
        handler[Symbol.dispose]();
        provider[Symbol.dispose]();
      },
    };
  }
  for (let i = 0; i < 10; ++i) {
    describe(`enabling visibility ${i}`, () => {
      it("by default everything is hidden", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
          const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "subCategory", modelId: definitionModel.id });
          return { category, subCategory };
        });

        const { imodel, ...keys } = buildIModelResult;
        const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
        using visibilityTestData = await createVisibilityTestData({
          imodel,
          categoryIds: getCategoryIds(keys),
          testDataVisibilityInitializer,
        });
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
          const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
          using visibilityTestData = await createVisibilityTestData({
            imodel,
            categoryIds: getCategoryIds(keys),
            testDataVisibilityInitializer,
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
          await waitFor(async () =>
            validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: "all-visible",
            }),
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
          const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
          using visibilityTestData = await createVisibilityTestData({
            imodel,
            categoryIds: getCategoryIds(keys),
            testDataVisibilityInitializer,
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
          await waitFor(async () =>
            validateHierarchyVisibility({
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
            }),
          );
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
          const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
          using visibilityTestData = await createVisibilityTestData({
            imodel,
            categoryIds: getCategoryIds(keys),
            testDataVisibilityInitializer,
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), true);
          await waitFor(async () =>
            validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: {
                [keys.definitionContainerRoot.id]: "partial",
                [keys.definitionContainerChild.id]: "visible",
                [keys.directCategory.id]: "hidden",
                [keys.indirectCategory.id]: "visible",
              },
            }),
          );
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
          const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
          using visibilityTestData = await createVisibilityTestData({
            imodel,
            categoryIds: getCategoryIds(keys),
            testDataVisibilityInitializer,
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), true);
          await waitFor(async () =>
            validateHierarchyVisibility({
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
            }),
          );
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
          const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
          using visibilityTestData = await createVisibilityTestData({
            imodel,
            categoryIds: getCategoryIds(keys),
            testDataVisibilityInitializer,
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), true);
          await waitFor(async () =>
            validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: "all-visible",
            }),
          );
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
          const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
          using visibilityTestData = await createVisibilityTestData({
            imodel,
            categoryIds: getCategoryIds(keys),
            testDataVisibilityInitializer,
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
          await waitFor(async () =>
            validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: "all-visible",
            }),
          );
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
          const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
          using visibilityTestData = await createVisibilityTestData({
            imodel,
            categoryIds: getCategoryIds(keys),
            testDataVisibilityInitializer,
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
          await waitFor(async () =>
            validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: {
                [keys.category2.id]: "hidden",
                [keys.category.id]: "visible",
                [keys.subCategory2.id]: "hidden",
                [keys.subCategory.id]: "visible",
              },
            }),
          );
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
          const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
          using visibilityTestData = await createVisibilityTestData({
            imodel,
            categoryIds: getCategoryIds(keys),
            testDataVisibilityInitializer,
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
          await waitFor(async () =>
            validateHierarchyVisibility({
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
            }),
          );
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
          const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
          using visibilityTestData = await createVisibilityTestData({
            imodel,
            categoryIds: getCategoryIds(keys),
            testDataVisibilityInitializer,
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
          await waitFor(async () =>
            validateHierarchyVisibility({
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
            }),
          );
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
          const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
          using visibilityTestData = await createVisibilityTestData({
            imodel,
            categoryIds: getCategoryIds(keys),
            testDataVisibilityInitializer,
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
          await waitFor(async () =>
            validateHierarchyVisibility({
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
            }),
          );
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
          const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
          using visibilityTestData = await createVisibilityTestData({
            imodel,
            categoryIds: getCategoryIds(keys),
            testDataVisibilityInitializer,
          });

          const { handler, provider, viewport } = visibilityTestData;
          await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);

          await waitFor(async () =>
            validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: {
                [keys.category.id]: "partial",
                [keys.subCategory.id]: "visible",
                [keys.subCategory2.id]: "hidden",
              },
            }),
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
          const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
          using visibilityTestData = await createVisibilityTestData({
            imodel,
            categoryIds: getCategoryIds(keys),
            testDataVisibilityInitializer,
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
          await waitFor(async () =>
            validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: {
                [keys.category2.id]: "hidden",
                [keys.category.id]: "partial",
                [keys.subCategory.id]: "visible",
              },
            }),
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
          const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
          using visibilityTestData = await createVisibilityTestData({
            imodel,
            categoryIds: getCategoryIds(keys),
            testDataVisibilityInitializer,
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
          await waitFor(async () =>
            validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: {
                [keys.definitionContainerRoot.id]: "partial",
                [keys.category.id]: "partial",
                [keys.subCategory.id]: "visible",
              },
            }),
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
          const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
          using visibilityTestData = await createVisibilityTestData({
            imodel,
            categoryIds: getCategoryIds(keys),
            testDataVisibilityInitializer,
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
          await waitFor(async () =>
            validateHierarchyVisibility({
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
            }),
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
          const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
          using visibilityTestData = await createVisibilityTestData({
            imodel,
            categoryIds: getCategoryIds(keys),
            hierarchyConfig: { hideSubCategories: true },
            testDataVisibilityInitializer,
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
          await waitFor(async () =>
            validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: "all-hidden",
            }),
          );
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
              const element1 = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: directCategory.id });
              const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelChild.id });
              const element2 = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
              const subCategory = insertSubCategory({
                builder,
                parentCategoryId: indirectCategory.id,
                codeValue: "subCategory",
                modelId: definitionModelChild.id,
              });
              return { definitionContainerRoot, physicalModel, directCategory, element1, element2, subCategory, definitionModelChild, indirectCategory };
            });

            const { imodel, ...keys } = buildIModelResult;
            const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
            using visibilityTestData = await createVisibilityTestData({
              imodel,
              categoryIds: getCategoryIds(keys),
              testDataVisibilityInitializer,
              hierarchyConfig: { showElements: true },
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
            await waitFor(async () =>
              validateHierarchyVisibility({
                provider,
                handler,
                viewport,
                expectations: "all-visible",
              }),
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
                physicalModel,
              };
            });

            const { imodel, ...keys } = buildIModelResult;
            const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
            using visibilityTestData = await createVisibilityTestData({
              imodel,
              categoryIds: getCategoryIds(keys),
              testDataVisibilityInitializer,
              hierarchyConfig: { showElements: true },
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), true);
            await waitFor(async () =>
              validateHierarchyVisibility({
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
              }),
            );
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
              return { definitionContainerRoot, definitionContainerChild, directCategory, indirectCategory, directElement, indirectElement, physicalModel };
            });

            const { imodel, ...keys } = buildIModelResult;
            const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
            using visibilityTestData = await createVisibilityTestData({
              imodel,
              categoryIds: getCategoryIds(keys),
              testDataVisibilityInitializer,
              hierarchyConfig: { showElements: true },
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), true);
            await waitFor(async () =>
              validateHierarchyVisibility({
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
              }),
            );
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
              const definitionModelChild2 = insertSubModel({
                builder,
                classFullName: "BisCore.DefinitionModel",
                modeledElementId: definitionContainerChild2.id,
              });
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
                physicalModel,
              };
            });

            const { imodel, ...keys } = buildIModelResult;
            const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
            using visibilityTestData = await createVisibilityTestData({
              imodel,
              categoryIds: getCategoryIds(keys),
              testDataVisibilityInitializer,
              hierarchyConfig: { showElements: true },
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), true);
            await waitFor(async () =>
              validateHierarchyVisibility({
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
              }),
            );
          });

          it("showing child definition container makes it, all of its contained elements and its parent definition container visible", async function () {
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

              return { definitionContainerChild, indirectElement, indirectSubCategory, indirectCategory, definitionModelChild, physicalModel };
            });

            const { imodel, ...keys } = buildIModelResult;
            const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
            using visibilityTestData = await createVisibilityTestData({
              imodel,
              categoryIds: getCategoryIds(keys),
              testDataVisibilityInitializer,
              hierarchyConfig: { showElements: true },
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), true);
            await waitFor(async () =>
              validateHierarchyVisibility({
                provider,
                handler,
                viewport,
                expectations: "all-visible",
              }),
            );
          });
        });

        describe("categories", () => {
          it("showing category makes it, all of its subCategories and elements visible", async function () {
            await using buildIModelResult = await buildIModel(this, async (builder) => {
              const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

              const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
              const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
              const subCategory = insertSubCategory({
                builder,
                parentCategoryId: category.id,
                codeValue: "subCategory",
              });
              return { category, subCategory, element, physicalModel };
            });

            const { imodel, ...keys } = buildIModelResult;
            const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
            using visibilityTestData = await createVisibilityTestData({
              imodel,
              categoryIds: getCategoryIds(keys),
              testDataVisibilityInitializer,
              hierarchyConfig: { showElements: true },
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
            await waitFor(async () =>
              validateHierarchyVisibility({
                provider,
                handler,
                viewport,
                expectations: "all-visible",
              }),
            );
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

              return { category, category2, subCategory, subCategory2, element, element2, physicalModel };
            });

            const { imodel, ...keys } = buildIModelResult;
            const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
            using visibilityTestData = await createVisibilityTestData({
              imodel,
              categoryIds: getCategoryIds(keys),
              testDataVisibilityInitializer,
              hierarchyConfig: { showElements: true },
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
            await waitFor(async () =>
              validateHierarchyVisibility({
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
              }),
            );
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

              return { definitionContainer, category, category2, subCategory, subCategory2, element, element2, physicalModel };
            });

            const { imodel, ...keys } = buildIModelResult;
            const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
            using visibilityTestData = await createVisibilityTestData({
              imodel,
              categoryIds: getCategoryIds(keys),
              testDataVisibilityInitializer,
              hierarchyConfig: { showElements: true },
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
            await waitFor(async () =>
              validateHierarchyVisibility({
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
              }),
            );
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
              return { definitionContainerRoot, category, category2, subCategory, subCategory2, element, element2, physicalModel };
            });

            const { imodel, ...keys } = buildIModelResult;
            const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
            using visibilityTestData = await createVisibilityTestData({
              imodel,
              categoryIds: getCategoryIds(keys),
              testDataVisibilityInitializer,
              hierarchyConfig: { showElements: true },
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
            await waitFor(async () =>
              validateHierarchyVisibility({
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
              }),
            );
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
              return { definitionContainerRoot, definitionContainerChild, category, indirectCategory, subCategory, indirectElement, element, physicalModel };
            });

            const { imodel, ...keys } = buildIModelResult;
            const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
            using visibilityTestData = await createVisibilityTestData({
              imodel,
              categoryIds: getCategoryIds(keys),
              testDataVisibilityInitializer,
              hierarchyConfig: { showElements: true },
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), true);
            await waitFor(async () =>
              validateHierarchyVisibility({
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
              }),
            );
          });
        });

        describe("subCategories", () => {
          it("showing subCategory makes it visible and its parent category partially visible, and doesn't affect elements", async function () {
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
              return { category, subCategory, subCategory2, element, physicalModel };
            });

            const { imodel, ...keys } = buildIModelResult;
            const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
            using visibilityTestData = await createVisibilityTestData({
              imodel,
              categoryIds: getCategoryIds(keys),
              testDataVisibilityInitializer,
              hierarchyConfig: { showElements: true },
            });
            const { handler, provider, viewport } = visibilityTestData;
            await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);

            await waitFor(async () =>
              validateHierarchyVisibility({
                provider,
                handler,
                viewport,
                expectations: {
                  [keys.category.id]: "partial",
                  [keys.subCategory.id]: "visible",
                  [keys.subCategory2.id]: "hidden",
                  [keys.element.id]: "hidden",
                },
              }),
            );
          });

          it("showing subCategory makes it visible and its parent category partially visible, and doesn't affect elements of other categories", async function () {
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
            const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
            using visibilityTestData = await createVisibilityTestData({
              imodel,
              categoryIds: getCategoryIds(keys),
              testDataVisibilityInitializer,
              hierarchyConfig: { showElements: true },
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
            await waitFor(async () =>
              validateHierarchyVisibility({
                provider,
                handler,
                viewport,
                expectations: {
                  [keys.category2.id]: "hidden",
                  [keys.category.id]: "partial",
                  [keys.subCategory.id]: "visible",
                  [keys.element.id]: "hidden",
                  [keys.element2.id]: "hidden",
                },
              }),
            );
          });

          it("showing subCategory makes it visible and parents partially visible", async function () {
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
            const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
            using visibilityTestData = await createVisibilityTestData({
              imodel,
              categoryIds: getCategoryIds(keys),
              testDataVisibilityInitializer,
              hierarchyConfig: { showElements: true },
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
            await waitFor(async () =>
              validateHierarchyVisibility({
                provider,
                handler,
                viewport,
                expectations: {
                  [keys.definitionContainerRoot.id]: "partial",
                  [keys.category.id]: "partial",
                  [keys.subCategory.id]: "visible",
                  [keys.element.id]: "hidden",
                },
              }),
            );
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
                physicalModel,
              };
            });

            const { imodel, ...keys } = buildIModelResult;
            const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
            using visibilityTestData = await createVisibilityTestData({
              imodel,
              categoryIds: getCategoryIds(keys),
              testDataVisibilityInitializer,
              hierarchyConfig: { showElements: true },
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
            await waitFor(async () =>
              validateHierarchyVisibility({
                provider,
                handler,
                viewport,
                expectations: {
                  [keys.definitionContainerRoot.id]: "hidden",
                  [keys.categoryOfDefinitionContainer.id]: "hidden",
                  [keys.subCategoryOfDefinitionContainer.id]: "hidden",
                  [keys.category.id]: "partial",
                  [keys.subCategory.id]: "visible",
                  [keys.element.id]: "hidden",
                  [keys.elementOfDefinitionContainer.id]: "hidden",
                },
              }),
            );
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
            const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
            using visibilityTestData = await createVisibilityTestData({
              imodel,
              categoryIds: getCategoryIds(keys),
              testDataVisibilityInitializer,
              hierarchyConfig: { showElements: true },
            });
            const { handler, provider, viewport } = visibilityTestData;
            await handler.changeVisibility(
              createElementHierarchyNode({ modelId: keys.physicalModel.id, categoryId: keys.category.id, elementId: keys.element.id }),
              true,
            );

            await waitFor(async () =>
              validateHierarchyVisibility({
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
              }),
            );
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
            const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
            using visibilityTestData = await createVisibilityTestData({
              imodel,
              categoryIds: getCategoryIds(keys),
              testDataVisibilityInitializer,
              hierarchyConfig: { showElements: true },
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(
              createElementHierarchyNode({ modelId: keys.physicalModel.id, categoryId: keys.category.id, elementId: keys.element.id }),
              true,
            );
            await waitFor(async () =>
              validateHierarchyVisibility({
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
              }),
            );
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
            const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
            using visibilityTestData = await createVisibilityTestData({
              imodel,
              categoryIds: getCategoryIds(keys),
              testDataVisibilityInitializer,
              hierarchyConfig: { showElements: true },
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(
              createElementHierarchyNode({ modelId: keys.physicalModel.id, categoryId: keys.category.id, elementId: keys.element.id }),
              true,
            );
            await waitFor(async () =>
              validateHierarchyVisibility({
                provider,
                handler,
                viewport,
                expectations: {
                  [keys.definitionContainerRoot.id]: "partial",
                  [keys.category.id]: "partial",
                  [keys.subCategory.id]: "hidden",
                  [keys.element.id]: "visible",
                },
              }),
            );
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
                physicalModel,
              };
            });

            const { imodel, ...keys } = buildIModelResult;
            const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(keys));
            using visibilityTestData = await createVisibilityTestData({
              imodel,
              categoryIds: getCategoryIds(keys),
              testDataVisibilityInitializer,
              hierarchyConfig: { showElements: true },
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
            await waitFor(async () =>
              validateHierarchyVisibility({
                provider,
                handler,
                viewport,
                expectations: {
                  [keys.definitionContainerRoot.id]: "hidden",
                  [keys.categoryOfDefinitionContainer.id]: "hidden",
                  [keys.subCategoryOfDefinitionContainer.id]: "hidden",
                  [keys.category.id]: "partial",
                  [keys.subCategory.id]: "visible",
                  [keys.element.id]: "hidden",
                  [keys.elementOfDefinitionContainer.id]: "hidden",
                },
              }),
            );
          });
        });

        interface IModelWithSubModelIds {
          modeledElement: InstanceKey;
          model: InstanceKey;
          category: InstanceKey;
          subModelCategory?: InstanceKey;
          subModelElement?: InstanceKey;
        }

        const testCases: Array<{
          describeName: string;
          createIModel: (context: Mocha.Context) => Promise<{ imodel: IModelConnection } & IModelWithSubModelIds>;
          cases: Array<{
            only?: boolean;
            name: string;
            getTargetNode: (ids: IModelWithSubModelIds) => NonGroupingHierarchyNode | GroupingHierarchyNode;
            expectations: (ids: IModelWithSubModelIds) => "all-visible" | "all-hidden" | VisibilityExpectations;
          }>;
        }> = [
          {
            describeName: "with modeled elements",
            createIModel: async function createIModel(context: Mocha.Context): Promise<{ imodel: IModelConnection } & IModelWithSubModelIds> {
              return buildIModel(context, async (builder, testSchema) => {
                const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
                const partition = insertPhysicalPartition({ builder, codeValue: "model", parentId: rootSubject.id });
                const model = insertPhysicalSubModel({ builder, modeledElementId: partition.id });
                const category = insertSpatialCategory({ builder, codeValue: "category" });
                const modeledElement = insertPhysicalElement({
                  builder,
                  userLabel: `element`,
                  modelId: model.id,
                  categoryId: category.id,
                  classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
                });
                const subModel = insertPhysicalSubModel({ builder, modeledElementId: modeledElement.id });
                const subModelCategory = insertSpatialCategory({ builder, codeValue: "category2" });
                const subModelElement = insertPhysicalElement({ builder, userLabel: `element2`, modelId: subModel.id, categoryId: subModelCategory.id });
                return {
                  modeledElement,
                  model,
                  category,
                  subModelCategory,
                  subModelElement,
                };
              });
            },
            cases: [
              {
                name: "modeled element's children display is turned on when its category display is turned on",
                getTargetNode: (ids: IModelWithSubModelIds) => createCategoryHierarchyNode(ids.category.id, true),
                expectations: () => "all-visible",
              },
              {
                name: "modeled element's children display is turned on when its class grouping node display is turned on",
                getTargetNode: (ids: IModelWithSubModelIds) =>
                  createClassGroupingHierarchyNode({ categoryId: ids.category.id, modelElementsMap: new Map([[ids.model.id, [ids.modeledElement.id]]]) }),
                expectations: () => "all-visible",
              },
              {
                name: "modeled element's children display is turned on when its display is turned on",
                getTargetNode: (ids: IModelWithSubModelIds) =>
                  createElementHierarchyNode({
                    modelId: ids.model.id,
                    categoryId: ids.category.id,
                    elementId: ids.modeledElement.id,
                    hasChildren: true,
                  }),
                expectations: () => "all-visible",
              },
              {
                name: "modeled element's children display is turned on when its sub-model display is turned on",
                getTargetNode: (ids: IModelWithSubModelIds) => createModelHierarchyNode(ids.modeledElement.id, true),
                expectations: (ids: IModelWithSubModelIds) => ({
                  [ids.subModelCategory?.id ?? ""]: "visible",
                  [`${ids.modeledElement.id}-${ids.subModelCategory?.id ?? ""}`]: "visible",
                  [ids.subModelCategory?.id ?? ""]: "visible",
                  [ids.category.id]: "partial",
                  [ids.modeledElement.id]: "partial",
                  [ids.subModelElement?.id ?? ""]: "visible",
                  [ids.model.id]: "partial",
                }),
              },
              {
                name: "modeled element, its model and category have partial visibility when its sub-model element's category display is turned on",
                getTargetNode: (ids: IModelWithSubModelIds) => createSubModelCategoryHierarchyNode(ids.modeledElement.id, ids.subModelCategory?.id, true),
                expectations: (ids: IModelWithSubModelIds) => ({
                  [ids.subModelCategory?.id ?? ""]: "visible",
                  [`${ids.modeledElement.id}-${ids.subModelCategory?.id ?? ""}`]: "visible",
                  [ids.category.id]: "partial",
                  [ids.modeledElement.id]: "partial",
                  [ids.subModelElement?.id ?? ""]: "visible",
                  [ids.model.id]: "partial",
                }),
              },
              {
                name: "modeled element, its model and category have partial visibility when its sub-model element's display is turned on",
                getTargetNode: (ids: IModelWithSubModelIds) =>
                  createElementHierarchyNode({
                    modelId: ids.modeledElement.id,
                    categoryId: ids.subModelCategory?.id,
                    elementId: ids.subModelElement?.id,
                  }),
                expectations: (ids: IModelWithSubModelIds) => ({
                  // This happens because changing element state does not turn on category visiblity, it only turns on model display if it is off.
                  // Since subModelCategory is also displayed at tree root (it does not have children) it's visibility remains hidden.
                  [ids.subModelCategory?.id ?? ""]: "hidden",
                  [`${ids.modeledElement.id}-${ids.subModelCategory?.id ?? ""}`]: "visible",
                  [ids.category.id]: "partial",
                  [ids.modeledElement.id]: "partial",
                  [ids.subModelElement?.id ?? ""]: "visible",
                  [ids.model.id]: "partial",
                }),
              },
            ],
          },
          {
            describeName: "with modeled elements that have private subModel",
            createIModel: async function createIModel(context: Mocha.Context): Promise<{ imodel: IModelConnection } & IModelWithSubModelIds> {
              return buildIModel(context, async (builder, testSchema) => {
                const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
                const partition = insertPhysicalPartition({ builder, codeValue: "model", parentId: rootSubject.id });
                const model = insertPhysicalSubModel({ builder, modeledElementId: partition.id });
                const category = insertSpatialCategory({ builder, codeValue: "category" });
                const modeledElement = insertPhysicalElement({
                  builder,
                  userLabel: `element`,
                  modelId: model.id,
                  categoryId: category.id,
                  classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
                });
                const subModel = insertPhysicalSubModel({ builder, modeledElementId: modeledElement.id, isPrivate: true });
                const subModelCategory = insertSpatialCategory({ builder, codeValue: "category2" });
                const subModelElement = insertPhysicalElement({ builder, userLabel: `element2`, modelId: subModel.id, categoryId: subModelCategory.id });
                return {
                  modeledElement,
                  model,
                  category,
                  subModelCategory,
                  subModelElement,
                };
              });
            },
            cases: [
              {
                name: "children are visible when category display is turned on",
                getTargetNode: (ids: IModelWithSubModelIds) => createCategoryHierarchyNode(ids.category.id, true),
                expectations: (ids: IModelWithSubModelIds) => ({
                  [ids.subModelCategory?.id ?? ""]: "hidden",
                  [ids.category.id]: "visible",
                  [ids.modeledElement.id]: "visible",
                }),
              },
              {
                name: "parent category and child elements are visible when elements class grouping node display is turned on",
                getTargetNode: (ids: IModelWithSubModelIds) =>
                  createClassGroupingHierarchyNode({ categoryId: ids.category.id, modelElementsMap: new Map([[ids.model.id, [ids.modeledElement.id]]]) }),
                expectations: (ids: IModelWithSubModelIds) => ({
                  [ids.subModelCategory?.id ?? ""]: "hidden",
                  [ids.category.id]: "visible",
                  [ids.modeledElement.id]: "visible",
                }),
              },
              {
                name: "parents are visible when elements display is turned on",
                getTargetNode: (ids: IModelWithSubModelIds) =>
                  createElementHierarchyNode({
                    modelId: ids.model.id,
                    categoryId: ids.category.id,
                    elementId: ids.modeledElement.id,
                    hasChildren: false,
                  }),
                expectations: (ids: IModelWithSubModelIds) => ({
                  [ids.subModelCategory?.id ?? ""]: "hidden",
                  [ids.category.id]: "visible",
                  [ids.modeledElement.id]: "visible",
                }),
              },
            ],
          },
          {
            describeName: "with modeled elements that have subModel with no children",
            createIModel: async function createIModel(context: Mocha.Context): Promise<{ imodel: IModelConnection } & IModelWithSubModelIds> {
              return buildIModel(context, async (builder, testSchema) => {
                const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
                const partition = insertPhysicalPartition({ builder, codeValue: "model", parentId: rootSubject.id });
                const model = insertPhysicalSubModel({ builder, modeledElementId: partition.id });
                const category = insertSpatialCategory({ builder, codeValue: "category" });
                const modeledElement = insertPhysicalElement({
                  builder,
                  userLabel: `element`,
                  modelId: model.id,
                  categoryId: category.id,
                  classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
                });
                const subModel = insertPhysicalSubModel({ builder, modeledElementId: modeledElement.id });
                return {
                  rootSubject,
                  modeledElement,
                  model,
                  category,
                  subModel,
                };
              });
            },
            cases: [
              {
                name: "everything is visible when category display is turned on",
                getTargetNode: (ids: IModelWithSubModelIds) => createCategoryHierarchyNode(ids.category.id, true),
                expectations: () => "all-visible",
              },
              {
                name: "everything is visible when elements class grouping node display is turned on",
                getTargetNode: (ids: IModelWithSubModelIds) =>
                  createClassGroupingHierarchyNode({ categoryId: ids.category.id, modelElementsMap: new Map([[ids.model.id, [ids.modeledElement.id]]]) }),
                expectations: () => "all-visible",
              },
              {
                name: "everything is visible when elements display is turned on",
                getTargetNode: (ids: IModelWithSubModelIds) =>
                  createElementHierarchyNode({
                    modelId: ids.model.id,
                    categoryId: ids.category.id,
                    elementId: ids.modeledElement.id,
                    hasChildren: false,
                  }),
                expectations: () => "all-visible",
              },
            ],
          },
        ];
        testCases.forEach(({ describeName, createIModel, cases }) => {
          describe(describeName, () => {
            let iModel: IModelConnection;
            let createdIds: IModelWithSubModelIds;

            before(async function () {
              const { imodel, ...ids } = await createIModel(this);
              iModel = imodel;
              createdIds = ids;
            });

            after(async () => {
              await iModel.close();
            });

            cases.forEach(({ name, getTargetNode, expectations, only }) => {
              (only ? it.only : it)(name, async function () {
                const testDataVisibilityInitializer = new TestDataVisibilityInitializer(createHiddenTestData(createdIds as any));
                using visibilityTestData = await createVisibilityTestData({
                  imodel: iModel,
                  categoryIds: getCategoryIds(createdIds as any),
                  hierarchyConfig: { showElements: true },
                  testDataVisibilityInitializer,
                });
                const { handler, provider, viewport } = visibilityTestData;

                const nodeToChangeVisibility = getTargetNode(createdIds);
                await validateHierarchyVisibility({
                  provider,
                  handler,
                  viewport,
                  expectations: "all-hidden",
                });
                await handler.changeVisibility(nodeToChangeVisibility, true);
                await waitFor(async () =>
                  validateHierarchyVisibility({
                    provider,
                    handler,
                    viewport,
                    expectations: expectations(createdIds),
                  }),
                );
                await handler.changeVisibility(nodeToChangeVisibility, false);
                await waitFor(async () =>
                  validateHierarchyVisibility({
                    provider,
                    handler,
                    viewport,
                    expectations: "all-hidden",
                  }),
                );
              });
            });
          });
        });
      });
    });

    describe(`disabling visibility ${i}`, () => {
      it("by default everything is visible", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
          const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "subCategory", modelId: definitionModel.id });
          return { category };
        });

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, categoryIds: getCategoryIds(keys) });
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
          using visibilityTestData = await createVisibilityTestData({ imodel, categoryIds: getCategoryIds(keys) });
          const { handler, provider, viewport } = visibilityTestData;
          await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), false);
          await waitFor(async () =>
            validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: "all-hidden",
            }),
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
          using visibilityTestData = await createVisibilityTestData({ imodel, categoryIds: getCategoryIds(keys) });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerRoot.id), false);
          await waitFor(async () =>
            validateHierarchyVisibility({
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
            }),
          );
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
          using visibilityTestData = await createVisibilityTestData({ imodel, categoryIds: getCategoryIds(keys) });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), false);
          await waitFor(async () =>
            validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: {
                [keys.definitionContainerRoot.id]: "partial",
                [keys.definitionContainerChild.id]: "hidden",
                [keys.indirectCategory.id]: "hidden",
                [keys.directCategory.id]: "visible",
              },
            }),
          );
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
          using visibilityTestData = await createVisibilityTestData({ imodel, categoryIds: getCategoryIds(keys) });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), false);
          await waitFor(async () =>
            validateHierarchyVisibility({
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
            }),
          );
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
          using visibilityTestData = await createVisibilityTestData({ imodel, categoryIds: getCategoryIds(keys) });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createDefinitionContainerHierarchyNode(keys.definitionContainerChild.id), false);
          await waitFor(async () =>
            validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: "all-hidden",
            }),
          );
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
          using visibilityTestData = await createVisibilityTestData({ imodel, categoryIds: getCategoryIds(keys) });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), false);
          await waitFor(async () =>
            validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: "all-hidden",
            }),
          );
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
          using visibilityTestData = await createVisibilityTestData({ imodel, categoryIds: getCategoryIds(keys) });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), false);
          await waitFor(async () =>
            validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: {
                [keys.category.id]: "hidden",
                [keys.category2.id]: "visible",
                [keys.subCategory2.id]: "visible",
                [keys.subCategory.id]: "hidden",
              },
            }),
          );
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
          using visibilityTestData = await createVisibilityTestData({ imodel, categoryIds: getCategoryIds(keys) });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), false);
          await waitFor(async () =>
            validateHierarchyVisibility({
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
            }),
          );
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
          using visibilityTestData = await createVisibilityTestData({ imodel, categoryIds: getCategoryIds(keys) });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), false);
          await waitFor(async () =>
            validateHierarchyVisibility({
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
            }),
          );
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
          using visibilityTestData = await createVisibilityTestData({ imodel, categoryIds: getCategoryIds(keys) });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode(keys.category.id), false);
          await waitFor(async () =>
            validateHierarchyVisibility({
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
            }),
          );
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
          using visibilityTestData = await createVisibilityTestData({ imodel, categoryIds: getCategoryIds(keys) });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), false);
          await waitFor(async () =>
            validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: {
                [keys.category.id]: "partial",
                [keys.subCategory.id]: "hidden",
                [keys.subCategory2.id]: "visible",
              },
            }),
          );
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
          using visibilityTestData = await createVisibilityTestData({ imodel, categoryIds: getCategoryIds(keys) });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), false);
          await waitFor(async () =>
            validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: {
                [keys.category.id]: "partial",
                [keys.category2.id]: "visible",
                [keys.subCategory.id]: "hidden",
              },
            }),
          );
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
          using visibilityTestData = await createVisibilityTestData({ imodel, categoryIds: getCategoryIds(keys) });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), false);
          await waitFor(async () =>
            validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: {
                [keys.definitionContainerRoot.id]: "partial",
                [keys.category.id]: "partial",
                [keys.subCategory.id]: "hidden",
              },
            }),
          );
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
          using visibilityTestData = await createVisibilityTestData({ imodel, categoryIds: getCategoryIds(keys) });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), false);
          await waitFor(async () =>
            validateHierarchyVisibility({
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
            }),
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
          using visibilityTestData = await createVisibilityTestData({
            imodel,
            categoryIds: getCategoryIds(keys),
            hierarchyConfig: { hideSubCategories: true },
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createSubCategoryHierarchyNode(keys.subCategory.id, keys.category.id), true);
          await waitFor(async () =>
            validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: "all-visible",
            }),
          );
        });
      });
    });
  }

});

async function createViewState(iModel: IModelConnection, categoryIds: Id64Array) {
  const model = IModel.dictionaryId;
  const viewState = SpatialViewState.createFromProps(
    {
      categorySelectorProps: { categories: categoryIds, model, code: Code.createEmpty(), classFullName: "BisCore:CategorySelector" },
      displayStyleProps: { model, code: Code.createEmpty(), classFullName: "BisCore:DisplayStyle3d" },
      viewDefinitionProps: {
        model,
        code: Code.createEmpty(),
        categorySelectorId: "",
        classFullName: "BisCore:SpatialViewDefinition",
        displayStyleId: "",
      },
      modelSelectorProps: {
        models: [],
        code: Code.createEmpty(),
        model,
        classFullName: "BisCore:ModelSelector",
      },
    },
    iModel,
  );

  viewState.setAllow3dManipulations(true);

  viewState.displayStyle.backgroundColor = ColorDef.white;
  const flags = viewState.viewFlags.copy({
    grid: false,
    renderMode: RenderMode.SmoothShade,
    backgroundMap: false,
  });
  viewState.displayStyle.viewFlags = flags;

  IModelApp.viewManager.onViewOpen.addOnce((vp) => {
    if (vp.view.hasSameCoordinates(viewState)) {
      vp.applyViewState(viewState);
    }
  });
  await viewState.load();
  return viewState;
}

interface VisibilityInfo {
  id: Id64String;
  visible: boolean;
}

class TestDataVisibilityInitializer {
  private _categories: Array<VisibilityInfo>;
  private _subCategories: Array<VisibilityInfo>;
  private _models: Array<VisibilityInfo>;
  private _elements: Array<VisibilityInfo>;
  constructor(props?: {
    categories?: Array<VisibilityInfo>;
    subCategories?: Array<VisibilityInfo>;
    models?: Array<VisibilityInfo>;
    elements?: Array<VisibilityInfo>;
  }) {
    this._categories = props?.categories ?? [];
    this._subCategories = props?.subCategories ?? [];
    this._models = props?.models ?? [];
    this._elements = props?.elements ?? [];
  }

  public initialize(viewport: Viewport): void {
    for (const subCategoryInfo of this._subCategories) {
      viewport.changeSubCategoryDisplay(subCategoryInfo.id, subCategoryInfo.visible);
    }
    for (const categoryInfo of this._categories) {
      viewport.changeCategoryDisplay(categoryInfo.id, categoryInfo.visible, false);
    }

    for (const elementInfo of this._elements) {
      if (elementInfo.visible) {
        viewport.alwaysDrawn?.add(elementInfo.id);
        continue;
      }
      viewport.neverDrawn?.add(elementInfo.id);
    }
    if (!viewport.alwaysDrawn) {
      viewport.setAlwaysDrawn(new Set(this._elements.filter(({ visible }) => visible).map(({ id }) => id)));
    }
    if (!viewport.neverDrawn) {
      viewport.setNeverDrawn(new Set(this._elements.filter(({ visible }) => !visible).map(({ id }) => id)));
    }
    for (const modelInfo of this._models) {
      viewport.changeModelDisplay(modelInfo.id, modelInfo.visible);
    }
  }
}

function createHiddenTestData(keys: { [key: string]: InstanceKey }) {
  const categories = new Array<VisibilityInfo>();
  const subCategories = new Array<VisibilityInfo>();
  const elements = new Array<VisibilityInfo>();
  const models = new Array<VisibilityInfo>();
  for (const key of Object.values(keys)) {
    if (key.className.toLowerCase().includes("subcategory")) {
      subCategories.push({ id: key.id, visible: false });
      continue;
    }
    if (key.className.toLowerCase().includes("category")) {
      categories.push({ id: key.id, visible: false });
      subCategories.push({ id: getDefaultSubCategoryId(key.id), visible: false });
      continue;
    }
    if (key.className.toLowerCase().includes("physicalobject")) {
      elements.push({ id: key.id, visible: false });
      continue;
    }
    if (key.className.toLowerCase().includes("model")) {
      models.push({ id: key.id, visible: false });
    }
  }
  return { categories, subCategories, elements, models };
}

function getDefaultSubCategoryId(categoryId: Id64String) {
  const categoryIdNumber = Number.parseInt(categoryId, 16);
  const subCategoryId = `0x${(categoryIdNumber + 1).toString(16)}`;
  return subCategoryId;
}

function getCategoryIds(keys: { [key: string]: InstanceKey }) {
  const categoryIds = new Array<Id64String>();
  for (const key of Object.values(keys)) {
    if (key.className.toLowerCase().includes("subcategory")) {
      continue;
    }
    if (key.className.toLowerCase().includes("category")) {
      categoryIds.push(key.id);
      continue;
    }
  }
  return categoryIds;
}
