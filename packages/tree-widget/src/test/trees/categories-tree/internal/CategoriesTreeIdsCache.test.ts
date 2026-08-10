/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { HierarchyCacheMode, initializeCore, insertDefinitionContainer, insertSubCategory, insertSubModel, terminateCore } from "test-utilities";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withEditTxn } from "@itwin/core-backend";
import { IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { CLASS_NAME_DefinitionModel } from "../../../../tree-widget-react/shared/internal/ClassNameDefinitions.js";
import { collect } from "../../../../tree-widget-react/shared/internal/Rxjs.js";
import { buildIModel } from "../../../IModelUtils.js";
import { getDefaultSubCategoryId } from "../../TreeUtils.js";
import { createAccessAndCache, getInsertFunctionByViewType } from "./Utils.js";

import type { CategoriesTreeIdsCache } from "../../../../tree-widget-react/trees/categories-tree/internal/CategoriesTreeIdsCache.js";

describe("CategoriesTreeIdsCache", () => {
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
    const { insertCategory, insertElement, insertElementsModel, insertElementsSubModel, insertModeledElement } = getInsertFunctionByViewType(viewType);
    describe(`${viewType} view`, () => {
      let imodelWithoutElements: Awaited<ReturnType<typeof createIModelWithoutElements>>;
      let imodelWithoutDefContainers: Awaited<ReturnType<typeof createIModelWithoutDefContainers>>;
      let imodelWithDefContainersAndCategories: Awaited<ReturnType<typeof createIModelWithDefContainersAndCategories>>;
      let cacheForIModelWithoutElements: CategoriesTreeIdsCache;
      let cacheForIModelWithoutDefContainers: CategoriesTreeIdsCache;
      let cacheForIModelWithDefContainersAndCategories: CategoriesTreeIdsCache;
      async function createIModelWithoutElements() {
        return buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const emptyDefContainer = insertDefinitionContainer({ txn, codeValue: "Empty dc" });
            insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: emptyDefContainer.id });
            const emptyParentDefContainer = insertDefinitionContainer({ txn, codeValue: "Parent dc" });
            const emptyParentDefModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: emptyParentDefContainer.id });
            const childDefContainer = insertDefinitionContainer({ txn, codeValue: "Child dc", modelId: emptyParentDefModel.id });
            insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: childDefContainer.id });
            const parentDefContainer = insertDefinitionContainer({ txn, codeValue: "Parent dc with cat" });
            const parentDefModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: parentDefContainer.id });
            const defContainerOfCategories = insertDefinitionContainer({ txn, codeValue: "Categories dc", modelId: parentDefModel.id });
            const defModelOfCategories = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: defContainerOfCategories.id });
            const categoryOfDefContainer = insertCategory({ txn, codeValue: "cat of child", modelId: defModelOfCategories.id });
            const emptyCategory = insertCategory({ txn, codeValue: "Empty cat" });

            return {
              emptyDefContainer,
              emptyParentDefContainer,
              childDefContainer,
              defContainerOfCategories,
              parentDefContainer,
              categoryOfDefContainer,
              emptyCategory,
            };
          }),
        );
      }

      async function createIModelWithoutDefContainers() {
        return buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const category = insertCategory({ txn, codeValue: "cat" });
            const categoryWithSubCategories = insertCategory({ txn, codeValue: "cat with subCategories" });
            const elementsModel = insertElementsModel({ txn, codeValue: "m" });
            const element1 = insertElement({ txn, modelId: elementsModel.id, categoryId: category.id });
            const element2 = insertElement({ txn, modelId: elementsModel.id, categoryId: categoryWithSubCategories.id });
            const subCategory = insertSubCategory({ txn, parentCategoryId: categoryWithSubCategories.id, codeValue: "subCat" });

            return {
              category,
              categoryWithSubCategories,
              subCategory,
              element1,
              element2,
            };
          }),
        );
      }

      async function createIModelWithDefContainersAndCategories() {
        return buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const parentDefContainer = insertDefinitionContainer({ txn, codeValue: "Parent dc" });
            const parentDefModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: parentDefContainer.id });
            const childDefContainer = insertDefinitionContainer({ txn, codeValue: "Child dc", modelId: parentDefModel.id });
            const childDefModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: childDefContainer.id });
            const emptyChildDefContainer = insertDefinitionContainer({ txn, codeValue: "empty dc", modelId: parentDefModel.id });
            insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: emptyChildDefContainer.id });
            const categoryUnderChild = insertCategory({ txn, codeValue: "cat", modelId: childDefModel.id });
            const categoryUnderParentWithSubCategories = insertCategory({ txn, codeValue: "cat with subCategories", modelId: parentDefModel.id });
            const elementsModel = insertElementsModel({ txn, codeValue: "m" });
            const element1 = insertElement({ txn, modelId: elementsModel.id, categoryId: categoryUnderChild.id });
            const element2 = insertElement({ txn, modelId: elementsModel.id, categoryId: categoryUnderParentWithSubCategories.id });
            const subCategory = insertSubCategory({
              txn,
              parentCategoryId: categoryUnderParentWithSubCategories.id,
              codeValue: "subCat",
              modelId: parentDefModel.id,
            });

            return {
              parentDefContainer,
              childDefContainer,
              emptyChildDefContainer,
              categoryUnderChild,
              categoryUnderParentWithSubCategories,
              subCategory,
              element1,
              element2,
            };
          }),
        );
      }

      beforeAll(async () => {
        imodelWithoutElements = await createIModelWithoutElements();
        cacheForIModelWithoutElements = createAccessAndCache({ imodelConnection: imodelWithoutElements.imodelConnection, viewType }).idsCache;
        imodelWithoutDefContainers = await createIModelWithoutDefContainers();
        cacheForIModelWithoutDefContainers = createAccessAndCache({ imodelConnection: imodelWithoutDefContainers.imodelConnection, viewType }).idsCache;
        imodelWithDefContainersAndCategories = await createIModelWithDefContainersAndCategories();
        cacheForIModelWithDefContainersAndCategories = createAccessAndCache({
          imodelConnection: imodelWithDefContainersAndCategories.imodelConnection,
          viewType,
        }).idsCache;
      });

      afterAll(async () => {
        await imodelWithoutElements.imodelConnection.close();
        await imodelWithoutDefContainers.imodelConnection.close();
        await imodelWithDefContainersAndCategories.imodelConnection.close();
      });

      describe("getDirectChildDefinitionContainersAndCategories", () => {
        it("returns empty list for empty definition containers", async () => {
          const keys = imodelWithoutElements;
          const idsCache = cacheForIModelWithoutElements;
          expect(
            await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.emptyDefContainer.id] })),
          ).toEqual({
            categories: [],
            definitionContainers: [],
          });
        });

        it("returns empty list when child definition container is empty", async () => {
          const keys = imodelWithoutElements;
          const idsCache = cacheForIModelWithoutElements;
          expect(
            await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.emptyParentDefContainer.id] })),
          ).toEqual({
            categories: [],
            definitionContainers: [],
          });
        });

        it("returns child non empty definition container", async () => {
          const keys = imodelWithDefContainersAndCategories;
          const idsCache = cacheForIModelWithDefContainersAndCategories;
          expect(
            await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.parentDefContainer.id] })),
          ).toEqual({
            categories: [
              {
                id: keys.categoryUnderParentWithSubCategories.id,
                subCategoryChildCount: 2,
                isTopMostElementCategory: true,
                hasElements: true,
                hasElementsFromNonExcludedClasses: true,
              },
            ],
            definitionContainers: [keys.childDefContainer.id],
          });
        });

        it("returns child definition container when it has empty category and includeEmpty is true", async () => {
          const keys = imodelWithoutElements;
          const idsCache = cacheForIModelWithoutElements;
          expect(
            await firstValueFrom(
              idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.parentDefContainer.id], includeEmpty: true }),
            ),
          ).toEqual({
            categories: [],
            definitionContainers: [keys.defContainerOfCategories.id],
          });
        });

        it("returns empty when child definition container has empty category and includeEmpty is false", async () => {
          const keys = imodelWithoutElements;
          const idsCache = cacheForIModelWithoutElements;
          expect(
            await firstValueFrom(
              idsCache.getDirectChildDefinitionContainersAndCategories({
                parentDefinitionContainerIds: [keys.parentDefContainer.id],
                includeEmpty: false,
              }),
            ),
          ).toEqual({
            categories: [],
            definitionContainers: [],
          });
        });

        it("returns child categories when definition container contains categories", async () => {
          const keys = imodelWithDefContainersAndCategories;
          const idsCache = cacheForIModelWithDefContainersAndCategories;
          expect(
            await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.childDefContainer.id] })),
          ).toEqual({
            categories: [
              {
                id: keys.categoryUnderChild.id,
                subCategoryChildCount: 1,
                isTopMostElementCategory: true,
                hasElements: true,
                hasElementsFromNonExcludedClasses: true,
              },
            ],
            definitionContainers: [],
          });
        });

        it("returns children without elements when includeEmpty is true", async () => {
          const keys = imodelWithoutElements;
          const idsCache = cacheForIModelWithoutElements;
          expect(
            await firstValueFrom(
              idsCache.getDirectChildDefinitionContainersAndCategories({
                parentDefinitionContainerIds: [keys.defContainerOfCategories.id],
                includeEmpty: true,
              }),
            ),
          ).toEqual({
            categories: [
              {
                id: keys.categoryOfDefContainer.id,
                subCategoryChildCount: 1,
                isTopMostElementCategory: false,
                hasElements: false,
                hasElementsFromNonExcludedClasses: false,
              },
            ],
            definitionContainers: [],
          });
        });

        it("returns empty when no elements exist", async () => {
          const keys = imodelWithoutElements;
          const idsCache = cacheForIModelWithoutElements;
          expect(
            await firstValueFrom(
              idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.defContainerOfCategories.id] }),
            ),
          ).toEqual({
            categories: [],
            definitionContainers: [],
          });
        });

        it("returns only children which contain elements", async () => {
          const keys = imodelWithDefContainersAndCategories;
          const idsCache = cacheForIModelWithDefContainersAndCategories;
          expect(
            await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.parentDefContainer.id] })),
          ).toEqual({
            categories: [
              {
                id: keys.categoryUnderParentWithSubCategories.id,
                subCategoryChildCount: 2,
                isTopMostElementCategory: true,
                hasElements: true,
                hasElementsFromNonExcludedClasses: true,
              },
            ],
            definitionContainers: [keys.childDefContainer.id],
          });
        });

        it("returns children when definition container has parent", async () => {
          const keys = imodelWithDefContainersAndCategories;
          const idsCache = cacheForIModelWithDefContainersAndCategories;
          expect(
            await firstValueFrom(idsCache.getDirectChildDefinitionContainersAndCategories({ parentDefinitionContainerIds: [keys.childDefContainer.id] })),
          ).toEqual({
            categories: [
              {
                id: keys.categoryUnderChild.id,
                subCategoryChildCount: 1,
                isTopMostElementCategory: true,
                hasElements: true,
                hasElementsFromNonExcludedClasses: true,
              },
            ],
            definitionContainers: [],
          });
        });
      });

      describe("getAllContainedCategories", () => {
        it("returns empty list when definition container is empty", async () => {
          const keys = imodelWithoutElements;
          const idsCache = cacheForIModelWithoutElements;
          expect(await collect(idsCache.getAllContainedCategories({ definitionContainerIds: [keys.emptyDefContainer.id] }))).toEqual([]);
        });

        it("returns empty child categories", async () => {
          const keys = imodelWithoutElements;
          const idsCache = cacheForIModelWithoutElements;
          expect(await collect(idsCache.getAllContainedCategories({ definitionContainerIds: [keys.defContainerOfCategories.id] }))).toEqual([
            {
              hasElements: false,
              id: keys.categoryOfDefContainer.id,
              isTopMostElementCategory: false,
              subCategoryChildCount: 1,
              hasElementsFromNonExcludedClasses: false,
            },
          ]);
        });

        it("returns direct and indirect child categories", async () => {
          const keys = imodelWithDefContainersAndCategories;
          const idsCache = cacheForIModelWithDefContainersAndCategories;
          expect(await collect(idsCache.getAllContainedCategories({ definitionContainerIds: [keys.parentDefContainer.id] }))).toEqual([
            {
              hasElements: true,
              id: keys.categoryUnderChild.id,
              isTopMostElementCategory: true,
              subCategoryChildCount: 1,
              hasElementsFromNonExcludedClasses: true,
            },
            {
              hasElements: true,
              id: keys.categoryUnderParentWithSubCategories.id,
              isTopMostElementCategory: true,
              subCategoryChildCount: 2,
              hasElementsFromNonExcludedClasses: true,
            },
          ]);
        });

        it("returns direct child categories", async () => {
          const keys = imodelWithDefContainersAndCategories;
          const idsCache = cacheForIModelWithDefContainersAndCategories;
          expect(await collect(idsCache.getAllContainedCategories({ definitionContainerIds: [keys.childDefContainer.id] }))).toEqual([
            {
              hasElements: true,
              id: keys.categoryUnderChild.id,
              isTopMostElementCategory: true,
              subCategoryChildCount: 1,
              hasElementsFromNonExcludedClasses: true,
            },
          ]);
        });
      });

      describe("getSubCategoriesSearchPaths", () => {
        it("returns empty list when subcategory doesn't exist", async () => {
          const idsCache = cacheForIModelWithoutElements;
          expect(await firstValueFrom(idsCache.getSubCategoriesSearchPaths({ subCategoryIds: "0x123" }))).toEqual([]);
        });

        it("returns path to existing subCategory", async () => {
          const keys = imodelWithoutDefContainers;
          const idsCache = cacheForIModelWithoutDefContainers;
          expect(await firstValueFrom(idsCache.getSubCategoriesSearchPaths({ subCategoryIds: keys.subCategory.id }))).toEqual([
            keys.categoryWithSubCategories,
            keys.subCategory,
          ]);
        });

        it("returns path to subCategory under definition container", async () => {
          const keys = imodelWithDefContainersAndCategories;
          const idsCache = cacheForIModelWithDefContainersAndCategories;
          expect(await firstValueFrom(idsCache.getSubCategoriesSearchPaths({ subCategoryIds: keys.subCategory.id }))).toEqual([
            keys.parentDefContainer,
            keys.categoryUnderParentWithSubCategories,
            keys.subCategory,
          ]);
        });

        it("returns empty list when subCategory does not have siblings", async () => {
          const keys = imodelWithDefContainersAndCategories;
          const idsCache = cacheForIModelWithDefContainersAndCategories;
          const defaultSubCategory = getDefaultSubCategoryId(keys.categoryUnderChild.id);
          expect(await firstValueFrom(idsCache.getSubCategoriesSearchPaths({ subCategoryIds: defaultSubCategory }))).toEqual([]);
        });
      });

      describe("getSearchPathsUpToRootCategory", () => {
        it("returns empty list when category doesn't exist", async () => {
          const idsCache = cacheForIModelWithDefContainersAndCategories;
          expect(await collect(idsCache.getSearchPathsUpToRootCategory({ categoryId: "0x123" }))).toEqual([]);
        });

        it("returns empty list when category does not have definition container", async () => {
          const keys = imodelWithoutDefContainers;
          const idsCache = cacheForIModelWithoutDefContainers;
          expect(await collect(idsCache.getSearchPathsUpToRootCategory({ categoryId: keys.category.id }))).toEqual([[]]);
        });

        it("returns up to category path when it exist under sub-model", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const elementsModel = insertElementsModel({ txn, codeValue: "m" });
              const definitionContainer = insertDefinitionContainer({ txn, codeValue: "dc" });
              const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
              const category = insertCategory({ txn, codeValue: "cat", modelId: definitionModel.id });
              const modeledElement = insertModeledElement({
                txn,
                categoryId: category.id,
                modelId: elementsModel.id,
              });
              const subModel = insertElementsSubModel({
                txn,
                modeledElementId: modeledElement.id,
              });
              const elementOfSubModel = insertElement({
                txn,
                categoryId: category.id,
                modelId: subModel.id,
              });
              return { category, definitionContainer, modeledElement, elementOfSubModel, subModel };
            }),
          );
          const { imodelConnection, ...keys } = buildIModelResult;
          const accessAndCache = createAccessAndCache({ imodelConnection, viewType });
          expect(await collect(accessAndCache.idsCache.getSearchPathsUpToRootCategory({ categoryId: keys.category.id }))).toEqual([[keys.definitionContainer]]);
        });

        it("returns path up to category it has definition container", async () => {
          const keys = imodelWithDefContainersAndCategories;
          const idsCache = cacheForIModelWithDefContainersAndCategories;
          expect(await collect(idsCache.getSearchPathsUpToRootCategory({ categoryId: keys.categoryUnderParentWithSubCategories.id }))).toEqual([
            [keys.parentDefContainer],
          ]);
        });

        it("returns path up to nested category", async () => {
          const keys = imodelWithDefContainersAndCategories;
          const idsCache = cacheForIModelWithDefContainersAndCategories;
          expect(await collect(idsCache.getSearchPathsUpToRootCategory({ categoryId: keys.categoryUnderChild.id }))).toEqual([
            [keys.parentDefContainer, keys.childDefContainer],
          ]);
        });
      });

      describe("getDefinitionContainersSearchPaths", () => {
        it("returns empty list when definition container doesn't exist", async () => {
          const idsCache = cacheForIModelWithDefContainersAndCategories;
          expect(await firstValueFrom(idsCache.getDefinitionContainersSearchPaths({ definitionContainerIds: "0x123" }))).toEqual([]);
        });

        it("returns definition container it has elements", async () => {
          const keys = imodelWithDefContainersAndCategories;
          const idsCache = cacheForIModelWithDefContainersAndCategories;
          expect(await firstValueFrom(idsCache.getDefinitionContainersSearchPaths({ definitionContainerIds: keys.parentDefContainer.id }))).toEqual([
            keys.parentDefContainer,
          ]);
        });

        it("returns path to definition container when it has parent", async () => {
          const keys = imodelWithDefContainersAndCategories;
          const idsCache = cacheForIModelWithDefContainersAndCategories;
          expect(await firstValueFrom(idsCache.getDefinitionContainersSearchPaths({ definitionContainerIds: keys.childDefContainer.id }))).toEqual([
            keys.parentDefContainer,
            keys.childDefContainer,
          ]);
        });
      });

      describe("getAllDefinitionContainersAndCategories", () => {
        it("returns empty list when no categories or definition containers exist", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              insertElementsModel({ txn, codeValue: "m" });
            }),
          );
          const { imodelConnection } = buildIModelResult;
          const accessAndCache = createAccessAndCache({ imodelConnection, viewType });
          expect(await firstValueFrom(accessAndCache.idsCache.getAllDefinitionContainersAndCategories())).toEqual({ categories: [], definitionContainers: [] });
        });

        it("returns empty list when no elements exist", async () => {
          const idsCache = cacheForIModelWithoutElements;
          expect(await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories())).toEqual({ categories: [], definitionContainers: [] });
        });

        it("returns categories and definition containers when no elements exist and includeEmpty is set to true", async () => {
          const keys = imodelWithoutElements;
          const idsCache = cacheForIModelWithoutElements;
          const result = await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories({ includeEmpty: true }));
          expect(result.categories).toHaveLength(2);
          expect(result.categories).toEqual(expect.arrayContaining([keys.categoryOfDefContainer.id, keys.emptyCategory.id]));
          expect(result.definitionContainers).toHaveLength(2);
          expect(result.definitionContainers).toEqual(expect.arrayContaining([keys.defContainerOfCategories.id, keys.parentDefContainer.id]));
        });

        it("returns categories and definition containers which have elements", async () => {
          const keys = imodelWithDefContainersAndCategories;
          const idsCache = cacheForIModelWithDefContainersAndCategories;
          const result = await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories());
          expect(result.categories).toHaveLength(2);
          expect(result.categories).toEqual(expect.arrayContaining([keys.categoryUnderChild.id, keys.categoryUnderParentWithSubCategories.id]));
          expect(result.definitionContainers).toHaveLength(2);
          expect(result.definitionContainers).toEqual(expect.arrayContaining([keys.childDefContainer.id, keys.parentDefContainer.id]));
        });

        it("returns categories when no definition containers exist", async () => {
          const keys = imodelWithoutDefContainers;
          const idsCache = cacheForIModelWithoutDefContainers;
          const result = await firstValueFrom(idsCache.getAllDefinitionContainersAndCategories());
          expect(result.categories).toHaveLength(2);
          expect(result.categories).toEqual(expect.arrayContaining([keys.category.id, keys.categoryWithSubCategories.id]));
          expect(result.definitionContainers).toHaveLength(0);
        });
      });

      describe("getRootDefinitionContainersAndCategories", () => {
        it("returns empty list when no categories or definition containers exist", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              insertElementsModel({ txn, codeValue: "m" });
            }),
          );
          const { imodelConnection } = buildIModelResult;
          const accessAndCache = createAccessAndCache({ imodelConnection, viewType });
          expect(await firstValueFrom(accessAndCache.idsCache.getRootDefinitionContainersAndCategories())).toEqual({
            categories: [],
            definitionContainers: [],
          });
        });

        it("returns empty list when no elements exist", async () => {
          const idsCache = cacheForIModelWithoutElements;
          expect(await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories())).toEqual({
            categories: [],
            definitionContainers: [],
          });
        });

        it("returns root categories and definition containers when no elements exist and includeEmpty is set to true", async () => {
          const keys = imodelWithoutElements;
          const idsCache = cacheForIModelWithoutElements;
          expect(await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories({ includeEmpty: true }))).toEqual({
            categories: [
              {
                id: keys.emptyCategory.id,
                subCategoryChildCount: 1,
                isTopMostElementCategory: false,
                hasElements: false,
                hasElementsFromNonExcludedClasses: false,
              },
            ],
            definitionContainers: [keys.parentDefContainer.id],
          });
        });

        it("returns root categories", async () => {
          const keys = imodelWithoutDefContainers;
          const idsCache = cacheForIModelWithoutDefContainers;

          const result = await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories());
          expect(result.categories).toHaveLength(2);
          expect(result.categories).toEqual(
            expect.arrayContaining([
              { id: keys.category.id, subCategoryChildCount: 1, isTopMostElementCategory: true, hasElements: true, hasElementsFromNonExcludedClasses: true },
              {
                id: keys.categoryWithSubCategories.id,
                subCategoryChildCount: 2,
                isTopMostElementCategory: true,
                hasElements: true,
                hasElementsFromNonExcludedClasses: true,
              },
            ]),
          );
          expect(result.definitionContainers).toHaveLength(0);
        });

        it("returns root definition containers", async () => {
          const keys = imodelWithDefContainersAndCategories;
          const idsCache = cacheForIModelWithDefContainersAndCategories;
          expect(await firstValueFrom(idsCache.getRootDefinitionContainersAndCategories())).toEqual({
            categories: [],
            definitionContainers: [keys.parentDefContainer.id],
          });
        });
      });

      describe("getSubCategories", () => {
        it("returns empty list when category doesn't exist", async () => {
          const idsCache = cacheForIModelWithDefContainersAndCategories;
          expect(await firstValueFrom(idsCache.getSubCategories({ categoryId: "0x123" }))).toEqual([]);
        });

        it("returns sub-category when category has one sub-category", async () => {
          const keys = imodelWithoutDefContainers;
          const idsCache = cacheForIModelWithoutDefContainers;
          expect(await firstValueFrom(idsCache.getSubCategories({ categoryId: keys.category.id }))).toEqual([getDefaultSubCategoryId(keys.category.id)]);
        });

        it("returns sub-categories when category has multiple sub-categories", async () => {
          const keys = imodelWithoutDefContainers;
          const idsCache = cacheForIModelWithoutDefContainers;
          const result = await firstValueFrom(idsCache.getSubCategories({ categoryId: keys.categoryWithSubCategories.id }));
          expect(result.includes(keys.subCategory.id)).toBe(true);
          expect(result.length).toBe(2);
        });
      });
    });
  });
});
