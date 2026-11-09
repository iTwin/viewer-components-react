/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  HierarchyCacheMode,
  importSchema,
  initializeCore,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertPhysicalSubModel,
  insertSpatialCategory,
  insertSubject,
  terminateCore,
} from "test-utilities";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from "vitest";
import { withEditTxn } from "@itwin/core-backend";
import { IModel, IModelReadRpcInterface } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createIModelHierarchyProvider, HierarchySearchTree } from "@itwin/presentation-hierarchies";
import {
  CLASS_NAME_GeometricModel3d,
  CLASS_NAME_SpatialCategory,
  CLASS_NAME_Subject,
} from "../../../../tree-widget-react/shared/internal/ClassNameDefinitions.js";
import { mergeWithDefaults } from "../../../../tree-widget-react/shared/internal/Utils.js";
import { createModelsTreeVisibilityHandler } from "../../../../tree-widget-react/trees/models-tree/internal/visibility/ModelsTreeVisibilityHandler.js";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "../../../../tree-widget-react/trees/models-tree/ModelsTreeDefinition.js";
import { buildIModel } from "../../../IModelUtils.js";
import { validateHierarchyVisibility } from "../../../shared/VisibilityValidation.js";
import { TestUtils } from "../../../TestUtils.js";
import { createTreeWidgetTestingViewport } from "../../TreeUtils.js";
import {
  createAccessAndCache,
  createCategoryHierarchyNode,
  createClassGroupingHierarchyNode,
  createElementHierarchyNode,
  createModelHierarchyNode,
  createSubjectHierarchyNode,
} from "../Utils.js";
import { validateNodeVisibility } from "./VisibilityValidation.js";

import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Props } from "@itwin/presentation-shared";
import type { ModelsTreeIdsCache } from "../../../../tree-widget-react/trees/models-tree/internal/ModelsTreeIdsCache.js";
import type { RequiredModelsTreeHierarchyConfiguration } from "../../../../tree-widget-react/trees/models-tree/ModelsTreeDefinition.js";
import type { createIModelAccess, IModelAccess } from "../../Common.js";

