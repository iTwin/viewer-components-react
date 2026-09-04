/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { HierarchyCacheMode, initializeCore, insertDefinitionContainer, insertSubCategory, insertSubModel, terminateCore } from "test-utilities";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { withEditTxn } from "@itwin/core-backend";
import { IModel, IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { BaseIdsCache } from "../../../tree-widget-react/shared/internal/caches/BaseIdsCache.js";
import { CLASS_NAME_DefinitionModel } from "../../../tree-widget-react/shared/internal/ClassNameDefinitions.js";
import { getClassesByView, mergeWithDefaults } from "../../../tree-widget-react/shared/internal/Utils.js";
import { CategoriesTreeDefinition, defaultHierarchyConfiguration } from "../../../tree-widget-react/trees/categories-tree/CategoriesTreeDefinition.js";
import { CategoriesTreeIdsCache } from "../../../tree-widget-react/trees/categories-tree/internal/CategoriesTreeIdsCache.js";
import { buildIModel, TestSchema } from "../../IModelUtils.js";
import { createIModelAccess } from "../Common.js";
import { NodeValidators, validateHierarchy } from "../HierarchyValidation.js";
import { getInsertFunctionByViewType } from "./internal/Utils.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchyProvider } from "@itwin/presentation-hierarchies";
import type { EC } from "@itwin/presentation-shared";
import type { CategoriesTreeHierarchyConfiguration } from "../../../tree-widget-react/trees/categories-tree/CategoriesTreeDefinition.js";

describe("Categories tree", () => {
  describe("Hierarchy definition", () => {
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
      // eslint-disable-next-line @itwin/no-internal
      ECSchemaRpcImpl.register();
    });

    afterAll(async () => {
      await terminateCore();
    });

    ["2d" as const, "3d" as const].forEach((viewType) => {
      describe(`${viewType} view`, () => {
        const { insertCategory, insertElement, insertElementsModel, insertElementsSubModel, insertModeledElement } = getInsertFunctionByViewType(viewType);
        it("does not show private categories", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const elementsModel = insertElementsModel({ txn, codeValue: "m" });

              const category = insertCategory({ txn, codeValue: "cat" });
              insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });

              const privateCategory = insertCategory({ txn, codeValue: "private cat", isPrivate: true });
              insertElement({ txn, modelId: elementsModel.id, categoryId: privateCategory.id });

              return { category, privateCategory };
            }),
          );

          const { imodelConnection, ...keys } = buildIModelResult;
          using provider = createCategoryTreeProvider(imodelConnection, viewType);

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

        it("does not show definition container when it doesn't contain category", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const elementsModel = insertElementsModel({ txn, codeValue: "m" });
              const definitionContainer = insertDefinitionContainer({ txn, codeValue: "dc" });
              insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

              const category = insertCategory({ txn, codeValue: "cat" });

              insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });

              return { category };
            }),
          );

          const { imodelConnection, ...keys } = buildIModelResult;
          using provider = createCategoryTreeProvider(imodelConnection, viewType);

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

        it("does not show definition container when it contains definition container without categories", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              insertElementsModel({ txn, codeValue: "m" });
              const definitionContainer = insertDefinitionContainer({ txn, codeValue: "dc" });
              const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
              const definitionContainerChild = insertDefinitionContainer({ txn, codeValue: "child dc", modelId: definitionModel.id });
              insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
            }),
          );

          const { imodelConnection } = buildIModelResult;
          using provider = createCategoryTreeProvider(imodelConnection, viewType);

          await validateHierarchy({
            provider,
            expect: [],
          });
        });

        it("does not show definition container or category when category is private", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const elementsModel = insertElementsModel({ txn, codeValue: "m" });
              const definitionContainer = insertDefinitionContainer({ txn, codeValue: "dc" });
              const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

              const category = insertCategory({ txn, codeValue: "cat", modelId: definitionModel.id, isPrivate: true });

              insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
            }),
          );

          const { imodelConnection } = buildIModelResult;
          using provider = createCategoryTreeProvider(imodelConnection, viewType);

          await validateHierarchy({
            provider,
            expect: [],
          });
        });

        it("does not show definition container or category when category does not have elements", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const elementsModel = insertElementsModel({ txn, codeValue: "m" });
              const definitionContainer = insertDefinitionContainer({ txn, codeValue: "dc" });
              const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

              insertCategory({ txn, codeValue: "cat1", modelId: definitionModel.id });
              const category = insertCategory({ txn, codeValue: "cat" });

              insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
              return { category };
            }),
          );

          const { imodelConnection, ...keys } = buildIModelResult;
          using provider = createCategoryTreeProvider(imodelConnection, viewType);

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

        it("shows definition container and category when category does not have elements and categories.withoutElements is set to 'include'", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const elementsModel = insertElementsModel({ txn, codeValue: "m" });
              const definitionContainer = insertDefinitionContainer({ txn, codeValue: "dc" });
              const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

              const emptyCategory = insertCategory({ txn, codeValue: "cat1", modelId: definitionModel.id });
              const category = insertCategory({ txn, codeValue: "cat" });

              insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
              return { category, emptyCategory, definitionContainer };
            }),
          );

          const { imodelConnection, ...keys } = buildIModelResult;
          using provider = createCategoryTreeProvider(imodelConnection, viewType, { categories: { withoutElements: "include" } });

          await validateHierarchy({
            provider,
            expect: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.category],
                supportsFiltering: true,
                children: false,
              }),
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
            ],
          });
        });

        it("does not show definition container or category when definition container is private", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const elementsModel = insertElementsModel({ txn, codeValue: "m" });
              const definitionContainer = insertDefinitionContainer({ txn, codeValue: "dc", isPrivate: true });
              const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

              const category = insertCategory({ txn, codeValue: "cat", modelId: definitionModel.id });

              insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
            }),
          );

          const { imodelConnection } = buildIModelResult;
          using provider = createCategoryTreeProvider(imodelConnection, viewType);

          await validateHierarchy({
            provider,
            expect: [],
          });
        });

        it("does not show definition containers or categories when definition container contains another definition container that is private", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const elementsModel = insertElementsModel({ txn, codeValue: "m" });
              const definitionContainer = insertDefinitionContainer({ txn, codeValue: "dc" });
              const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
              const definitionContainerChild = insertDefinitionContainer({
                txn,
                codeValue: "child dc",
                isPrivate: true,
                modelId: definitionModel.id,
              });
              const definitionModelChild = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });

              const category = insertCategory({ txn, codeValue: "cat", modelId: definitionModelChild.id });

              insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
            }),
          );

          const { imodelConnection } = buildIModelResult;
          using provider = createCategoryTreeProvider(imodelConnection, viewType);

          await validateHierarchy({
            provider,
            expect: [],
          });
        });

        it("shows definition container when it contains category", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const elementsModel = insertElementsModel({ txn, codeValue: "m" });
              const definitionContainer = insertDefinitionContainer({ txn, codeValue: "dc" });
              const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

              const category = insertCategory({ txn, codeValue: "cat", modelId: definitionModel.id });

              insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });

              return { definitionContainer, category };
            }),
          );

          const { imodelConnection, ...keys } = buildIModelResult;
          using provider = createCategoryTreeProvider(imodelConnection, viewType);

          await validateHierarchy({
            provider,
            expect: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.definitionContainer],
                supportsFiltering: true,
                children: [
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.category],
                    label: "cat",
                    children: false,
                  }),
                ],
              }),
            ],
          });
        });

        it("shows definition container once when it contains multiple categories and elements", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const elementsModel = insertElementsModel({ txn, codeValue: "m" });
              const definitionContainer = insertDefinitionContainer({ txn, codeValue: "dc" });
              const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
              const category1 = insertCategory({ txn, codeValue: "cat1", modelId: definitionModel.id });
              const category2 = insertCategory({ txn, codeValue: "cat2", modelId: definitionModel.id });

              insertElement({ txn, modelId: elementsModel.id, categoryId: category1.id });
              insertElement({ txn, modelId: elementsModel.id, categoryId: category1.id });
              insertElement({ txn, modelId: elementsModel.id, categoryId: category2.id });

              return { definitionContainer, category1, category2 };
            }),
          );

          const { imodelConnection, ...keys } = buildIModelResult;
          using provider = createCategoryTreeProvider(imodelConnection, viewType);

          await validateHierarchy({
            provider,
            expect: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.definitionContainer],
                supportsFiltering: true,
                children: [
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.category1],
                    children: false,
                  }),
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.category2],
                    children: false,
                  }),
                ],
              }),
            ],
          });
        });

        it("shows element when 'elements' is set to 'include'", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const elementsModel = insertElementsModel({ txn, codeValue: "m" });
              const definitionContainer = insertDefinitionContainer({ txn, codeValue: "dc" });
              const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

              const category = insertCategory({ txn, codeValue: "cat", modelId: definitionModel.id });

              const element = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });

              return { definitionContainer, category, element };
            }),
          );

          const { imodelConnection, ...keys } = buildIModelResult;
          using provider = createCategoryTreeProvider(imodelConnection, viewType, { elements: { nodes: "include" } });

          await validateHierarchy({
            provider,
            expect: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.definitionContainer],
                supportsFiltering: true,
                children: [
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.category],
                    label: "cat",
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

        it("shows element and subCategories when elements is set to 'include'", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const elementsModel = insertElementsModel({ txn, codeValue: "m" });
              const definitionContainer = insertDefinitionContainer({ txn, codeValue: "dc" });
              const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

              const category = insertCategory({ txn, codeValue: "cat", modelId: definitionModel.id });

              const element = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
              const subCategory = insertSubCategory({ txn, parentCategoryId: category.id, codeValue: "subCat", modelId: definitionModel.id });

              return { definitionContainer, category, element, subCategory };
            }),
          );

          const { imodelConnection, ...keys } = buildIModelResult;
          using provider = createCategoryTreeProvider(imodelConnection, viewType, { elements: { nodes: "include" } });

          await validateHierarchy({
            provider,
            expect: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.definitionContainer],
                supportsFiltering: true,
                children: [
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.category],
                    label: "cat",
                    children: [
                      NodeValidators.createForInstanceNode({
                        label: "cat",
                        children: false,
                      }),
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

        it("shows element and hides subCategories when elements is set to 'include' and subCategories is set to 'exclude'", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const elementsModel = insertElementsModel({ txn, codeValue: "m" });
              const definitionContainer = insertDefinitionContainer({ txn, codeValue: "dc" });
              const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

              const category = insertCategory({ txn, codeValue: "cat", modelId: definitionModel.id });

              const element = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
              const subCategory = insertSubCategory({ txn, parentCategoryId: category.id, codeValue: "subCat", modelId: definitionModel.id });

              return { definitionContainer, category, element, subCategory };
            }),
          );

          const { imodelConnection, ...keys } = buildIModelResult;
          using provider = createCategoryTreeProvider(imodelConnection, viewType, { elements: { nodes: "include" }, subCategories: { nodes: "exclude" } });

          await validateHierarchy({
            provider,
            expect: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.definitionContainer],
                supportsFiltering: true,
                children: [
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.category],
                    label: "cat",
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

        it("shows all definition containers when they contain category directly or indirectly", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const elementsModel = insertElementsModel({ txn, codeValue: "m" });
              const definitionContainer = insertDefinitionContainer({ txn, codeValue: "dc" });
              const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
              const definitionContainerChild = insertDefinitionContainer({ txn, codeValue: "child dc", modelId: definitionModel.id });
              const definitionModelChild = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });

              const category = insertCategory({ txn, codeValue: "cat", modelId: definitionModelChild.id });

              insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });

              return { definitionContainer, definitionContainerChild, category };
            }),
          );

          const { imodelConnection, ...keys } = buildIModelResult;
          using provider = createCategoryTreeProvider(imodelConnection, viewType);

          await validateHierarchy({
            provider,
            expect: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.definitionContainer],
                supportsFiltering: true,
                children: [
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.definitionContainerChild],
                    label: "child dc",
                    children: [
                      NodeValidators.createForInstanceNode({
                        instanceKeys: [keys.category],
                        label: "cat",
                        children: false,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          });
        });

        it("shows root categories and definition container", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const elementsModel = insertElementsModel({ txn, codeValue: "m" });
              const definitionContainer = insertDefinitionContainer({ txn, codeValue: "dc" });
              const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });

              const category = insertCategory({ txn, codeValue: "cat" });
              const childCategory = insertCategory({ txn, codeValue: "ScChild", modelId: definitionModel.id });

              insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
              insertElement({ txn, modelId: elementsModel.id, categoryId: childCategory.id });

              return { category, definitionContainer, childCategory };
            }),
          );

          const { imodelConnection, ...keys } = buildIModelResult;
          using provider = createCategoryTreeProvider(imodelConnection, viewType);

          await validateHierarchy({
            provider,
            expect: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.category],
                supportsFiltering: true,
                children: false,
              }),
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
            ],
          });
        });

        it("does not show private subCategories", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const elementsModel = insertElementsModel({ txn, codeValue: "m" });

              const category = insertCategory({ txn, codeValue: "cat" });
              insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });

              const subCategory = insertSubCategory({ txn, parentCategoryId: category.id, codeValue: "subCat" });
              const privateSubCategory = insertSubCategory({ txn, parentCategoryId: category.id, codeValue: "private subCat", isPrivate: true });

              return { category, subCategory, privateSubCategory };
            }),
          );

          const { imodelConnection, ...keys } = buildIModelResult;
          using provider = createCategoryTreeProvider(imodelConnection, viewType);

          await validateHierarchy({
            provider,
            expect: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.category],
                supportsFiltering: true,
                children: [
                  NodeValidators.createForInstanceNode({
                    label: "cat",
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

        describe("Intermediate categories", () => {
          it("does not show intermediate category when child element has same category as parent", async () => {
            await using buildIModelResult = await buildIModel(async (imodel) =>
              withEditTxn(imodel, (txn) => {
                const elementsModel = insertElementsModel({ txn, codeValue: "m" });
                const category = insertCategory({ txn, codeValue: "cat" });
                const parentElement = insertElement({ txn, userLabel: "parent el", modelId: elementsModel.id, categoryId: category.id });
                const childElement = insertElement({
                  txn,
                  userLabel: "child element",
                  modelId: elementsModel.id,
                  categoryId: category.id,
                  parentId: parentElement.id,
                });
                return { category, parentElement, childElement };
              }),
            );

            const { imodelConnection, ...keys } = buildIModelResult;
            using provider = createCategoryTreeProvider(imodelConnection, viewType, { elements: { nodes: "include" } });

            await validateHierarchy({
              provider,
              expect: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.category],
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.parentElement.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.parentElement],
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              className: keys.childElement.className,
                              children: [
                                NodeValidators.createForInstanceNode({
                                  instanceKeys: [keys.childElement],
                                  children: false,
                                }),
                              ],
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

          it("shows intermediate category when child element has different category than parent", async () => {
            await using buildIModelResult = await buildIModel(async (imodel) =>
              withEditTxn(imodel, (txn) => {
                const elementsModel = insertElementsModel({ txn, codeValue: "m" });
                const categoryA = insertCategory({ txn, codeValue: "cat A" });
                const categoryB = insertCategory({ txn, codeValue: "cat B" });
                const parentElement = insertElement({ txn, userLabel: "parent el", modelId: elementsModel.id, categoryId: categoryA.id });
                const childElement = insertElement({
                  txn,
                  userLabel: "child element",
                  modelId: elementsModel.id,
                  categoryId: categoryB.id,
                  parentId: parentElement.id,
                });
                return { categoryA, categoryB, parentElement, childElement };
              }),
            );

            const { imodelConnection, ...keys } = buildIModelResult;
            using provider = createCategoryTreeProvider(imodelConnection, viewType, { elements: { nodes: "include" } });

            await validateHierarchy({
              provider,
              expect: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.categoryA],
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.parentElement.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.parentElement],
                          children: [
                            NodeValidators.createForInstanceNode({
                              instanceKeys: [keys.categoryB],
                              children: [
                                NodeValidators.createForClassGroupingNode({
                                  className: keys.childElement.className,
                                  children: [
                                    NodeValidators.createForInstanceNode({
                                      instanceKeys: [keys.childElement],
                                      children: false,
                                    }),
                                  ],
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.categoryB],
                  children: false,
                }),
              ],
            });
          });

          it("does not show intermediate category when modeling element has the same category as modeled element", async () => {
            await using buildIModelResult = await buildIModel(async (imodel) =>
              withEditTxn(imodel, (txn) => {
                const elementsModel = insertElementsModel({ txn, codeValue: "m" });
                const categoryA = insertCategory({ txn, codeValue: "cat A" });
                const modeledElement = insertModeledElement({
                  txn,
                  modelId: elementsModel.id,
                  categoryId: categoryA.id,
                });
                const subModel = insertElementsSubModel({ txn, modeledElementId: modeledElement.id });
                const modelingElement = insertElement({
                  txn,
                  modelId: subModel.id,
                  categoryId: categoryA.id,
                });
                return { categoryA, modeledElement, modelingElement };
              }),
            );

            const { imodelConnection, ...keys } = buildIModelResult;
            using provider = createCategoryTreeProvider(imodelConnection, viewType, { elements: { nodes: "include" } });

            await validateHierarchy({
              provider,
              expect: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.categoryA],
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.modeledElement.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.modeledElement],
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              className: keys.modelingElement.className,
                              children: [
                                NodeValidators.createForInstanceNode({
                                  instanceKeys: [keys.modelingElement],
                                  children: false,
                                }),
                              ],
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

          it("shows intermediate category when modeling element has different category than modeled element", async () => {
            await using buildIModelResult = await buildIModel(async (imodel) =>
              withEditTxn(imodel, (txn) => {
                const elementsModel = insertElementsModel({ txn, codeValue: "m" });
                const categoryA = insertCategory({ txn, codeValue: "cat A" });
                const categoryB = insertCategory({ txn, codeValue: "cat B" });
                const modeledElement = insertModeledElement({
                  txn,
                  userLabel: "modeled element",
                  modelId: elementsModel.id,
                  categoryId: categoryA.id,
                });
                const subModel = insertElementsSubModel({ txn, modeledElementId: modeledElement.id });
                const modelingElement = insertElement({
                  txn,
                  userLabel: "modeling element",
                  modelId: subModel.id,
                  categoryId: categoryB.id,
                });
                return { categoryA, categoryB, modeledElement, modelingElement };
              }),
            );

            const { imodelConnection, ...keys } = buildIModelResult;
            using provider = createCategoryTreeProvider(imodelConnection, viewType, { elements: { nodes: "include" } });

            await validateHierarchy({
              provider,
              expect: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.categoryA],
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.modeledElement.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.modeledElement],
                          children: [
                            NodeValidators.createForInstanceNode({
                              instanceKeys: [keys.categoryB],
                              children: [
                                NodeValidators.createForClassGroupingNode({
                                  className: keys.modelingElement.className,
                                  children: [
                                    NodeValidators.createForInstanceNode({
                                      instanceKeys: [keys.modelingElement],
                                      children: false,
                                    }),
                                  ],
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.categoryB],
                  children: false,
                }),
              ],
            });
          });

          it("shows intermediate category for deeply nested elements with different categories", async () => {
            await using buildIModelResult = await buildIModel(async (imodel) =>
              withEditTxn(imodel, (txn) => {
                const elementsModel = insertElementsModel({ txn, codeValue: "m" });
                const categoryA = insertCategory({ txn, codeValue: "cat A" });
                const categoryB = insertCategory({ txn, codeValue: "cat B" });
                const parentElement = insertElement({ txn, userLabel: "parent el", modelId: elementsModel.id, categoryId: categoryA.id });
                const childElement = insertElement({
                  txn,
                  userLabel: "child element",
                  modelId: elementsModel.id,
                  categoryId: categoryB.id,
                  parentId: parentElement.id,
                });
                const grandchildElement = insertElement({
                  txn,
                  userLabel: "grandchild element",
                  modelId: elementsModel.id,
                  categoryId: categoryA.id,
                  parentId: childElement.id,
                });
                return { categoryA, categoryB, parentElement, childElement, grandchildElement };
              }),
            );

            const { imodelConnection, ...keys } = buildIModelResult;
            using provider = createCategoryTreeProvider(imodelConnection, viewType, { elements: { nodes: "include" } });

            await validateHierarchy({
              provider,
              expect: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.categoryA],
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.parentElement.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.parentElement],
                          children: [
                            NodeValidators.createForInstanceNode({
                              instanceKeys: [keys.categoryB],
                              children: [
                                NodeValidators.createForClassGroupingNode({
                                  className: keys.childElement.className,
                                  children: [
                                    NodeValidators.createForInstanceNode({
                                      instanceKeys: [keys.childElement],
                                      children: [
                                        NodeValidators.createForInstanceNode({
                                          instanceKeys: [keys.categoryA],
                                          children: [
                                            NodeValidators.createForClassGroupingNode({
                                              className: keys.grandchildElement.className,
                                              children: [
                                                NodeValidators.createForInstanceNode({
                                                  instanceKeys: [keys.grandchildElement],
                                                  children: false,
                                                }),
                                              ],
                                            }),
                                          ],
                                        }),
                                      ],
                                    }),
                                  ],
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.categoryB],
                  children: false,
                }),
              ],
            });
          });
        });

        describe("elements.excludedClasses", () => {
          const elementClassName: EC.FullClassNameDotNotation = viewType === "3d" ? "Generic.PhysicalObject" : "BisCore.DrawingGraphic";
          const modeledElementClassName: EC.FullClassNameDotNotation = `${TestSchema.Name}.${viewType === "3d" ? TestSchema.ModeledElement3dClassName : TestSchema.ModeledElement2dClassName}`;
          const unrelatedElementClassName: EC.FullClassNameDotNotation = viewType === "3d" ? "BisCore.GeometricElement2d" : "BisCore.GeometricElement3d";
          const subModeledElementBaseClassName: EC.FullClassNameDotNotation = "BisCore.ISubModeledElement";
          it("does not filter out elements when they don't belong to any of the excluded classes", async () => {
            await using buildIModelResult = await buildIModel(async (imodel) =>
              withEditTxn(imodel, (txn) => {
                const elementsModel = insertElementsModel({ txn, codeValue: "m" });
                const category = insertCategory({ txn, codeValue: "cat" });
                const element = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
                return { category, element };
              }),
            );

            const { imodelConnection, ...keys } = buildIModelResult;
            using provider = createCategoryTreeProvider(imodelConnection, viewType, {
              elements: { nodes: "include", excludedClasses: [unrelatedElementClassName] },
            });

            await validateHierarchy({
              provider,
              expect: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.category],
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
            });
          });

          describe("root elements of excluded classes", () => {
            it("filters out elements of excluded classes", async () => {
              await using buildIModelResult = await buildIModel(async (imodel) =>
                withEditTxn(imodel, (txn) => {
                  const elementsModel = insertElementsModel({ txn, codeValue: "m" });
                  const category = insertCategory({ txn, codeValue: "cat" });
                  const keptElement = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
                  insertModeledElement({
                    txn,
                    modelId: elementsModel.id,
                    categoryId: category.id,
                  });
                  return { category, keptElement };
                }),
              );

              const { imodelConnection, ...keys } = buildIModelResult;
              using provider = createCategoryTreeProvider(imodelConnection, viewType, {
                elements: { nodes: "include", excludedClasses: [modeledElementClassName] },
              });

              await validateHierarchy({
                provider,
                expect: [
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.category],
                    children: [
                      NodeValidators.createForClassGroupingNode({
                        className: keys.keptElement.className,
                        children: [
                          NodeValidators.createForInstanceNode({
                            instanceKeys: [keys.keptElement],
                            children: false,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              });
            });

            it("filters out elements of classes derived from excluded classes", async () => {
              await using buildIModelResult = await buildIModel(async (imodel) =>
                withEditTxn(imodel, (txn) => {
                  const elementsModel = insertElementsModel({ txn, codeValue: "m" });
                  const category = insertCategory({ txn, codeValue: "cat" });
                  insertModeledElement({
                    txn,
                    modelId: elementsModel.id,
                    categoryId: category.id,
                  });
                  const keptElement = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
                  return { category, keptElement };
                }),
              );

              const { imodelConnection, ...keys } = buildIModelResult;
              using provider = createCategoryTreeProvider(imodelConnection, viewType, {
                elements: { nodes: "include", excludedClasses: [subModeledElementBaseClassName] },
              });

              await validateHierarchy({
                provider,
                expect: [
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.category],
                    children: [
                      NodeValidators.createForClassGroupingNode({
                        className: keys.keptElement.className,
                        children: [
                          NodeValidators.createForInstanceNode({
                            instanceKeys: [keys.keptElement],
                            children: false,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              });
            });

            it("shows category when it contains only excluded elements", async () => {
              await using buildIModelResult = await buildIModel(async (imodel) =>
                withEditTxn(imodel, (txn) => {
                  const definitionContainer = insertDefinitionContainer({ txn, codeValue: "dc" });
                  const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
                  const elementsModel = insertElementsModel({ txn, codeValue: "m" });
                  const category = insertCategory({ txn, codeValue: "cat", modelId: definitionModel.id });
                  insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
                  return { category, definitionContainer };
                }),
              );

              const { imodelConnection, ...keys } = buildIModelResult;
              using provider = createCategoryTreeProvider(imodelConnection, viewType, {
                elements: { nodes: "include", excludedClasses: [elementClassName] },
              });

              await validateHierarchy({
                provider,
                expect: [
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.definitionContainer],
                    children: [
                      NodeValidators.createForInstanceNode({
                        instanceKeys: [keys.category],
                        children: false,
                      }),
                    ],
                  }),
                ],
              });
            });
          });

          describe("child elements of excluded classes", () => {
            it("sets hasChildren to false when parent contains only excluded child elements", async () => {
              await using buildIModelResult = await buildIModel(async (imodel) =>
                withEditTxn(imodel, (txn) => {
                  const elementsModel = insertElementsModel({ txn, codeValue: "m" });
                  const category = insertCategory({ txn, codeValue: "cat" });
                  const excludedChildCategory = insertCategory({ txn, codeValue: "excluded child category" });
                  const parentElement = insertElement({ txn, userLabel: "parent el", modelId: elementsModel.id, categoryId: category.id });
                  insertModeledElement({
                    txn,
                    userLabel: "excluded child element",
                    modelId: elementsModel.id,
                    categoryId: excludedChildCategory.id,
                    parentId: parentElement.id,
                  });
                  return { category, parentElement, excludedChildCategory };
                }),
              );

              const { imodelConnection, ...keys } = buildIModelResult;
              using provider = createCategoryTreeProvider(imodelConnection, viewType, {
                elements: { nodes: "include", excludedClasses: [modeledElementClassName] },
              });

              await validateHierarchy({
                provider,
                expect: [
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.category],
                    children: [
                      NodeValidators.createForClassGroupingNode({
                        className: keys.parentElement.className,
                        children: [
                          NodeValidators.createForInstanceNode({
                            instanceKeys: [keys.parentElement],
                            children: false,
                          }),
                        ],
                      }),
                    ],
                  }),
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.excludedChildCategory],
                    children: false,
                  }),
                ],
              });
            });

            it("filters out child of excluded classes and their categories", async () => {
              await using buildIModelResult = await buildIModel(async (imodel) =>
                withEditTxn(imodel, (txn) => {
                  const elementsModel = insertElementsModel({ txn, codeValue: "m" });
                  const category = insertCategory({ txn, codeValue: "cat" });
                  const excludedChildCategory = insertCategory({ txn, codeValue: "excluded child cat" });
                  const childCategory = insertCategory({ txn, codeValue: "child cat" });
                  const parentElement = insertElement({ txn, userLabel: "parent el", modelId: elementsModel.id, categoryId: category.id });
                  insertModeledElement({
                    txn,
                    userLabel: "excluded child element",
                    modelId: elementsModel.id,
                    categoryId: excludedChildCategory.id,
                    parentId: parentElement.id,
                  });
                  const childElement = insertElement({
                    txn,
                    userLabel: "child element",
                    modelId: elementsModel.id,
                    categoryId: childCategory.id,
                    parentId: parentElement.id,
                  });
                  return { category, parentElement, childCategory, childElement, excludedChildCategory };
                }),
              );

              const { imodelConnection, ...keys } = buildIModelResult;
              using provider = createCategoryTreeProvider(imodelConnection, viewType, {
                elements: { nodes: "include", excludedClasses: [modeledElementClassName] },
              });

              await validateHierarchy({
                provider,
                expect: [
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.category],
                    children: [
                      NodeValidators.createForClassGroupingNode({
                        className: keys.parentElement.className,
                        children: [
                          NodeValidators.createForInstanceNode({
                            instanceKeys: [keys.parentElement],
                            children: [
                              NodeValidators.createForInstanceNode({
                                instanceKeys: [keys.childCategory],
                                children: [
                                  NodeValidators.createForClassGroupingNode({
                                    className: keys.childElement.className,
                                    children: [
                                      NodeValidators.createForInstanceNode({
                                        instanceKeys: [keys.childElement],
                                        children: false,
                                      }),
                                    ],
                                  }),
                                ],
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.childCategory],
                    children: false,
                  }),
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.excludedChildCategory],
                    children: false,
                  }),
                ],
              });
            });

            it("sets hasChildren to false when parent modeled element contains only excluded elements", async () => {
              await using buildIModelResult = await buildIModel(async (imodel) =>
                withEditTxn(imodel, (txn) => {
                  const elementsModel = insertElementsModel({ txn, codeValue: "m" });
                  const category = insertCategory({ txn, codeValue: "cat" });
                  const excludedChildCategory = insertCategory({ txn, codeValue: "excluded child category" });
                  const modeledElement = insertModeledElement({
                    txn,
                    userLabel: "modeled element",
                    modelId: elementsModel.id,
                    categoryId: category.id,
                  });
                  const subModel = insertElementsSubModel({ txn, modeledElementId: modeledElement.id });
                  insertElement({
                    txn,
                    userLabel: "excluded modeling element",
                    modelId: subModel.id,
                    categoryId: excludedChildCategory.id,
                  });
                  return { category, modeledElement, excludedChildCategory };
                }),
              );

              const { imodelConnection, ...keys } = buildIModelResult;
              using provider = createCategoryTreeProvider(imodelConnection, viewType, {
                elements: { nodes: "include", excludedClasses: [elementClassName] },
              });

              await validateHierarchy({
                provider,
                expect: [
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.category],
                    children: [
                      NodeValidators.createForClassGroupingNode({
                        className: keys.modeledElement.className,
                        children: [
                          NodeValidators.createForInstanceNode({
                            instanceKeys: [keys.modeledElement],
                            children: false,
                          }),
                        ],
                      }),
                    ],
                  }),
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.excludedChildCategory],
                    children: false,
                  }),
                ],
              });
            });

            it("filters out sub-model child elements of excluded classes and their categories", async () => {
              await using buildIModelResult = await buildIModel(async (imodel) =>
                withEditTxn(imodel, (txn) => {
                  const elementsModel = insertElementsModel({ txn, codeValue: "m" });
                  const category = insertCategory({ txn, codeValue: "cat" });
                  const excludedChildCategory = insertCategory({ txn, codeValue: "excluded child category" });
                  const childCategory = insertCategory({ txn, codeValue: "child category" });
                  const modeledElement = insertModeledElement({
                    txn,
                    userLabel: "modeled element",
                    modelId: elementsModel.id,
                    categoryId: category.id,
                  });
                  const subModel = insertElementsSubModel({ txn, modeledElementId: modeledElement.id });
                  insertElement({
                    txn,
                    userLabel: "excluded modeling element",
                    modelId: subModel.id,
                    categoryId: excludedChildCategory.id,
                  });
                  const childModeledElement = insertModeledElement({
                    txn,
                    userLabel: "child modeled element",
                    modelId: subModel.id,
                    categoryId: childCategory.id,
                  });
                  return { category, modeledElement, childCategory, childModeledElement, excludedChildCategory };
                }),
              );

              const { imodelConnection, ...keys } = buildIModelResult;
              using provider = createCategoryTreeProvider(imodelConnection, viewType, {
                elements: { nodes: "include", excludedClasses: [elementClassName] },
              });

              await validateHierarchy({
                provider,
                expect: [
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.category],
                    label: "cat",
                    children: [
                      NodeValidators.createForClassGroupingNode({
                        className: keys.modeledElement.className,
                        children: [
                          NodeValidators.createForInstanceNode({
                            instanceKeys: [keys.modeledElement],
                            children: [
                              NodeValidators.createForInstanceNode({
                                instanceKeys: [keys.childCategory],
                                children: [
                                  NodeValidators.createForClassGroupingNode({
                                    className: keys.childModeledElement.className,
                                    children: [
                                      NodeValidators.createForInstanceNode({
                                        instanceKeys: [keys.childModeledElement],
                                        children: false,
                                      }),
                                    ],
                                  }),
                                ],
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.childCategory],
                    children: false,
                  }),
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.excludedChildCategory],
                    children: false,
                  }),
                ],
              });
            });
          });
        });

        describe("createInstanceKeyPaths query interrupts handling", () => {
          let imodelConnection: IModelConnection;
          let dispose: () => Promise<void>;

          beforeAll(async () => {
            const buildIModelResult = await buildIModel(async (imodel) =>
              withEditTxn(imodel, (txn) => {
                const model = insertElementsModel({ txn, codeValue: "xModel" });
                const category1 = insertCategory({ txn, codeValue: "xCat1", modelId: IModel.dictionaryId });
                const subCategory1 = insertSubCategory({ txn, parentCategoryId: category1.id, codeValue: "xSubCat", modelId: IModel.dictionaryId });
                const category2 = insertCategory({ txn, codeValue: "xCat2", modelId: IModel.dictionaryId });
                const elementInCategory2 = insertElement({ txn, modelId: model.id, categoryId: category2.id, userLabel: "xEl" });
                return { model, category1, subCategory1, category2, elementInCategory2 };
              }),
            );
            imodelConnection = buildIModelResult.imodelConnection;
            dispose = async () => buildIModelResult[Symbol.asyncDispose]();
          });

          afterAll(async () => {
            await dispose();
          });

          [
            { queryIdentifier: "LIKE '%' || ? || '%'", description: "label filtering query" },
            { queryIdentifier: "FROM CategoriesElementsHierarchy mce", description: "elements' search paths query" },
          ].forEach(({ queryIdentifier, description }) => {
            it(`doesn't throw on ecsql query interrupt in ${description}`, async () => {
              const imodelAccess = createIModelAccess(imodelConnection);
              const baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, elementClassName: getClassesByView(viewType).elementClass, type: viewType });
              const idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: viewType, baseIdsCache });
              const iter = CategoriesTreeDefinition.createInstanceKeyPaths({
                imodelAccess,
                idsCache,
                viewType,
                hierarchyConfig: {
                  subCategories: { nodes: "include" },
                  categories: { withoutElements: "include" },
                  elements: { nodes: "include", excludedClasses: [] },
                },
                label: "x",
              });
              let didInterrupt = false;
              const originalQueryReader = imodelConnection.createQueryReader.bind(imodelConnection);
              vi.spyOn(imodelConnection, "createQueryReader").mockImplementation(async function* (...args): any {
                const [ecsql] = args;
                if (ecsql.includes(queryIdentifier)) {
                  didInterrupt = true;
                  const err = new Error(ecsql);
                  err.name = "BE_SQLITE_INTERRUPT";
                  throw err;
                }
                return yield* originalQueryReader(...args);
              });
              await expect(Array.fromAsync(iter)).resolves.toBeDefined();
              expect(didInterrupt).toBe(true);
            });
          });
        });
      });
    });
  });
});

