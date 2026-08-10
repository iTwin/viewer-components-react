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
import { CLASS_NAME_DefinitionModel, CLASS_NAME_SubCategory } from "../../../../tree-widget-react/shared/internal/ClassNameDefinitions.js";
import { getClassesByView, mergeWithDefaults } from "../../../../tree-widget-react/shared/internal/Utils.js";
import { CategoriesTreeDefinition, defaultHierarchyConfiguration } from "../../../../tree-widget-react/trees/categories-tree/CategoriesTreeDefinition.js";
import { createCategoriesTreeVisibilityHandler } from "../../../../tree-widget-react/trees/categories-tree/internal/visibility/CategoriesTreeVisibilityHandler.js";
import { buildIModel } from "../../../IModelUtils.js";
import { TestUtils } from "../../../TestUtils.js";
import { createTreeWidgetTestingViewport, getDefaultSubCategoryId } from "../../TreeUtils.js";
import {
  createAccessAndCache,
  createCategoryHierarchyNode,
  createDefinitionContainerHierarchyNode,
  createElementHierarchyNode,
  createSubCategoryHierarchyNode,
  getInsertFunctionByViewType,
  validateCategoriesTreeHierarchyVisibility,
} from "./Utils.js";

import type { Id64Arg } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchySearchTree } from "@itwin/presentation-hierarchies";
import type {
  CategoriesTreeHierarchyConfiguration,
  RequiredCategoriesTreeHierarchyConfiguration,
} from "../../../../tree-widget-react/trees/categories-tree/CategoriesTreeDefinition.js";
import type { CategoriesTreeIdsCache } from "../../../../tree-widget-react/trees/categories-tree/internal/CategoriesTreeIdsCache.js";
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

    describe(`${viewType} view`, () => {
      describe("search nodes", () => {
        async function createFilteredVisibilityTestData({
          imodelConnection,
          searchPaths,
          visibleByDefault,
          subCategoriesOfCategories,
          idsCache,
          imodelAccess,
        }: {
          searchPaths: HierarchySearchTree[];
          visibleByDefault?: boolean;
          subCategoriesOfCategories: Array<{ categoryId: string; subCategories: Id64Arg }>;
          imodelConnection: IModelConnection;
          hierarchyConfig?: CategoriesTreeHierarchyConfiguration;
          imodelAccess: IModelAccess;
          idsCache: CategoriesTreeIdsCache;
        }) {
          const hierarchyConfig: RequiredCategoriesTreeHierarchyConfiguration = mergeWithDefaults({
            defaults: defaultHierarchyConfiguration,
            overrides: {
              elements: { nodes: "include" },
              categories: { withoutElements: "include" },
            },
          });
          const viewport = createTreeWidgetTestingViewport({
            iModel: imodelConnection,
            viewType,
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
          const providerWithSearchPaths = createProvider({
            idsCache,
            imodelAccess,
            searchPaths,
            hierarchyConfig,
          });
          return {
            defaultVisibilityHandler,
            visibilityHandlerWithSearchPaths,
            defaultProvider,
            providerWithSearchPaths,
            imodelConnection,
            imodelAccess,
            viewport,
            [Symbol.dispose]() {
              defaultVisibilityHandler[Symbol.dispose]();
              visibilityHandlerWithSearchPaths[Symbol.dispose]();
              defaultProvider[Symbol.dispose]();
              providerWithSearchPaths[Symbol.dispose]();
            },
          };
        }

        it("returns 'disabled' when node has search paths but visibility handler doesn't", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const category = insertCategory({ txn, codeValue: "cat" });
              const subCategory = insertSubCategory({
                txn,
                parentCategoryId: category.id,
                codeValue: "subCat",
              });
              return { category, subCategory };
            }),
          );
          const { imodelConnection, ...keys } = buildIModelResult;
          const hierarchyConfig: RequiredCategoriesTreeHierarchyConfiguration = mergeWithDefaults({
            defaults: defaultHierarchyConfiguration,
            overrides: {
              elements: { nodes: "include" },
              categories: { withoutElements: "include" },
            },
          });
          const accessAndCache = createAccessAndCache({ imodelConnection, viewType });
          const viewport = createTreeWidgetTestingViewport({
            iModel: imodelConnection,
            viewType,
            visibleByDefault: true,
            subCategoriesOfCategories: [
              {
                categoryId: keys.category.id,
                subCategories: [keys.subCategory.id, getDefaultSubCategoryId(keys.category.id)],
              },
            ],
          });
          using visibilityHandlerWithoutSearchPaths = createCategoriesTreeVisibilityHandler({
            idsCache: accessAndCache.idsCache,
            searchPaths: undefined,
            imodelAccess: accessAndCache.imodelAccess,
            viewport,
            hierarchyConfig,
          });

          using providerWithSearchPaths = createProvider({
            idsCache: accessAndCache.idsCache,
            imodelAccess: accessAndCache.imodelAccess,
            searchPaths: [{ identifier: keys.category, children: [{ identifier: keys.subCategory }] }],
            hierarchyConfig,
          });
          await validateCategoriesTreeHierarchyVisibility({
            provider: providerWithSearchPaths,
            handler: visibilityHandlerWithoutSearchPaths,
            viewport,
            // prettier-ignore
            expectations: {
                [keys.category.id]: "disabled",
                  [keys.subCategory.id]: "visible",
              },
          });
        });

        describe("category with sub-categories hierarchy", () => {
          let createIModelResult: Awaited<ReturnType<typeof createIModel>>;
          let visibilityTestData: Awaited<ReturnType<typeof createFilteredVisibilityTestData>>;
          let accessAndCache: ReturnType<typeof createAccessAndCache>;
          async function createIModel() {
            return buildIModel(async (imodel) =>
              withEditTxn(imodel, (txn) => {
                const category = insertCategory({ txn, codeValue: "cat" });
                const defaultSubCategory = { id: getDefaultSubCategoryId(category.id), className: CLASS_NAME_SubCategory };
                const subCategory = insertSubCategory({
                  txn,
                  parentCategoryId: category.id,
                  codeValue: "subCat",
                });

                const siblingCategory = insertCategory({ txn, codeValue: "sibling cat" });
                const defaultSiblingSubCategory = { id: getDefaultSubCategoryId(siblingCategory.id), className: CLASS_NAME_SubCategory };
                const siblingSubCategory = insertSubCategory({
                  txn,
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
                  searchPaths: [{ identifier: category, children: [{ identifier: defaultSubCategory }] }],
                };
              }),
            );
          }

          beforeAll(async () => {
            createIModelResult = await createIModel();
            accessAndCache = createAccessAndCache({ imodelConnection: createIModelResult.imodelConnection, viewType });
          });

          beforeEach(async function () {
            visibilityTestData = await createFilteredVisibilityTestData({
              imodelConnection: createIModelResult.imodelConnection,
              searchPaths: createIModelResult.searchPaths,
              visibleByDefault: false,
              subCategoriesOfCategories: [
                { categoryId: createIModelResult.category.id, subCategories: [createIModelResult.subCategory.id, createIModelResult.defaultSubCategory.id] },
                {
                  categoryId: createIModelResult.siblingCategory.id,
                  subCategories: [createIModelResult.siblingSubCategory.id, createIModelResult.defaultSiblingSubCategory.id],
                },
              ],
              imodelAccess: accessAndCache.imodelAccess,
              idsCache: accessAndCache.idsCache,
            });
          });

          afterEach(() => {
            visibilityTestData[Symbol.dispose]();
          });

          afterAll(async () => {
            await createIModelResult.imodelConnection.close();
          });

          it("showing category changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const { category, subCategory, defaultSubCategory, siblingCategory, siblingSubCategory, defaultSiblingSubCategory } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createCategoryHierarchyNode({
                id: category.id,
                search: {
                  isSearchTarget: false,
                  childrenTargetPaths: [{ identifier: defaultSubCategory }],
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

          it("showing search target sub-category changes visibility for related nodes in search paths", async () => {
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

        describe("category with child elements hierarchy", () => {
          let createIModelResult: Awaited<ReturnType<typeof createIModel>>;
          let visibilityTestData: Awaited<ReturnType<typeof createFilteredVisibilityTestData>>;
          let accessAndCache: ReturnType<typeof createAccessAndCache>;
          async function createIModel() {
            return buildIModel(async (imodel) =>
              withEditTxn(imodel, (txn) => {
                const elementsModel = insertElementsModel({ txn, codeValue: "m" });

                const category = insertCategory({ txn, codeValue: "cat" });
                const defaultSubCategory = { id: getDefaultSubCategoryId(category.id), className: CLASS_NAME_SubCategory };
                const parentElement1 = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
                const parentElement2 = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
                const element = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
                const childElement11 = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id, parentId: parentElement1.id });
                const childElement12 = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id, parentId: parentElement1.id });
                const childElement21 = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id, parentId: parentElement2.id });

                const siblingCategory = insertCategory({ txn, codeValue: "sibling cat" });
                const defaultSiblingSubCategory = { id: getDefaultSubCategoryId(siblingCategory.id), className: CLASS_NAME_SubCategory };
                const siblingElement = insertElement({ txn, modelId: elementsModel.id, categoryId: siblingCategory.id });

                return {
                  category,
                  defaultSubCategory,
                  parentElement1,
                  parentElement2,
                  element,
                  childElement11,
                  childElement12,
                  childElement21,
                  defaultSiblingSubCategory,
                  siblingElement,
                  siblingCategory,
                  elementsModel,
                  searchPaths: [
                    { identifier: category, children: [{ identifier: parentElement1, children: [{ identifier: childElement11 }] }] },
                    { identifier: category, children: [{ identifier: parentElement2, isTarget: true, children: [{ identifier: childElement21 }] }] },
                  ],
                };
              }),
            );
          }

          beforeAll(async () => {
            createIModelResult = await createIModel();
            accessAndCache = createAccessAndCache({ imodelConnection: createIModelResult.imodelConnection, viewType });
          });

          beforeEach(async function () {
            visibilityTestData = await createFilteredVisibilityTestData({
              imodelConnection: createIModelResult.imodelConnection,
              searchPaths: createIModelResult.searchPaths,
              visibleByDefault: false,
              subCategoriesOfCategories: [
                { categoryId: createIModelResult.category.id, subCategories: createIModelResult.defaultSubCategory.id },
                { categoryId: createIModelResult.siblingCategory.id, subCategories: createIModelResult.defaultSiblingSubCategory.id },
              ],
              idsCache: accessAndCache.idsCache,
              imodelAccess: accessAndCache.imodelAccess,
            });
            visibilityTestData.viewport.setNeverDrawn({
              elementIds: new Set([
                createIModelResult.element.id,
                createIModelResult.childElement11.id,
                createIModelResult.childElement12.id,
                createIModelResult.siblingElement.id,
                createIModelResult.childElement21.id,
                createIModelResult.parentElement1.id,
                createIModelResult.parentElement2.id,
              ]),
            });
          });

          afterEach(() => {
            visibilityTestData[Symbol.dispose]();
          });

          afterAll(async () => {
            await createIModelResult.imodelConnection.close();
          });

          it("showing category changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const { category, element, siblingElement, parentElement1, childElement11, childElement12, parentElement2, childElement21, siblingCategory } =
              createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createCategoryHierarchyNode({
                id: category.id,
                search: {
                  isSearchTarget: false,
                  childrenTargetPaths: [{ identifier: parentElement1, children: [{ identifier: childElement11 }] }, { identifier: parentElement2 }],
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
                  [parentElement1.id]: "visible",
                    [childElement11.id]: "visible",

                  [parentElement2.id]: "visible",
                    [childElement21.id]: "visible",
              },
            });

            await validateCategoriesTreeHierarchyVisibility({
              provider: defaultProvider,
              handler: defaultVisibilityHandler,
              viewport,
              // prettier-ignore
              expectations: {
                [category.id]: "partial",
                  [element.id]: "hidden",

                  [parentElement1.id]: "partial",
                    [childElement11.id]: "visible",
                    [childElement12.id]: "hidden",

                  [parentElement2.id]: "visible",
                    [childElement21.id]: "visible",

                [siblingCategory.id]: "hidden",
                  [siblingElement.id]: "hidden",
              },
            });
          });

          it("showing parent element changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const {
              category,
              element,
              siblingElement,
              parentElement1,
              childElement11,
              childElement12,
              parentElement2,
              childElement21,
              siblingCategory,
              elementsModel,
            } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createElementHierarchyNode({
                elementId: parentElement1.id,
                parentKeys: [category],
                modelId: elementsModel.id,
                categoryId: category.id,
                search: {
                  isSearchTarget: false,
                  childrenTargetPaths: [{ identifier: childElement11 }],
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
                  [parentElement1.id]: "visible",
                    [childElement11.id]: "visible",

                  [parentElement2.id]: "hidden",
                    [childElement21.id]: "hidden",
              },
            });

            await validateCategoriesTreeHierarchyVisibility({
              provider: defaultProvider,
              handler: defaultVisibilityHandler,
              viewport,
              // prettier-ignore
              expectations: {
                [category.id]: "partial",
                  [element.id]: "hidden",

                  [parentElement1.id]: "partial",
                    [childElement11.id]: "visible",
                    [childElement12.id]: "hidden",

                  [parentElement2.id]: "hidden",
                    [childElement21.id]: "hidden",

                [siblingCategory.id]: "hidden",
                  [siblingElement.id]: "hidden",
              },
            });
          });

          it("showing search target child element changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const {
              category,
              element,
              siblingElement,
              parentElement1,
              childElement11,
              childElement12,
              parentElement2,
              childElement21,
              siblingCategory,
              elementsModel,
            } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createElementHierarchyNode({
                elementId: childElement11.id,
                parentKeys: [category, parentElement1],
                modelId: elementsModel.id,
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
                  [parentElement1.id]: "partial",
                    [childElement11.id]: "visible",

                  [parentElement2.id]: "hidden",
                    [childElement21.id]: "hidden",
              },
            });

            await validateCategoriesTreeHierarchyVisibility({
              provider: defaultProvider,
              handler: defaultVisibilityHandler,
              viewport,
              // prettier-ignore
              expectations: {
                [category.id]: "partial",
                  [element.id]: "hidden",

                  [parentElement1.id]: "partial",
                    [childElement11.id]: "visible",
                    [childElement12.id]: "hidden",

                  [parentElement2.id]: "hidden",
                    [childElement21.id]: "hidden",

                [siblingCategory.id]: "hidden",
                  [siblingElement.id]: "hidden",
              },
            });
          });

          it("showing search target parent element changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const {
              category,
              element,
              siblingElement,
              parentElement1,
              childElement11,
              childElement12,
              parentElement2,
              childElement21,
              siblingCategory,
              elementsModel,
            } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createElementHierarchyNode({
                elementId: parentElement2.id,
                parentKeys: [category],
                modelId: elementsModel.id,
                categoryId: category.id,
                search: { isSearchTarget: true, childrenTargetPaths: [{ identifier: childElement21 }] },
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
                  [parentElement1.id]: "hidden",
                    [childElement11.id]: "hidden",

                  [parentElement2.id]: "visible",
                    [childElement21.id]: "visible",
              },
            });

            await validateCategoriesTreeHierarchyVisibility({
              provider: defaultProvider,
              handler: defaultVisibilityHandler,
              viewport,
              // prettier-ignore
              expectations: {
                [category.id]: "partial",
                  [element.id]: "hidden",

                  [parentElement1.id]: "hidden",
                    [childElement11.id]: "hidden",
                    [childElement12.id]: "hidden",

                  [parentElement2.id]: "visible",
                    [childElement21.id]: "visible",

                [siblingCategory.id]: "hidden",
                  [siblingElement.id]: "hidden",
              },
            });
          });

          it("showing search target child element of search target parent element changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const {
              category,
              element,
              siblingElement,
              parentElement1,
              childElement11,
              childElement12,
              parentElement2,
              childElement21,
              siblingCategory,
              elementsModel,
            } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createElementHierarchyNode({
                elementId: childElement21.id,
                parentKeys: [category, parentElement2],
                modelId: elementsModel.id,
                categoryId: category.id,
                search: { isSearchTarget: true, hasSearchTargetAncestor: true },
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
                  [parentElement1.id]: "hidden",
                    [childElement11.id]: "hidden",

                  [parentElement2.id]: "partial",
                    [childElement21.id]: "visible",
              },
            });

            await validateCategoriesTreeHierarchyVisibility({
              provider: defaultProvider,
              handler: defaultVisibilityHandler,
              viewport,
              // prettier-ignore
              expectations: {
                [category.id]: "partial",
                  [element.id]: "hidden",

                  [parentElement1.id]: "hidden",
                    [childElement11.id]: "hidden",
                    [childElement12.id]: "hidden",

                  [parentElement2.id]: "partial",
                    [childElement21.id]: "visible",

                [siblingCategory.id]: "hidden",
                  [siblingElement.id]: "hidden",
              },
            });
          });
        });

        describe("category with elements which are search targets and have search target ancestor", () => {
          let createIModelResult: Awaited<ReturnType<typeof createIModel>>;
          let visibilityTestData: Awaited<ReturnType<typeof createFilteredVisibilityTestData>>;
          let accessAndCache: ReturnType<typeof createAccessAndCache>;
          async function createIModel() {
            return buildIModel(async (imodel) =>
              withEditTxn(imodel, (txn) => {
                const elementsModel = insertElementsModel({ txn, codeValue: "m" });

                const category = insertCategory({ txn, codeValue: "cat" });
                const defaultSubCategory = { id: getDefaultSubCategoryId(category.id), className: CLASS_NAME_SubCategory };
                const element = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
                const parentElement = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
                const childElement = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id, parentId: parentElement.id });
                const childOfChild1 = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id, parentId: childElement.id });
                const childOfChild2 = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id, parentId: childElement.id });

                return {
                  category,
                  defaultSubCategory,
                  parentElement,
                  element,
                  childElement,
                  elementsModel,
                  childOfChild1,
                  childOfChild2,
                  searchPaths: [
                    {
                      identifier: category,
                      children: [
                        { identifier: parentElement, isTarget: true, children: [{ identifier: childElement, children: [{ identifier: childOfChild1 }] }] },
                      ],
                    },
                  ],
                };
              }),
            );
          }

          beforeAll(async () => {
            createIModelResult = await createIModel();
            accessAndCache = createAccessAndCache({ imodelConnection: createIModelResult.imodelConnection, viewType });
          });

          beforeEach(async function () {
            visibilityTestData = await createFilteredVisibilityTestData({
              imodelConnection: createIModelResult.imodelConnection,
              searchPaths: createIModelResult.searchPaths,
              visibleByDefault: false,
              subCategoriesOfCategories: [{ categoryId: createIModelResult.category.id, subCategories: createIModelResult.defaultSubCategory.id }],
              imodelAccess: accessAndCache.imodelAccess,
              idsCache: accessAndCache.idsCache,
            });
            visibilityTestData.viewport.setNeverDrawn({
              elementIds: new Set([
                createIModelResult.element.id,
                createIModelResult.parentElement.id,
                createIModelResult.childElement.id,
                createIModelResult.childOfChild1.id,
                createIModelResult.childOfChild2.id,
              ]),
            });
          });

          afterEach(() => {
            visibilityTestData[Symbol.dispose]();
          });

          afterAll(async () => {
            await createIModelResult.imodelConnection.close();
          });

          it("showing category changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const { category, element, parentElement, childElement, childOfChild1, childOfChild2 } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createCategoryHierarchyNode({
                id: category.id,
                search: {
                  isSearchTarget: false,
                  childrenTargetPaths: [
                    { identifier: parentElement, isTarget: true, children: [{ identifier: childElement, children: [{ identifier: childOfChild1 }] }] },
                  ],
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
                      [childOfChild1.id]: "visible",
                      [childOfChild2.id]: "visible",
              },
            });

            await validateCategoriesTreeHierarchyVisibility({
              provider: defaultProvider,
              handler: defaultVisibilityHandler,
              viewport,
              // prettier-ignore
              expectations: {
                [category.id]: "partial",
                  [element.id]: "hidden",

                  [parentElement.id]: "visible",
                    [childElement.id]: "visible",
                      [childOfChild1.id]: "visible",
                      [childOfChild2.id]: "visible",
              },
            });
          });

          it("showing search target parent element changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const { category, element, parentElement, childElement, childOfChild1, childOfChild2, elementsModel } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createElementHierarchyNode({
                elementId: parentElement.id,
                parentKeys: [category, { type: "class-grouping", className: getClassesByView(viewType).elementClass }],
                modelId: elementsModel.id,
                categoryId: category.id,
                search: { isSearchTarget: true, childrenTargetPaths: [{ identifier: childElement, children: [{ identifier: childOfChild1 }] }] },
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
                      [childOfChild1.id]: "visible",
                      [childOfChild2.id]: "visible",
              },
            });

            await validateCategoriesTreeHierarchyVisibility({
              provider: defaultProvider,
              handler: defaultVisibilityHandler,
              viewport,
              // prettier-ignore
              expectations: {
                [category.id]: "partial",
                  [element.id]: "hidden",

                  [parentElement.id]: "visible",
                    [childElement.id]: "visible",
                      [childOfChild1.id]: "visible",
                      [childOfChild2.id]: "visible",
              },
            });
          });

          it("showing child element of search target parent element changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const { category, element, parentElement, childElement, childOfChild1, childOfChild2, elementsModel } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createElementHierarchyNode({
                elementId: childElement.id,
                parentKeys: [
                  category,
                  { type: "class-grouping", className: getClassesByView(viewType).elementClass },
                  parentElement,
                  { type: "class-grouping", className: getClassesByView(viewType).elementClass },
                ],
                modelId: elementsModel.id,
                categoryId: category.id,
                search: { isSearchTarget: false, hasSearchTargetAncestor: true, childrenTargetPaths: [{ identifier: childOfChild1 }] },
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
                      [childOfChild1.id]: "visible",
                      [childOfChild2.id]: "visible",
              },
            });

            await validateCategoriesTreeHierarchyVisibility({
              provider: defaultProvider,
              handler: defaultVisibilityHandler,
              viewport,
              // prettier-ignore
              expectations: {
                [category.id]: "partial",
                  [element.id]: "hidden",

                  [parentElement.id]: "partial",
                    [childElement.id]: "visible",
                      [childOfChild1.id]: "visible",
                      [childOfChild2.id]: "visible",
              },
            });
          });

          it("showing nested child search target element with search target ancestor element changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const { category, element, parentElement, childElement, childOfChild1, childOfChild2, elementsModel } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createElementHierarchyNode({
                elementId: childOfChild1.id,
                parentKeys: [
                  category,
                  { type: "class-grouping", className: getClassesByView(viewType).elementClass },
                  parentElement,
                  { type: "class-grouping", className: getClassesByView(viewType).elementClass },
                  childElement,
                  { type: "class-grouping", className: getClassesByView(viewType).elementClass },
                ],
                modelId: elementsModel.id,
                categoryId: category.id,
                search: { isSearchTarget: true, hasSearchTargetAncestor: true },
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
                    [childElement.id]: "partial",
                      [childOfChild1.id]: "visible",
                      [childOfChild2.id]: "hidden",
              },
            });

            await validateCategoriesTreeHierarchyVisibility({
              provider: defaultProvider,
              handler: defaultVisibilityHandler,
              viewport,
              // prettier-ignore
              expectations: {
                [category.id]: "partial",
                  [element.id]: "hidden",

                  [parentElement.id]: "partial",
                    [childElement.id]: "partial",
                      [childOfChild1.id]: "visible",
                      [childOfChild2.id]: "hidden",
              },
            });
          });
        });

        describe("category with intermediate categories hierarchy", () => {
          let createIModelResult: Awaited<ReturnType<typeof createIModel>>;
          let visibilityTestData: Awaited<ReturnType<typeof createFilteredVisibilityTestData>>;
          let accessAndCache: ReturnType<typeof createAccessAndCache>;
          async function createIModel() {
            return buildIModel(async (imodel) =>
              withEditTxn(imodel, (txn) => {
                const elementsModel = insertElementsModel({ txn, codeValue: "m" });

                const categoryA = insertCategory({ txn, codeValue: "catA" });
                const defaultSubCategoryA = { id: getDefaultSubCategoryId(categoryA.id), className: CLASS_NAME_SubCategory };
                const categoryB = insertCategory({ txn, codeValue: "catB" });
                const defaultSubCategoryB = { id: getDefaultSubCategoryId(categoryB.id), className: CLASS_NAME_SubCategory };
                const parentElement = insertElement({ txn, modelId: elementsModel.id, categoryId: categoryA.id });
                const childElement1 = insertElement({ txn, modelId: elementsModel.id, categoryId: categoryB.id, parentId: parentElement.id });
                const childElement2 = insertElement({ txn, modelId: elementsModel.id, categoryId: categoryB.id, parentId: parentElement.id });
                const siblingElement = insertElement({ txn, modelId: elementsModel.id, categoryId: categoryA.id });

                return {
                  categoryA,
                  categoryB,
                  defaultSubCategoryA,
                  defaultSubCategoryB,
                  parentElement,
                  childElement1,
                  childElement2,
                  siblingElement,
                  elementsModel,
                  searchPaths: [
                    {
                      identifier: categoryA,
                      children: [
                        {
                          identifier: parentElement,
                          children: [{ identifier: categoryB, children: [{ identifier: childElement1 }] }],
                        },
                      ],
                    },
                  ],
                };
              }),
            );
          }

          beforeAll(async () => {
            createIModelResult = await createIModel();
            accessAndCache = createAccessAndCache({ imodelConnection: createIModelResult.imodelConnection, viewType });
          });

          beforeEach(async function () {
            visibilityTestData = await createFilteredVisibilityTestData({
              imodelConnection: createIModelResult.imodelConnection,
              searchPaths: createIModelResult.searchPaths,
              visibleByDefault: false,
              subCategoriesOfCategories: [
                { categoryId: createIModelResult.categoryA.id, subCategories: createIModelResult.defaultSubCategoryA.id },
                { categoryId: createIModelResult.categoryB.id, subCategories: createIModelResult.defaultSubCategoryB.id },
              ],
              imodelAccess: accessAndCache.imodelAccess,
              idsCache: accessAndCache.idsCache,
            });
            visibilityTestData.viewport.setNeverDrawn({
              elementIds: new Set([
                createIModelResult.parentElement.id,
                createIModelResult.childElement1.id,
                createIModelResult.childElement2.id,
                createIModelResult.siblingElement.id,
              ]),
            });
          });

          afterEach(() => {
            visibilityTestData[Symbol.dispose]();
          });

          afterAll(async () => {
            await createIModelResult.imodelConnection.close();
          });

          it("showing intermediate category changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const { categoryA, categoryB, parentElement, childElement1, childElement2, siblingElement, elementsModel } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createCategoryHierarchyNode({
                id: categoryB.id,
                modelIds: [elementsModel.id],
                hasChildren: true,
                parentKeys: [categoryA, parentElement],
                parentElementsPath: [{ elementIds: [parentElement.id], categoryIds: categoryA.id }],
                search: {
                  isSearchTarget: false,
                  childrenTargetPaths: [{ identifier: childElement1 }],
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
                [categoryA.id]: "partial",
                  [parentElement.id]: "partial",
                    [`${parentElement.id}-${categoryB.id}`]: "visible",
                      [childElement1.id]: "visible",
              },
            });

            await validateCategoriesTreeHierarchyVisibility({
              provider: defaultProvider,
              handler: defaultVisibilityHandler,
              viewport,
              // prettier-ignore
              expectations: {
                [categoryA.id]: "partial",
                  [parentElement.id]: "partial",
                    [`${parentElement.id}-${categoryB.id}`]: "partial",
                      [childElement1.id]: "visible",
                      [childElement2.id]: "hidden",
                  [siblingElement.id]: "hidden",

                [categoryB.id]: "hidden",
              },
            });
          });

          it("showing child element under intermediate category changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const { categoryA, categoryB, parentElement, childElement1, childElement2, siblingElement, elementsModel } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createElementHierarchyNode({
                elementId: childElement1.id,
                modelId: elementsModel.id,
                categoryId: categoryB.id,
                parentKeys: [categoryA, parentElement, categoryB],
                parentElementsPath: [{ elementIds: [parentElement.id], categoryIds: categoryA.id }],
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
                [categoryA.id]: "partial",
                  [parentElement.id]: "partial",
                    [`${parentElement.id}-${categoryB.id}`]: "visible",
                      [childElement1.id]: "visible",
              },
            });

            await validateCategoriesTreeHierarchyVisibility({
              provider: defaultProvider,
              handler: defaultVisibilityHandler,
              viewport,
              // prettier-ignore
              expectations: {
                [categoryA.id]: "partial",
                  [parentElement.id]: "partial",
                    [`${parentElement.id}-${categoryB.id}`]: "partial",
                      [childElement1.id]: "visible",
                      [childElement2.id]: "hidden",
                  [siblingElement.id]: "hidden",

                [categoryB.id]: "hidden",
              },
            });
          });

          it("showing parent element changes visibility for intermediate category children in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const { categoryA, categoryB, parentElement, childElement1, childElement2, siblingElement, elementsModel } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createElementHierarchyNode({
                elementId: parentElement.id,
                modelId: elementsModel.id,
                categoryId: categoryA.id,
                parentKeys: [categoryA],
                hasChildren: true,
                search: {
                  isSearchTarget: false,
                  childrenTargetPaths: [{ identifier: categoryB, children: [{ identifier: childElement1 }] }],
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
                [categoryA.id]: "visible",
                  [parentElement.id]: "visible",
                    [`${parentElement.id}-${categoryB.id}`]: "visible",
                      [childElement1.id]: "visible",
              },
            });

            await validateCategoriesTreeHierarchyVisibility({
              provider: defaultProvider,
              handler: defaultVisibilityHandler,
              viewport,
              // prettier-ignore
              expectations: {
                [categoryA.id]: "partial",
                  [parentElement.id]: "partial",
                    [`${parentElement.id}-${categoryB.id}`]: "partial",
                      [childElement1.id]: "visible",
                      [childElement2.id]: "hidden",
                  [siblingElement.id]: "hidden",

                [categoryB.id]: "hidden",
              },
            });
          });

          it("showing root category changes visibility for intermediate category children in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const { categoryA, categoryB, parentElement, childElement1, childElement2, siblingElement } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createCategoryHierarchyNode({
                id: categoryA.id,
                hasChildren: true,
                search: {
                  isSearchTarget: false,
                  childrenTargetPaths: [{ identifier: parentElement, children: [{ identifier: categoryB, children: [{ identifier: childElement1 }] }] }],
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
                [categoryA.id]: "visible",
                  [parentElement.id]: "visible",
                    [`${parentElement.id}-${categoryB.id}`]: "visible",
                      [childElement1.id]: "visible",
              },
            });

            await validateCategoriesTreeHierarchyVisibility({
              provider: defaultProvider,
              handler: defaultVisibilityHandler,
              viewport,
              // prettier-ignore
              expectations: {
                [categoryA.id]: "partial",
                  [parentElement.id]: "partial",
                    [`${parentElement.id}-${categoryB.id}`]: "partial",
                      [childElement1.id]: "visible",
                      [childElement2.id]: "hidden",
                  [siblingElement.id]: "hidden",

                [categoryB.id]: "hidden",
              },
            });
          });
        });

        describe("category with intermediate categories under sub-model hierarchy", () => {
          let createIModelResult: Awaited<ReturnType<typeof createIModel>>;
          let visibilityTestData: Awaited<ReturnType<typeof createFilteredVisibilityTestData>>;
          let accessAndCache: ReturnType<typeof createAccessAndCache>;
          async function createIModel() {
            return buildIModel(async (imodel) =>
              withEditTxn(imodel, (txn) => {
                const elementsModel = insertElementsModel({ txn, codeValue: "m" });

                const categoryA = insertCategory({ txn, codeValue: "catA" });
                const defaultSubCategoryA = { id: getDefaultSubCategoryId(categoryA.id), className: CLASS_NAME_SubCategory };
                const categoryB = insertCategory({ txn, codeValue: "catB" });
                const defaultSubCategoryB = { id: getDefaultSubCategoryId(categoryB.id), className: CLASS_NAME_SubCategory };
                const modeledElement = insertModeledElement({
                  txn,
                  modelId: elementsModel.id,
                  categoryId: categoryA.id,
                });
                const subModel = insertElementsSubModel({ txn, modeledElementId: modeledElement.id });
                const subModelElement1 = insertElement({ txn, modelId: subModel.id, categoryId: categoryB.id });
                const subModelElement2 = insertElement({ txn, modelId: subModel.id, categoryId: categoryB.id });

                return {
                  categoryA,
                  categoryB,
                  defaultSubCategoryA,
                  defaultSubCategoryB,
                  modeledElement,
                  subModel,
                  subModelElement1,
                  subModelElement2,
                  elementsModel,
                  searchPaths: [
                    {
                      identifier: categoryA,
                      children: [
                        {
                          identifier: modeledElement,
                          children: [{ identifier: subModel, children: [{ identifier: categoryB, children: [{ identifier: subModelElement1 }] }] }],
                        },
                      ],
                    },
                  ],
                };
              }),
            );
          }

          beforeAll(async () => {
            createIModelResult = await createIModel();
            accessAndCache = createAccessAndCache({ imodelConnection: createIModelResult.imodelConnection, viewType });
          });

          beforeEach(async function () {
            visibilityTestData = await createFilteredVisibilityTestData({
              imodelConnection: createIModelResult.imodelConnection,
              searchPaths: createIModelResult.searchPaths,
              visibleByDefault: false,
              subCategoriesOfCategories: [
                { categoryId: createIModelResult.categoryA.id, subCategories: createIModelResult.defaultSubCategoryA.id },
                { categoryId: createIModelResult.categoryB.id, subCategories: createIModelResult.defaultSubCategoryB.id },
              ],
              imodelAccess: accessAndCache.imodelAccess,
              idsCache: accessAndCache.idsCache,
            });
            visibilityTestData.viewport.setNeverDrawn({
              elementIds: new Set([createIModelResult.modeledElement.id, createIModelResult.subModelElement1.id, createIModelResult.subModelElement2.id]),
            });
          });

          afterEach(() => {
            visibilityTestData[Symbol.dispose]();
          });

          afterAll(async () => {
            await createIModelResult.imodelConnection.close();
          });

          it("showing intermediate category under sub-model changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const { categoryA, categoryB, modeledElement, subModel, subModelElement1, subModelElement2 } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createCategoryHierarchyNode({
                id: categoryB.id,
                modelIds: [modeledElement.id],
                hasChildren: true,
                parentKeys: [categoryA, modeledElement, subModel],
                search: {
                  isSearchTarget: false,
                  childrenTargetPaths: [{ identifier: subModelElement1 }],
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
                [categoryA.id]: "partial",
                  [modeledElement.id]: "partial",
                    [subModel.id]: "partial",
                      [`${modeledElement.id}-${categoryB.id}`]: "visible",
                        [subModelElement1.id]: "visible",
              },
            });

            await validateCategoriesTreeHierarchyVisibility({
              provider: defaultProvider,
              handler: defaultVisibilityHandler,
              viewport,
              // prettier-ignore
              expectations: {
                [categoryA.id]: "partial",
                  [modeledElement.id]: "partial",
                    [`${modeledElement.id}-${categoryB.id}`]: "partial",
                      [subModelElement1.id]: "visible",
                      [subModelElement2.id]: "hidden",

                [categoryB.id]: "hidden",
              },
            });
          });

          it("showing element under intermediate category in sub-model changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const { categoryA, categoryB, modeledElement, subModel, subModelElement1, subModelElement2 } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createElementHierarchyNode({
                elementId: subModelElement1.id,
                modelId: modeledElement.id,
                categoryId: categoryB.id,
                parentKeys: [categoryA, modeledElement, subModel, categoryB],
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
                [categoryA.id]: "partial",
                  [modeledElement.id]: "partial",
                    [subModel.id]: "partial",
                      [`${modeledElement.id}-${categoryB.id}`]: "visible",
                        [subModelElement1.id]: "visible",
              },
            });

            await validateCategoriesTreeHierarchyVisibility({
              provider: defaultProvider,
              handler: defaultVisibilityHandler,
              viewport,
              // prettier-ignore
              expectations: {
                [categoryA.id]: "partial",
                  [modeledElement.id]: "partial",
                    [`${modeledElement.id}-${categoryB.id}`]: "partial",
                      [subModelElement1.id]: "visible",
                      [subModelElement2.id]: "hidden",

                [categoryB.id]: "hidden",
              },
            });
          });

          it("showing modeled element changes visibility for intermediate category children in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const { categoryA, categoryB, modeledElement, subModel, subModelElement1, subModelElement2, elementsModel } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createElementHierarchyNode({
                elementId: modeledElement.id,
                modelId: elementsModel.id,
                categoryId: categoryA.id,
                parentKeys: [categoryA],
                hasChildren: true,
                search: {
                  isSearchTarget: false,
                  childrenTargetPaths: [{ identifier: subModel, children: [{ identifier: categoryB, children: [{ identifier: subModelElement1 }] }] }],
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
                [categoryA.id]: "visible",
                  [modeledElement.id]: "visible",
                    [subModel.id]: "visible",
                      [`${modeledElement.id}-${categoryB.id}`]: "visible",
                        [subModelElement1.id]: "visible",
              },
            });

            await validateCategoriesTreeHierarchyVisibility({
              provider: defaultProvider,
              handler: defaultVisibilityHandler,
              viewport,
              // prettier-ignore
              expectations: {
                [categoryA.id]: "partial",
                  [modeledElement.id]: "partial",
                    [`${modeledElement.id}-${categoryB.id}`]: "partial",
                      [subModelElement1.id]: "visible",
                      [subModelElement2.id]: "hidden",

                [categoryB.id]: "hidden",
              },
            });
          });
        });

        describe("category with modeled elements hierarchy", () => {
          let createIModelResult: Awaited<ReturnType<typeof createIModel>>;
          let visibilityTestData: Awaited<ReturnType<typeof createFilteredVisibilityTestData>>;
          let accessAndCache: ReturnType<typeof createAccessAndCache>;
          async function createIModel() {
            return buildIModel(async (imodel) =>
              withEditTxn(imodel, (txn) => {
                const elementsModel = insertElementsModel({ txn, codeValue: "m" });

                const category = insertCategory({ txn, codeValue: "cat" });
                const defaultSubCategory = { id: getDefaultSubCategoryId(category.id), className: CLASS_NAME_SubCategory };
                const element = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
                const modeledElement = insertModeledElement({
                  txn,
                  userLabel: "modeled el",
                  modelId: elementsModel.id,
                  categoryId: category.id,
                });
                const subModel = insertElementsSubModel({ txn, modeledElementId: modeledElement.id });
                const subModelCategory = insertCategory({ txn, codeValue: "subModel cat" });
                const subModelElement = insertElement({ txn, userLabel: "subModel el", modelId: subModel.id, categoryId: subModelCategory.id });
                const subModelElement2 = insertElement({ txn, userLabel: "subModel el 2", modelId: subModel.id, categoryId: subModelCategory.id });
                const defaultSubCategoryOfSubModelCategory = { id: getDefaultSubCategoryId(subModelCategory.id), className: CLASS_NAME_SubCategory };

                const otherSubModelCategory = insertCategory({ txn, codeValue: "other subModel cat" });
                const otherSubModelElement = insertElement({
                  txn,
                  userLabel: "other subModel el",
                  modelId: subModel.id,
                  categoryId: otherSubModelCategory.id,
                });
                const defaultSubCategoryOfOtherSubModelCategory = { id: getDefaultSubCategoryId(otherSubModelCategory.id), className: CLASS_NAME_SubCategory };

                const siblingCategory = insertCategory({ txn, codeValue: "sibling cat" });
                const siblingElement = insertElement({ txn, modelId: elementsModel.id, categoryId: siblingCategory.id });
                const defaultSiblingSubCategory = { id: getDefaultSubCategoryId(siblingCategory.id), className: CLASS_NAME_SubCategory };

                return {
                  category,
                  elementsModel,
                  defaultSubCategory,
                  element,
                  modeledElement,
                  subModel,
                  subModelCategory,
                  subModelElement,
                  subModelElement2,
                  defaultSubCategoryOfSubModelCategory,
                  otherSubModelCategory,
                  otherSubModelElement,
                  defaultSubCategoryOfOtherSubModelCategory,
                  siblingCategory,
                  siblingElement,
                  defaultSiblingSubCategory,
                  searchPaths: [
                    {
                      identifier: category,
                      children: [
                        {
                          identifier: modeledElement,
                          children: [{ identifier: subModel, children: [{ identifier: subModelCategory, children: [{ identifier: subModelElement }] }] }],
                        },
                      ],
                    },
                  ],
                };
              }),
            );
          }

          beforeAll(async () => {
            createIModelResult = await createIModel();
            accessAndCache = createAccessAndCache({ imodelConnection: createIModelResult.imodelConnection, viewType });
          });

          beforeEach(async function () {
            visibilityTestData = await createFilteredVisibilityTestData({
              imodelConnection: createIModelResult.imodelConnection,
              searchPaths: createIModelResult.searchPaths,
              visibleByDefault: false,
              subCategoriesOfCategories: [
                { categoryId: createIModelResult.category.id, subCategories: createIModelResult.defaultSubCategory.id },
                { categoryId: createIModelResult.subModelCategory.id, subCategories: createIModelResult.defaultSubCategoryOfSubModelCategory.id },
                {
                  categoryId: createIModelResult.otherSubModelCategory.id,
                  subCategories: createIModelResult.defaultSubCategoryOfOtherSubModelCategory.id,
                },
                { categoryId: createIModelResult.siblingCategory.id, subCategories: createIModelResult.defaultSiblingSubCategory.id },
              ],
              imodelAccess: accessAndCache.imodelAccess,
              idsCache: accessAndCache.idsCache,
            });
          });

          afterEach(() => {
            visibilityTestData[Symbol.dispose]();
          });

          afterAll(async () => {
            await createIModelResult.imodelConnection.close();
          });

          it("showing category changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const {
              category,
              modeledElement,
              subModel,
              subModelCategory,
              subModelElement,
              siblingCategory,
              siblingElement,
              element,
              subModelElement2,
              otherSubModelCategory,
              otherSubModelElement,
            } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createCategoryHierarchyNode({
                id: category.id,
                search: {
                  isSearchTarget: false,
                  childrenTargetPaths: [
                    {
                      identifier: modeledElement,
                      children: [{ identifier: subModel, children: [{ identifier: subModelCategory, children: [{ identifier: subModelElement }] }] }],
                    },
                  ],
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
                  [element.id]: "hidden",

                  [modeledElement.id]: "partial",
                    [`${subModel.id}-${subModelCategory.id}`]: "partial",
                      [subModelElement.id]: "visible",
                      [subModelElement2.id]: "hidden",
                    [`${subModel.id}-${otherSubModelCategory.id}`]: "hidden",
                      [otherSubModelElement.id]: "hidden",

                [otherSubModelCategory.id]: "hidden",

                [siblingCategory.id]: "hidden",
                  [siblingElement.id]: "hidden",

                [subModelCategory.id]: "hidden",
              },
            });
          });

          it("showing modeled element changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const {
              category,
              modeledElement,
              subModel,
              subModelCategory,
              subModelElement,
              siblingCategory,
              siblingElement,
              element,
              subModelElement2,
              otherSubModelCategory,
              otherSubModelElement,
              elementsModel,
            } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createElementHierarchyNode({
                elementId: modeledElement.id,
                categoryId: category.id,
                parentKeys: [category],
                modelId: elementsModel.id,
                search: {
                  isSearchTarget: false,
                  childrenTargetPaths: [{ identifier: subModel, children: [{ identifier: subModelCategory, children: [{ identifier: subModelElement }] }] }],
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
                  [element.id]: "hidden",

                  [modeledElement.id]: "partial",
                    [`${subModel.id}-${subModelCategory.id}`]: "partial",
                      [subModelElement.id]: "visible",
                      [subModelElement2.id]: "hidden",
                    [`${subModel.id}-${otherSubModelCategory.id}`]: "hidden",
                      [otherSubModelElement.id]: "hidden",

                [otherSubModelCategory.id]: "hidden",

                [siblingCategory.id]: "hidden",
                  [siblingElement.id]: "hidden",

                [subModelCategory.id]: "hidden",
              },
            });
          });

          it("showing category of subModel changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const {
              category,
              modeledElement,
              subModel,
              subModelCategory,
              subModelElement,
              siblingCategory,
              siblingElement,
              element,
              subModelElement2,
              otherSubModelCategory,
              otherSubModelElement,
            } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createCategoryHierarchyNode({
                id: subModelCategory.id,
                parentKeys: [category, modeledElement, subModel],
                modelIds: [subModel.id],
                search: {
                  isSearchTarget: false,
                  childrenTargetPaths: [{ identifier: subModelElement }],
                },
              }),
              true,
            );
            // In this case when turning on subModelCategory, only subModelElement is put into always drawn list (due to search paths).
            // Because subModelElement and subModelCategory visibility is not affected by visibility of nodes above them (in hierarchy),
            // visibility handler does not change the visibility of modeledElement or category (They get partial visibility because their subModels are visible, but they themselves are not).
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
                  [element.id]: "hidden",

                  [modeledElement.id]: "partial",
                    [`${subModel.id}-${subModelCategory.id}`]: "partial",
                      [subModelElement.id]: "visible",
                      [subModelElement2.id]: "hidden",
                    [`${subModel.id}-${otherSubModelCategory.id}`]: "hidden",
                      [otherSubModelElement.id]: "hidden",

                [otherSubModelCategory.id]: "hidden",

                [siblingCategory.id]: "hidden",
                  [siblingElement.id]: "hidden",

                [subModelCategory.id]: "hidden",
              },
            });
          });

          it("showing search target subModel element changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const {
              category,
              modeledElement,
              subModel,
              subModelCategory,
              subModelElement,
              siblingCategory,
              siblingElement,
              element,
              subModelElement2,
              otherSubModelCategory,
              otherSubModelElement,
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

            // In this case when turning on subModelElement visibility, it is put into always drawn list.
            // Because subModelElement and subModelCategory visibility is not affected by visibility of nodes above them (in hierarchy),
            // visibility handler does not change the visibility of modeledElement or category (They get partial visibility because their subModels are visible, but they themselves are not).
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
                  [element.id]: "hidden",

                  [modeledElement.id]: "partial",
                    [`${subModel.id}-${subModelCategory.id}`]: "partial",
                      [subModelElement.id]: "visible",
                      [subModelElement2.id]: "hidden",
                    [`${subModel.id}-${otherSubModelCategory.id}`]: "hidden",
                      [otherSubModelElement.id]: "hidden",

                [otherSubModelCategory.id]: "hidden",

                [siblingCategory.id]: "hidden",
                  [siblingElement.id]: "hidden",

                [subModelCategory.id]: "hidden",
              },
            });
          });
        });

        describe("category under definition container hierarchy", () => {
          let createIModelResult: Awaited<ReturnType<typeof createIModel>>;
          let visibilityTestData: Awaited<ReturnType<typeof createFilteredVisibilityTestData>>;
          let accessAndCache: ReturnType<typeof createAccessAndCache>;
          async function createIModel() {
            return buildIModel(async (imodel) =>
              withEditTxn(imodel, (txn) => {
                const definitionContainer = insertDefinitionContainer({ txn, codeValue: "dc" });
                const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

                const category = insertCategory({ txn, codeValue: "cat", modelId: definitionModel.id });
                const defaultSubCategory = { id: getDefaultSubCategoryId(category.id), className: CLASS_NAME_SubCategory };
                const subCategory = insertSubCategory({
                  txn,
                  parentCategoryId: category.id,
                  codeValue: "subCat",
                  modelId: definitionModel.id,
                });

                const siblingCategory = insertCategory({ txn, codeValue: "sibling cat", modelId: definitionModel.id });
                const defaultSiblingSubCategory = { id: getDefaultSubCategoryId(siblingCategory.id), className: CLASS_NAME_SubCategory };

                return {
                  definitionContainer,
                  category,
                  defaultSubCategory,
                  subCategory,
                  siblingCategory,
                  defaultSiblingSubCategory,
                  searchPaths: [{ identifier: definitionContainer, children: [{ identifier: category, children: [{ identifier: defaultSubCategory }] }] }],
                };
              }),
            );
          }

          beforeAll(async () => {
            createIModelResult = await createIModel();
            accessAndCache = createAccessAndCache({ imodelConnection: createIModelResult.imodelConnection, viewType });
          });

          beforeEach(async function () {
            visibilityTestData = await createFilteredVisibilityTestData({
              imodelConnection: createIModelResult.imodelConnection,
              searchPaths: createIModelResult.searchPaths,
              visibleByDefault: false,
              subCategoriesOfCategories: [
                { categoryId: createIModelResult.category.id, subCategories: [createIModelResult.subCategory.id, createIModelResult.defaultSubCategory.id] },
                { categoryId: createIModelResult.siblingCategory.id, subCategories: createIModelResult.defaultSiblingSubCategory.id },
              ],
              imodelAccess: accessAndCache.imodelAccess,
              idsCache: accessAndCache.idsCache,
            });
          });

          afterEach(() => {
            visibilityTestData[Symbol.dispose]();
          });

          afterAll(async () => {
            await createIModelResult.imodelConnection.close();
          });

          it("showing definition container changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const { definitionContainer, category, siblingCategory, defaultSubCategory, subCategory } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createDefinitionContainerHierarchyNode({
                id: definitionContainer.id,
                search: {
                  isSearchTarget: false,
                  childrenTargetPaths: [{ identifier: category, children: [{ identifier: defaultSubCategory }] }],
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
              },
            });
          });

          it("showing category changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const { definitionContainer, category, siblingCategory, defaultSubCategory, subCategory } = createIModelResult;
            await visibilityHandlerWithSearchPaths.changeVisibility(
              createCategoryHierarchyNode({
                id: category.id,
                parentKeys: [definitionContainer],
                search: {
                  isSearchTarget: false,
                  childrenTargetPaths: [{ identifier: defaultSubCategory }],
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
              },
            });
          });

          it("showing search target sub-category changes visibility for related nodes in search paths", async () => {
            const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
            const { definitionContainer, category, siblingCategory, defaultSubCategory, subCategory } = createIModelResult;
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
              },
            });
          });
        });
      });
    });
  });
});
