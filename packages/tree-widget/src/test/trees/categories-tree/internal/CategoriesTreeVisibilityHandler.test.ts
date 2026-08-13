/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { HierarchyCacheMode, initializeCore, insertDefinitionContainer, insertSubCategory, insertSubModel, terminateCore } from "test-utilities";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from "vitest";
import { withEditTxn } from "@itwin/core-backend";
import { IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { CLASS_NAME_DefinitionModel } from "../../../../tree-widget-react/shared/internal/ClassNameDefinitions.js";
import { getClassesByView, mergeWithDefaults } from "../../../../tree-widget-react/shared/internal/Utils.js";
import { CategoriesTreeDefinition, defaultHierarchyConfiguration } from "../../../../tree-widget-react/trees/categories-tree/CategoriesTreeDefinition.js";
import { createCategoriesTreeVisibilityHandler } from "../../../../tree-widget-react/trees/categories-tree/internal/visibility/CategoriesTreeVisibilityHandler.js";
import { buildIModel } from "../../../IModelUtils.js";
import { TestUtils } from "../../../TestUtils.js";
import { createTreeWidgetTestingViewport, getDefaultSubCategoryId } from "../../TreeUtils.js";
import {
  createAccessAndCache,
  createCategoryHierarchyNode,
  createClassGroupingHierarchyNode,
  createDefinitionContainerHierarchyNode,
  createElementHierarchyNode,
  createModelHierarchyNode,
  createSubCategoryHierarchyNode,
  getInsertFunctionByViewType,
  setupInitialDisplayState,
  validateCategoriesTreeHierarchyVisibility,
} from "./Utils.js";

import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { GroupingHierarchyNode, HierarchySearchTree, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";
import type {
  CategoriesTreeHierarchyConfiguration,
  RequiredCategoriesTreeHierarchyConfiguration,
} from "../../../../tree-widget-react/trees/categories-tree/CategoriesTreeDefinition.js";
import type { CategoriesTreeIdsCache } from "../../../../tree-widget-react/trees/categories-tree/internal/CategoriesTreeIdsCache.js";
import type { VisibilityExpectations } from "../../../shared/VisibilityValidation.js";
import type { createIModelAccess, IModelAccess } from "../../Common.js";

describe("CategoriesTreeVisibilityHandler", () => {
  beforeAll(async () => {
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
    await TestUtils.initialize();
    // eslint-disable-next-line @itwin/no-internal
    ECSchemaRpcImpl.register();
  });

  afterAll(async () => {
    await terminateCore();
    TestUtils.terminate();
  });

  ["2d" as const, "3d" as const].forEach((viewType) => {
    const { insertCategory, insertElement, insertElementsModel, insertElementsSubModel, insertModeledElement } = getInsertFunctionByViewType(viewType);
    function createProvider(props: {
      idsCache: CategoriesTreeIdsCache;
      imodelAccess: ReturnType<typeof createIModelAccess>;
      searchPaths?: HierarchySearchTree[];
      hierarchyConfig: RequiredCategoriesTreeHierarchyConfiguration;
    }) {
      return createIModelHierarchyProvider({
        hierarchyDefinition: new CategoriesTreeDefinition({ ...props, viewType }),
        imodelAccess: props.imodelAccess,
        ...(props.searchPaths ? { search: { paths: props.searchPaths } } : undefined),
      });
    }

    async function createVisibilityTestData({
      imodelConnection,
      subCategoriesOfCategories,
      visibleByDefault,
      idsCache,
      imodelAccess,
      ...restProps
    }: {
      imodelConnection: IModelConnection;
      hierarchyConfig?: CategoriesTreeHierarchyConfiguration;
      subCategoriesOfCategories?: Array<{ categoryId: Id64String; subCategories: Id64Arg }>;
      visibleByDefault?: boolean;
      idsCache: CategoriesTreeIdsCache;
      imodelAccess: IModelAccess;
    }) {
      const hierarchyConfig = mergeWithDefaults({
        defaults: defaultHierarchyConfiguration,
        overrides: restProps.hierarchyConfig,
      });
      const viewport = createTreeWidgetTestingViewport({ iModel: imodelConnection, subCategoriesOfCategories, viewType, visibleByDefault });
      const handler = createCategoriesTreeVisibilityHandler({
        viewport,
        idsCache,
        imodelAccess,
        searchPaths: undefined,
        hierarchyConfig,
      });
      const provider = createProvider({ idsCache, imodelAccess, hierarchyConfig });

      return {
        handler,
        provider,
        viewport,
        [Symbol.dispose]() {
          handler[Symbol.dispose]();
          provider[Symbol.dispose]();
        },
      };
    }
    describe(`${viewType} view`, () => {
      let datasets: Awaited<ReturnType<typeof createDatasets>>;

      beforeAll(async () => {
        datasets = await createDatasets(viewType);
      });

      afterAll(async () => {
        await datasets[Symbol.asyncDispose]();
      });

      describe("enabling visibility", () => {
        it("by default everything is hidden", async () => {
          const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;

          using visibilityTestData = await createVisibilityTestData({
            imodelConnection,
            subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
            idsCache,
            imodelAccess,
          });
          const { handler, provider, viewport } = visibilityTestData;

          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: "all-hidden",
          });
        });

        it("category is partial when multiple models contain category and override for one model is set to 'Show'", async () => {
          const { imodelConnection, idsCache, imodelAccess, keys } = datasets.elementsModels;

          using visibilityTestData = await createVisibilityTestData({
            imodelConnection,
            idsCache,
            imodelAccess,
          });
          const { handler, provider, viewport } = visibilityTestData;
          setupInitialDisplayState({
            viewport,
            models: [
              { id: keys.elementsModel1.id, visible: true },
              { id: keys.elementsModel2.id, visible: true },
            ],
          });

          viewport.setPerModelCategoryOverride({
            modelIds: keys.elementsModel1.id,
            categoryIds: keys.categoryA.id,
            override: "show",
          });

          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: {
              [keys.categoryA.id]: "partial",
              [keys.categoryB.id]: "hidden",
            },
          });
        });

        describe("definitionContainers", () => {
          it("showing definition container turns on children", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;

            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
              idsCache,
              imodelAccess,
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainer.id }), true);
            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: "all-visible",
            });
          });

          it("showing definition container doesn't affect non contained definition containers", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.unrelatedDefContainers;

            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              subCategoriesOfCategories: [
                { categoryId: keys.category.id, subCategories: keys.subCategory.id },
                { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
              ],
              idsCache,
              imodelAccess,
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainer.id }), true);
            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              // oxfmt-ignore
              expectations: {
                [keys.definitionContainer.id]: "visible",
                  [keys.category.id]: "visible",
                    [keys.subCategory.id]: "visible",
                    [keys.defaultSubCategoryId]: "visible",

                [keys.definitionContainer2.id]: "hidden",
                  [keys.category2.id]: "hidden",
                    [keys.subCategory2.id]: "hidden",
                    [keys.defaultSubCategoryId2]: "hidden",
              },
            });
          });

          it("showing definition container affects parent", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.siblingCategories;

            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              idsCache,
              imodelAccess,
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.childDefinitionContainer.id }), true);
            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              // oxfmt-ignore
              expectations: {
                [keys.parentDefinitionContainer.id]: "partial",
                  [keys.category.id]: "hidden",

                  [keys.childDefinitionContainer.id]: "visible",
                    [keys.childCategory.id]: "visible",
                    [keys.childCategory2.id]: "visible",
              },
            });
          });
        });

        describe("categories", () => {
          it("showing category of hidden model does not enable other categories", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.elementsModels;
            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              idsCache,
              imodelAccess,
              hierarchyConfig: { elements: { nodes: "include" } },
            });
            const { handler, provider, viewport } = visibilityTestData;

            viewport.changeModelDisplay({ modelIds: keys.elementsModel1.id, display: false });
            viewport.changeModelDisplay({ modelIds: keys.elementsModel2.id, display: true });
            viewport.setPerModelCategoryOverride({ modelIds: keys.elementsModel1.id, categoryIds: keys.categoryA.id, override: "hide" });
            viewport.setPerModelCategoryOverride({ modelIds: keys.elementsModel1.id, categoryIds: keys.categoryB.id, override: "show" });
            viewport.renderFrame();
            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              // oxfmt-ignore
              expectations: {
                [keys.categoryA.id]: "hidden",
                  [keys.elementA1.id]: "hidden",
                  [keys.elementA2.id]: "hidden",

                [keys.categoryB.id]: "hidden",
                  [keys.elementB1.id]: "hidden",
                  [keys.elementB2.id]: "hidden",
              },
            });
            await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.categoryA.id }), true);
            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              // oxfmt-ignore
              expectations: {
                [keys.categoryA.id]: "visible",
                  [keys.elementA1.id]: "visible",
                  [keys.elementA2.id]: "visible",

                [keys.categoryB.id]: "hidden",
                  [keys.elementB1.id]: "hidden", // ElementB1 is still hidden even though categoryB used to have a 'show' override
                  [keys.elementB2.id]: "hidden",
              },
            });
          });

          it("showing category turns on parents and children", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;

            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
              idsCache,
              imodelAccess,
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

          it("showing category doesn't affect unrelated nodes", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.unrelatedDefContainers;

            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              subCategoriesOfCategories: [
                { categoryId: keys.category.id, subCategories: keys.subCategory.id },
                { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
              ],
              idsCache,
              imodelAccess,
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), true);
            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              // oxfmt-ignore
              expectations: {
                [keys.definitionContainer.id]: "visible",
                  [keys.category.id]: "visible",
                    [keys.defaultSubCategoryId]: "visible",
                    [keys.subCategory.id]: "visible",

                [keys.definitionContainer2.id]: "hidden",
                  [keys.category2.id]: "hidden",
                    [keys.defaultSubCategoryId2]: "hidden",
                    [keys.subCategory2.id]: "hidden",
              },
            });
          });

          it("showing category makes parent container partially visible if it has more direct child categories", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.siblingCategories;

            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              idsCache,
              imodelAccess,
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.childCategory.id }), true);
            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              // oxfmt-ignore
              expectations: {
                [keys.parentDefinitionContainer.id]: "partial",
                  [keys.category.id]: "hidden",

                  [keys.childDefinitionContainer.id]: "partial",
                    [keys.childCategory.id]: "visible",
                    [keys.childCategory2.id]: "hidden",
              },
            });
          });

          it("showing category makes parent container partially visible if it has more definition containers", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.siblingCategories;

            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              idsCache,
              imodelAccess,
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), true);
            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              // oxfmt-ignore
              expectations: {
                [keys.parentDefinitionContainer.id]: "partial",
                  [keys.category.id]: "visible",

                  [keys.childDefinitionContainer.id]: "hidden",
                    [keys.childCategory.id]: "hidden",
                    [keys.childCategory2.id]: "hidden",
              },
            });
          });
        });

        describe("subCategories", () => {
          it("showing subCategory of hidden model does not affect other categories", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.unrelatedDefContainers;
            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              subCategoriesOfCategories: [
                { categoryId: keys.category.id, subCategories: keys.subCategory.id },
                { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
              ],
              idsCache,
              imodelAccess,
            });
            const { handler, provider, viewport } = visibilityTestData;

            viewport.changeModelDisplay({ modelIds: keys.elementsModel.id, display: false });
            viewport.changeCategoryDisplay({ categoryIds: keys.category2.id, display: true });
            viewport.renderFrame();
            await handler.changeVisibility(createSubCategoryHierarchyNode({ id: keys.subCategory.id, categoryId: keys.category.id }), true);
            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              // oxfmt-ignore
              expectations: {
                [keys.definitionContainer.id]: "partial",
                  [keys.category.id]: "partial",
                    [keys.defaultSubCategoryId]: "hidden",
                    [keys.subCategory.id]: "visible",

                [keys.definitionContainer2.id]: "hidden",
                  [keys.category2.id]: "hidden",
                    [keys.defaultSubCategoryId2]: "hidden",
                    [keys.subCategory2.id]: "hidden",
              },
            });
          });

          it("showing subCategory doesn't affect sibling subCategories", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;

            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
              idsCache,
              imodelAccess,
            });

            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createSubCategoryHierarchyNode({ id: keys.subCategory.id, categoryId: keys.category.id }), true);

            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              // oxfmt-ignore
              expectations: {
                [keys.definitionContainer.id]: "partial",
                  [keys.category.id]: "partial",
                    [keys.defaultSubCategoryId]: "hidden",
                    [keys.subCategory.id]: "visible",
              },
            });
          });

          it("showing subCategory doesn't affect non related nodes", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.unrelatedDefContainers;

            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              subCategoriesOfCategories: [
                { categoryId: keys.category.id, subCategories: keys.subCategory.id },
                { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
              ],
              idsCache,
              imodelAccess,
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createSubCategoryHierarchyNode({ id: keys.subCategory.id, categoryId: keys.category.id }), true);
            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              // oxfmt-ignore
              expectations: {
                [keys.definitionContainer.id]: "partial",
                  [keys.category.id]: "partial",
                    [keys.defaultSubCategoryId]: "hidden",
                    [keys.subCategory.id]: "visible",

                [keys.definitionContainer2.id]: "hidden",
                  [keys.category2.id]: "hidden",
                    [keys.defaultSubCategoryId2]: "hidden",
                    [keys.subCategory2.id]: "hidden",
              },
            });
          });
        });

        describe("elements set to 'include'", () => {
          describe("definitionContainers", () => {
            it("showing definition container turns on children", async () => {
              const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;

              using visibilityTestData = await createVisibilityTestData({
                imodelConnection,
                subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
                hierarchyConfig: { elements: { nodes: "include" } },
                idsCache,
                imodelAccess,
              });
              const { handler, provider, viewport } = visibilityTestData;

              await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainer.id }), true);
              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                expectations: "all-visible",
              });
            });

            it("showing definition container doesn't affect non contained definition containers", async () => {
              const { imodelConnection, idsCache, imodelAccess, keys } = datasets.unrelatedDefContainers;

              using visibilityTestData = await createVisibilityTestData({
                imodelConnection,
                subCategoriesOfCategories: [
                  { categoryId: keys.category.id, subCategories: keys.subCategory.id },
                  { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
                ],
                idsCache,
                imodelAccess,
                hierarchyConfig: { elements: { nodes: "include" } },
              });
              const { handler, provider, viewport } = visibilityTestData;

              await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainer.id }), true);
              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.definitionContainer.id]: "visible",
                      [keys.category.id]: "visible",
                        [keys.defaultSubCategoryId]: "visible",
                        [keys.subCategory.id]: "visible",
                        [keys.element.id]: "visible",

                  [keys.definitionContainer2.id]: "hidden",
                      [keys.category2.id]: "hidden",
                        [keys.defaultSubCategoryId2]: "hidden",
                        [keys.subCategory2.id]: "hidden",
                        [keys.element2.id]: "hidden",
                },
              });
            });

            it("showing child definition container affects parent", async () => {
              const { imodelConnection, idsCache, imodelAccess, keys } = datasets.siblingCategories;

              using visibilityTestData = await createVisibilityTestData({
                imodelConnection,
                hierarchyConfig: { elements: { nodes: "include" } },
                idsCache,
                imodelAccess,
              });
              const { handler, provider, viewport } = visibilityTestData;

              await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.childDefinitionContainer.id }), true);
              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.parentDefinitionContainer.id]: "partial",
                    [keys.category.id]: "hidden",
                      [keys.element.id]: "hidden",

                    [keys.childDefinitionContainer.id]: "visible",
                      [keys.childCategory.id]: "visible",
                        [keys.childElement.id]: "visible",

                      [keys.childCategory2.id]: "visible",
                        [keys.childElement2.id]: "visible",
                },
              });
            });
          });

          describe("categories", () => {
            it("showing category turns on children", async () => {
              const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;

              using visibilityTestData = await createVisibilityTestData({
                imodelConnection,
                subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
                hierarchyConfig: { elements: { nodes: "include" } },
                idsCache,
                imodelAccess,
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

            it("showing category doesn't affect other categories", async () => {
              const { imodelConnection, idsCache, imodelAccess, keys } = datasets.unrelatedDefContainers;

              using visibilityTestData = await createVisibilityTestData({
                imodelConnection,
                subCategoriesOfCategories: [
                  { categoryId: keys.category.id, subCategories: keys.subCategory.id },
                  { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
                ],
                hierarchyConfig: { elements: { nodes: "include" } },
                idsCache,
                imodelAccess,
              });
              const { handler, provider, viewport } = visibilityTestData;

              await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), true);
              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.definitionContainer.id]: "visible",
                    [keys.category.id]: "visible",
                      [keys.defaultSubCategoryId]: "visible",
                      [keys.element.id]: "visible",
                      [keys.subCategory.id]: "visible",

                  [keys.definitionContainer2.id]: "hidden",
                    [keys.category2.id]: "hidden",
                      [keys.defaultSubCategoryId2]: "hidden",
                      [keys.element2.id]: "hidden",
                      [keys.subCategory2.id]: "hidden",
                },
              });
            });

            it("showing category doesn't affect non related definition container", async () => {
              const { imodelConnection, idsCache, imodelAccess, keys } = datasets.unrelatedDefContainers;

              using visibilityTestData = await createVisibilityTestData({
                imodelConnection,
                subCategoriesOfCategories: [
                  { categoryId: keys.category.id, subCategories: keys.subCategory.id },
                  { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
                ],
                hierarchyConfig: { elements: { nodes: "include" } },
                idsCache,
                imodelAccess,
              });
              const { handler, provider, viewport } = visibilityTestData;

              await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), true);
              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.definitionContainer.id]: "visible",
                    [keys.category.id]: "visible",
                      [keys.defaultSubCategoryId]: "visible",
                      [keys.subCategory.id]: "visible",
                      [keys.element.id]: "visible",

                  [keys.definitionContainer2.id]: "hidden",
                    [keys.category2.id]: "hidden",
                      [keys.defaultSubCategoryId2]: "hidden",
                      [keys.subCategory2.id]: "hidden",
                      [keys.element2.id]: "hidden",
                },
              });
            });

            it("showing category makes parent container partially visible if it has more direct child categories", async () => {
              const { imodelConnection, idsCache, imodelAccess, keys } = datasets.siblingCategories;

              using visibilityTestData = await createVisibilityTestData({
                imodelConnection,
                hierarchyConfig: { elements: { nodes: "include" } },
                idsCache,
                imodelAccess,
              });
              const { handler, provider, viewport } = visibilityTestData;

              await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.childCategory.id }), true);
              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.parentDefinitionContainer.id]: "partial",
                    [keys.category.id]: "hidden",
                      [keys.element.id]: "hidden",

                    [keys.childDefinitionContainer.id]: "partial",
                      [keys.childCategory.id]: "visible",
                        [keys.childElement.id]: "visible",

                      [keys.childCategory2.id]: "hidden",
                        [keys.childElement2.id]: "hidden",
                },
              });
            });

            it("showing category makes parent container partially visible if it has more definition containers", async () => {
              const { imodelConnection, idsCache, imodelAccess, keys } = datasets.siblingCategories;

              using visibilityTestData = await createVisibilityTestData({
                imodelConnection,
                hierarchyConfig: { elements: { nodes: "include" } },
                idsCache,
                imodelAccess,
              });
              const { handler, provider, viewport } = visibilityTestData;

              await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), true);
              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.parentDefinitionContainer.id]: "partial",
                    [keys.category.id]: "visible",
                      [keys.element.id]: "visible",

                    [keys.childDefinitionContainer.id]: "hidden",
                      [keys.childCategory.id]: "hidden",
                        [keys.childElement.id]: "hidden",

                      [keys.childCategory2.id]: "hidden",
                        [keys.childElement2.id]: "hidden",
                },
              });
            });
          });

          describe("subCategories", () => {
            it("showing subCategory doesn't affect category elements", async () => {
              const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;

              using visibilityTestData = await createVisibilityTestData({
                imodelConnection,
                subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
                hierarchyConfig: { elements: { nodes: "include" } },
                idsCache,
                imodelAccess,
              });
              const { handler, provider, viewport } = visibilityTestData;
              setupInitialDisplayState({ viewport, elements: [{ id: keys.element.id, visible: false }] });
              await handler.changeVisibility(createSubCategoryHierarchyNode({ id: keys.subCategory.id, categoryId: keys.category.id }), true);

              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.definitionContainer.id]: "partial",
                    [keys.category.id]: "partial",
                      [keys.defaultSubCategoryId]: "hidden",
                      [keys.subCategory.id]: "visible",
                      [keys.element.id]: "hidden",
                },
              });
            });

            it("showing subCategory doesn't affect non related elements", async () => {
              const { imodelConnection, idsCache, imodelAccess, keys } = datasets.unrelatedDefContainers;

              using visibilityTestData = await createVisibilityTestData({
                imodelConnection,
                subCategoriesOfCategories: [
                  { categoryId: keys.category.id, subCategories: keys.subCategory.id },
                  { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
                ],
                hierarchyConfig: { elements: { nodes: "include" } },
                idsCache,
                imodelAccess,
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
                // oxfmt-ignore
                expectations: {
                  [keys.definitionContainer.id]: "partial",
                    [keys.category.id]: "partial",
                      [keys.defaultSubCategoryId]: "hidden",
                      [keys.subCategory.id]: "visible",
                      [keys.element.id]: "hidden",

                  [keys.definitionContainer2.id]: "hidden",
                    [keys.category2.id]: "hidden",
                      [keys.defaultSubCategoryId2]: "hidden",
                      [keys.subCategory2.id]: "hidden",
                      [keys.element2.id]: "hidden",
                },
              });
            });
          });

          describe("elements", () => {
            it("showing element doesn't affect sibling subCategories or elements", async () => {
              await using buildIModelResult = await buildIModel(async (imodel) =>
                withEditTxn(imodel, (txn) => {
                  const elementsModel = insertElementsModel({ txn, codeValue: "m" });

                  const category = insertCategory({ txn, codeValue: "cat" });
                  const element = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
                  const element2 = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
                  const subCategory = insertSubCategory({
                    txn,
                    parentCategoryId: category.id,
                    codeValue: "subCat",
                  });
                  const subCategory2 = insertSubCategory({
                    txn,
                    parentCategoryId: category.id,
                    codeValue: "subCat2",
                  });
                  return { category, subCategory, subCategory2, element, element2, elementsModel };
                }),
              );

              const { imodelConnection, ...keys } = buildIModelResult;
              const accessAndCache = createAccessAndCache({ imodelConnection, viewType });
              using visibilityTestData = await createVisibilityTestData({
                imodelConnection,
                subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: [keys.subCategory.id, keys.subCategory2.id] }],
                hierarchyConfig: { elements: { nodes: "include" } },
                ...accessAndCache,
              });
              const { handler, provider, viewport } = visibilityTestData;

              await handler.changeVisibility(
                createElementHierarchyNode({ modelId: keys.elementsModel.id, categoryId: keys.category.id, elementId: keys.element.id }),
                true,
              );

              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.category.id]: "partial",
                    [getDefaultSubCategoryId(keys.category.id)]: "hidden",
                    [keys.subCategory.id]: "hidden",
                    [keys.subCategory2.id]: "hidden",
                    [keys.element.id]: "visible",
                    [keys.element2.id]: "hidden",
                },
              });
            });

            it("showing element doesn't affect not related categories or subCategories", async () => {
              const { imodelConnection, idsCache, imodelAccess, keys } = datasets.unrelatedDefContainers;

              using visibilityTestData = await createVisibilityTestData({
                imodelConnection,
                subCategoriesOfCategories: [
                  { categoryId: keys.category.id, subCategories: keys.subCategory.id },
                  { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
                ],
                hierarchyConfig: { elements: { nodes: "include" } },
                idsCache,
                imodelAccess,
              });
              const { handler, provider, viewport } = visibilityTestData;

              await handler.changeVisibility(
                createElementHierarchyNode({ modelId: keys.elementsModel.id, categoryId: keys.category.id, elementId: keys.element.id }),
                true,
              );
              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.definitionContainer.id]: "partial",
                    [keys.category.id]: "partial",
                      [keys.defaultSubCategoryId]: "hidden",
                      [keys.subCategory.id]: "hidden",
                      [keys.element.id]: "visible",

                  [keys.definitionContainer2.id]: "hidden",
                    [keys.category2.id]: "hidden",
                      [keys.defaultSubCategoryId2]: "hidden",
                      [keys.subCategory2.id]: "hidden",
                      [keys.element2.id]: "hidden",
                },
              });
            });

            it("showing element turns on category and its parents", async () => {
              const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;

              using visibilityTestData = await createVisibilityTestData({
                imodelConnection,
                subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
                hierarchyConfig: { elements: { nodes: "include" } },
                idsCache,
                imodelAccess,
              });
              const { handler, provider, viewport } = visibilityTestData;

              await handler.changeVisibility(
                createElementHierarchyNode({ modelId: keys.elementsModel.id, categoryId: keys.category.id, elementId: keys.element.id }),
                true,
              );
              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.definitionContainer.id]: "partial",
                    [keys.category.id]: "partial",
                      [keys.defaultSubCategoryId]: "hidden",
                      [keys.subCategory.id]: "hidden",
                      [keys.element.id]: "visible",
                },
              });
            });
          });

          describe("intermediate categories", () => {
            let visibilityTestData: Awaited<ReturnType<typeof createVisibilityTestData>>;

            beforeEach(async () => {
              const { imodelConnection, idsCache, imodelAccess } = datasets.intermediateCategories;
              visibilityTestData = await createVisibilityTestData({
                imodelConnection,
                hierarchyConfig: { elements: { nodes: "include" } },
                idsCache,
                imodelAccess,
              });
            });

            afterEach(() => {
              visibilityTestData[Symbol.dispose]();
            });

            it("showing intermediate category makes its elements visible and parent element partially visible", async () => {
              const { handler, provider, viewport } = visibilityTestData;
              const { keys } = datasets.intermediateCategories;

              await handler.changeVisibility(
                createCategoryHierarchyNode({
                  id: keys.categoryB.id,
                  modelIds: [keys.elementsModel.id],
                  hasChildren: true,
                  parentElementsPath: [{ elementIds: [keys.parentElement.id], categoryIds: keys.categoryA.id }],
                }),
                true,
              );

              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.categoryA.id]: "partial",
                    [keys.parentElement.id]: "partial",
                      [`${keys.parentElement.id}-${keys.categoryB.id}`]: "visible",
                        [keys.childElement.id]: "visible",

                  [keys.categoryB.id]: "hidden",
                },
              });
            });

            it("showing child element under intermediate category makes it visible and parents partially visible", async () => {
              const { handler, provider, viewport } = visibilityTestData;
              const { keys } = datasets.intermediateCategories;

              await handler.changeVisibility(
                createElementHierarchyNode({
                  modelId: keys.elementsModel.id,
                  categoryId: keys.categoryB.id,
                  elementId: keys.childElement.id,
                  parentElementsPath: [{ elementIds: [keys.parentElement.id], categoryIds: keys.categoryA.id }],
                }),
                true,
              );

              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.categoryA.id]: "partial",
                    [keys.parentElement.id]: "partial",
                      [`${keys.parentElement.id}-${keys.categoryB.id}`]: "visible",
                        [keys.childElement.id]: "visible",

                  [keys.categoryB.id]: "hidden",
                },
              });
            });

            it("showing parent element makes children under intermediate category visible", async () => {
              const { handler, provider, viewport } = visibilityTestData;
              const { keys } = datasets.intermediateCategories;

              await handler.changeVisibility(
                createElementHierarchyNode({
                  modelId: keys.elementsModel.id,
                  categoryId: keys.categoryA.id,
                  elementId: keys.parentElement.id,
                  hasChildren: true,
                }),
                true,
              );

              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.categoryA.id]: "partial",
                    // Category has a sub-category which is hidden
                    [keys.parentElement.id]: "visible",
                      [`${keys.parentElement.id}-${keys.categoryB.id}`]: "visible",
                        [keys.childElement.id]: "visible",

                  [keys.categoryB.id]: "hidden",
                },
              });
            });
          });

          describe("intermediate categories under sub-model", () => {
            let visibilityTestData: Awaited<ReturnType<typeof createVisibilityTestData>>;

            beforeEach(async () => {
              const { imodelConnection, idsCache, imodelAccess } = datasets.subModelIntermediateCategories;
              visibilityTestData = await createVisibilityTestData({
                imodelConnection,
                hierarchyConfig: { elements: { nodes: "include" } },
                idsCache,
                imodelAccess,
              });
            });

            afterEach(() => {
              visibilityTestData[Symbol.dispose]();
            });

            it("showing intermediate category under sub-model makes its elements visible and modeled element partially visible", async () => {
              const { handler, provider, viewport } = visibilityTestData;
              const { keys } = datasets.subModelIntermediateCategories;

              await handler.changeVisibility(
                createCategoryHierarchyNode({
                  id: keys.categoryB.id,
                  modelIds: [keys.modeledElement.id],
                  hasChildren: true,
                }),
                true,
              );

              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.categoryA.id]: "partial",
                    [keys.modeledElement.id]: "partial",
                      [`${keys.modeledElement.id}-${keys.categoryB.id}`]: "visible",
                        [keys.subModelElement.id]: "visible",

                  [keys.categoryB.id]: "hidden",
                },
              });
            });

            it("showing element under intermediate category in sub-model makes it visible and parents partially visible", async () => {
              const { handler, provider, viewport } = visibilityTestData;
              const { keys } = datasets.subModelIntermediateCategories;

              await handler.changeVisibility(
                createElementHierarchyNode({
                  modelId: keys.modeledElement.id,
                  categoryId: keys.categoryB.id,
                  elementId: keys.subModelElement.id,
                }),
                true,
              );

              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.categoryA.id]: "partial",
                    [keys.modeledElement.id]: "partial",
                      [`${keys.modeledElement.id}-${keys.categoryB.id}`]: "visible",
                        [keys.subModelElement.id]: "visible",

                  [keys.categoryB.id]: "hidden",
                },
              });
            });

            it("showing modeled element makes sub-model elements under intermediate category visible", async () => {
              const { handler, provider, viewport } = visibilityTestData;
              const { keys } = datasets.subModelIntermediateCategories;

              await handler.changeVisibility(
                createElementHierarchyNode({
                  modelId: keys.elementsModel.id,
                  categoryId: keys.categoryA.id,
                  elementId: keys.modeledElement.id,
                  hasChildren: true,
                }),
                true,
              );

              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.categoryA.id]: "partial",
                    // Category has a sub-category which is hidden
                    [keys.modeledElement.id]: "visible",
                      [`${keys.modeledElement.id}-${keys.categoryB.id}`]: "visible",
                        [keys.subModelElement.id]: "visible",

                  [keys.categoryB.id]: "hidden",
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
            createIModel: () => Promise<{ imodelConnection: IModelConnection } & IModelWithSubModelIds>;
            cases: Array<{
              only?: boolean;
              name: string;
              getTargetNode: (ids: IModelWithSubModelIds) => NonGroupingHierarchyNode | GroupingHierarchyNode;
              expectations: (ids: IModelWithSubModelIds) => "all-visible" | "all-hidden" | VisibilityExpectations;
            }>;
          }> = [
            {
              describeName: "with modeled elements",
              createIModel: async function createIModel(): Promise<{ imodelConnection: IModelConnection } & IModelWithSubModelIds> {
                return buildIModel(async (imodel) =>
                  withEditTxn(imodel, (txn) => {
                    const model = insertElementsModel({ txn, codeValue: "m" });
                    const category = insertCategory({ txn, codeValue: "cat" });
                    const modeledElement = insertModeledElement({
                      txn,
                      userLabel: `el`,
                      modelId: model.id,
                      categoryId: category.id,
                    });
                    const subModel = insertElementsSubModel({ txn, modeledElementId: modeledElement.id });
                    const subModelCategory = insertCategory({ txn, codeValue: "cat2" });
                    const subModelElement = insertElement({ txn, userLabel: `el2`, modelId: subModel.id, categoryId: subModelCategory.id });
                    return {
                      modeledElement,
                      model,
                      category,
                      subModelCategory,
                      subModelElement,
                      subModel,
                    };
                  }),
                );
              },
              cases: [
                {
                  name: "modeled element's children display is turned on when its category display is turned on",
                  getTargetNode: (ids: IModelWithSubModelIds) => createCategoryHierarchyNode({ id: ids.category.id, hasChildren: true }),
                  // oxfmt-ignore
                  expectations: (ids) => ({
                    [ids.category.id]: "visible",
                      [ids.modeledElement.id]: "visible",
                        [`${ids.modeledElement.id}-${ids.subModelCategory!.id}`]: "visible",
                          [ids.subModelElement!.id]: "visible",

                    [ids.subModelCategory!.id]: "hidden",
                  }),
                },
                {
                  name: "modeled element's children display is turned on when its class grouping node display is turned on",
                  getTargetNode: (ids: IModelWithSubModelIds) =>
                    createClassGroupingHierarchyNode({
                      categoryId: ids.category.id,
                      modelElementsMap: new Map([[ids.model.id, { elementIds: new Set([ids.modeledElement.id]) }]]),
                    }),
                  // oxfmt-ignore
                  expectations: (ids: IModelWithSubModelIds) => ({
                    [ids.subModelCategory!.id]: "hidden",

                    [ids.category.id]: "partial",
                      [ids.modeledElement.id]: "visible",
                        [`${ids.modeledElement.id}-${ids.subModelCategory!.id}`]: "visible",
                          [ids.subModelElement!.id]: "visible",
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
                  // oxfmt-ignore
                  expectations: (ids: IModelWithSubModelIds) => ({
                    [ids.subModelCategory!.id]: "hidden",

                    [ids.category.id]: "partial",
                      [ids.modeledElement.id]: "visible",
                        [`${ids.modeledElement.id}-${ids.subModelCategory!.id}`]: "visible",
                          [ids.subModelElement!.id]: "visible",
                  }),
                },
                {
                  name: "modeled element's children display is turned on when its sub-model display is turned on",
                  getTargetNode: (ids: IModelWithSubModelIds) => createModelHierarchyNode({ id: ids.modeledElement.id, hasChildren: true }),
                  // oxfmt-ignore
                  expectations: (ids: IModelWithSubModelIds) => ({
                    [ids.subModelCategory!.id]: "hidden",

                    [ids.category.id]: "partial",
                      [ids.modeledElement.id]: "partial",
                        [`${ids.modeledElement.id}-${ids.subModelCategory!.id}`]: "visible",
                          [ids.subModelElement!.id]: "visible",
                  }),
                },
                {
                  name: "modeled element, its model and category have partial visibility when its sub-model element's category display is turned on",
                  getTargetNode: (ids: IModelWithSubModelIds) =>
                    createCategoryHierarchyNode({ id: ids.subModelCategory!.id, modelIds: [ids.modeledElement.id] }),
                  // oxfmt-ignore
                  expectations: (ids: IModelWithSubModelIds) => ({
                    [ids.subModelCategory!.id]: "hidden",

                    [ids.category.id]: "partial",
                      [ids.modeledElement.id]: "partial",
                        [`${ids.modeledElement.id}-${ids.subModelCategory!.id}`]: "visible",
                          [ids.subModelElement!.id]: "visible",
                  }),
                },
                {
                  name: "modeled element, its model and category have partial visibility when its sub-model element's display is turned on",
                  getTargetNode: (ids: IModelWithSubModelIds) =>
                    createElementHierarchyNode({
                      modelId: ids.modeledElement.id,
                      categoryId: ids.subModelCategory!.id,
                      elementId: ids.subModelElement!.id,
                    }),
                  // oxfmt-ignore
                  expectations: (ids: IModelWithSubModelIds) => ({
                    [ids.subModelCategory!.id]: "hidden",

                    [ids.category.id]: "partial",
                      [ids.modeledElement.id]: "partial",
                        [`${ids.modeledElement.id}-${ids.subModelCategory!.id}`]: "visible",
                          [ids.subModelElement!.id]: "visible",
                  }),
                },
              ],
            },
            {
              describeName: "with modeled elements that have private subModel",
              createIModel: async function createIModel(): Promise<{ imodelConnection: IModelConnection } & IModelWithSubModelIds> {
                return buildIModel(async (imodel) =>
                  withEditTxn(imodel, (txn) => {
                    const model = insertElementsModel({ txn, codeValue: "model" });
                    const category = insertCategory({ txn, codeValue: "cat" });
                    const modeledElement = insertModeledElement({
                      txn,
                      userLabel: `el`,
                      modelId: model.id,
                      categoryId: category.id,
                    });
                    const subModel = insertElementsSubModel({ txn, modeledElementId: modeledElement.id, isPrivate: true });
                    const subModelCategory = insertCategory({ txn, codeValue: "category2" });
                    const subModelElement = insertElement({ txn, userLabel: `element2`, modelId: subModel.id, categoryId: subModelCategory.id });
                    return {
                      modeledElement,
                      model,
                      category,
                      subModelCategory,
                      subModelElement,
                      subModel,
                    };
                  }),
                );
              },
              cases: [
                {
                  name: "children are visible when category display is turned on",
                  getTargetNode: (ids: IModelWithSubModelIds) => createCategoryHierarchyNode({ id: ids.category.id, hasChildren: true }),
                  // oxfmt-ignore
                  expectations: (ids: IModelWithSubModelIds) => ({
                    [ids.category.id]: "visible",
                      [ids.modeledElement.id]: "visible",
                  }),
                },
                {
                  name: "child elements are visible when elements class grouping node display is turned on",
                  getTargetNode: (ids: IModelWithSubModelIds) =>
                    createClassGroupingHierarchyNode({
                      categoryId: ids.category.id,
                      modelElementsMap: new Map([[ids.model.id, { elementIds: new Set([ids.modeledElement.id]) }]]),
                    }),
                  // oxfmt-ignore
                  expectations: (ids: IModelWithSubModelIds) => ({
                    [ids.category.id]: "partial",
                      // Category has hidden sub-category
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
                  //oxfmt-ignore
                  expectations: (ids: IModelWithSubModelIds) => ({
                    [ids.category.id]: "partial",
                      // Category has hidden sub-category
                      [ids.modeledElement.id]: "visible",
                  }),
                },
              ],
            },
            {
              describeName: "with modeled elements that have subModel with no children",
              createIModel: async function createIModel(): Promise<{ imodelConnection: IModelConnection } & IModelWithSubModelIds> {
                return buildIModel(async (imodel) =>
                  withEditTxn(imodel, (txn) => {
                    const model = insertElementsModel({ txn, codeValue: "m" });
                    const category = insertCategory({ txn, codeValue: "cat" });
                    const modeledElement = insertModeledElement({
                      txn,
                      userLabel: `el`,
                      modelId: model.id,
                      categoryId: category.id,
                    });
                    const subModel = insertElementsSubModel({ txn, modeledElementId: modeledElement.id });
                    return {
                      modeledElement,
                      model,
                      category,
                      subModel,
                    };
                  }),
                );
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
                    createClassGroupingHierarchyNode({
                      categoryId: ids.category.id,
                      modelElementsMap: new Map([[ids.model.id, { elementIds: new Set([ids.modeledElement.id]) }]]),
                    }),
                  // Category has partial visibility, since its sub-category is not visible
                  // oxfmt-ignore
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
                  // oxfmt-ignore
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
              let accessAndCache: ReturnType<typeof createAccessAndCache>;
              let createdIds: IModelWithSubModelIds;

              beforeAll(async () => {
                const { imodelConnection, ...ids } = await createIModel();
                iModel = imodelConnection;
                accessAndCache = createAccessAndCache({ imodelConnection: iModel, viewType });
                createdIds = ids;
              });

              afterAll(async () => {
                await iModel.close();
              });

              cases.forEach(({ name, getTargetNode, expectations, only }) => {
                (only ? it.only : it)(name, async function () {
                  using visibilityTestData = await createVisibilityTestData({
                    imodelConnection: iModel,
                    hierarchyConfig: { elements: { nodes: "include" } },
                    ...accessAndCache,
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

        describe("enabling category visibility through model selector", () => {
          it("category is visible when only one model contains category and model is enabled through model selector", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;

            using visibilityTestData = await createVisibilityTestData({ imodelConnection, idsCache, imodelAccess });
            const { handler, provider, viewport } = visibilityTestData;
            setupInitialDisplayState({ viewport, categories: [{ id: keys.category.id, visible: true }] });

            viewport.changeModelDisplay({ modelIds: keys.elementsModel.id, display: true });

            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: "all-visible",
            });
          });

          it("category is partial when multiple models contain category and one model is enabled through model selector", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.elementsModels;
            using visibilityTestData = await createVisibilityTestData({ imodelConnection, idsCache, imodelAccess });
            const { handler, provider, viewport } = visibilityTestData;
            setupInitialDisplayState({ viewport, categories: [{ id: keys.categoryA.id, visible: true }] });

            viewport.changeModelDisplay({ modelIds: keys.elementsModel1.id, display: true });

            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: {
                [keys.categoryA.id]: "partial",
                [keys.categoryB.id]: "hidden",
              },
            });
          });
        });
      });

      describe("disabling visibility", () => {
        it("by default everything is visible", async () => {
          const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;
          using visibilityTestData = await createVisibilityTestData({
            imodelConnection,
            subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
            visibleByDefault: true,
            idsCache,
            imodelAccess,
          });
          const { handler, provider, viewport } = visibilityTestData;

          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: "all-visible",
          });
        });

        it("category is partial when multiple models contain category and override for one model is set to 'Hide'", async () => {
          const { imodelConnection, idsCache, imodelAccess, keys } = datasets.elementsModels;
          using visibilityTestData = await createVisibilityTestData({ imodelConnection, visibleByDefault: true, idsCache, imodelAccess });
          const { handler, provider, viewport } = visibilityTestData;

          viewport.setPerModelCategoryOverride({
            modelIds: keys.elementsModel1.id,
            categoryIds: keys.categoryA.id,
            override: "hide",
          });

          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: {
              [keys.categoryA.id]: "partial",
              [keys.categoryB.id]: "visible",
            },
          });
        });

        it("category is partial when multiple models contain category and one model is disabled through model selector", async () => {
          const { imodelConnection, idsCache, imodelAccess, keys } = datasets.elementsModels;
          using visibilityTestData = await createVisibilityTestData({ imodelConnection, visibleByDefault: true, idsCache, imodelAccess });
          const { handler, provider, viewport } = visibilityTestData;

          viewport.changeModelDisplay({ modelIds: keys.elementsModel1.id, display: false });

          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: {
              [keys.categoryA.id]: "partial",
              [keys.categoryB.id]: "partial",
            },
          });
        });

        describe("definitionContainers", () => {
          it("hiding definition container hides children", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;
            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
              visibleByDefault: true,
              idsCache,
              imodelAccess,
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainer.id }), false);
            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: "all-hidden",
            });
          });

          it("hiding definition container doesn't affect non contained definition containers", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.unrelatedDefContainers;
            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              subCategoriesOfCategories: [
                { categoryId: keys.category.id, subCategories: keys.subCategory.id },
                { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
              ],
              visibleByDefault: true,
              idsCache,
              imodelAccess,
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.definitionContainer.id }), false);
            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              // oxfmt-ignore
              expectations: {
                [keys.definitionContainer.id]: "hidden",
                  [keys.category.id]: "hidden",
                    [keys.subCategory.id]: "hidden",
                    [keys.defaultSubCategoryId]: "hidden",

                [keys.definitionContainer2.id]: "visible",
                  [keys.category2.id]: "visible",
                    [keys.subCategory2.id]: "visible",
                    [keys.defaultSubCategoryId2]: "visible",
              },
            });
          });

          it("hiding definition affects parent", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.siblingCategories;
            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              visibleByDefault: true,
              idsCache,
              imodelAccess,
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createDefinitionContainerHierarchyNode({ id: keys.childDefinitionContainer.id }), false);
            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              // oxfmt-ignore

              expectations: {
                [keys.parentDefinitionContainer.id]: "partial",
                  [keys.category.id]: "visible",

                  [keys.childDefinitionContainer.id]: "hidden",
                    [keys.childCategory.id]: "hidden",
                    [keys.childCategory2.id]: "hidden",
              },
            });
          });
        });

        describe("categories", () => {
          it("hiding category hides children", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;
            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
              visibleByDefault: true,
              idsCache,
              imodelAccess,
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

          it("hiding category doesn't affect non related nodes", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.unrelatedDefContainers;
            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              subCategoriesOfCategories: [
                { categoryId: keys.category.id, subCategories: keys.subCategory.id },
                { categoryId: keys.category2.id, subCategories: keys.subCategory2.id },
              ],
              visibleByDefault: true,
              idsCache,
              imodelAccess,
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), false);
            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              // oxfmt-ignore
              expectations: {
                [keys.definitionContainer.id]: "hidden",
                  [keys.category.id]: "hidden",
                    [keys.subCategory.id]: "hidden",
                    [keys.defaultSubCategoryId]: "hidden",

                [keys.definitionContainer2.id]: "visible",
                  [keys.category2.id]: "visible",
                    [keys.subCategory2.id]: "visible",
                    [keys.defaultSubCategoryId2]: "visible",
              },
            });
          });

          it("hiding category makes parent container partially visible if it has more direct child categories", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.siblingCategories;
            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              visibleByDefault: true,
              idsCache,
              imodelAccess,
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.childCategory.id }), false);
            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              // oxfmt-ignore
              expectations: {
                [keys.parentDefinitionContainer.id]: "partial",
                  [keys.category.id]: "visible",

                  [keys.childDefinitionContainer.id]: "partial",
                    [keys.childCategory.id]: "hidden",
                    [keys.childCategory2.id]: "visible",
              },
            });
          });

          it("hiding category makes parent container partially visible if it has more definition containers", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.siblingCategories;
            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              visibleByDefault: true,
              idsCache,
              imodelAccess,
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createCategoryHierarchyNode({ id: keys.category.id }), false);
            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              // oxfmt-ignore

              expectations: {
                [keys.parentDefinitionContainer.id]: "partial",
                  [keys.category.id]: "hidden",

                  [keys.childDefinitionContainer.id]: "visible",
                    [keys.childCategory.id]: "visible",
                    [keys.childCategory2.id]: "visible",
              },
            });
          });
        });

        describe("subCategories", () => {
          it("hiding subCategory affects parents and doesn't affect other subCategories", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;
            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
              visibleByDefault: true,
              idsCache,
              imodelAccess,
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createSubCategoryHierarchyNode({ id: keys.subCategory.id, categoryId: keys.category.id }), false);
            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              // oxfmt-ignore
              expectations: {
                [keys.definitionContainer.id]: "partial",
                  [keys.category.id]: "partial",
                    [getDefaultSubCategoryId(keys.category.id)]: "visible",
                    [keys.subCategory.id]: "hidden",
              },
            });
          });

          it("hiding subCategory doesn't affect not related nodes", async () => {
            const { imodelConnection, idsCache, imodelAccess, keys } = datasets.unrelatedDefContainers;
            using visibilityTestData = await createVisibilityTestData({
              imodelConnection,
              subCategoriesOfCategories: [{ categoryId: keys.category.id, subCategories: keys.subCategory.id }],
              visibleByDefault: true,
              idsCache,
              imodelAccess,
            });
            const { handler, provider, viewport } = visibilityTestData;

            await handler.changeVisibility(createSubCategoryHierarchyNode({ id: keys.subCategory.id, categoryId: keys.category.id }), false);
            await validateCategoriesTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              // oxfmt-ignore
              expectations: {
                [keys.definitionContainer.id]: "partial",
                  [keys.category.id]: "partial",
                    [keys.subCategory.id]: "hidden",
                    [keys.defaultSubCategoryId]: "visible",

                [keys.definitionContainer2.id]: "visible",
                  [keys.category2.id]: "visible",
                    [keys.subCategory2.id]: "visible",
                    [keys.defaultSubCategoryId2]: "visible",
              },
            });
          });
        });

        describe("elements set to 'include'", () => {
          describe("intermediate categories", () => {
            let visibilityTestData: Awaited<ReturnType<typeof createVisibilityTestData>>;

            beforeEach(async () => {
              const { imodelConnection, idsCache, imodelAccess } = datasets.intermediateCategories;
              visibilityTestData = await createVisibilityTestData({
                imodelConnection,
                hierarchyConfig: { elements: { nodes: "include" } },
                visibleByDefault: true,
                idsCache,
                imodelAccess,
              });
            });

            afterEach(() => {
              visibilityTestData[Symbol.dispose]();
            });

            it("hiding intermediate category makes its elements hidden", async () => {
              const { handler, provider, viewport } = visibilityTestData;
              const { keys } = datasets.intermediateCategories;

              await handler.changeVisibility(
                createCategoryHierarchyNode({
                  id: keys.categoryB.id,
                  modelIds: [keys.elementsModel.id],
                  hasChildren: true,
                  parentElementsPath: [{ elementIds: [keys.parentElement.id], categoryIds: keys.categoryA.id }],
                }),
                false,
              );

              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.categoryA.id]: "partial",
                    [keys.parentElement.id]: "partial",
                      [`${keys.parentElement.id}-${keys.categoryB.id}`]: "hidden",
                        [keys.childElement.id]: "hidden",

                  [keys.categoryB.id]: "visible",
                },
              });
            });

            it("hiding child element under intermediate category makes it hidden and parents partially visible", async () => {
              const { handler, provider, viewport } = visibilityTestData;
              const { keys } = datasets.intermediateCategories;

              await handler.changeVisibility(
                createElementHierarchyNode({
                  modelId: keys.elementsModel.id,
                  categoryId: keys.categoryB.id,
                  elementId: keys.childElement.id,
                  parentElementsPath: [{ elementIds: [keys.parentElement.id], categoryIds: keys.categoryA.id }],
                }),
                false,
              );

              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.categoryA.id]: "partial",
                    [keys.parentElement.id]: "partial",
                      [`${keys.parentElement.id}-${keys.categoryB.id}`]: "hidden",
                        [keys.childElement.id]: "hidden",

                  [keys.categoryB.id]: "visible",
                },
              });
            });

            it("hiding parent element makes children under intermediate category hidden", async () => {
              const { handler, provider, viewport } = visibilityTestData;
              const { keys } = datasets.intermediateCategories;

              await handler.changeVisibility(
                createElementHierarchyNode({
                  modelId: keys.elementsModel.id,
                  categoryId: keys.categoryA.id,
                  elementId: keys.parentElement.id,
                  hasChildren: true,
                }),
                false,
              );

              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.categoryA.id]: "partial",
                    // Category has a sub-category which is visible
                    [keys.parentElement.id]: "hidden",
                      [`${keys.parentElement.id}-${keys.categoryB.id}`]: "hidden",
                        [keys.childElement.id]: "hidden",

                  [keys.categoryB.id]: "visible",
                },
              });
            });
          });

          describe("intermediate categories under sub-model", () => {
            let visibilityTestData: Awaited<ReturnType<typeof createVisibilityTestData>>;

            beforeEach(async () => {
              const { imodelConnection, idsCache, imodelAccess } = datasets.subModelIntermediateCategories;
              visibilityTestData = await createVisibilityTestData({
                imodelConnection,
                hierarchyConfig: { elements: { nodes: "include" } },
                visibleByDefault: true,
                idsCache,
                imodelAccess,
              });
            });

            afterEach(() => {
              visibilityTestData[Symbol.dispose]();
            });

            it("hiding intermediate category under sub-model makes its elements hidden", async () => {
              const { handler, provider, viewport } = visibilityTestData;
              const { keys } = datasets.subModelIntermediateCategories;

              await handler.changeVisibility(
                createCategoryHierarchyNode({
                  id: keys.categoryB.id,
                  modelIds: [keys.modeledElement.id],
                  hasChildren: true,
                }),
                false,
              );

              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.categoryA.id]: "partial",
                    [keys.modeledElement.id]: "partial",
                      [`${keys.modeledElement.id}-${keys.categoryB.id}`]: "hidden",
                        [keys.subModelElement.id]: "hidden",

                  [keys.categoryB.id]: "visible",
                },
              });
            });

            it("hiding element under intermediate category in sub-model makes it hidden and parents partially visible", async () => {
              const { handler, provider, viewport } = visibilityTestData;
              const { keys } = datasets.subModelIntermediateCategories;

              await handler.changeVisibility(
                createElementHierarchyNode({
                  modelId: keys.modeledElement.id,
                  categoryId: keys.categoryB.id,
                  elementId: keys.subModelElement.id,
                }),
                false,
              );

              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  [keys.categoryA.id]: "partial",
                    [keys.modeledElement.id]: "partial",
                      [`${keys.modeledElement.id}-${keys.categoryB.id}`]: "hidden",
                        [keys.subModelElement.id]: "hidden",

                  [keys.categoryB.id]: "visible",
                },
              });
            });

            it("hiding modeled element makes sub-model elements under intermediate category hidden", async () => {
              const { handler, provider, viewport } = visibilityTestData;
              const { keys } = datasets.subModelIntermediateCategories;

              await handler.changeVisibility(
                createElementHierarchyNode({
                  modelId: keys.elementsModel.id,
                  categoryId: keys.categoryA.id,
                  elementId: keys.modeledElement.id,
                  hasChildren: true,
                }),
                false,
              );

              await validateCategoriesTreeHierarchyVisibility({
                provider,
                handler,
                viewport,
                // oxfmt-ignore
                expectations: {
                  // Category has a sub-category which is visible
                  [keys.categoryA.id]: "partial",
                    [keys.modeledElement.id]: "hidden",
                      [`${keys.modeledElement.id}-${keys.categoryB.id}`]: "hidden",
                        [keys.subModelElement.id]: "hidden",

                  [keys.categoryB.id]: "visible",
                },
              });
            });
          });
        });
      });

      describe("elements.excludedClasses", () => {
        it("element of an excluded class participates in visibility", async () => {
          const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;

          using visibilityTestData = await createVisibilityTestData({
            imodelConnection,
            hierarchyConfig: { elements: { nodes: "include", excludedClasses: [getClassesByView(viewType).elementClass] } },
            idsCache,
            imodelAccess,
          });
          const { handler, provider, viewport } = visibilityTestData;

          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: "all-hidden",
          });

          const definitionContainerNode = createDefinitionContainerHierarchyNode({ id: keys.definitionContainer.id });
          await handler.changeVisibility(definitionContainerNode, true);
          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: "all-visible",
          });

          viewport.setNeverDrawn({ elementIds: new Set([keys.element.id]) });

          await validateCategoriesTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // oxfmt-ignore
            expectations: {
              [keys.definitionContainer.id]: "partial",
                [keys.category.id]: "partial",
                  [keys.defaultSubCategoryId]: "visible",
                  [keys.subCategory.id]: "visible",
            },
          });
        });
      });
    });
  });
});