function createCategoryTreeProvider(
  imodelConnection: IModelConnection,
  viewType: "2d" | "3d",
  hierarchyConfig?: CategoriesTreeHierarchyConfiguration,
): HierarchyProvider & Disposable {
  const imodelAccess = createIModelAccess(imodelConnection);
  const excludedElementClassNames = hierarchyConfig?.elements?.nodes === "include" ? hierarchyConfig.elements.excludedClasses : undefined;
  const baseIdsCache = new BaseIdsCache({
    queryExecutor: imodelAccess,
    elementClassName: getClassesByView(viewType).elementClass,
    type: viewType,
    excludedElementClassNames,
  });
  const idsCache = new CategoriesTreeIdsCache({
    queryExecutor: imodelAccess,
    type: viewType,
    baseIdsCache,
    excludedElementClassNames,
  });
  const hierarchyProvider = createIModelHierarchyProvider({
    imodelAccess,
    hierarchyDefinition: new CategoriesTreeDefinition({
      imodelAccess,
      viewType,
      idsCache,
      hierarchyConfig: mergeWithDefaults({ defaults: defaultHierarchyConfiguration, overrides: hierarchyConfig }),
    }),
  });
  return {
    hierarchyChanged: hierarchyProvider.hierarchyChanged,
    getNodes: (props) => hierarchyProvider.getNodes(props),
    getNodeInstanceKeys: (props) => hierarchyProvider.getNodeInstanceKeys(props),
    setFormatter: (formatter) => hierarchyProvider.setFormatter(formatter),
    setHierarchySearch: (props) => hierarchyProvider.setHierarchySearch(props),
    [Symbol.dispose]() {
      hierarchyProvider[Symbol.dispose]();
    },
  };
}
