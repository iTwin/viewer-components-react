/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModel, IModelReadRpcInterface } from "@itwin/core-common";
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
import { createCategoriesTreeVisibilityHandler } from "../../../../tree-widget-react/components/trees/categories-tree/internal/visibility/CategoriesTreeVisibilityHandler.js";
import {
  CLASS_NAME_DefinitionModel,
  CLASS_NAME_SubCategory,
  CLASS_NAME_Subject,
} from "../../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";
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
import { TestUtils } from "../../../TestUtils.js";
import { createIModelAccess } from "../../Common.js";
import { validateHierarchyVisibility } from "../../common/VisibilityValidation.js";
import { createTreeWidgetTestingViewport, getDefaultSubCategoryId } from "../../TreeUtils.js";
import {
  createCategoryHierarchyNode,
  createClassGroupingHierarchyNode,
  createDefinitionContainerHierarchyNode,
  createElementHierarchyNode,
  createModelHierarchyNode,
  createSubCategoryHierarchyNode,
  createSubModelCategoryHierarchyNode,
} from "./Utils.js";
import { validateNodeVisibility } from "./VisibilityValidation.js";

import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type { GroupingHierarchyNode, HierarchyNodeIdentifiersPath, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { Props } from "@itwin/presentation-shared";
import type { CategoriesTreeHierarchyConfiguration } from "../../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeDefinition.js";
import type { VisibilityExpectations } from "../../common/VisibilityValidation.js";
import type { TreeWidgetTestingViewport } from "../../TreeUtils.js";

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
      rpcs: [IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
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
    subCategoriesOfCategories,
    visibleByDefault,
  }: {
    imodel: IModelConnection;
    hierarchyConfig: CategoriesTreeHierarchyConfiguration;
    subCategoriesOfCategories?: Array<{ categoryId: Id64String; subCategories: Id64Arg }>;
    visibleByDefault?: boolean;
  }) {
    const imodelAccess = createIModelAccess(imodel);
    const idsCache = new CategoriesTreeIdsCache(imodelAccess, "3d");
    const viewport = createTreeWidgetTestingViewport({ iModel: imodel, subCategoriesOfCategories, viewType: "3d", visibleByDefault });

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
    searchPaths?: HierarchyNodeIdentifiersPath[];
    hierarchyConfig: CategoriesTreeHierarchyConfiguration;
  }) {
    return createIModelHierarchyProvider({
      hierarchyDefinition: new CategoriesTreeDefinition({ ...props, viewType: "3d" }),
      imodelAccess: props.imodelAccess,
      ...(props.searchPaths ? { search: { paths: props.searchPaths } } : undefined),
    });
  }

  async function createVisibilityTestData({
    imodel,
    hierarchyConfig,
    subCategoriesOfCategories,
    visibleByDefault,
  }: {
    imodel: IModelConnection;
    hierarchyConfig?: Partial<CategoriesTreeHierarchyConfiguration>;
    subCategoriesOfCategories?: Array<{ categoryId: Id64String; subCategories: Id64Arg }>;
    visibleByDefault?: boolean;
  }) {
    const hierarchyConfiguration = {
      ...defaultHierarchyConfiguration,
      ...hierarchyConfig,
    };
    const commonProps = await createCommonProps({ imodel, hierarchyConfig: hierarchyConfiguration, subCategoriesOfCategories, visibleByDefault });
    const handler = createCategoriesTreeVisibilityHandler({
      viewport: commonProps.viewport,
      idsCache: commonProps.idsCache,
      imodelAccess: commonProps.imodelAccess,
      searchPaths: undefined,
      hierarchyConfig: hierarchyConfiguration,
    });
    const provider = createProvider({ ...commonProps });

    return {
      handler,
      provider,
      ...commonProps,
      [Symbol.dispose]() {
        commonProps.idsCache[Symbol.dispose]();
        handler[Symbol.dispose]();
        provider[Symbol.dispose]();
      },
    };
  }

  describe("enabling visibility", () => {
    it("by default everything is hidden", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        const subCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "subCategory", modelId: definitionModel.id });
        return { category, subCategory, physicalModel };
      });

      const { imodel, ...keys } = buildIModelResult;

      using visibilityTestData = await createVisibilityTestData({
        imodel,
        subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
      });
      const { handler, provider, viewport } = visibilityTestData;

      await validateCategoriesTreeHierarchyVisibility({
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
          const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });

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
          return { definitionContainerRoot, definitionContainerChild, directCategory, indirectCategory, indirectSubCategory, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [{ categoryId: keys.indirectCategory.id, subCategories: keys.indirectSubCategory.id }],
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainerRoot.id }), true);
        await validateCategoriesTreeHierarchyVisibility({
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
          const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
          const indirectSubCategory = insertSubCategory({
            builder,
            parentCategoryId: indirectCategory.id,
            codeValue: "subCategory",
            modelId: definitionModelChild.id,
          });

          const definitionContainerRoot2 = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot2" });
          const definitionModelRoot2 = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot2.id });
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
            physicalModel,
          };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [
            { categoryId: keys.indirectCategory.id, subCategories: keys.indirectSubCategory.id },
            { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
          ],
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainerRoot.id }), true);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.definitionContainerRoot.id]: "visible",
              [keys.definitionContainerChild.id]: "visible",
                [keys.indirectCategory.id]: "visible",
                  [keys.indirectSubCategory.id]: "visible",

            [keys.definitionContainerRoot2.id]: "hidden",
              [keys.category2.id]: "hidden",
                [keys.subCategory2.id]: "hidden",
          },
        });
      });

      it("showing definition container makes it and all of its contained elements visible, and parent container partially visible if it has more direct child categories", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });

          const directCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory1", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: directCategory.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
          return { definitionContainerRoot, definitionContainerChild, directCategory, indirectCategory, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainerChild.id }), true);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
              [keys.directCategory.id]: "hidden",

              [keys.definitionContainerChild.id]: "visible",
                [keys.indirectCategory.id]: "visible",
          },
        });
      });

      it("showing definition container makes it and all of its contained elements visible, and parent container partially visible if it has more definition containers", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });

          const definitionContainerChild2 = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild2", modelId: definitionModelRoot.id });
          const definitionModelChild2 = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild2.id });
          const indirectCategory2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelChild2.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory2.id });
          return { definitionContainerRoot, definitionContainerChild, indirectCategory2, indirectCategory, definitionContainerChild2, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainerChild.id }), true);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
              [keys.definitionContainerChild.id]: "visible",
                [keys.indirectCategory.id]: "visible",

              [keys.definitionContainerChild2.id]: "hidden",
                [keys.indirectCategory2.id]: "hidden",
          },
        });
      });

      it("showing child definition container makes it, all of its contained elements and its parent definition container visible", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
          const indirectSubCategory = insertSubCategory({
            builder,
            parentCategoryId: indirectCategory.id,
            codeValue: "subCategory",
            modelId: definitionModelChild.id,
          });

          return { definitionContainerRoot, definitionContainerChild, indirectCategory, indirectSubCategory, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [{ categoryId: keys.indirectCategory.id, subCategories: keys.indirectSubCategory.id }],
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainerChild.id }), true);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-visible",
        });
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
          return { category, subCategory, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), true);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-visible",
        });
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

          return { category, category2, subCategory, subCategory2, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [
            { categoryId: keys.category.id, subCategories: keys.subCategory.id },
            { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
          ],
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), true);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.category.id]: "visible",
              [keys.subCategory.id]: "visible",

            [keys.category2.id]: "hidden",
              [keys.subCategory2.id]: "hidden",
          },
        });
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
          const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
          const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModel.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
          const subCategory2 = insertSubCategory({
            builder,
            parentCategoryId: category2.id,
            codeValue: "subCategory2",
            modelId: definitionContainer.id,
          });

          return { definitionContainer, category, category2, subCategory, subCategory2, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [
            { categoryId: keys.category.id, subCategories: keys.subCategory.id },
            { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
          ],
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), true);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.category.id]: "visible",
              [keys.subCategory.id]: "visible",

            [keys.definitionContainer.id]: "hidden",
              [keys.category2.id]: "hidden",
                [keys.subCategory2.id]: "hidden",
          },
        });
      });

      it("showing category makes it and all of its subcategories visible, and parent container partially visible if it has more direct child categories", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

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
          return { definitionContainerRoot, category, category2, subCategory, subCategory2, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [
            { categoryId: keys.category.id, subCategories: keys.subCategory.id },
            { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
          ],
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), true);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
              [keys.category.id]: "visible",
                [keys.subCategory.id]: "visible",

              [keys.category2.id]: "hidden",
                [keys.subCategory2.id]: "hidden",
          },
        });
      });

      it("showing category makes it and all of its subCategories visible, and parent container partially visible if it has more definition containers", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
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
          return { definitionContainerRoot, definitionContainerChild, category, indirectCategory, subCategory, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), true);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
              [keys.category.id]: "visible",
                [keys.subCategory.id]: "visible",

              [keys.definitionContainerChild.id]: "hidden",
                [keys.indirectCategory.id]: "hidden",
          },
        });
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
          return { category, subCategory, subCategory2, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: [keys.subCategory.id, keys.subCategory2.id] }],
        });

        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode({ id: keys.subCategory.id, categoryId: keys.category.id }), true);

        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.category.id]: "partial",
              [keys.subCategory.id]: "visible",
              [keys.subCategory2.id]: "hidden",
          },
        });
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
          return { category, subCategory, category2, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode({ id: keys.subCategory.id, categoryId: keys.category.id }), true);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.category.id]: "partial",
              [keys.subCategory.id]: "visible",

            [keys.category2.id]: "hidden",
          },
        });
      });

      it("showing subCategory makes it visible and parents partially visible", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
            modelId: definitionModelRoot.id,
          });
          return { category, subCategory, definitionContainerRoot, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode({ id: keys.subCategory.id, categoryId: keys.category.id }), true);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
              [keys.category.id]: "partial",
                [keys.subCategory.id]: "visible",
          },
        });
      });

      it("showing subCategory makes it visible and doesn't affect non related definition containers", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

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
          return { category, subCategory, definitionContainerRoot, categoryOfDefinitionContainer, subCategoryOfDefinitionContainer, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [
            { categoryId: keys.category.id, subCategories: keys.subCategory.id },
            { categoryId: keys.categoryOfDefinitionContainer.id, subCategories: keys.subCategoryOfDefinitionContainer.id },
          ],
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode({ id: keys.subCategory.id, categoryId: keys.category.id }), true);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.definitionContainerRoot.id]: "hidden",
              [keys.categoryOfDefinitionContainer.id]: "hidden",
                [keys.subCategoryOfDefinitionContainer.id]: "hidden",

            [keys.category.id]: "partial",
              [keys.subCategory.id]: "visible",
          },
        });
      });
    });

    describe("showElements set to true", () => {
      describe("definitionContainers", () => {
        it("showing definition container makes it and all of its contained elements visible", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

            const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
            const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });

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

          using visibilityTestData = await createVisibilityTestData({
            imodel,
            subCategoriesOfCategories: [{ categoryId: keys.indirectCategory.id, subCategories: keys.subCategory.id }],
            hierarchyConfig: { showElements: true },
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainerRoot.id }), true);
          await validateCategoriesTreeHierarchyVisibility({
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
            const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
            const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
            const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
            const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
            const indirectElement = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
            const indirectSubCategory = insertSubCategory({
              builder,
              parentCategoryId: indirectCategory.id,
              codeValue: "subCategory",
              modelId: definitionModelChild.id,
            });

            const definitionContainerRoot2 = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot2" });
            const definitionModelRoot2 = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot2.id });
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

          using visibilityTestData = await createVisibilityTestData({
            imodel,
            subCategoriesOfCategories: [
              { categoryId: keys.indirectCategory.id, subCategories: keys.indirectSubCategory.id },
              { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
            ],
            hierarchyConfig: { showElements: true },
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainerRoot.id }), true);
          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [keys.definitionContainerRoot.id]: "visible",
                [keys.definitionContainerChild.id]: "visible",
                  [keys.indirectCategory.id]: "visible",
                    [keys.indirectElement.id]: "visible",
                    [keys.indirectSubCategory.id]: "visible",

              [keys.definitionContainerRoot2.id]: "hidden",
                [keys.category2.id]: "hidden",
                  [keys.element2.id]: "hidden",
                  [keys.subCategory2.id]: "hidden",
            },
          });
        });

        it("showing definition container makes it and all of its contained elements visible, and parent container partially visible if it has more direct child categories", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

            const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
            const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });

            const directCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory1", modelId: definitionModelRoot.id });
            const directElement = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: directCategory.id });
            const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelChild.id });
            const indirectElement = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
            return { definitionContainerRoot, definitionContainerChild, directCategory, indirectCategory, directElement, indirectElement, physicalModel };
          });

          const { imodel, ...keys } = buildIModelResult;

          using visibilityTestData = await createVisibilityTestData({
            imodel,
            hierarchyConfig: { showElements: true },
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainerChild.id }), true);
          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [keys.definitionContainerRoot.id]: "partial",
                [keys.directCategory.id]: "hidden",
                  [keys.directElement.id]: "hidden",

                [keys.definitionContainerChild.id]: "visible",
                  [keys.indirectCategory.id]: "visible",
                    [keys.indirectElement.id]: "visible",
            },
          });
        });

        it("showing definition container makes it and all of its contained elements visible, and parent container partially visible if it has more definition containers", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

            const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
            const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
            const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
            const indirectElement = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });

            const definitionContainerChild2 = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild2", modelId: definitionModelRoot.id });
            const definitionModelChild2 = insertSubModel({
              builder,
              classFullName: CLASS_NAME_DefinitionModel,
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

          using visibilityTestData = await createVisibilityTestData({
            imodel,
            hierarchyConfig: { showElements: true },
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainerChild.id }), true);
          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [keys.definitionContainerRoot.id]: "partial",
                [keys.definitionContainerChild.id]: "visible",
                  [keys.indirectCategory.id]: "visible",
                    [keys.indirectElement.id]: "visible",

                [keys.definitionContainerChild2.id]: "hidden",
                  [keys.indirectCategory2.id]: "hidden",
                    [keys.indirectElement2.id]: "hidden",
            },
          });
        });

        it("showing child definition container makes it, all of its contained elements and its parent definition container visible", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
            const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
            const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
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

          using visibilityTestData = await createVisibilityTestData({
            imodel,
            subCategoriesOfCategories: [{ categoryId: keys.indirectCategory.id, subCategories: keys.indirectSubCategory.id }],
            hierarchyConfig: { showElements: true },
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainerChild.id }), true);
          await validateCategoriesTreeHierarchyVisibility({
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
            const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            const subCategory = insertSubCategory({
              builder,
              parentCategoryId: category.id,
              codeValue: "subCategory",
            });
            return { category, subCategory, element, physicalModel };
          });

          const { imodel, ...keys } = buildIModelResult;

          using visibilityTestData = await createVisibilityTestData({
            imodel,
            subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
            hierarchyConfig: { showElements: true },
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), true);
          await validateCategoriesTreeHierarchyVisibility({
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

            return { category, category2, subCategory, subCategory2, element, element2, physicalModel };
          });

          const { imodel, ...keys } = buildIModelResult;

          using visibilityTestData = await createVisibilityTestData({
            imodel,
            subCategoriesOfCategories: [
              { categoryId: keys.category.id, subCategories: keys.subCategory.id },
              { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
            ],
            hierarchyConfig: { showElements: true },
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), true);
          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [keys.category.id]: "visible",
                [keys.element.id]: "visible",
                [keys.subCategory.id]: "visible",

              [keys.category2.id]: "hidden",
                [keys.element2.id]: "hidden",
                [keys.subCategory2.id]: "hidden",
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
            const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
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

          using visibilityTestData = await createVisibilityTestData({
            imodel,
            subCategoriesOfCategories: [
              { categoryId: keys.category.id, subCategories: keys.subCategory.id },
              { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
            ],
            hierarchyConfig: { showElements: true },
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), true);
          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [keys.category.id]: "visible",
                [keys.subCategory.id]: "visible",
                [keys.element.id]: "visible",

              [keys.definitionContainer.id]: "hidden",
                [keys.category2.id]: "hidden",
                  [keys.subCategory2.id]: "hidden",
                  [keys.element2.id]: "hidden",
            },
          });
        });

        it("showing category makes it, all of its subcategories and elements visible, and parent container partially visible if it has more direct child categories", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

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

          using visibilityTestData = await createVisibilityTestData({
            imodel,
            subCategoriesOfCategories: [
              { categoryId: keys.category.id, subCategories: keys.subCategory.id },
              { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
            ],
            hierarchyConfig: { showElements: true },
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), true);
          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [keys.definitionContainerRoot.id]: "partial",
                [keys.category.id]: "visible",
                  [keys.subCategory.id]: "visible",
                  [keys.element.id]: "visible",

                [keys.category2.id]: "hidden",
                  [keys.subCategory2.id]: "hidden",
                  [keys.element2.id]: "hidden",
            },
          });
        });

        it("showing category makes it, all of its subCategories and elements visible, and parent container partially visible if it has more definition containers", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

            const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
            const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
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

          using visibilityTestData = await createVisibilityTestData({
            imodel,
            subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
            hierarchyConfig: { showElements: true },
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), true);
          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [keys.definitionContainerRoot.id]: "partial",
                [keys.definitionContainerChild.id]: "hidden",
                  [keys.indirectCategory.id]: "hidden",
                    [keys.indirectElement.id]: "hidden",

                [keys.category.id]: "visible",
                  [keys.subCategory.id]: "visible",
                  [keys.element.id]: "visible",
            },
          });
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

          using visibilityTestData = await createVisibilityTestData({
            imodel,
            subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: [keys.subCategory.id, keys.subCategory2.id] }],
            hierarchyConfig: { showElements: true },
          });
          const { handler, provider, viewport } = visibilityTestData;
          setupInitialDisplayState({ viewport, elements: [{ id: keys.element.id, visible: false }] });
          await handler.changeVisibility(createSubCategoryHierarchyNode({ id: keys.subCategory.id, categoryId: keys.category.id }), true);

          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [keys.category.id]: "partial",
                [keys.subCategory.id]: "visible",
                [keys.subCategory2.id]: "hidden",
                [keys.element.id]: "hidden",
            },
          });
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

          using visibilityTestData = await createVisibilityTestData({
            imodel,
            subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
            hierarchyConfig: { showElements: true },
          });
          const { handler, provider, viewport } = visibilityTestData;
          setupInitialDisplayState({
            viewport,
            elements: [
              { id: keys.element.id, visible: false },
              { id: keys.element2.id, visible: false },
            ],
          });

          await handler.changeVisibility(createSubCategoryHierarchyNode({ id: keys.subCategory.id, categoryId: keys.category.id }), true);
          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [keys.category.id]: "partial",
                [keys.subCategory.id]: "visible",
                [keys.element.id]: "hidden",

              [keys.category2.id]: "hidden",
                [keys.element2.id]: "hidden",
            },
          });
        });

        it("showing subCategory makes it visible and parents partially visible", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

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

          using visibilityTestData = await createVisibilityTestData({
            imodel,
            subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
            hierarchyConfig: { showElements: true },
          });
          const { handler, provider, viewport } = visibilityTestData;
          setupInitialDisplayState({ viewport, elements: [{ id: keys.element.id, visible: false }] });

          await handler.changeVisibility(createSubCategoryHierarchyNode({ id: keys.subCategory.id, categoryId: keys.category.id }), true);
          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [keys.definitionContainerRoot.id]: "partial",
                [keys.category.id]: "partial",
                  [keys.subCategory.id]: "visible",
                  [keys.element.id]: "hidden",
            },
          });
        });

        it("showing subCategory makes it visible and doesn't affect non related definition containers", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

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

          using visibilityTestData = await createVisibilityTestData({
            imodel,
            subCategoriesOfCategories: [
              { categoryId: keys.category.id, subCategories: keys.subCategory.id },
              { categoryId: keys.categoryOfDefinitionContainer.id, subCategories: keys.subCategoryOfDefinitionContainer.id },
            ],
            hierarchyConfig: { showElements: true },
          });
          const { handler, provider, viewport } = visibilityTestData;
          setupInitialDisplayState({
            viewport,
            elements: [
              { id: keys.element.id, visible: false },
              { id: keys.elementOfDefinitionContainer.id, visible: false },
            ],
          });

          await handler.changeVisibility(createSubCategoryHierarchyNode({ id: keys.subCategory.id, categoryId: keys.category.id }), true);
          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [keys.definitionContainerRoot.id]: "hidden",
                [keys.categoryOfDefinitionContainer.id]: "hidden",
                  [keys.subCategoryOfDefinitionContainer.id]: "hidden",
                  [keys.elementOfDefinitionContainer.id]: "hidden",

              [keys.category.id]: "partial",
                [keys.subCategory.id]: "visible",
                [keys.element.id]: "hidden",
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

          using visibilityTestData = await createVisibilityTestData({
            imodel,
            subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: [keys.subCategory.id, keys.subCategory2.id] }],
            hierarchyConfig: { showElements: true },
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(
            createElementHierarchyNode({ modelId: keys.physicalModel.id, categoryId: keys.category.id, elementId: keys.element.id }),
            true,
          );

          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
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

          using visibilityTestData = await createVisibilityTestData({
            imodel,
            subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
            hierarchyConfig: { showElements: true },
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(
            createElementHierarchyNode({ modelId: keys.physicalModel.id, categoryId: keys.category.id, elementId: keys.element.id }),
            true,
          );
          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [keys.category.id]: "partial",
                [keys.subCategory.id]: "hidden",
                [keys.element.id]: "visible",

              [keys.category2.id]: "hidden",
                [keys.element2.id]: "hidden",
            },
          });
        });

        // TODO: Enable with https://github.com/iTwin/viewer-components-react/issues/1513
        it.skip("showing element makes it, its children visible and parents partially visible", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

            const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelRoot.id });
            const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            const childElement = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id, parentId: element.id });
            const subCategory = insertSubCategory({
              builder,
              parentCategoryId: category.id,
              codeValue: "subCategory",
              modelId: definitionModelRoot.id,
            });
            return { category, subCategory, definitionContainerRoot, element, physicalModel, childElement };
          });

          const { imodel, ...keys } = buildIModelResult;

          using visibilityTestData = await createVisibilityTestData({
            imodel,
            subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
            hierarchyConfig: { showElements: true },
          });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(
            createElementHierarchyNode({ modelId: keys.physicalModel.id, categoryId: keys.category.id, elementId: keys.element.id }),
            true,
          );
          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [keys.definitionContainerRoot.id]: "partial",
                [keys.category.id]: "partial",
                  [keys.subCategory.id]: "hidden",
                  [keys.element.id]: "visible",
                    [keys.childElement.id]: "visible",
            },
          });
        });

        it("showing subCategory makes it visible and doesn't affect non related definition containers", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
            const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

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

          using visibilityTestData = await createVisibilityTestData({
            imodel,
            subCategoriesOfCategories: [
              { categoryId: keys.category.id, subCategories: keys.subCategory.id },
              { categoryId: keys.categoryOfDefinitionContainer.id, subCategories: keys.subCategoryOfDefinitionContainer.id },
            ],
            hierarchyConfig: { showElements: true },
          });
          const { handler, provider, viewport } = visibilityTestData;

          setupInitialDisplayState({
            viewport,
            elements: [
              { id: keys.element.id, visible: false },
              { id: keys.elementOfDefinitionContainer.id, visible: false },
            ],
          });

          await handler.changeVisibility(createSubCategoryHierarchyNode({ id: keys.subCategory.id, categoryId: keys.category.id }), true);
          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [keys.definitionContainerRoot.id]: "hidden",
                [keys.categoryOfDefinitionContainer.id]: "hidden",
                  [keys.subCategoryOfDefinitionContainer.id]: "hidden",
                  [keys.elementOfDefinitionContainer.id]: "hidden",

              [keys.category.id]: "partial",
                [keys.subCategory.id]: "visible",
                [keys.element.id]: "hidden",
            },
          });
        });
      });

      interface IModelWithSubModelIds {
        modeledElement: InstanceKey;
        model: InstanceKey;
        category: InstanceKey;
        subModelCategory?: InstanceKey;
        subModelElement?: InstanceKey;
        subModel: InstanceKey;
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
              const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
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
                subModel,
              };
            });
          },
          cases: [
            {
              name: "modeled element's children display is turned on when its category display is turned on",
              getTargetNode: (ids: IModelWithSubModelIds) => createCategoryHierarchyNode({ id: ids.category.id, hasChildren: true }),
              // prettier-ignore
              expectations: (ids) => ({
                [ids.category.id]: "visible",
                  [ids.modeledElement.id]: "visible",
                    [`${ids.modeledElement.id}-${ids.subModelCategory?.id ?? ""}`]: "visible",
                      [ids.subModelElement?.id ?? ""]: "visible",

                [ids.subModelCategory?.id ?? ""]: "partial",
              }),
            },
            {
              name: "modeled element's children display is turned on when its class grouping node display is turned on",
              getTargetNode: (ids: IModelWithSubModelIds) =>
                createClassGroupingHierarchyNode({ categoryId: ids.category.id, modelElementsMap: new Map([[ids.model.id, [ids.modeledElement.id]]]) }),
              // prettier-ignore
              expectations: (ids: IModelWithSubModelIds) => ({
                [ids.subModelCategory?.id ?? ""]: "partial",

                [ids.category.id]: "partial",
                  [ids.modeledElement.id]: "visible",
                    [`${ids.modeledElement.id}-${ids.subModelCategory?.id ?? ""}`]: "visible",
                      [ids.subModelElement?.id ?? ""]: "visible",
              }),
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
              // prettier-ignore
              expectations: (ids: IModelWithSubModelIds) => ({
                [ids.subModelCategory?.id ?? ""]: "partial",

                [ids.category.id]: "partial",
                  [ids.modeledElement.id]: "visible",
                    [`${ids.modeledElement.id}-${ids.subModelCategory?.id ?? ""}`]: "visible",
                      [ids.subModelElement?.id ?? ""]: "visible",
              }),
            },
            {
              name: "modeled element's children display is turned on when its sub-model display is turned on",
              getTargetNode: (ids: IModelWithSubModelIds) => createModelHierarchyNode({ id: ids.modeledElement.id, hasChildren: true }),
              // prettier-ignore
              expectations: (ids: IModelWithSubModelIds) => ({
                [ids.subModelCategory?.id ?? ""]: "partial",

                [ids.category.id]: "partial",
                  [ids.modeledElement.id]: "partial",
                    [`${ids.modeledElement.id}-${ids.subModelCategory?.id ?? ""}`]: "visible",
                      [ids.subModelElement?.id ?? ""]: "visible",
              }),
            },
            {
              name: "modeled element, its model and category have partial visibility when its sub-model element's category display is turned on",
              getTargetNode: (ids: IModelWithSubModelIds) => createSubModelCategoryHierarchyNode(ids.modeledElement.id, ids.subModelCategory?.id, true),
              // prettier-ignore
              expectations: (ids: IModelWithSubModelIds) => ({
                [ids.subModelCategory?.id ?? ""]: "visible",

                [ids.category.id]: "partial",
                  [ids.modeledElement.id]: "partial",
                    [`${ids.modeledElement.id}-${ids.subModelCategory?.id ?? ""}`]: "visible",
                      [ids.subModelElement?.id ?? ""]: "visible",
              }),
            },
            {
              name: "modeled element, its model and category have partial visibility when its sub-model element's display is turned on",
              getTargetNode: (ids: IModelWithSubModelIds) =>
                createElementHierarchyNode({
                  modelId: ids.modeledElement.id,
                  categoryId: ids.subModelCategory?.id,
                  elementId: ids.subModelElement!.id,
                }),
              // prettier-ignore
              expectations: (ids: IModelWithSubModelIds) => ({
                [ids.subModelCategory?.id ?? ""]: "partial",

                [ids.category.id]: "partial",
                  [ids.modeledElement.id]: "partial",
                    [`${ids.modeledElement.id}-${ids.subModelCategory?.id ?? ""}`]: "visible",
                      [ids.subModelElement?.id ?? ""]: "visible",
              }),
            },
          ],
        },
        {
          describeName: "with modeled elements that have private subModel",
          createIModel: async function createIModel(context: Mocha.Context): Promise<{ imodel: IModelConnection } & IModelWithSubModelIds> {
            return buildIModel(context, async (builder, testSchema) => {
              const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
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
                subModel,
              };
            });
          },
          cases: [
            {
              name: "children are visible when category display is turned on",
              getTargetNode: (ids: IModelWithSubModelIds) => createCategoryHierarchyNode({ id: ids.category.id, hasChildren: true }),
              // prettier-ignore
              expectations: (ids: IModelWithSubModelIds) => ({
                [ids.subModelCategory?.id ?? ""]: "hidden",

                [ids.category.id]: "visible",
                  [ids.modeledElement.id]: "visible",
              }),
            },
            {
              name: "child elements are visible when elements class grouping node display is turned on",
              getTargetNode: (ids: IModelWithSubModelIds) =>
                createClassGroupingHierarchyNode({ categoryId: ids.category.id, modelElementsMap: new Map([[ids.model.id, [ids.modeledElement.id]]]) }),
              // Category has partial visibility, since its sub-category is not visible
              // prettier-ignore
              expectations: (ids: IModelWithSubModelIds) => ({
                [ids.subModelCategory?.id ?? ""]: "hidden",

                [ids.category.id]: "partial",
                  [ids.modeledElement.id]: "visible",
              }),
            },
            {
              name: "everything under model is visible when elements display is turned on",
              getTargetNode: (ids: IModelWithSubModelIds) =>
                createElementHierarchyNode({
                  modelId: ids.model.id,
                  categoryId: ids.category.id,
                  elementId: ids.modeledElement.id,
                  hasChildren: false,
                }),
              // Category has partial visibility, since its sub-category is not visible
              //prettier-ignore
              expectations: (ids: IModelWithSubModelIds) => ({
                [ids.subModelCategory?.id ?? ""]: "hidden",

                [ids.category.id]: "partial",
                  [ids.modeledElement.id]: "visible",
              }),
            },
          ],
        },
        {
          describeName: "with modeled elements that have subModel with no children",
          createIModel: async function createIModel(context: Mocha.Context): Promise<{ imodel: IModelConnection } & IModelWithSubModelIds> {
            return buildIModel(context, async (builder, testSchema) => {
              const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
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
              getTargetNode: (ids: IModelWithSubModelIds) => createCategoryHierarchyNode({ id: ids.category.id, hasChildren: true }),
              expectations: () => "all-visible",
            },
            {
              name: "everything under model is visible when elements class grouping node display is turned on",
              getTargetNode: (ids: IModelWithSubModelIds) =>
                createClassGroupingHierarchyNode({ categoryId: ids.category.id, modelElementsMap: new Map([[ids.model.id, [ids.modeledElement.id]]]) }),
              // Category has partial visibility, since its sub-category is not visible
              // prettier-ignore
              expectations: (ids) => ({
                [ids.category.id]: "partial",
                  [ids.modeledElement.id]: "visible",
              }),
            },
            {
              name: "everything under model is visible when elements display is turned on",
              getTargetNode: (ids: IModelWithSubModelIds) =>
                createElementHierarchyNode({
                  modelId: ids.model.id,
                  categoryId: ids.category.id,
                  elementId: ids.modeledElement.id,
                  hasChildren: false,
                }),
              // Category has partial visibility, since its sub-category is not visible
              // prettier-ignore
              expectations: (ids) => ({
                [ids.category.id]: "partial",
                  [ids.modeledElement.id]: "visible",
              }),
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
              using visibilityTestData = await createVisibilityTestData({
                imodel: iModel,
                hierarchyConfig: { showElements: true },
              });
              const { handler, provider, viewport } = visibilityTestData;

              const nodeToChangeVisibility = getTargetNode(createdIds);
              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                expectations: "all-hidden",
              });
              await handler.changeVisibility(nodeToChangeVisibility, true);
              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                expectations: expectations(createdIds),
              });
              await handler.changeVisibility(nodeToChangeVisibility, false);
              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                expectations: "all-hidden",
              });
            });
          });
        });
      });
    });

    describe("enabling category visibility through overrides", () => {
      it("category is partial when multiple models contain category and override for one model is set to 'Show'", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
          const physicalModel2 = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          insertPhysicalElement({ builder, modelId: physicalModel2.id, categoryId: category.id });
          return { category, physicalModel, physicalModel2 };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        setupInitialDisplayState({
          viewport,
          models: [
            { id: keys.physicalModel.id, visible: true },
            { id: keys.physicalModel2.id, visible: true },
          ],
        });

        viewport.setPerModelCategoryOverride({
          modelIds: keys.physicalModel.id,
          categoryIds: keys.category.id,
          override: "show",
        });

        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.category.id]: "partial",
          },
        });
      });
    });

    describe("enabling category visibility through model selector", () => {
      it("category is visible when only one model contains category and model is enabled through model selector", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          return { category, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        setupInitialDisplayState({ viewport, categories: [{ id: keys.category.id, visible: true }] });

        viewport.changeModelDisplay({ modelIds: keys.physicalModel.id, display: true });

        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-visible",
        });
      });

      it("category is partial when multiple models contain category and one model is enabled through model selector", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
          const physicalModel2 = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          insertPhysicalElement({ builder, modelId: physicalModel2.id, categoryId: category.id });
          return { category, physicalModel, physicalModel2 };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        setupInitialDisplayState({ viewport, categories: [{ id: keys.category.id, visible: true }] });

        viewport.changeModelDisplay({ modelIds: keys.physicalModel.id, display: true });

        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.category.id]: "partial",
          },
        });
      });
    });
  });

  describe("disabling visibility", () => {
    it("by default everything is visible", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        const subCategory = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "subCategory", modelId: definitionModel.id });
        return { category, physicalModel, subCategory };
      });

      const { imodel, ...keys } = buildIModelResult;
      using visibilityTestData = await createVisibilityTestData({
        imodel,
        subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
        visibleByDefault: true,
      });
      const { handler, provider, viewport } = visibilityTestData;

      await validateCategoriesTreeHierarchyVisibility({
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
          const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });

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
          return { definitionContainerRoot, definitionContainerChild, directCategory, indirectCategory, indirectSubCategory, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [{ categoryId: keys.indirectCategory.id, subCategories: keys.indirectSubCategory.id }],
          visibleByDefault: true,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainerRoot.id }), false);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-hidden",
        });
      });

      it("hiding definition container makes it and all of its contained elements hidden and doesn't affect non contained definition containers", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
          const indirectSubCategory = insertSubCategory({
            builder,
            parentCategoryId: indirectCategory.id,
            codeValue: "subCategory",
            modelId: definitionModelChild.id,
          });

          const definitionContainerRoot2 = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot2" });
          const definitionModelRoot2 = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot2.id });
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
            physicalModel,
          };
        });

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [
            { categoryId: keys.indirectCategory.id, subCategories: keys.indirectSubCategory.id },
            { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
          ],
          visibleByDefault: true,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainerRoot.id }), false);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.definitionContainerRoot.id]: "hidden",
              [keys.definitionContainerChild.id]: "hidden",
                [keys.indirectCategory.id]: "hidden",
                  [keys.indirectSubCategory.id]: "hidden",

            [keys.definitionContainerRoot2.id]: "visible",
              [keys.category2.id]: "visible",
                [keys.subCategory2.id]: "visible",
          },
        });
      });

      it("hiding definition container makes it and all of its contained elements hidden, and parent container partially visible if it has more direct child categories", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });

          const directCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory1", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: directCategory.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
          return { definitionContainerRoot, definitionContainerChild, directCategory, indirectCategory, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, visibleByDefault: true });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainerChild.id }), false);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
              [keys.directCategory.id]: "visible",

              [keys.definitionContainerChild.id]: "hidden",
                [keys.indirectCategory.id]: "hidden",
          },
        });
      });

      it("hiding definition container makes it and all of its contained elements hidden, and parent container partially visible if it has more definition containers", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });

          const definitionContainerChild2 = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild2", modelId: definitionModelRoot.id });
          const definitionModelChild2 = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild2.id });
          const indirectCategory2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModelChild2.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory2.id });
          return { definitionContainerRoot, definitionContainerChild, indirectCategory2, indirectCategory, definitionContainerChild2, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({ imodel, visibleByDefault: true });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainerChild.id }), false);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
              [keys.definitionContainerChild.id]: "hidden",
                [keys.indirectCategory.id]: "hidden",

              [keys.definitionContainerChild2.id]: "visible",
                [keys.indirectCategory2.id]: "visible",
          },
        });
      });

      it("hiding child definition container makes it, all of its contained elements and its parent definition container hidden", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });
          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
          const indirectCategory = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: indirectCategory.id });
          const indirectSubCategory = insertSubCategory({
            builder,
            parentCategoryId: indirectCategory.id,
            codeValue: "subCategory",
            modelId: definitionModelChild.id,
          });

          return { definitionContainerRoot, definitionContainerChild, indirectCategory, indirectSubCategory, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [{ categoryId: keys.indirectCategory.id, subCategories: keys.indirectSubCategory.id }],
          visibleByDefault: true,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainerChild.id }), false);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-hidden",
        });
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
          return { category, subCategory, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
          visibleByDefault: true,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), false);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-hidden",
        });
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

          return { category, category2, subCategory, subCategory2, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [
            { categoryId: keys.category.id, subCategories: keys.subCategory.id },
            { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
          ],
          visibleByDefault: true,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), false);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.category.id]: "hidden",
              [keys.subCategory.id]: "hidden",

            [keys.category2.id]: "visible",
              [keys.subCategory2.id]: "visible",
          },
        });
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
          const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
          const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", modelId: definitionModel.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });
          const subCategory2 = insertSubCategory({
            builder,
            parentCategoryId: category2.id,
            codeValue: "subCategory2",
            modelId: definitionContainer.id,
          });

          return { definitionContainer, category, category2, subCategory, subCategory2, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [
            { categoryId: keys.category.id, subCategories: keys.subCategory.id },
            { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
          ],
          visibleByDefault: true,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), false);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.category.id]: "hidden",
              [keys.subCategory.id]: "hidden",

            [keys.definitionContainer.id]: "visible",
              [keys.category2.id]: "visible",
                [keys.subCategory2.id]: "visible",
          },
        });
      });

      it("hiding category makes it and all of its subcategories hidden, and parent container partially visible if it has more direct child categories", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

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
          return { definitionContainerRoot, category, category2, subCategory, subCategory2, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [
            { categoryId: keys.category.id, subCategories: keys.subCategory.id },
            { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
          ],
          visibleByDefault: true,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), false);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
              [keys.category.id]: "hidden",
                [keys.subCategory.id]: "hidden",

              [keys.category2.id]: "visible",
                [keys.subCategory2.id]: "visible",
          },
        });
      });

      it("hiding category makes it and all of its subCategories hidden, and parent container partially visible if it has more definition containers", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

          const definitionContainerChild = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerChild", modelId: definitionModelRoot.id });
          const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
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
          return { definitionContainerRoot, definitionContainerChild, category, indirectCategory, subCategory, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
          visibleByDefault: true,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), false);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
              [keys.category.id]: "hidden",
                [keys.subCategory.id]: "hidden",

              [keys.definitionContainerChild.id]: "visible",
                [keys.indirectCategory.id]: "visible",
          },
        });
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
          return { category, subCategory, subCategory2, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: [keys.subCategory.id, keys.subCategory2.id] }],
          visibleByDefault: true,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode({ id: keys.subCategory.id, categoryId: keys.category.id }), false);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.category.id]: "partial",
              [keys.subCategory.id]: "hidden",
              [keys.subCategory2.id]: "visible",
          },
        });
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
          return { category, subCategory, category2, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
          visibleByDefault: true,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode({ id: keys.subCategory.id, categoryId: keys.category.id }), false);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.category.id]: "partial",
              [keys.subCategory.id]: "hidden",

            [keys.category2.id]: "visible",
          },
        });
      });

      it("hiding subCategory makes it hidden and parents partially visible", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelRoot.id });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
            modelId: definitionModelRoot.id,
          });
          return { category, subCategory, definitionContainerRoot, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
          visibleByDefault: true,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode({ id: keys.subCategory.id, categoryId: keys.category.id }), false);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.definitionContainerRoot.id]: "partial",
              [keys.category.id]: "partial",
                [keys.subCategory.id]: "hidden",
          },
        });
      });

      it("hiding subCategory makes it hidden and doesn't affect non related definition containers", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const definitionContainerRoot = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
          const definitionModelRoot = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerRoot.id });

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
          return { category, subCategory, definitionContainerRoot, categoryOfDefinitionContainer, subCategoryOfDefinitionContainer, physicalModel };
        });

        const { imodel, ...keys } = buildIModelResult;
        using visibilityTestData = await createVisibilityTestData({
          imodel,
          subCategoriesOfCategories: [
            { categoryId: keys.category.id, subCategories: keys.subCategory.id },
            { categoryId: keys.categoryOfDefinitionContainer.id, subCategories: keys.subCategoryOfDefinitionContainer.id },
          ],
          visibleByDefault: true,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createSubCategoryHierarchyNode({ id: keys.subCategory.id, categoryId: keys.category.id }), false);
        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.definitionContainerRoot.id]: "visible",
              [keys.categoryOfDefinitionContainer.id]: "visible",
                [keys.subCategoryOfDefinitionContainer.id]: "visible",

            [keys.category.id]: "partial",
              [keys.subCategory.id]: "hidden",
          },
        });
      });
    });

    describe("disabling category visibility through overrides", () => {
      it("category is partial when multiple models contain category and override for one model is set to 'Hide'", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
          const physicalModel2 = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          insertPhysicalElement({ builder, modelId: physicalModel2.id, categoryId: category.id });
          return { category, physicalModel, physicalModel2 };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({ imodel, visibleByDefault: true });
        const { handler, provider, viewport } = visibilityTestData;

        viewport.setPerModelCategoryOverride({
          modelIds: keys.physicalModel.id,
          categoryIds: keys.category.id,
          override: "hide",
        });

        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.category.id]: "partial",
          },
        });
      });
    });

    describe("disabling category visibility through model selector", () => {
      it("category is partial when multiple models contain category and one model is disabled through model selector", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
          const physicalModel2 = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" });

          const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          insertPhysicalElement({ builder, modelId: physicalModel2.id, categoryId: category.id });
          return { category, physicalModel, physicalModel2 };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({ imodel, visibleByDefault: true });
        const { handler, provider, viewport } = visibilityTestData;

        viewport.changeModelDisplay({ modelIds: keys.physicalModel.id, display: false });

        await validateCategoriesTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.category.id]: "partial",
          },
        });
      });
    });
  });

  describe("search nodes", () => {
    async function createFilteredVisibilityTestData({
      imodel,
      searchPaths,
      view,
      visibleByDefault,
      subCategoriesOfCategories,
    }: Parameters<typeof createVisibilityTestData>[0] & {
      searchPaths: HierarchyNodeIdentifiersPath[];
      view: "2d" | "3d";
      visibleByDefault?: boolean;
      subCategoriesOfCategories: Array<{ categoryId: string; subCategories: Id64Arg }>;
    }) {
      const hierarchyConfig = { ...defaultHierarchyConfiguration, showElements: true, showEmptyCategories: true };
      const imodelAccess = createIModelAccess(imodel);
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, view);
      const viewport = createTreeWidgetTestingViewport({
        iModel: imodel,
        viewType: view,
        visibleByDefault,
        subCategoriesOfCategories,
      });
      const visibilityHandlerWithSearchPaths = createCategoriesTreeVisibilityHandler({
        idsCache,
        searchPaths,
        imodelAccess,
        viewport,
        hierarchyConfig,
      });
      const defaultVisibilityHandler = createCategoriesTreeVisibilityHandler({
        idsCache,
        imodelAccess,
        viewport,
        hierarchyConfig,
      });
      const defaultProvider = createProvider({ idsCache, imodelAccess, hierarchyConfig });
      const providerWithSearchPaths = createProvider({ idsCache, imodelAccess, searchPaths, hierarchyConfig });
      return {
        defaultVisibilityHandler,
        visibilityHandlerWithSearchPaths,
        defaultProvider,
        providerWithSearchPaths,
        imodel,
        imodelAccess,
        viewport,
        [Symbol.dispose]() {
          idsCache[Symbol.dispose]();
          defaultVisibilityHandler[Symbol.dispose]();
          visibilityHandlerWithSearchPaths[Symbol.dispose]();
          defaultProvider[Symbol.dispose]();
          providerWithSearchPaths[Symbol.dispose]();
        },
      };
    }

    describe("category with sub-categories hierarchy", () => {
      let createIModelResult: Awaited<ReturnType<typeof createIModel>>;
      let visibilityTestData: Awaited<ReturnType<typeof createFilteredVisibilityTestData>>;
      async function createIModel(context: Mocha.Context) {
        return buildIModel(context, async (builder) => {
          const category = insertSpatialCategory({ builder, codeValue: "category" });
          const defaultSubCategory = { id: getDefaultSubCategoryId(category.id), className: CLASS_NAME_SubCategory };
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
          });

          const siblingCategory = insertSpatialCategory({ builder, codeValue: "sibling category" });
          const defaultSiblingSubCategory = { id: getDefaultSubCategoryId(siblingCategory.id), className: CLASS_NAME_SubCategory };
          const siblingSubCategory = insertSubCategory({
            builder,
            parentCategoryId: siblingCategory.id,
            codeValue: "sibling SubCategory",
          });

          return {
            category,
            subCategory,
            siblingCategory,
            siblingSubCategory,
            defaultSubCategory,
            defaultSiblingSubCategory,
            searchPaths: [[category, defaultSubCategory]],
          };
        });
      }

      before(async function () {
        createIModelResult = await createIModel(this);
      });

      beforeEach(async function () {
        visibilityTestData = await createFilteredVisibilityTestData({
          imodel: createIModelResult.imodel,
          searchPaths: createIModelResult.searchPaths,
          view: "3d",
          visibleByDefault: false,
          subCategoriesOfCategories: [
            { categoryId: createIModelResult.category.id, subCategories: [createIModelResult.subCategory.id, createIModelResult.defaultSubCategory.id] },
            {
              categoryId: createIModelResult.siblingCategory.id,
              subCategories: [createIModelResult.siblingSubCategory.id, createIModelResult.defaultSiblingSubCategory.id],
            },
          ],
        });
      });

      afterEach(() => {
        visibilityTestData[Symbol.dispose]();
      });

      after(async () => {
        await createIModelResult.imodel.close();
      });

      it("showing category changes visibility for related nodes in search paths", async function () {
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const { category, subCategory, defaultSubCategory, siblingCategory, siblingSubCategory, defaultSiblingSubCategory } = createIModelResult;
        await visibilityHandlerWithSearchPaths.changeVisibility(
          createCategoryHierarchyNode({
            id: category.id,
            search: {
              isSearchTarget: false,
              childrenTargetPaths: [[defaultSubCategory]],
            },
          }),
          true,
        );

        await validateCategoriesTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          // prettier-ignore
          expectations: {
            [category.id]: "visible",
              [defaultSubCategory.id]: "visible",
          },
        });

        await validateCategoriesTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // prettier-ignore
          expectations: {
            [category.id]: "partial",
              [defaultSubCategory.id]: "visible",
              [subCategory.id]: "hidden",

            [siblingCategory.id]: "hidden",
              [siblingSubCategory.id]: "hidden",
              [defaultSiblingSubCategory.id]: "hidden",
          },
        });
      });

      it("showing search target sub-category changes visibility for related nodes in search paths", async function () {
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const { category, subCategory, defaultSubCategory, siblingCategory, siblingSubCategory, defaultSiblingSubCategory } = createIModelResult;
        await visibilityHandlerWithSearchPaths.changeVisibility(
          createSubCategoryHierarchyNode({
            id: defaultSubCategory.id,
            categoryId: category.id,
            parentKeys: [category],
            search: { isSearchTarget: true },
          }),
          true,
        );

        await validateCategoriesTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          // prettier-ignore
          expectations: {
            [category.id]: "visible",
              [defaultSubCategory.id]: "visible",
          },
        });

        await validateCategoriesTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // prettier-ignore
          expectations: {
            [category.id]: "partial",
              [defaultSubCategory.id]: "visible",
              [subCategory.id]: "hidden",

            [siblingCategory.id]: "hidden",
              [siblingSubCategory.id]: "hidden",
              [defaultSiblingSubCategory.id]: "hidden",
          },
        });
      });
    });

    // TODO: Enable with https://github.com/iTwin/viewer-components-react/issues/1513
    describe.skip("category with child elements hierarchy", () => {
      let createIModelResult: Awaited<ReturnType<typeof createIModel>>;
      let visibilityTestData: Awaited<ReturnType<typeof createFilteredVisibilityTestData>>;
      async function createIModel(context: Mocha.Context) {
        return buildIModel(context, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

          const category = insertSpatialCategory({ builder, codeValue: "category" });
          const defaultSubCategory = { id: getDefaultSubCategoryId(category.id), className: CLASS_NAME_SubCategory };
          const parentElement = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const childElement = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id, parentId: parentElement.id });
          const childElement2 = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id, parentId: parentElement.id });

          const siblingCategory = insertSpatialCategory({ builder, codeValue: "sibling category" });
          const defaultSiblingSubCategory = { id: getDefaultSubCategoryId(siblingCategory.id), className: CLASS_NAME_SubCategory };
          const siblingElement = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: siblingCategory.id });

          return {
            category,
            defaultSubCategory,
            parentElement,
            element,
            childElement,
            childElement2,
            defaultSiblingSubCategory,
            siblingElement,
            siblingCategory,
            physicalModel,
            searchPaths: [[category, parentElement, childElement]],
          };
        });
      }

      before(async function () {
        createIModelResult = await createIModel(this);
      });

      beforeEach(async function () {
        visibilityTestData = await createFilteredVisibilityTestData({
          imodel: createIModelResult.imodel,
          searchPaths: createIModelResult.searchPaths,
          view: "3d",
          visibleByDefault: false,
          subCategoriesOfCategories: [
            { categoryId: createIModelResult.category.id, subCategories: createIModelResult.defaultSubCategory.id },
            { categoryId: createIModelResult.siblingCategory.id, subCategories: createIModelResult.defaultSiblingSubCategory.id },
          ],
        });
      });

      afterEach(() => {
        visibilityTestData[Symbol.dispose]();
      });

      after(async () => {
        await createIModelResult.imodel.close();
      });

      it("showing category changes visibility for related nodes in search paths", async function () {
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const {
          category,
          element,
          siblingElement,
          parentElement,
          childElement,
          childElement2,
          defaultSubCategory,
          siblingCategory,
          defaultSiblingSubCategory,
        } = createIModelResult;
        await visibilityHandlerWithSearchPaths.changeVisibility(
          createCategoryHierarchyNode({
            id: category.id,
            search: {
              isSearchTarget: false,
              childrenTargetPaths: [[parentElement, childElement]],
            },
          }),
          true,
        );

        await validateCategoriesTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          // prettier-ignore
          expectations: {
            [category.id]: "visible",
              [parentElement.id]: "visible",
                [childElement.id]: "visible",
          },
        });

        await validateCategoriesTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // prettier-ignore
          expectations: {
            [category.id]: "partial",
              [defaultSubCategory.id]: "hidden",
              [element.id]: "hidden",

              [parentElement.id]: "partial",
                [childElement.id]: "visible",
                [childElement2.id]: "hidden",

            [siblingCategory.id]: "hidden",
              [siblingElement.id]: "hidden",
              [defaultSiblingSubCategory.id]: "hidden",
          },
        });
      });

      it("showing parent element changes visibility for related nodes in search paths", async function () {
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const {
          category,
          element,
          siblingElement,
          parentElement,
          childElement,
          childElement2,
          defaultSubCategory,
          siblingCategory,
          defaultSiblingSubCategory,
          physicalModel,
        } = createIModelResult;
        await visibilityHandlerWithSearchPaths.changeVisibility(
          createElementHierarchyNode({
            elementId: parentElement.id,
            parentKeys: [category],
            modelId: physicalModel.id,
            categoryId: category.id,
            search: {
              isSearchTarget: false,
              childrenTargetPaths: [[childElement]],
            },
          }),
          true,
        );

        await validateCategoriesTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          // prettier-ignore
          expectations: {
            [category.id]: "visible",
              [parentElement.id]: "visible",
                [childElement.id]: "visible",
          },
        });

        await validateCategoriesTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // prettier-ignore
          expectations: {
            [category.id]: "partial",
              [defaultSubCategory.id]: "hidden",
              [element.id]: "hidden",

              [parentElement.id]: "partial",
                [childElement.id]: "visible",
                [childElement2.id]: "hidden",

            [siblingCategory.id]: "hidden",
              [siblingElement.id]: "hidden",
              [defaultSiblingSubCategory.id]: "hidden",
          },
        });
      });

      it("showing search target child element changes visibility for related nodes in search paths", async function () {
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const {
          category,
          element,
          siblingElement,
          parentElement,
          childElement,
          childElement2,
          defaultSubCategory,
          siblingCategory,
          defaultSiblingSubCategory,
          physicalModel,
        } = createIModelResult;
        await visibilityHandlerWithSearchPaths.changeVisibility(
          createElementHierarchyNode({
            elementId: childElement.id,
            parentKeys: [category, parentElement],
            modelId: physicalModel.id,
            categoryId: category.id,
            search: { isSearchTarget: true },
          }),
          true,
        );

        await validateCategoriesTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          // prettier-ignore
          expectations: {
            [category.id]: "partial",
              [parentElement.id]: "partial",
                [childElement.id]: "visible",
          },
        });

        await validateCategoriesTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // prettier-ignore
          expectations: {
            [category.id]: "partial",
              [defaultSubCategory.id]: "hidden",
              [element.id]: "hidden",

              [parentElement.id]: "partial",
                [childElement.id]: "visible",
                [childElement2.id]: "hidden",

            [siblingCategory.id]: "hidden",
              [siblingElement.id]: "hidden",
              [defaultSiblingSubCategory.id]: "hidden",
          },
        });
      });
    });

    // TODO: Enable with https://github.com/iTwin/viewer-components-react/issues/1553
    describe.skip("category with modeled elements hierarchy", () => {
      let createIModelResult: Awaited<ReturnType<typeof createIModel>>;
      let visibilityTestData: Awaited<ReturnType<typeof createFilteredVisibilityTestData>>;
      async function createIModel(context: Mocha.Context) {
        return buildIModel(context, async (builder, testSchema) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

          const category = insertSpatialCategory({ builder, codeValue: "category" });
          const defaultSubCategory = { id: getDefaultSubCategoryId(category.id), className: CLASS_NAME_SubCategory };
          const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const modeledElement = insertPhysicalElement({
            builder,
            userLabel: `modeled element`,
            modelId: physicalModel.id,
            categoryId: category.id,
            classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
          });
          const subModel = insertPhysicalSubModel({ builder, modeledElementId: modeledElement.id });
          const subModelCategory = insertSpatialCategory({ builder, codeValue: "subModel category" });
          const subModelElement = insertPhysicalElement({ builder, userLabel: `subModel element`, modelId: subModel.id, categoryId: subModelCategory.id });
          const subModelElement2 = insertPhysicalElement({ builder, userLabel: `subModel element 2`, modelId: subModel.id, categoryId: subModelCategory.id });
          const defaultSubCategoryOfSubModelCategory = { id: getDefaultSubCategoryId(subModelCategory.id), className: CLASS_NAME_SubCategory };

          const siblingCategory = insertSpatialCategory({ builder, codeValue: "sibling category" });
          const siblingElement = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: siblingCategory.id });
          const defaultSiblingSubCategory = { id: getDefaultSubCategoryId(siblingCategory.id), className: CLASS_NAME_SubCategory };

          return {
            category,
            physicalModel,
            defaultSubCategory,
            element,
            modeledElement,
            subModel,
            subModelCategory,
            subModelElement,
            subModelElement2,
            defaultSubCategoryOfSubModelCategory,
            siblingCategory,
            siblingElement,
            defaultSiblingSubCategory,
            searchPaths: [[category, modeledElement, subModel, subModelCategory, subModelElement]],
          };
        });
      }

      before(async function () {
        createIModelResult = await createIModel(this);
      });

      beforeEach(async function () {
        visibilityTestData = await createFilteredVisibilityTestData({
          imodel: createIModelResult.imodel,
          searchPaths: createIModelResult.searchPaths,
          view: "3d",
          visibleByDefault: false,
          subCategoriesOfCategories: [
            { categoryId: createIModelResult.category.id, subCategories: createIModelResult.defaultSubCategory.id },
            { categoryId: createIModelResult.subModelCategory.id, subCategories: createIModelResult.defaultSubCategoryOfSubModelCategory.id },
            { categoryId: createIModelResult.siblingCategory.id, subCategories: createIModelResult.defaultSiblingSubCategory.id },
          ],
        });
      });

      afterEach(() => {
        visibilityTestData[Symbol.dispose]();
      });

      after(async () => {
        await createIModelResult.imodel.close();
      });

      it("showing category changes visibility for related nodes in search paths", async function () {
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const {
          category,
          modeledElement,
          subModel,
          subModelCategory,
          subModelElement,
          siblingCategory,
          siblingElement,
          defaultSiblingSubCategory,
          defaultSubCategoryOfSubModelCategory,
          defaultSubCategory,
          element,
          subModelElement2,
        } = createIModelResult;
        await visibilityHandlerWithSearchPaths.changeVisibility(
          createCategoryHierarchyNode({
            id: category.id,
            search: {
              isSearchTarget: false,
              childrenTargetPaths: [[modeledElement, subModel, subModelCategory, subModelElement]],
            },
          }),
          true,
        );

        await validateCategoriesTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          // prettier-ignore
          expectations: {
            [category.id]: "visible",
              [modeledElement.id]: "visible",
                [`${subModel.id}-${subModelCategory.id}`]: "visible",
                  [subModelElement.id]: "visible",
          },
        });

        await validateCategoriesTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // prettier-ignore
          expectations: {
            [category.id]: "partial",
              [defaultSubCategory.id]: "hidden",
              [element.id]: "hidden",

              [modeledElement.id]: "partial",
                [`${subModel.id}-${subModelCategory.id}`]: "partial",
                  [subModelElement.id]: "visible",
                  [subModelElement2.id]: "hidden",

            [siblingCategory.id]: "hidden",
              [siblingElement.id]: "hidden",
              [defaultSiblingSubCategory.id]: "hidden",

            [subModelCategory.id]: "hidden",
              [defaultSubCategoryOfSubModelCategory.id]: "hidden",
          },
        });
      });

      it("showing modeled element changes visibility for related nodes in search paths", async function () {
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const {
          category,
          modeledElement,
          subModel,
          subModelCategory,
          subModelElement,
          siblingCategory,
          siblingElement,
          defaultSiblingSubCategory,
          defaultSubCategoryOfSubModelCategory,
          defaultSubCategory,
          element,
          subModelElement2,
          physicalModel,
        } = createIModelResult;
        await visibilityHandlerWithSearchPaths.changeVisibility(
          createElementHierarchyNode({
            elementId: modeledElement.id,
            categoryId: category.id,
            parentKeys: [category],
            modelId: physicalModel.id,
            search: {
              isSearchTarget: false,
              childrenTargetPaths: [[subModel, subModelCategory, subModelElement]],
            },
          }),
          true,
        );

        await validateCategoriesTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          // prettier-ignore
          expectations: {
            [category.id]: "visible",
              [modeledElement.id]: "visible",
                [`${subModel.id}-${subModelCategory.id}`]: "visible",
                  [subModelElement.id]: "visible",
          },
        });

        await validateCategoriesTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // prettier-ignore
          expectations: {
            [category.id]: "partial",
              [defaultSubCategory.id]: "hidden",
              [element.id]: "hidden",

              [modeledElement.id]: "partial",
                [`${subModel.id}-${subModelCategory.id}`]: "partial",
                  [subModelElement.id]: "visible",
                  [subModelElement2.id]: "hidden",

            [siblingCategory.id]: "hidden",
              [siblingElement.id]: "hidden",
              [defaultSiblingSubCategory.id]: "hidden",

            [subModelCategory.id]: "hidden",
              [defaultSubCategoryOfSubModelCategory.id]: "hidden",
          },
        });
      });

      it("showing category of subModel changes visibility for related nodes in search paths", async function () {
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const {
          category,
          modeledElement,
          subModel,
          subModelCategory,
          subModelElement,
          siblingCategory,
          siblingElement,
          defaultSiblingSubCategory,
          defaultSubCategoryOfSubModelCategory,
          defaultSubCategory,
          element,
          subModelElement2,
        } = createIModelResult;
        await visibilityHandlerWithSearchPaths.changeVisibility(
          createCategoryHierarchyNode({
            id: subModelCategory.id,
            parentKeys: [category, modeledElement],
            isCategoryOfSubModel: true,
            modelIds: [subModel.id],
            search: {
              isSearchTarget: false,
              childrenTargetPaths: [[subModelElement]],
            },
          }),
          true,
        );

        await validateCategoriesTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          // prettier-ignore
          expectations: {
            [category.id]: "partial",
              [modeledElement.id]: "partial",
                [`${subModel.id}-${subModelCategory.id}`]: "visible",
                  [subModelElement.id]: "visible",
          },
        });

        await validateCategoriesTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // prettier-ignore
          expectations: {
            [category.id]: "partial",
              [defaultSubCategory.id]: "hidden",
              [element.id]: "hidden",

              [modeledElement.id]: "partial",
                [`${subModel.id}-${subModelCategory.id}`]: "partial",
                  [subModelElement.id]: "visible",
                  [subModelElement2.id]: "hidden",

            [siblingCategory.id]: "hidden",
              [siblingElement.id]: "hidden",
              [defaultSiblingSubCategory.id]: "hidden",

            [subModelCategory.id]: "partial",
              [defaultSubCategoryOfSubModelCategory.id]: "hidden",
          },
        });
      });

      it("showing search target subModel element changes visibility for related nodes in search paths", async function () {
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const {
          category,
          modeledElement,
          subModel,
          subModelCategory,
          subModelElement,
          siblingCategory,
          siblingElement,
          defaultSiblingSubCategory,
          defaultSubCategoryOfSubModelCategory,
          defaultSubCategory,
          element,
          subModelElement2,
        } = createIModelResult;
        await visibilityHandlerWithSearchPaths.changeVisibility(
          createElementHierarchyNode({
            elementId: subModelElement.id,
            parentKeys: [category, modeledElement, subModelCategory],
            categoryId: subModelCategory.id,
            modelId: subModel.id,
            search: { isSearchTarget: true },
          }),
          true,
        );

        await validateCategoriesTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          // prettier-ignore
          expectations: {
            [category.id]: "partial",
              [modeledElement.id]: "partial",
                [`${subModel.id}-${subModelCategory.id}`]: "visible",
                  [subModelElement.id]: "visible",
          },
        });

        await validateCategoriesTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // prettier-ignore
          expectations: {
            [category.id]: "partial",
              [defaultSubCategory.id]: "hidden",
              [element.id]: "hidden",

              [modeledElement.id]: "partial",
                [`${subModel.id}-${subModelCategory.id}`]: "partial",
                  [subModelElement.id]: "visible",
                  [subModelElement2.id]: "hidden",

            [siblingCategory.id]: "hidden",
              [siblingElement.id]: "hidden",
              [defaultSiblingSubCategory.id]: "hidden",

            [subModelCategory.id]: "hidden",
              [defaultSubCategoryOfSubModelCategory.id]: "hidden",
          },
        });
      });
    });

    describe("category under definition container hierarchy", () => {
      let createIModelResult: Awaited<ReturnType<typeof createIModel>>;
      let visibilityTestData: Awaited<ReturnType<typeof createFilteredVisibilityTestData>>;
      async function createIModel(context: Mocha.Context) {
        return buildIModel(context, async (builder) => {
          const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
          const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

          const category = insertSpatialCategory({ builder, codeValue: "category", modelId: definitionModel.id });
          const defaultSubCategory = { id: getDefaultSubCategoryId(category.id), className: CLASS_NAME_SubCategory };
          const subCategory = insertSubCategory({
            builder,
            parentCategoryId: category.id,
            codeValue: "subCategory",
            modelId: definitionModel.id,
          });

          const siblingCategory = insertSpatialCategory({ builder, codeValue: "sibling category", modelId: definitionModel.id });
          const defaultSiblingSubCategory = { id: getDefaultSubCategoryId(siblingCategory.id), className: CLASS_NAME_SubCategory };

          return {
            definitionContainer,
            category,
            defaultSubCategory,
            subCategory,
            siblingCategory,
            defaultSiblingSubCategory,
            searchPaths: [[definitionContainer, category, defaultSubCategory]],
          };
        });
      }

      before(async function () {
        createIModelResult = await createIModel(this);
      });

      beforeEach(async function () {
        visibilityTestData = await createFilteredVisibilityTestData({
          imodel: createIModelResult.imodel,
          searchPaths: createIModelResult.searchPaths,
          view: "3d",
          visibleByDefault: false,
          subCategoriesOfCategories: [
            { categoryId: createIModelResult.category.id, subCategories: [createIModelResult.subCategory.id, createIModelResult.defaultSubCategory.id] },
            { categoryId: createIModelResult.siblingCategory.id, subCategories: createIModelResult.defaultSiblingSubCategory.id },
          ],
        });
      });

      afterEach(() => {
        visibilityTestData[Symbol.dispose]();
      });

      after(async () => {
        await createIModelResult.imodel.close();
      });

      it("showing definition container changes visibility for related nodes in search paths", async function () {
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const { definitionContainer, category, siblingCategory, defaultSubCategory, defaultSiblingSubCategory, subCategory } = createIModelResult;
        await visibilityHandlerWithSearchPaths.changeVisibility(
          createDefinitionContainerHierarchyNode({
            id: definitionContainer.id,
            search: {
              isSearchTarget: false,
              childrenTargetPaths: [[category, defaultSubCategory]],
            },
          }),
          true,
        );

        await validateCategoriesTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          // prettier-ignore
          expectations: {
            [definitionContainer.id]: "visible",
              [category.id]: "visible",
                [defaultSubCategory.id]: "visible",
          },
        });

        await validateCategoriesTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // prettier-ignore
          expectations: {
            [definitionContainer.id]: "partial",
              [category.id]: "partial",
                [defaultSubCategory.id]: "visible",
                [subCategory.id]: "hidden",

              [siblingCategory.id]: "hidden",
                [defaultSiblingSubCategory.id]: "hidden",
          },
        });
      });

      it("showing category changes visibility for related nodes in search paths", async function () {
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const { definitionContainer, category, siblingCategory, defaultSubCategory, defaultSiblingSubCategory, subCategory } = createIModelResult;
        await visibilityHandlerWithSearchPaths.changeVisibility(
          createCategoryHierarchyNode({
            id: category.id,
            parentKeys: [definitionContainer],
            search: {
              isSearchTarget: false,
              childrenTargetPaths: [[defaultSubCategory]],
            },
          }),
          true,
        );

        await validateCategoriesTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          // prettier-ignore
          expectations: {
            [definitionContainer.id]: "visible",
              [category.id]: "visible",
                [defaultSubCategory.id]: "visible",
          },
        });

        await validateCategoriesTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // prettier-ignore
          expectations: {
            [definitionContainer.id]: "partial",
              [category.id]: "partial",
                [defaultSubCategory.id]: "visible",
                [subCategory.id]: "hidden",

              [siblingCategory.id]: "hidden",
                [defaultSiblingSubCategory.id]: "hidden",
          },
        });
      });

      it("showing search target sub-category changes visibility for related nodes in search paths", async function () {
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const { definitionContainer, category, siblingCategory, defaultSubCategory, defaultSiblingSubCategory, subCategory } = createIModelResult;
        await visibilityHandlerWithSearchPaths.changeVisibility(
          createSubCategoryHierarchyNode({
            id: defaultSubCategory.id,
            parentKeys: [definitionContainer, category],
            categoryId: category.id,
            search: { isSearchTarget: true },
          }),
          true,
        );

        await validateCategoriesTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          // prettier-ignore
          expectations: {
            [definitionContainer.id]: "visible",
              [category.id]: "visible",
                [defaultSubCategory.id]: "visible",
          },
        });

        await validateCategoriesTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // prettier-ignore
          expectations: {
            [definitionContainer.id]: "partial",
              [category.id]: "partial",
                [defaultSubCategory.id]: "visible",
                [subCategory.id]: "hidden",

              [siblingCategory.id]: "hidden",
                [defaultSiblingSubCategory.id]: "hidden",
          },
        });
      });
    });
  });
});