async function createDatasets(viewType: "2d" | "3d") {
  const imodels: IModelConnection[] = [];
  const { insertElementsModel, insertModeledElement, insertCategory, insertElement, insertElementsSubModel } = getInsertFunctionByViewType(viewType);

  return {
    [Symbol.asyncDispose]: async () => Promise.all(imodels.map(async (imodel) => imodel.close())),
    ["simple"]: await (async () => {
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          // Structure of the iModel:
          // - DefinitionContainer
          //   - Category
          //     - Default SubCategory
          //     - SubCategory
          //     - Element
          const elementsModel = insertElementsModel({ txn, codeValue: "m" });
          const definitionContainer = insertDefinitionContainer({ txn, codeValue: "dc" });
          const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

          const category = insertCategory({ txn, codeValue: "cat", modelId: definitionModel.id });
          const element = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({ txn, parentCategoryId: category.id, codeValue: "subCat", modelId: definitionModel.id });
          return { definitionContainer, category, subCategory, elementsModel, element, defaultSubCategoryId: getDefaultSubCategoryId(category.id) };
        }),
      );
      imodels.push(imodelConnection);
      return { imodelConnection, keys, ...createAccessAndCache({ imodelConnection, viewType }) };
    })(),
    ["unrelatedDefContainers"]: await (async () => {
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          // Structure of the iModel:
          // - DefinitionContainer
          //   - Category
          //     - Default SubCategory
          //     - SubCategory
          //     - Element
          //
          // - DefinitionContainer2
          //   - Category2
          //     - Default SubCategory2
          //     - SubCategory2
          //     - Element2
          const elementsModel = insertElementsModel({ txn, codeValue: "m" });
          const definitionContainer = insertDefinitionContainer({ txn, codeValue: "dc" });
          const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
          const category = insertCategory({ txn, codeValue: "cat", modelId: definitionModel.id });
          const element = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
          const subCategory = insertSubCategory({ txn, parentCategoryId: category.id, codeValue: "subCat", modelId: definitionModel.id });

          const definitionContainer2 = insertDefinitionContainer({ txn, codeValue: "dc2" });
          const definitionModel2 = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer2.id });
          const category2 = insertCategory({ txn, codeValue: "cat2", modelId: definitionModel2.id });
          const element2 = insertElement({ txn, modelId: elementsModel.id, categoryId: category2.id });
          const subCategory2 = insertSubCategory({ txn, parentCategoryId: category2.id, codeValue: "subCat2", modelId: definitionModel2.id });
          return {
            definitionContainer,
            category,
            subCategory,
            elementsModel,
            element,
            defaultSubCategoryId: getDefaultSubCategoryId(category.id),
            definitionContainer2,
            category2,
            subCategory2,
            element2,
            defaultSubCategoryId2: getDefaultSubCategoryId(category2.id),
          };
        }),
      );
      imodels.push(imodelConnection);
      return { imodelConnection, keys, ...createAccessAndCache({ imodelConnection, viewType }) };
    })(),
    ["siblingCategories"]: await (async () => {
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          // Structure of the iModel:
          // - Parent DefinitionContainer
          //   - Category
          //    - Element
          //   - Child DefinitionContainer
          //     - Child Category
          //       - Child element
          //     - Child Category2
          //       - Child element2
          const elementsModel = insertElementsModel({ txn, codeValue: "m" });
          const parentDefinitionContainer = insertDefinitionContainer({ txn, codeValue: "dc" });
          const parentDefinitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: parentDefinitionContainer.id });
          const childDefinitionContainer = insertDefinitionContainer({ txn, codeValue: "child dc", modelId: parentDefinitionModel.id });
          const childDefinitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: childDefinitionContainer.id });
          const childCategory = insertCategory({ txn, codeValue: "child cat", modelId: childDefinitionModel.id });
          const childElement = insertElement({ txn, modelId: elementsModel.id, categoryId: childCategory.id });
          const childCategory2 = insertCategory({ txn, codeValue: "child cat2", modelId: childDefinitionModel.id });
          const childElement2 = insertElement({ txn, modelId: elementsModel.id, categoryId: childCategory2.id });

          const category = insertCategory({ txn, codeValue: "cat", modelId: parentDefinitionModel.id });
          const element = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
          return {
            parentDefinitionContainer,
            childDefinitionContainer,
            childCategory,
            childElement,
            childCategory2,
            childElement2,
            category,
            elementsModel,
            element,
          };
        }),
      );
      imodels.push(imodelConnection);
      return { imodelConnection, keys, ...createAccessAndCache({ imodelConnection, viewType }) };
    })(),
    ["elementsModels"]: await (async () => {
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          // Structure of the iModel:
          // - CategoryA
          //   - ElementA1 (model1)
          //   - ElementA2 (model2)
          // - CategoryB
          //   - ElementB1 (model1)
          //   - ElementB2 (model2)
          const elementsModel1 = insertElementsModel({ txn, codeValue: "m1" });
          const elementsModel2 = insertElementsModel({ txn, codeValue: "m2" });
          const categoryA = insertCategory({ txn, codeValue: "catA" });
          const categoryB = insertCategory({ txn, codeValue: "catB" });
          const elementA1 = insertElement({ txn, modelId: elementsModel1.id, categoryId: categoryA.id });
          const elementA2 = insertElement({ txn, modelId: elementsModel2.id, categoryId: categoryA.id });
          const elementB1 = insertElement({ txn, modelId: elementsModel1.id, categoryId: categoryB.id });
          const elementB2 = insertElement({ txn, modelId: elementsModel2.id, categoryId: categoryB.id });
          return { elementsModel1, elementsModel2, categoryA, categoryB, elementA1, elementA2, elementB1, elementB2 };
        }),
      );
      imodels.push(imodelConnection);
      return { imodelConnection, keys, ...createAccessAndCache({ imodelConnection, viewType }) };
    })(),
    ["intermediateCategories"]: await (async () => {
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const elementsModel = insertElementsModel({ txn, codeValue: "m" });
          const categoryA = insertCategory({ txn, codeValue: "catA" });
          const categoryB = insertCategory({ txn, codeValue: "catB" });
          const parentElement = insertElement({ txn, modelId: elementsModel.id, categoryId: categoryA.id });
          const childElement = insertElement({ txn, modelId: elementsModel.id, categoryId: categoryB.id, parentId: parentElement.id });
          return { categoryA, categoryB, parentElement, childElement, elementsModel };
        }),
      );
      imodels.push(imodelConnection);
      return { imodelConnection, keys, ...createAccessAndCache({ imodelConnection, viewType }) };
    })(),
    ["subModelIntermediateCategories"]: await (async () => {
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const elementsModel = insertElementsModel({ txn, codeValue: "m" });
          const categoryA = insertCategory({ txn, codeValue: "catA" });
          const categoryB = insertCategory({ txn, codeValue: "catB" });
          const modeledElement = insertModeledElement({
            txn,
            modelId: elementsModel.id,
            categoryId: categoryA.id,
          });
          const subModel = insertElementsSubModel({ txn, modeledElementId: modeledElement.id });
          const subModelElement = insertElement({ txn, modelId: subModel.id, categoryId: categoryB.id });
          return { categoryA, categoryB, modeledElement, subModel, subModelElement, elementsModel };
        }),
      );
      imodels.push(imodelConnection);
      return { imodelConnection, keys, ...createAccessAndCache({ imodelConnection, viewType }) };
    })(),
  };
}