describe("ModelsTreeVisibilityHandler", () => {
  beforeAll(async () => {
    await NoRenderApp.startup();
    await TestUtils.initialize();
  });

  afterAll(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

  describe("search nodes", () => {
    let datasets: Awaited<ReturnType<typeof createDatasets>>;
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
      datasets = await createDatasets();
    });

    afterAll(async () => {
      await terminateCore();
      await datasets[Symbol.asyncDispose]();
    });

    function createProvider(props: {
      idsCache: ModelsTreeIdsCache;
      imodelAccess: ReturnType<typeof createIModelAccess>;
      hierarchyConfig: RequiredModelsTreeHierarchyConfiguration;
      searchPaths?: HierarchySearchTree[];
    }) {
      return createIModelHierarchyProvider({
        hierarchyDefinition: new ModelsTreeDefinition(props),
        imodelAccess: props.imodelAccess,
        ...(props.searchPaths ? { search: { paths: props.searchPaths } } : undefined),
      });
    }
    function createFilteredVisibilityTestData({
      imodelConnection,
      searchPaths,
      imodelAccess,
      idsCache,
    }: {
      imodelConnection: IModelConnection;
      searchPaths: HierarchySearchTree[];
      imodelAccess: IModelAccess;
      idsCache: ModelsTreeIdsCache;
    }) {
      const hierarchyConfig = mergeWithDefaults({ defaults: defaultHierarchyConfiguration, overrides: { subjects: { root: "exclude" } } });
      const viewport = createTreeWidgetTestingViewport({ iModel: imodelConnection, viewType: "3d", visibleByDefault: undefined });
      const visibilityHandlerWithSearchPaths = createModelsTreeVisibilityHandler({ idsCache, imodelAccess, searchPaths, viewport });
      const defaultVisibilityHandler = createModelsTreeVisibilityHandler({ idsCache, imodelAccess, viewport });
      const defaultProvider = createProvider({ idsCache, imodelAccess, hierarchyConfig });
      const providerWithSearchPaths = createProvider({ idsCache, imodelAccess, hierarchyConfig, searchPaths });
      return {
        defaultVisibilityHandler,
        defaultProvider,
        providerWithSearchPaths,
        visibilityHandlerWithSearchPaths,
        viewport,
        [Symbol.dispose]() {
          defaultVisibilityHandler[Symbol.dispose]();
          visibilityHandlerWithSearchPaths[Symbol.dispose]();
          defaultProvider[Symbol.dispose]();
          providerWithSearchPaths[Symbol.dispose]();
        },
      };
    }

    describe("single path to element", () => {
      it("showing category changes visibility for nodes in search paths", async () => {
        const { imodelConnection, searchPaths, keys, imodelAccess, idsCache } = datasets.simple;
        using visibilityTestData = createFilteredVisibilityTestData({ imodelConnection, searchPaths, imodelAccess, idsCache });
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

        viewport.setNeverDrawn({ elementIds: new Set([keys.parentElement.id, keys.searchTargetChildElement.id, keys.childElement.id]) });
        viewport.renderFrame();

        const node = createCategoryHierarchyNode({
          categoryId: keys.category.id,
          modelId: keys.model.id,
          parentKeys: [keys.model],
          search: {
            isSearchTarget: false,
            childrenTargetPaths: [{ identifier: keys.parentElement }, { identifier: keys.searchTargetChildElement }],
          },
        });
        await visibilityHandlerWithSearchPaths.changeVisibility(node, true);

        await validateModelsTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          expectations: "all-visible",
        });

        await validateModelsTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.category.id}`]: "partial",
                  [keys.parentElement.id]: "partial",
                    [keys.searchTargetChildElement.id]: "visible",
                    [keys.childElement.id]: "hidden",
            },
        });
      });

      it("showing element changes visibility for nodes in search paths", async () => {
        const { imodelConnection, searchPaths, keys, imodelAccess, idsCache } = datasets.simple;
        using visibilityTestData = createFilteredVisibilityTestData({ imodelConnection, searchPaths, imodelAccess, idsCache });
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const node = createElementHierarchyNode({
          elementId: keys.parentElement.id,
          categoryId: keys.category.id,
          modelId: keys.model.id,
          parentKeys: [keys.model, keys.category],
          search: {
            isSearchTarget: false,
            childrenTargetPaths: [{ identifier: keys.searchTargetChildElement }],
          },
        });
        await visibilityHandlerWithSearchPaths.changeVisibility(node, true);
        await validateModelsTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          expectations: "all-visible",
        });
        await validateModelsTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.category.id}`]: "partial",
                  [keys.parentElement.id]: "partial",
                    [keys.searchTargetChildElement.id]: "visible",
                    [keys.childElement.id]: "hidden",
            },
        });
      });

      it("showing class grouping node changes visibility for nodes in search paths", async () => {
        const { imodelConnection, searchPaths, keys, imodelAccess, idsCache } = datasets.simple;
        using visibilityTestData = createFilteredVisibilityTestData({ imodelConnection, searchPaths, imodelAccess, idsCache });
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const node = createClassGroupingHierarchyNode({
          elements: [keys.parentElement.id],
          modelId: keys.model.id,
          categoryId: keys.category.id,
          parentKeys: [keys.model, keys.category],
          hasDirectNonSearchTargets: true,
          hasSearchTargetAncestor: false,
        });
        await visibilityHandlerWithSearchPaths.changeVisibility(node, true);

        await validateModelsTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          expectations: "all-visible",
        });

        await validateModelsTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.category.id}`]: "partial",
                  [keys.parentElement.id]: "partial",
                    [keys.searchTargetChildElement.id]: "visible",
                    [keys.childElement.id]: "hidden",
            },
        });
      });

      it("hiding category changes visibility for nodes in search paths", async () => {
        const { imodelConnection, searchPaths, keys, imodelAccess, idsCache } = datasets.simple;
        using visibilityTestData = createFilteredVisibilityTestData({ imodelConnection, searchPaths, imodelAccess, idsCache });
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        viewport.changeModelDisplay({ modelIds: keys.model.id, display: true });
        viewport.setAlwaysDrawn({ elementIds: new Set([keys.parentElement.id, keys.searchTargetChildElement.id, keys.childElement.id]) });
        viewport.renderFrame();

        const node = createCategoryHierarchyNode({
          categoryId: keys.category.id,
          modelId: keys.model.id,
          parentKeys: [keys.model],
          search: {
            isSearchTarget: false,
            childrenTargetPaths: [{ identifier: keys.parentElement }, { identifier: keys.searchTargetChildElement }],
          },
        });
        await visibilityHandlerWithSearchPaths.changeVisibility(node, false);

        await validateModelsTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          expectations: "all-hidden",
        });

        await validateModelsTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.category.id}`]: "partial",
                  [keys.parentElement.id]: "partial",
                    [keys.searchTargetChildElement.id]: "hidden",
                    [keys.childElement.id]: "visible",
            },
        });
      });

      it("hiding element changes visibility for nodes in search paths", async () => {
        const { imodelConnection, searchPaths, keys, imodelAccess, idsCache } = datasets.simple;
        using visibilityTestData = createFilteredVisibilityTestData({ imodelConnection, searchPaths, imodelAccess, idsCache });
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

        viewport.changeModelDisplay({ modelIds: keys.model.id, display: true });
        viewport.setAlwaysDrawn({ elementIds: new Set([keys.parentElement.id, keys.searchTargetChildElement.id, keys.childElement.id]) });
        viewport.renderFrame();

        const node = createElementHierarchyNode({
          elementId: keys.parentElement.id,
          categoryId: keys.category.id,
          modelId: keys.model.id,
          parentKeys: [keys.model, keys.category],
          search: {
            isSearchTarget: false,
            childrenTargetPaths: [{ identifier: keys.searchTargetChildElement }],
          },
        });
        await visibilityHandlerWithSearchPaths.changeVisibility(node, false);

        await validateModelsTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          expectations: "all-hidden",
        });

        await validateModelsTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.category.id}`]: "partial",
                  [keys.parentElement.id]: "partial",
                    [keys.searchTargetChildElement.id]: "hidden",
                    [keys.childElement.id]: "visible",
            },
        });
      });

      it("hiding class grouping node changes visibility for nodes in search paths", async () => {
        const { imodelConnection, searchPaths, keys, imodelAccess, idsCache } = datasets.simple;
        using visibilityTestData = createFilteredVisibilityTestData({ imodelConnection, searchPaths, imodelAccess, idsCache });
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

        viewport.changeModelDisplay({ modelIds: keys.model.id, display: true });
        viewport.setAlwaysDrawn({ elementIds: new Set([keys.parentElement.id, keys.searchTargetChildElement.id, keys.childElement.id]) });
        viewport.renderFrame();

        const node = createClassGroupingHierarchyNode({
          elements: [keys.parentElement.id],
          modelId: keys.model.id,
          categoryId: keys.category.id,
          parentKeys: [keys.model, keys.category],
          hasDirectNonSearchTargets: true,
          hasSearchTargetAncestor: false,
        });
        await visibilityHandlerWithSearchPaths.changeVisibility(node, false);
        await validateModelsTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          expectations: "all-hidden",
        });
        await validateModelsTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.category.id}`]: "partial",
                  [keys.parentElement.id]: "partial",
                    [keys.searchTargetChildElement.id]: "hidden",
                    [keys.childElement.id]: "visible",
            },
        });
      });

      it("showing model node changes visibility for nodes in search paths", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const model = insertPhysicalModelWithPartition({ txn, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
            const searchTargetElement = insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });

            const otherCategory = insertSpatialCategory({ txn, codeValue: "otherCategory" });
            const otherModel = insertPhysicalModelWithPartition({ txn, partitionParentId: IModel.rootSubjectId, codeValue: "2" });
            const otherElement = insertPhysicalElement({ txn, modelId: otherModel.id, categoryId: otherCategory.id });

            return {
              model,
              category,
              searchTargetElement,
              otherModel,
              otherCategory,
              otherElement,
              searchPaths: [{ identifier: model, children: [{ identifier: category, children: [{ identifier: searchTargetElement }] }] }],
            };
          }),
        );

        const { imodelConnection, searchPaths, ...keys } = buildIModelResult;
        using visibilityTestData = createFilteredVisibilityTestData({
          imodelConnection,
          searchPaths,
          ...createAccessAndCache({ imodelConnection, hierarchyConfig: { subjects: { root: "exclude" } } }),
        });
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const node = createModelHierarchyNode({
          modelId: keys.model.id,
          search: {
            childrenTargetPaths: [{ identifier: keys.category }, { identifier: keys.searchTargetElement }],
          },
        });
        await visibilityHandlerWithSearchPaths.changeVisibility(node, true);

        await validateModelsTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          expectations: "all-visible",
        });

        await validateModelsTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "visible",
                [`${keys.model.id}-${keys.category.id}`]: "visible",
                  [keys.searchTargetElement.id]: "visible",

              [keys.otherModel.id]: "hidden",
                [`${keys.otherModel.id}-${keys.otherCategory.id}`]: "hidden",
                  [keys.otherElement.id]: "hidden",
            },
        });
      });
    });

    describe("path to elements in different categories", () => {
      it("showing model node changes visibility for nodes in search paths", async () => {
        const { imodelConnection, searchPaths, keys, imodelAccess, idsCache } = datasets.differentCategories;
        using visibilityTestData = createFilteredVisibilityTestData({ imodelConnection, searchPaths, imodelAccess, idsCache });
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

        const node = createModelHierarchyNode({
          modelId: keys.model.id,
          search: {
            childrenTargetPaths: searchPaths.flatMap((tree) => tree.children ?? []),
          },
        });
        await visibilityHandlerWithSearchPaths.changeVisibility(node, true);

        await validateModelsTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          expectations: "all-visible",
        });

        await validateModelsTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.categoriesOfSearchTargets[0].id}`]: "partial",
                  [keys.searchTargetElements[0]]: "visible",
                  [keys.nonSearchTargetElements[0]]: "hidden",

                [`${keys.model.id}-${keys.categoriesOfSearchTargets[1].id}`]: "partial",
                  [keys.searchTargetElements[1]]: "visible",
                  [keys.nonSearchTargetElements[1]]: "hidden",

                [`${keys.model.id}-${keys.categoriesOfSearchTargets[2].id}`]: "partial",
                  [keys.searchTargetElements[2]]: "visible",
                  [keys.nonSearchTargetElements[2]]: "hidden",

              [keys.otherModel.id]: "hidden",
                [`${keys.otherModel.id}-${keys.otherCategory.id}`]: "hidden",
                  [keys.otherElement.id]: "hidden",
            },
        });
      });

      it("showing category node changes visibility for related nodes in search paths", async () => {
        const { imodelConnection, searchPaths, keys, imodelAccess, idsCache } = datasets.differentCategories;
        using visibilityTestData = createFilteredVisibilityTestData({ imodelConnection, searchPaths, imodelAccess, idsCache });
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

        const node = createCategoryHierarchyNode({
          modelId: keys.model.id,
          categoryId: keys.categoriesOfSearchTargets[0].id,
          parentKeys: [keys.model],
          search: { childrenTargetPaths: searchPaths[0].children![0].children! },
        });
        await visibilityHandlerWithSearchPaths.changeVisibility(node, true);

        await validateModelsTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.categoriesOfSearchTargets[0].id}`]: "visible",
                  [keys.searchTargetElements[0]]: "visible",

                [`${keys.model.id}-${keys.categoriesOfSearchTargets[1].id}`]: "hidden",
                  [keys.searchTargetElements[1]]: "hidden",

                [`${keys.model.id}-${keys.categoriesOfSearchTargets[2].id}`]: "hidden",
                  [keys.searchTargetElements[2]]: "hidden",
            },
        });

        await validateModelsTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.categoriesOfSearchTargets[0].id}`]: "partial",
                  [keys.searchTargetElements[0]]: "visible",
                  [keys.nonSearchTargetElements[0]]: "hidden",

                [`${keys.model.id}-${keys.categoriesOfSearchTargets[1].id}`]: "hidden",
                  [keys.searchTargetElements[1]]: "hidden",
                  [keys.nonSearchTargetElements[1]]: "hidden",

                [`${keys.model.id}-${keys.categoriesOfSearchTargets[2].id}`]: "hidden",
                  [keys.searchTargetElements[2]]: "hidden",
                  [keys.nonSearchTargetElements[2]]: "hidden",

              [keys.otherModel.id]: "hidden",
                [`${keys.otherModel.id}-${keys.otherCategory.id}`]: "hidden",
                  [keys.otherElement.id]: "hidden",
            },
        });
      });
    });

    describe("multiple paths to a category and element under it", () => {
      it("showing model node changes visibility for related nodes in search paths", async () => {
        const { imodelConnection, searchPaths, keys, imodelAccess, idsCache } = datasets.multiplePaths;
        using visibilityTestData = createFilteredVisibilityTestData({ imodelConnection, searchPaths, imodelAccess, idsCache });
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

        const node = createSubjectHierarchyNode({ ids: keys.parentSubject.id });
        await visibilityHandlerWithSearchPaths.changeVisibility(node, true);

        await validateModelsTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          expectations: "all-visible",
        });

        await validateModelsTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          expectations: "all-visible",
        });
      });

      it("showing category node changes visibility for related nodes in search paths", async () => {
        const { imodelConnection, searchPaths, keys, imodelAccess, idsCache } = datasets.multiplePaths;
        using visibilityTestData = createFilteredVisibilityTestData({ imodelConnection, searchPaths, imodelAccess, idsCache });
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

        const node = createCategoryHierarchyNode({
          modelId: keys.modelIds[0],
          categoryId: keys.categoryIds[0],
          parentKeys: [
            keys.parentSubject,
            { id: keys.subjectIds[0], className: CLASS_NAME_Subject },
            { id: keys.modelIds[0], className: CLASS_NAME_GeometricModel3d },
          ],
        });
        await visibilityHandlerWithSearchPaths.changeVisibility(node, true);

        await validateModelsTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.parentSubject.id]: "partial",
                [keys.subjectIds[0]]: "visible",
                  [keys.modelIds[0]]: "visible",
                    [`${keys.modelIds[0]}-${keys.categoryIds[0]}`]: "visible",
                      [keys.elementsOfModels[0][0]]: "visible",
                      [keys.elementsOfModels[0][1]]: "visible",

              [keys.subjectIds[1]]: "hidden",
                [keys.modelIds[1]]: "hidden",
                  [`${keys.modelIds[1]}-${keys.categoryIds[1]}`]: "hidden",
                    [keys.elementsOfModels[1][0]]: "hidden",
                    [keys.elementsOfModels[1][1]]: "hidden",
            },
        });

        await validateModelsTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.parentSubject.id]: "partial",
                [keys.subjectIds[0]]: "visible",
                  [keys.modelIds[0]]: "visible",
                    [`${keys.modelIds[0]}-${keys.categoryIds[0]}`]: "visible",
                      [keys.elementsOfModels[0][0]]: "visible",
                      [keys.elementsOfModels[0][1]]: "visible",

              [keys.subjectIds[1]]: "hidden",
                [keys.modelIds[1]]: "hidden",
                  [`${keys.modelIds[1]}-${keys.categoryIds[1]}`]: "hidden",
                    [keys.elementsOfModels[1][0]]: "hidden",
                    [keys.elementsOfModels[1][1]]: "hidden",
            },
        });
      });
    });

    it("showing class grouping node changes visibility for related nodes in search paths", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, async (txn) => {
          const schemaContentXml = `
            <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
            <ECEntityClass typeName="PhysicalElement1">
              <BaseClass>bis:PhysicalElement</BaseClass>
            </ECEntityClass>
            <ECEntityClass typeName="PhysicalElement2">
              <BaseClass>bis:PhysicalElement</BaseClass>
            </ECEntityClass>
          `;

          const { PhysicalElement1, PhysicalElement2 } = (
            await importSchema({
              imodel,
              schemaContentXml,
              schemaName: "ClassGroupingSchema",
              schemaAlias: "test1",
            })
          ).items;

          const model = insertPhysicalModelWithPartition({ txn, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
          const category = insertSpatialCategory({ txn, codeValue: "category1" });
          const element1 = insertPhysicalElement({ txn, classFullName: PhysicalElement1.fullName, modelId: model.id, categoryId: category.id });
          const element2 = insertPhysicalElement({ txn, classFullName: PhysicalElement2.fullName, modelId: model.id, categoryId: category.id });

          return {
            firstElement: element1.id,
            model: model.id,
            category: category.id,
            searchPaths: [{ identifier: model, children: [{ identifier: category, children: [{ identifier: element1 }] }] }],
            element2: element2.id,
          };
        }),
      );

      const { imodelConnection, searchPaths, ...keys } = buildIModelResult;
      using visibilityTestData = createFilteredVisibilityTestData({
        imodelConnection,
        searchPaths,
        ...createAccessAndCache({ imodelConnection, hierarchyConfig: { subjects: { root: "exclude" } } }),
      });
      const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

      const node = createClassGroupingHierarchyNode({
        elements: [keys.firstElement],
        categoryId: keys.category,
        modelId: keys.model,
        parentKeys: [
          { id: keys.model, className: CLASS_NAME_GeometricModel3d },
          { id: keys.category, className: CLASS_NAME_SpatialCategory },
        ],
        hasDirectNonSearchTargets: true,
        hasSearchTargetAncestor: false,
      });
      await visibilityHandlerWithSearchPaths.changeVisibility(node, true);

      await validateModelsTreeHierarchyVisibility({
        provider: providerWithSearchPaths,
        handler: visibilityHandlerWithSearchPaths,
        viewport,
        expectations: "all-visible",
      });

      await validateModelsTreeHierarchyVisibility({
        provider: defaultProvider,
        handler: defaultVisibilityHandler,
        viewport,
        // oxfmt-ignore
        expectations: {
            [keys.model]: "partial",
              [`${keys.model}-${keys.category}`]: "partial",
                [keys.firstElement]: "visible",
                [keys.element2]: "hidden",
          },
      });
    });

    describe("path with intermediate categories", () => {
      let visibilityTestData: ReturnType<typeof createFilteredVisibilityTestData>;
      beforeEach(() => {
        const { imodelConnection, searchPaths, idsCache, imodelAccess, keys } = datasets.intermediateCategories;
        visibilityTestData = createFilteredVisibilityTestData({
          imodelConnection,
          searchPaths,
          idsCache,
          imodelAccess,
        });
        visibilityTestData.viewport.setNeverDrawn({
          elementIds: new Set([keys.parentElement.id, keys.childElement1.id, keys.childElement2.id]),
        });
        visibilityTestData.viewport.renderFrame();
      });

      afterEach(() => {
        visibilityTestData[Symbol.dispose]();
      });

      it("showing intermediate category changes visibility for related nodes in search paths", async () => {
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const { keys } = datasets.intermediateCategories;

        await visibilityHandlerWithSearchPaths.changeVisibility(
          createCategoryHierarchyNode({
            modelId: keys.model.id,
            categoryId: keys.categoryB.id,
            hasChildren: true,
            parentKeys: [keys.model, keys.categoryA, keys.parentElement],
            parentElementsPath: [{ elementIds: [keys.parentElement.id], categoryIds: keys.categoryA.id }],
            search: {
              isSearchTarget: false,
              childrenTargetPaths: [{ identifier: keys.childElement1 }],
            },
          }),
          true,
        );

        await validateModelsTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                  [keys.parentElement.id]: "partial",
                    [`${keys.parentElement.id}-${keys.categoryB.id}`]: "visible",
                      [keys.childElement1.id]: "visible",
            },
        });

        await validateModelsTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                  [keys.parentElement.id]: "partial",
                    [`${keys.parentElement.id}-${keys.categoryB.id}`]: "partial",
                      [keys.childElement1.id]: "visible",
                      [keys.childElement2.id]: "hidden",
            },
        });
      });

      it("showing child element under intermediate category changes visibility for related nodes in search paths", async () => {
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const { keys } = datasets.intermediateCategories;

        await visibilityHandlerWithSearchPaths.changeVisibility(
          createElementHierarchyNode({
            elementId: keys.childElement1.id,
            modelId: keys.model.id,
            categoryId: keys.categoryB.id,
            parentKeys: [keys.model, keys.categoryA, keys.parentElement, keys.categoryB],
            parentElementsPath: [{ elementIds: [keys.parentElement.id], categoryIds: keys.categoryA.id }],
            search: { isSearchTarget: true },
          }),
          true,
        );

        await validateModelsTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                  [keys.parentElement.id]: "partial",
                    [`${keys.parentElement.id}-${keys.categoryB.id}`]: "visible",
                      [keys.childElement1.id]: "visible",
            },
        });

        await validateModelsTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                  [keys.parentElement.id]: "partial",
                    [`${keys.parentElement.id}-${keys.categoryB.id}`]: "partial",
                      [keys.childElement1.id]: "visible",
                      [keys.childElement2.id]: "hidden",
            },
        });
      });

      it("showing parent element changes visibility for intermediate category children in search paths", async () => {
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const { keys } = datasets.intermediateCategories;

        await visibilityHandlerWithSearchPaths.changeVisibility(
          createElementHierarchyNode({
            elementId: keys.parentElement.id,
            modelId: keys.model.id,
            categoryId: keys.categoryA.id,
            parentKeys: [keys.model, keys.categoryA],
            hasChildren: true,
            search: {
              isSearchTarget: false,
              childrenTargetPaths: [{ identifier: keys.categoryB, children: [{ identifier: keys.childElement1 }] }],
            },
          }),
          true,
        );

        await validateModelsTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          expectations: "all-visible",
        });

        await validateModelsTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                  [keys.parentElement.id]: "partial",
                    [`${keys.parentElement.id}-${keys.categoryB.id}`]: "partial",
                      [keys.childElement1.id]: "visible",
                      [keys.childElement2.id]: "hidden",
            },
        });
      });
    });

    describe("path with intermediate categories under sub-model", () => {
      let visibilityTestData: ReturnType<typeof createFilteredVisibilityTestData>;

      beforeEach(() => {
        const { idsCache, imodelAccess, imodelConnection, keys, searchPaths } = datasets.subModelIntermediateCategories;
        visibilityTestData = createFilteredVisibilityTestData({
          imodelConnection,
          searchPaths,
          idsCache,
          imodelAccess,
        });
        visibilityTestData.viewport.setNeverDrawn({
          elementIds: new Set([keys.modeledElement.id, keys.subModelElement1.id, keys.subModelElement2.id]),
        });
        visibilityTestData.viewport.renderFrame();
      });

      afterEach(() => {
        visibilityTestData[Symbol.dispose]();
      });

      it("showing intermediate category under sub-model changes visibility for related nodes in search paths", async () => {
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const { keys } = datasets.subModelIntermediateCategories;

        await visibilityHandlerWithSearchPaths.changeVisibility(
          createCategoryHierarchyNode({
            modelId: keys.modeledElement.id,
            categoryId: keys.categoryB.id,
            hasChildren: true,
            parentKeys: [keys.model, keys.categoryA, keys.modeledElement, keys.subModel],
            search: {
              isSearchTarget: false,
              childrenTargetPaths: [{ identifier: keys.subModelElement1 }],
            },
          }),
          true,
        );

        await validateModelsTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                  [keys.modeledElement.id]: "partial",
                    [`${keys.modeledElement.id}-${keys.categoryB.id}`]: "visible",
                      [keys.subModelElement1.id]: "visible",
            },
        });

        await validateModelsTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                  [keys.modeledElement.id]: "partial",
                    [`${keys.modeledElement.id}-${keys.categoryB.id}`]: "partial",
                      [keys.subModelElement1.id]: "visible",
                      [keys.subModelElement2.id]: "hidden",
            },
        });
      });

      it("showing element under intermediate category in sub-model changes visibility for related nodes in search paths", async () => {
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const { keys } = datasets.subModelIntermediateCategories;

        await visibilityHandlerWithSearchPaths.changeVisibility(
          createElementHierarchyNode({
            elementId: keys.subModelElement1.id,
            modelId: keys.modeledElement.id,
            categoryId: keys.categoryB.id,
            parentKeys: [keys.model, keys.categoryA, keys.modeledElement, keys.subModel, keys.categoryB],
            search: { isSearchTarget: true },
          }),
          true,
        );

        await validateModelsTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                  [keys.modeledElement.id]: "partial",
                    [`${keys.modeledElement.id}-${keys.categoryB.id}`]: "visible",
                      [keys.subModelElement1.id]: "visible",
            },
        });

        await validateModelsTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                  [keys.modeledElement.id]: "partial",
                    [`${keys.modeledElement.id}-${keys.categoryB.id}`]: "partial",
                      [keys.subModelElement1.id]: "visible",
                      [keys.subModelElement2.id]: "hidden",
            },
        });
      });

      it("showing modeled element changes visibility for intermediate category children in search paths", async () => {
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const { keys } = datasets.subModelIntermediateCategories;

        await visibilityHandlerWithSearchPaths.changeVisibility(
          createElementHierarchyNode({
            elementId: keys.modeledElement.id,
            modelId: keys.model.id,
            categoryId: keys.categoryA.id,
            parentKeys: [keys.model, keys.categoryA],
            hasChildren: true,
            search: {
              isSearchTarget: false,
              childrenTargetPaths: [
                { identifier: keys.subModel, children: [{ identifier: keys.categoryB, children: [{ identifier: keys.subModelElement1 }] }] },
              ],
            },
          }),
          true,
        );

        await validateModelsTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          expectations: "all-visible",
        });

        await validateModelsTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                  [keys.modeledElement.id]: "partial",
                    [`${keys.modeledElement.id}-${keys.categoryB.id}`]: "partial",
                      [keys.subModelElement1.id]: "visible",
                      [keys.subModelElement2.id]: "hidden",
            },
        });
      });
    });

    describe("path with modeling element of same category as modeled element", () => {
      it("showing search target modeling element changes visibility for related nodes in search paths", async () => {
        await using buildIModelResult = await buildIModel(async (imodel, testSchema) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, partitionParentId: IModel.rootSubjectId, codeValue: "model" });
            const categoryA = insertSpatialCategory({ txn, codeValue: "categoryA" });
            const modeledElement = insertPhysicalElement({
              txn,
              userLabel: "modeled element",
              modelId: model.id,
              categoryId: categoryA.id,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            });
            const subModel = insertPhysicalSubModel({ txn, modeledElementId: modeledElement.id });
            // modeling element uses the same category as the modeled element, so the intermediate category node is not shown.
            const modelingElement = insertPhysicalElement({ txn, userLabel: "modeling element", modelId: subModel.id, categoryId: categoryA.id });

            return {
              model,
              categoryA,
              modeledElement,
              subModel,
              modelingElement,
              searchPaths: [
                {
                  identifier: model,
                  children: [
                    {
                      identifier: categoryA,
                      children: [
                        {
                          identifier: modeledElement,
                          children: [{ identifier: subModel, children: [{ identifier: modelingElement }] }],
                        },
                      ],
                    },
                  ],
                },
              ],
            };
          }),
        );
        using visibilityTestData = createFilteredVisibilityTestData({
          imodelConnection: buildIModelResult.imodelConnection,
          searchPaths: buildIModelResult.searchPaths,
          ...createAccessAndCache({ imodelConnection: buildIModelResult.imodelConnection, hierarchyConfig: { subjects: { root: "exclude" } } }),
        });
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
        const keys = buildIModelResult;

        await visibilityHandlerWithSearchPaths.changeVisibility(
          createElementHierarchyNode({
            elementId: keys.modelingElement.id,
            modelId: keys.modeledElement.id,
            categoryId: keys.categoryA.id,
            parentKeys: [keys.model, keys.categoryA, keys.modeledElement, keys.subModel],
            search: { isSearchTarget: true },
          }),
          true,
        );

        await validateModelsTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                  [keys.modeledElement.id]: "partial",
                    [keys.modelingElement.id]: "visible",
            },
        });

        await validateModelsTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // oxfmt-ignore
          expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                  [keys.modeledElement.id]: "partial",
                    [keys.modelingElement.id]: "visible",
            },
        });
      });
    });
  });
});

async function validateModelsTreeHierarchyVisibility(props: Omit<Props<typeof validateHierarchyVisibility>, "validateNodeVisibility">) {
  return validateHierarchyVisibility({
    ...props,
    validateNodeVisibility,
  });
}

async function createDatasets() {
  const imodels: IModelConnection[] = [];

  return {
    [Symbol.asyncDispose]: async () => Promise.all(imodels.map(async (imodel) => imodel.close())),
    ["simple"]: await (async () => {
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const category = insertSpatialCategory({ txn, codeValue: "cat" });
          const model = insertPhysicalModelWithPartition({ txn, partitionParentId: IModel.rootSubjectId, codeValue: "m" });
          const parentElement = insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });
          const searchTargetChildElement = insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id, parentId: parentElement.id });
          const childElement = insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id, parentId: parentElement.id });

          return {
            model,
            category,
            searchTargetChildElement,
            childElement,
            parentElement,
            searchPaths: [
              {
                identifier: model,
                children: [{ identifier: category, children: [{ identifier: parentElement, children: [{ identifier: searchTargetChildElement }] }] }],
              },
            ],
          };
        }),
      );
      imodels.push(imodelConnection);
      return {
        imodelConnection,
        searchPaths: [
          {
            identifier: keys.model,
            children: [
              { identifier: keys.category, children: [{ identifier: keys.parentElement, children: [{ identifier: keys.searchTargetChildElement }] }] },
            ],
          },
        ],
        keys,
        ...createAccessAndCache({ imodelConnection, hierarchyConfig: { subjects: { root: "exclude" } } }),
      };
    })(),
    ["differentCategories"]: await (async () => {
      const searchPathsBuilder = HierarchySearchTree.createBuilder();
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const categoriesOfSearchTargets = [
            insertSpatialCategory({ txn, codeValue: "category1" }),
            insertSpatialCategory({ txn, codeValue: "category2" }),
            insertSpatialCategory({ txn, codeValue: "category3" }),
          ];
          const model = insertPhysicalModelWithPartition({ txn, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
          const searchTargets = new Array<Id64String>();
          const nonSearchTargets = new Array<Id64String>();
          categoriesOfSearchTargets.forEach((category) => {
            const searchTarget = insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });
            searchPathsBuilder.accept({ path: [model, category, searchTarget] });
            searchTargets.push(searchTarget.id);

            const nonSearchTarget = insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });
            nonSearchTargets.push(nonSearchTarget.id);
          });

          const otherCategory = insertSpatialCategory({ txn, codeValue: "otherCategory" });
          const otherModel = insertPhysicalModelWithPartition({ txn, partitionParentId: IModel.rootSubjectId, codeValue: "2" });
          const otherElement = insertPhysicalElement({ txn, modelId: otherModel.id, categoryId: otherCategory.id });

          return {
            model,
            categoriesOfSearchTargets,
            searchTargetElements: searchTargets,
            nonSearchTargetElements: nonSearchTargets,
            otherModel,
            otherCategory,
            otherElement,
          };
        }),
      );
      imodels.push(imodelConnection);
      return {
        imodelConnection,
        searchPaths: searchPathsBuilder.getTree(),
        keys,
        ...createAccessAndCache({ imodelConnection, hierarchyConfig: { subjects: { root: "exclude" } } }),
      };
    })(),
    ["multiplePaths"]: await (async () => {
      const searchPathsBuilder = HierarchySearchTree.createBuilder();
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const subjectIds = new Array<Id64String>();
          const modelIds = new Array<Id64String>();
          const categoryIds = new Array<Id64String>();

          const parentSubject = insertSubject({ txn, codeValue: `parent subject`, parentId: IModel.rootSubjectId });
          const elementsOfModels = new Array<Array<Id64String>>();
          for (let i = 0; i < 2; ++i) {
            const subject = insertSubject({ txn, codeValue: `subject${i}`, parentId: parentSubject.id });
            const model = insertPhysicalModelWithPartition({ txn, partitionParentId: subject.id, codeValue: `model${i}` });
            const category = insertSpatialCategory({ txn, codeValue: `category${i}` });
            const elements = [
              insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id }),
              insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id }),
            ];
            subjectIds.push(subject.id);
            modelIds.push(model.id);
            searchPathsBuilder.accept({ path: [parentSubject, subject, model, category] });
            searchPathsBuilder.accept({ path: [parentSubject, subject, model, category, elements[0]] });
            categoryIds.push(category.id);
            elementsOfModels.push(elements.map((el) => el.id));
          }

          return {
            parentSubject,
            subjectIds,
            modelIds,
            searchPaths: searchPathsBuilder.getTree(),
            categoryIds,
            elementsOfModels,
          };
        }),
      );
      imodels.push(imodelConnection);
      return {
        imodelConnection,
        searchPaths: searchPathsBuilder.getTree(),
        keys,
        ...createAccessAndCache({ imodelConnection, hierarchyConfig: { subjects: { root: "exclude" } } }),
      };
    })(),
    ["intermediateCategories"]: await (async () => {
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const model = insertPhysicalModelWithPartition({ txn, partitionParentId: IModel.rootSubjectId, codeValue: "model" });
          const categoryA = insertSpatialCategory({ txn, codeValue: "categoryA" });
          const categoryB = insertSpatialCategory({ txn, codeValue: "categoryB" });
          const parentElement = insertPhysicalElement({ txn, modelId: model.id, categoryId: categoryA.id });
          const childElement1 = insertPhysicalElement({ txn, modelId: model.id, categoryId: categoryB.id, parentId: parentElement.id });
          const childElement2 = insertPhysicalElement({ txn, modelId: model.id, categoryId: categoryB.id, parentId: parentElement.id });

          return {
            model,
            categoryA,
            categoryB,
            parentElement,
            childElement1,
            childElement2,
          };
        }),
      );
      imodels.push(imodelConnection);
      return {
        imodelConnection,
        searchPaths: [
          {
            identifier: keys.model,
            children: [
              {
                identifier: keys.categoryA,
                children: [{ identifier: keys.parentElement, children: [{ identifier: keys.categoryB, children: [{ identifier: keys.childElement1 }] }] }],
              },
            ],
          },
        ],
        keys,
        ...createAccessAndCache({ imodelConnection, hierarchyConfig: { subjects: { root: "exclude" } } }),
      };
    })(),
    ["subModelIntermediateCategories"]: await (async () => {
      const { imodelConnection, ...keys } = await buildIModel(async (imodel, testSchema) =>
        withEditTxn(imodel, (txn) => {
          const model = insertPhysicalModelWithPartition({ txn, partitionParentId: IModel.rootSubjectId, codeValue: "model" });
          const categoryA = insertSpatialCategory({ txn, codeValue: "categoryA" });
          const categoryB = insertSpatialCategory({ txn, codeValue: "categoryB" });
          const modeledElement = insertPhysicalElement({
            txn,
            modelId: model.id,
            categoryId: categoryA.id,
            classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
          });
          const subModel = insertPhysicalSubModel({ txn, modeledElementId: modeledElement.id });
          const subModelElement1 = insertPhysicalElement({ txn, modelId: subModel.id, categoryId: categoryB.id });
          const subModelElement2 = insertPhysicalElement({ txn, modelId: subModel.id, categoryId: categoryB.id });

          return {
            model,
            categoryA,
            categoryB,
            modeledElement,
            subModel,
            subModelElement1,
            subModelElement2,
          };
        }),
      );
      imodels.push(imodelConnection);
      return {
        imodelConnection,
        searchPaths: [
          {
            identifier: keys.model,
            children: [
              {
                identifier: keys.categoryA,
                children: [
                  {
                    identifier: keys.modeledElement,
                    children: [{ identifier: keys.subModel, children: [{ identifier: keys.categoryB, children: [{ identifier: keys.subModelElement1 }] }] }],
                  },
                ],
              },
            ],
          },
        ],
        keys,
        ...createAccessAndCache({ imodelConnection, hierarchyConfig: { subjects: { root: "exclude" } } }),
      };
    })(),
  };
}