interface VisibilityInfo {
  id: Id64String;
  visible: boolean;
}

function setupInitialDisplayState(props: {
  viewport: TreeWidgetTestingViewport;
  categories?: Array<VisibilityInfo>;
  subCategories?: Array<VisibilityInfo>;
  models?: Array<VisibilityInfo>;
  elements?: Array<VisibilityInfo>;
}) {
  const { viewport } = props;
  const categories = props.categories ?? [];
  const elements = props.elements ?? [];
  const subCategories = props.subCategories ?? [];
  const models = props.models ?? [];
  for (const subCategoryInfo of subCategories) {
    viewport.changeSubCategoryDisplay({ subCategoryId: subCategoryInfo.id, display: subCategoryInfo.visible });
  }
  for (const categoryInfo of categories) {
    viewport.changeCategoryDisplay({ categoryIds: categoryInfo.id, display: categoryInfo.visible, enableAllSubCategories: false });
  }
  const alwaysDrawn = elements.filter(({ visible }) => visible).map(({ id }) => id);
  if (alwaysDrawn.length > 0) {
    viewport.setAlwaysDrawn({ elementIds: new Set([...alwaysDrawn, ...(viewport.alwaysDrawn ?? [])]) });
  }
  const neverDrawn = elements.filter(({ visible }) => !visible).map(({ id }) => id);
  if (neverDrawn.length > 0) {
    viewport.setNeverDrawn({ elementIds: new Set([...neverDrawn, ...(viewport.neverDrawn ?? [])]) });
  }

  viewport.changeModelDisplay({ modelIds: models.filter(({ visible }) => visible).map(({ id }) => id), display: true });
  viewport.changeModelDisplay({ modelIds: models.filter(({ visible }) => !visible).map(({ id }) => id), display: false });
  viewport.renderFrame();
}

async function validateCategoriesTreeHierarchyVisibility(props: Omit<Props<typeof validateHierarchyVisibility>, "validateNodeVisibility">) {
  return validateHierarchyVisibility({
    ...props,
    validateNodeVisibility,
  });
}
