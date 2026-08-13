/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "test-utilities";
import { afterAll, beforeAll, describe, it } from "vitest";
import { withEditTxn } from "@itwin/core-backend";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { CLASS_NAME_GeometricElement3d } from "../../../tree-widget-react/shared/internal/ClassNameDefinitions.js";
import { ClassificationsTreeDefinition } from "../../../tree-widget-react/trees/classifications-tree/ClassificationsTreeDefinition.js";
import { createClassificationsTreeVisibilityHandler } from "../../../tree-widget-react/trees/classifications-tree/internal/visibility/ClassificationsTreeVisibilityHandler.js";
import { buildIModel } from "../../IModelUtils.js";
import { initializeITwinJs, terminateITwinJs } from "../../Initialize.js";
import { validateHierarchyVisibility } from "../../shared/VisibilityValidation.js";
import { createTreeWidgetTestingViewport } from "../TreeUtils.js";
import { createClassificationHierarchyNode, createClassificationTableHierarchyNode, createPhysicalElementHierarchyNode } from "./HierarchyNodeUtils.js";
import {
  CATEGORY_SYMBOLIZES_CLASSIFICATION_RELATIONSHIP_SCHEMA,
  createAccessAndCache,
  importCategorySymbolizesClassificationSchema,
  importClassificationSchema,
  insertCategorySymbolizesClassificationRelationship,
  insertClassification,
  insertClassificationSystem,
  insertClassificationTable,
  insertElementHasClassificationsRelationship,
} from "./Utils.js";
import { validateNodeVisibility } from "./VisibilityValidation.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchySearchTree } from "@itwin/presentation-hierarchies";
import type { Props } from "@itwin/presentation-shared";
import type { ClassificationsTreeHierarchyConfiguration } from "../../../tree-widget-react/trees/classifications-tree/ClassificationsTreeDefinition.js";
import type { ClassificationsTreeIdsCache } from "../../../tree-widget-react/trees/classifications-tree/internal/ClassificationsTreeIdsCache.js";
import type { ClassificationsTreeVisibilityHandlerConfiguration } from "../../../tree-widget-react/trees/classifications-tree/UseClassificationsTree.js";
import type { createIModelAccess, IModelAccess } from "../Common.js";

describe("ClassificationsTreeVisibilityHandler", () => {
  const rootClassificationSystemCode = "clSystem";
  let datasets: Awaited<ReturnType<typeof createDatasets>>;

  beforeAll(async () => {
    await initializeITwinJs();
    datasets = await createDatasets(rootClassificationSystemCode);
  });

  afterAll(async () => {
    await terminateITwinJs();
    await datasets[Symbol.asyncDispose]();
  });

  function createProvider({
    idsCache,
    ...props
  }: {
    idsCache: ClassificationsTreeIdsCache;
    imodelAccess: ReturnType<typeof createIModelAccess>;
    searchPaths?: HierarchySearchTree[];
    hierarchyConfig?: Partial<ClassificationsTreeHierarchyConfiguration>;
  }) {
    return createIModelHierarchyProvider({
      hierarchyDefinition: new ClassificationsTreeDefinition({
        ...props,
        getIdsCache: () => idsCache,
        hierarchyConfig: { rootClassificationSystemCode, ...props.hierarchyConfig },
      }),
      imodelAccess: props.imodelAccess,
      ...(props.searchPaths ? { search: { paths: props.searchPaths } } : undefined),
    });
  }

  async function createVisibilityTestData({
    imodelConnection,
    visibleByDefault,
    hierarchyConfig,
    idsCache,
    imodelAccess,
  }: {
    imodelConnection: IModelConnection;
    visibleByDefault?: boolean;
    hierarchyConfig?: Partial<ClassificationsTreeHierarchyConfiguration>;
    imodelAccess: IModelAccess;
    idsCache: ClassificationsTreeIdsCache;
  }) {
    const viewport = createTreeWidgetTestingViewport({
      iModel: imodelConnection,
      visibleByDefault,
      viewType: "3d",
    });
    const handler = createClassificationsTreeVisibilityHandler({ imodelAccess, idsCache, viewport });
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

  describe("custom classification -> category relationship", () => {
    it("does not turn on categories from custom classification -> category relationship when `visibilityHandlerConfig` is not provided", async () => {
      const { imodelConnection, keys } = datasets.customRelationship;
      const { idsCache, imodelAccess } = createAccessAndCache({ imodelConnection, hierarchyConfig: { rootClassificationSystemCode } });
      using visibilityTestData = await createVisibilityTestData({
        imodelConnection,
        imodelAccess,
        idsCache,
      });
      const { handler, provider, viewport } = visibilityTestData;

      await validateClassificationsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
      await handler.changeVisibility(createClassificationHierarchyNode({ id: keys.classification.id }), true);
      await validateClassificationsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
      await validateNodeVisibility({
        handler,
        node: createPhysicalElementHierarchyNode({
          id: keys.elementNotInHierarchy.id,
          categoryId: keys.categoryFromCustomRelationship.id,
          modelId: keys.elementsModel.id,
        }),
        viewport,
        expectations: "all-hidden",
      });
    });

    it("turns on categories from custom classification -> category relationship", async () => {
      const { imodelConnection, imodelAccess, idsCache, keys } = datasets.customRelationship;

      using visibilityTestData = await createVisibilityTestData({
        imodelConnection,
        imodelAccess,
        idsCache,
      });
      const { handler, provider, viewport } = visibilityTestData;

      await validateClassificationsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
      await handler.changeVisibility(createClassificationHierarchyNode({ id: keys.classification.id }), true);
      await validateClassificationsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
      await validateNodeVisibility({
        handler,
        node: createPhysicalElementHierarchyNode({
          id: keys.elementNotInHierarchy.id,
          categoryId: keys.categoryFromCustomRelationship.id,
          modelId: keys.elementsModel.id,
        }),
        viewport,
        expectations: "all-visible",
      });
    });

    it("classification visibility takes into account categories from custom classification -> category relationship", async () => {
      const { imodelConnection, imodelAccess, idsCache, keys } = datasets.customRelationship;

      using visibilityTestData = await createVisibilityTestData({
        imodelConnection,
        idsCache,
        imodelAccess,
      });
      const { handler, provider, viewport } = visibilityTestData;

      await validateClassificationsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
      await handler.changeVisibility(createClassificationHierarchyNode({ id: keys.classification.id }), true);
      await validateClassificationsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
      viewport.changeCategoryDisplay({ categoryIds: keys.categoryFromCustomRelationship.id, display: false });
      await validateClassificationsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        // oxfmt-ignore
        expectations: {
          [keys.table.id]: "partial",
            [keys.classification.id]: "partial",
              [keys.elementInHierarchy.id]: "visible",
        },
      });
      await validateNodeVisibility({
        handler,
        node: createPhysicalElementHierarchyNode({
          id: keys.elementNotInHierarchy.id,
          categoryId: keys.categoryFromCustomRelationship.id,
          modelId: keys.elementsModel.id,
        }),
        viewport,
        expectations: "all-hidden",
      });
    });
  });

  describe("enabling visibility", () => {
    it("by default everything is hidden in 3d view with 3d elements' hierarchy", async () => {
      const { idsCache, imodelAccess, imodelConnection } = datasets.simple;
      using visibilityTestData = await createVisibilityTestData({
        imodelConnection,
        idsCache,
        imodelAccess,
      });
      const { handler, provider, viewport } = visibilityTestData;

      await validateClassificationsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
    });

    describe("classification table", () => {
      it("showing classification table makes contained elements under it visible", async () => {
        const { idsCache, imodelAccess, imodelConnection, keys } = datasets.simple;

        using visibilityTestData = await createVisibilityTestData({
          imodelConnection,
          idsCache,
          imodelAccess,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createClassificationTableHierarchyNode({ id: keys.table.id }), true);
        await validateClassificationsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-visible",
        });
      });
    });

    describe("classification", () => {
      it("showing classification makes all ancestors and contained elements under it visible", async () => {
        const { idsCache, imodelAccess, imodelConnection, keys } = datasets.simple;

        using visibilityTestData = await createVisibilityTestData({
          imodelConnection,
          idsCache,
          imodelAccess,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createClassificationHierarchyNode({ id: keys.classification.id }), true);
        await validateClassificationsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-visible",
        });
      });

      it("showing classification makes all ancestors partially visible, and contained elements under it visible", async () => {
        const { imodelConnection, idsCache, imodelAccess, keys } = datasets.multipleClassifications;

        using visibilityTestData = await createVisibilityTestData({
          imodelConnection,
          idsCache,
          imodelAccess,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createClassificationHierarchyNode({ id: keys.classification1.id }), true);
        await validateClassificationsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // oxfmt-ignore
          expectations: {
            [keys.table.id]: "partial",
              [keys.classification1.id]: "visible",
                  [keys.parentElement1.id]: "visible",
                    [keys.childElement1.id]: "visible",

              [keys.classification2.id]: "hidden",
                  [keys.parentElement2.id]: "hidden",
                    [keys.childElement2.id]: "hidden",
          },
        });
      });
    });

    describe("geometric element", () => {
      it("showing geometric element makes ancestors partially visible, and the element visible", async () => {
        const { imodelConnection, idsCache, imodelAccess, keys } = datasets.multipleClassifications;

        using visibilityTestData = await createVisibilityTestData({
          imodelConnection,
          idsCache,
          imodelAccess,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(
          createPhysicalElementHierarchyNode({ id: keys.parentElement1.id, categoryId: keys.category1.id, modelId: keys.elementsModel.id }),
          true,
        );
        await validateClassificationsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // oxfmt-ignore
          expectations: {
            [keys.table.id]: "partial",
              [keys.classification1.id]: "visible",
                [keys.parentElement1.id]: "visible",
                  [keys.childElement1.id]: "visible",

              [keys.classification2.id]: "hidden",
                [keys.parentElement2.id]: "hidden",
                  [keys.childElement2.id]: "hidden",
          },
        });
      });
    });

    describe("element with different category than parent", () => {
      it("showing child element with different category makes it visible and parent partially visible", async () => {
        const { imodelConnection, keys, idsCache, imodelAccess } = datasets.childrenOfDifferentCategories;

        using visibilityTestData = await createVisibilityTestData({
          imodelConnection,
          idsCache,
          imodelAccess,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(
          createPhysicalElementHierarchyNode({
            id: keys.childElement.id,
            categoryId: keys.category2.id,
            modelId: keys.elementsModel.id,
            parentElementsPath: [{ elementIds: [keys.parentElement.id], categoryIds: keys.category.id }],
          }),
          true,
        );
        await validateClassificationsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // oxfmt-ignore
          expectations: {
            [keys.table.id]: "partial",
              [keys.classification.id]: "partial",
                [keys.parentElement.id]: "partial",
                  [keys.childElement.id]: "visible",
          },
        });
      });

      it("showing parent element makes children with different category visible", async () => {
        const { imodelConnection, keys, idsCache, imodelAccess } = datasets.childrenOfDifferentCategories;

        using visibilityTestData = await createVisibilityTestData({
          imodelConnection,
          idsCache,
          imodelAccess,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(
          createPhysicalElementHierarchyNode({
            id: keys.parentElement.id,
            categoryId: keys.category.id,
            modelId: keys.elementsModel.id,
          }),
          true,
        );
        await validateClassificationsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // oxfmt-ignore
          expectations: {
            [keys.table.id]: "visible",
              [keys.classification.id]: "visible",
                [keys.parentElement.id]: "visible",
                  [keys.childElement.id]: "visible",
          },
        });
      });
    });
  });

  describe("disabling visibility", () => {
    it("by default everything is visible in 3d view with 3d elements' hierarchy", async () => {
      const { imodelConnection, imodelAccess, idsCache } = datasets.simple;
      using visibilityTestData = await createVisibilityTestData({
        imodelConnection,
        visibleByDefault: true,
        idsCache,
        imodelAccess,
      });
      const { handler, provider, viewport } = visibilityTestData;

      await validateClassificationsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
    });

    describe("classification table", () => {
      it("hiding classification table makes contained elements under it hidden", async () => {
        const { imodelConnection, keys, idsCache, imodelAccess } = datasets.simple;

        using visibilityTestData = await createVisibilityTestData({
          imodelConnection,
          idsCache,
          imodelAccess,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createClassificationTableHierarchyNode({ id: keys.table.id }), false);
        await validateClassificationsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-hidden",
        });
      });
    });

    describe("classification", () => {
      it("hiding classification makes all ancestors partially visible, and contained elements under it hidden", async () => {
        const { imodelConnection, keys, idsCache, imodelAccess } = datasets.multipleClassifications;

        using visibilityTestData = await createVisibilityTestData({
          imodelConnection,
          visibleByDefault: true,
          idsCache,
          imodelAccess,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createClassificationHierarchyNode({ id: keys.classification1.id }), false);
        await validateClassificationsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // oxfmt-ignore
          expectations: {
            [keys.table.id]: "partial",
              [keys.classification1.id]: "hidden",
                [keys.parentElement1.id]: "hidden",
                  [keys.childElement1.id]: "hidden",

              [keys.classification2.id]: "visible",
                [keys.parentElement2.id]: "visible",
                  [keys.childElement2.id]: "visible",
          },
        });
      });
    });

    describe("geometric element", () => {
      it("hiding geometric element makes ancestors partially visible, element and its children hidden", async () => {
        const { imodelConnection, keys, idsCache, imodelAccess } = datasets.multipleClassifications;

        using visibilityTestData = await createVisibilityTestData({
          imodelConnection,
          visibleByDefault: true,
          idsCache,
          imodelAccess,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(
          createPhysicalElementHierarchyNode({ id: keys.parentElement1.id, categoryId: keys.category1.id, modelId: keys.elementsModel.id }),
          false,
        );
        await validateClassificationsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // oxfmt-ignore
          expectations: {
            [keys.table.id]: "partial",
              [keys.classification1.id]: "hidden",
                [keys.parentElement1.id]: "hidden",
                  [keys.childElement1.id]: "hidden",

              [keys.classification2.id]: "visible",
                [keys.parentElement2.id]: "visible",
                  [keys.childElement2.id]: "visible",
          },
        });
      });
    });

    describe("element with different category than parent", () => {
      it("hiding child element with different category makes it hidden and parent partially visible", async () => {
        const { imodelConnection, keys, idsCache, imodelAccess } = datasets.childrenOfDifferentCategories;

        using visibilityTestData = await createVisibilityTestData({
          imodelConnection,
          visibleByDefault: true,
          idsCache,
          imodelAccess,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(
          createPhysicalElementHierarchyNode({
            id: keys.childElement.id,
            categoryId: keys.category2.id,
            modelId: keys.elementsModel.id,
            parentElementsPath: [{ elementIds: [keys.parentElement.id], categoryIds: keys.category.id }],
          }),
          false,
        );
        await validateClassificationsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // oxfmt-ignore
          expectations: {
            [keys.table.id]: "partial",
              [keys.classification.id]: "partial",
                [keys.parentElement.id]: "partial",
                  [keys.childElement.id]: "hidden",
          },
        });
      });

      it("hiding parent element makes children with different category hidden", async () => {
        const { imodelConnection, keys, idsCache, imodelAccess } = datasets.childrenOfDifferentCategories;

        using visibilityTestData = await createVisibilityTestData({
          imodelConnection,
          visibleByDefault: true,
          idsCache,
          imodelAccess,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(
          createPhysicalElementHierarchyNode({
            id: keys.parentElement.id,
            categoryId: keys.category.id,
            modelId: keys.elementsModel.id,
          }),
          false,
        );
        await validateClassificationsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // oxfmt-ignore
          expectations: {
            [keys.table.id]: "hidden",
              [keys.classification.id]: "hidden",
                [keys.parentElement.id]: "hidden",
                  [keys.childElement.id]: "hidden",
          },
        });
      });
    });
  });

  describe("search nodes", () => {
    let createIModelResult: Awaited<ReturnType<typeof createIModel>>;
    let accessAndCache: ReturnType<typeof createAccessAndCache>;
    async function createIModel() {
      return buildIModel(async (imodel) =>
        withEditTxn(imodel, async (txn) => {
          await importClassificationSchema(imodel);

          const system = insertClassificationSystem({ txn, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ txn, parentId: system.id, codeValue: "clTable" });
          const classification = insertClassification({ txn, modelId: table.id, codeValue: "cl" });

          const elementsModel = insertPhysicalModelWithPartition({ txn, codeValue: "m" });
          const category = insertSpatialCategory({ txn, codeValue: "cat" });
          const parentOfSearchTargetElement = insertPhysicalElement({
            txn,
            modelId: elementsModel.id,
            categoryId: category.id,
            codeValue: "parent of search target",
          });
          const searchTargetChildElement = insertPhysicalElement({
            txn,
            modelId: elementsModel.id,
            categoryId: category.id,
            codeValue: "search target",
            parentId: parentOfSearchTargetElement.id,
          });
          const childElement = insertPhysicalElement({
            txn,
            modelId: elementsModel.id,
            categoryId: category.id,
            codeValue: "child",
            parentId: parentOfSearchTargetElement.id,
          });
          const siblingElement = insertPhysicalElement({
            txn,
            modelId: elementsModel.id,
            categoryId: category.id,
            codeValue: "sibling",
          });
          insertElementHasClassificationsRelationship({ txn, elementId: parentOfSearchTargetElement.id, classificationId: classification.id });
          insertElementHasClassificationsRelationship({ txn, elementId: siblingElement.id, classificationId: classification.id });

          return {
            table,
            classification,
            elementsModel,
            category,
            parentOfSearchTargetElement,
            searchTargetChildElement,
            childElement,
            siblingElement,
            searchPaths: [
              {
                identifier: table,
                children: [
                  {
                    identifier: classification,
                    children: [{ identifier: parentOfSearchTargetElement, children: [{ identifier: searchTargetChildElement }] }],
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
      accessAndCache = createAccessAndCache({ imodelConnection: createIModelResult.imodelConnection, hierarchyConfig: { rootClassificationSystemCode } });
    });

    afterAll(async () => {
      await createIModelResult.imodelConnection.close();
    });

    async function createFilteredVisibilityTestData({
      imodelConnection,
      searchPaths,
      visibleByDefault,
      imodelAccess,
      idsCache,
    }: {
      imodelConnection: IModelConnection;
      imodelAccess: IModelAccess;
      idsCache: ClassificationsTreeIdsCache;
      searchPaths: HierarchySearchTree[];
      visibleByDefault?: boolean;
    }) {
      const viewport = createTreeWidgetTestingViewport({
        iModel: imodelConnection,
        viewType: "3d",
        visibleByDefault,
      });
      const visibilityHandlerWithSearchPaths = createClassificationsTreeVisibilityHandler({ idsCache, searchPaths, imodelAccess, viewport });
      const defaultVisibilityHandler = createClassificationsTreeVisibilityHandler({ idsCache, imodelAccess, viewport });
      const defaultProvider = createProvider({ idsCache, imodelAccess });
      const providerWithSearchPaths = createProvider({ idsCache, imodelAccess, searchPaths });
      return {
        defaultVisibilityHandler,
        visibilityHandlerWithSearchPaths,
        defaultProvider,
        providerWithSearchPaths,
        viewport,
        [Symbol.dispose]() {
          defaultVisibilityHandler[Symbol.dispose]();
          visibilityHandlerWithSearchPaths[Symbol.dispose]();
          defaultProvider[Symbol.dispose]();
          providerWithSearchPaths[Symbol.dispose]();
        },
      };
    }

    it("showing parent geometric element of search target changes visibility for nodes in search paths", async () => {
      const { imodelConnection, searchPaths, ...keys } = createIModelResult;
      using visibilityTestData = await createFilteredVisibilityTestData({
        imodelConnection,
        searchPaths,
        imodelAccess: accessAndCache.imodelAccess,
        idsCache: accessAndCache.idsCache,
      });
      const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

      await visibilityHandlerWithSearchPaths.changeVisibility(
        createPhysicalElementHierarchyNode({
          id: keys.parentOfSearchTargetElement.id,
          categoryId: keys.category.id,
          modelId: keys.elementsModel.id,
          parentKeys: [keys.table, keys.classification],
          search: {
            isSearchTarget: false,
            childrenTargetPaths: [{ identifier: keys.searchTargetChildElement }],
          },
        }),
        true,
      );

      await validateClassificationsTreeHierarchyVisibility({
        provider: providerWithSearchPaths,
        handler: visibilityHandlerWithSearchPaths,
        viewport,
        expectations: "all-visible",
      });

      await validateClassificationsTreeHierarchyVisibility({
        provider: defaultProvider,
        handler: defaultVisibilityHandler,
        viewport,
        // oxfmt-ignore
        expectations: {
          [keys.table.id]: "partial",
            [keys.classification.id]: "partial",
              [keys.siblingElement.id]: "hidden",

              [keys.parentOfSearchTargetElement.id]: "partial",
                [keys.searchTargetChildElement.id]: "visible",
                [keys.childElement.id]: "hidden",
        },
      });
    });

    it("showing search target geometric element changes visibility for nodes in search paths", async () => {
      const { imodelConnection, searchPaths, ...keys } = createIModelResult;
      using visibilityTestData = await createFilteredVisibilityTestData({
        imodelConnection,
        searchPaths,
        imodelAccess: accessAndCache.imodelAccess,
        idsCache: accessAndCache.idsCache,
      });
      const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

      await visibilityHandlerWithSearchPaths.changeVisibility(
        createPhysicalElementHierarchyNode({
          id: keys.searchTargetChildElement.id,
          categoryId: keys.category.id,
          modelId: keys.elementsModel.id,
          parentKeys: [keys.table, keys.classification, keys.parentOfSearchTargetElement],
          search: { isSearchTarget: true },
        }),
        true,
      );

      await validateClassificationsTreeHierarchyVisibility({
        provider: providerWithSearchPaths,
        handler: visibilityHandlerWithSearchPaths,
        viewport,
        // oxfmt-ignore
        expectations: {
          [keys.table.id]: "partial",
            [keys.classification.id]: "partial",
              [keys.parentOfSearchTargetElement.id]: "partial",
                [keys.searchTargetChildElement.id]: "visible",
        },
      });

      await validateClassificationsTreeHierarchyVisibility({
        provider: defaultProvider,
        handler: defaultVisibilityHandler,
        viewport,
        // oxfmt-ignore
        expectations: {
          [keys.table.id]: "partial",
            [keys.classification.id]: "partial",
              [keys.siblingElement.id]: "hidden",

              [keys.parentOfSearchTargetElement.id]: "partial",
                [keys.searchTargetChildElement.id]: "visible",
                [keys.childElement.id]: "hidden",
        },
      });
    });

    it("showing classification of search target element changes visibility for nodes in search paths", async () => {
      const { imodelConnection, searchPaths, ...keys } = createIModelResult;
      using visibilityTestData = await createFilteredVisibilityTestData({
        imodelConnection,
        searchPaths,
        idsCache: accessAndCache.idsCache,
        imodelAccess: accessAndCache.imodelAccess,
      });
      const { visibilityHandlerWithSearchPaths, defaultVisibilityHandler, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
      await visibilityHandlerWithSearchPaths.changeVisibility(
        createClassificationHierarchyNode({
          id: keys.classification.id,
          search: {
            isSearchTarget: false,
            childrenTargetPaths: [{ identifier: keys.parentOfSearchTargetElement, children: [{ identifier: keys.searchTargetChildElement }] }],
          },
          parentKeys: [keys.table],
        }),
        true,
      );

      await validateClassificationsTreeHierarchyVisibility({
        provider: providerWithSearchPaths,
        handler: visibilityHandlerWithSearchPaths,
        viewport,
        expectations: "all-visible",
      });

      await validateClassificationsTreeHierarchyVisibility({
        provider: defaultProvider,
        handler: defaultVisibilityHandler,
        viewport,
        // oxfmt-ignore
        expectations: {
          [keys.table.id]: "partial",
            [keys.classification.id]: "partial",
              [keys.siblingElement.id]: "hidden",

              [keys.parentOfSearchTargetElement.id]: "partial",
                [keys.searchTargetChildElement.id]: "visible",
                [keys.childElement.id]: "hidden",
        },
      });
    });

    it("showing classification table of search target element changes visibility for nodes in search paths", async () => {
      const { imodelConnection, searchPaths, ...keys } = createIModelResult;
      using visibilityTestData = await createFilteredVisibilityTestData({
        imodelConnection,
        searchPaths,
        idsCache: accessAndCache.idsCache,
        imodelAccess: accessAndCache.imodelAccess,
      });
      const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
      await visibilityHandlerWithSearchPaths.changeVisibility(
        createClassificationTableHierarchyNode({
          hasChildren: true,
          id: keys.table.id,
          search: {
            isSearchTarget: false,
            childrenTargetPaths: [
              {
                identifier: keys.classification,
                children: [{ identifier: keys.parentOfSearchTargetElement, children: [{ identifier: keys.searchTargetChildElement }] }],
              },
            ],
          },
        }),
        true,
      );

      await validateClassificationsTreeHierarchyVisibility({
        provider: providerWithSearchPaths,
        handler: visibilityHandlerWithSearchPaths,
        viewport,
        expectations: "all-visible",
      });

      await validateClassificationsTreeHierarchyVisibility({
        provider: defaultProvider,
        handler: defaultVisibilityHandler,
        viewport,
        // oxfmt-ignore
        expectations: {
          [keys.table.id]: "partial",
            [keys.classification.id]: "partial",
              [keys.siblingElement.id]: "hidden",

              [keys.parentOfSearchTargetElement.id]: "partial",
                [keys.searchTargetChildElement.id]: "visible",
                [keys.childElement.id]: "hidden",
        },
      });
    });
  });

  it("element of an excluded class still participates in visibility", async () => {
    const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;
    using visibilityTestData = await createVisibilityTestData({
      imodelConnection,
      hierarchyConfig: {
        elements: { excludedClasses: [CLASS_NAME_GeometricElement3d] },
      },
      idsCache,
      imodelAccess,
    });
    const { handler, viewport, provider } = visibilityTestData;

    await validateClassificationsTreeHierarchyVisibility({
      provider,
      handler,
      viewport,
      expectations: "all-hidden",
    });

    const classificationTableNode = createClassificationTableHierarchyNode({ id: keys.table.id });
    await handler.changeVisibility(classificationTableNode, true);
    await validateClassificationsTreeHierarchyVisibility({
      provider,
      handler,
      viewport,
      expectations: "all-visible",
    });

    viewport.setNeverDrawn({ elementIds: new Set([keys.parentElement.id]) });

    await validateClassificationsTreeHierarchyVisibility({
      provider,
      handler,
      viewport,
      // oxfmt-ignore
      expectations: {
        [keys.table.id]: "partial",
          [keys.classification.id]: "partial",
      },
    });
  });

  it("child element of an excluded class still participates in visibility", async () => {
    const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;

    using visibilityTestData = await createVisibilityTestData({
      imodelConnection,
      hierarchyConfig: {
        elements: { excludedClasses: [CLASS_NAME_GeometricElement3d] },
      },
      idsCache,
      imodelAccess,
    });
    const { handler, viewport, provider } = visibilityTestData;

    await validateClassificationsTreeHierarchyVisibility({
      provider,
      handler,
      viewport,
      expectations: "all-hidden",
    });

    const classificationTableNode = createClassificationTableHierarchyNode({ id: keys.table.id });
    await handler.changeVisibility(classificationTableNode, true);
    await validateClassificationsTreeHierarchyVisibility({
      provider,
      handler,
      viewport,
      expectations: "all-visible",
    });

    viewport.setNeverDrawn({ elementIds: new Set([keys.childElement.id]) });

    await validateClassificationsTreeHierarchyVisibility({
      provider,
      handler,
      viewport,
      // oxfmt-ignore
      expectations: {
        [keys.table.id]: "partial",
          [keys.classification.id]: "partial",
      },
    });
  });
});

async function validateClassificationsTreeHierarchyVisibility(props: Omit<Props<typeof validateHierarchyVisibility>, "validateNodeVisibility">) {
  return validateHierarchyVisibility({
    ...props,
    validateNodeVisibility,
  });
}

async function createDatasets(rootClassificationSystemCode: string) {
  const imodels: IModelConnection[] = [];
  return {
    [Symbol.asyncDispose]: async () => Promise.all(imodels.map(async (imodel) => imodel.close())),
    ["simple"]: await (async () => {
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, async (txn) => {
          await importClassificationSchema(imodel);

          const system = insertClassificationSystem({ txn, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ txn, parentId: system.id, codeValue: "clTable" });
          const classification = insertClassification({ txn, modelId: table.id, codeValue: "cl" });

          const elementsModel = insertPhysicalModelWithPartition({ txn, codeValue: "m" });
          const category = insertSpatialCategory({ txn, codeValue: "cat" });
          const parentElement = insertPhysicalElement({
            txn,
            modelId: elementsModel.id,
            categoryId: category.id,
            codeValue: "parent el",
          });
          const childElement = insertPhysicalElement({
            txn,
            modelId: elementsModel.id,
            categoryId: category.id,
            parentId: parentElement.id,
            codeValue: "child el",
          });
          insertElementHasClassificationsRelationship({ txn, elementId: parentElement.id, classificationId: classification.id });

          return { table, classification, elementsModel, category, parentElement, childElement };
        }),
      );
      imodels.push(imodelConnection);
      return { imodelConnection, keys, ...createAccessAndCache({ imodelConnection, hierarchyConfig: { rootClassificationSystemCode } }) };
    })(),
    ["customRelationship"]: await (async () => {
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, async (txn) => {
          await importClassificationSchema(imodel);
          await importCategorySymbolizesClassificationSchema(imodel);

          const system = insertClassificationSystem({ txn, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ txn, parentId: system.id, codeValue: "clTable" });
          const classification = insertClassification({ txn, modelId: table.id, codeValue: "cl" });

          const elementsModel = insertPhysicalModelWithPartition({ txn, codeValue: "m" });
          const category = insertSpatialCategory({ txn, codeValue: "cat" });
          const elementInHierarchy = insertPhysicalElement({
            txn,
            modelId: elementsModel.id,
            categoryId: category.id,
            codeValue: "parent el",
          });
          insertElementHasClassificationsRelationship({ txn, elementId: elementInHierarchy.id, classificationId: classification.id });
          insertCategorySymbolizesClassificationRelationship({ txn, categoryId: category.id, classificationId: classification.id });

          const categoryFromCustomRelationship = insertSpatialCategory({ txn, codeValue: "cat custom" });
          const elementNotInHierarchy = insertPhysicalElement({ txn, modelId: elementsModel.id, categoryId: categoryFromCustomRelationship.id });
          insertCategorySymbolizesClassificationRelationship({ txn, categoryId: categoryFromCustomRelationship.id, classificationId: classification.id });
          return { table, classification, category, elementInHierarchy, categoryFromCustomRelationship, elementNotInHierarchy, elementsModel };
        }),
      );
      const visibilityHandlerConfig: ClassificationsTreeVisibilityHandlerConfiguration = {
        classificationToCategoriesRelationshipSpecification: {
          fullClassName: `${CATEGORY_SYMBOLIZES_CLASSIFICATION_RELATIONSHIP_SCHEMA}.CategorySymbolizesClassification`,
          source: "category",
        },
      };
      imodels.push(imodelConnection);
      return {
        imodelConnection,
        keys,
        ...createAccessAndCache({ imodelConnection, hierarchyConfig: { rootClassificationSystemCode }, visibilityHandlerConfig }),
      };
    })(),
    ["multipleClassifications"]: await (async () => {
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, async (txn) => {
          await importClassificationSchema(imodel);

          const system = insertClassificationSystem({ txn, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ txn, parentId: system.id, codeValue: "clTable" });
          const classification1 = insertClassification({ txn, modelId: table.id, codeValue: "cl" });
          const classification2 = insertClassification({ txn, modelId: table.id, codeValue: "cl2" });

          const elementsModel = insertPhysicalModelWithPartition({ txn, codeValue: "m" });
          const category1 = insertSpatialCategory({ txn, codeValue: "cat" });
          const category2 = insertSpatialCategory({ txn, codeValue: "cat2" });
          const parentElement1 = insertPhysicalElement({
            txn,
            modelId: elementsModel.id,
            categoryId: category1.id,
            codeValue: "parent el",
          });
          const parentElement2 = insertPhysicalElement({
            txn,
            modelId: elementsModel.id,
            categoryId: category2.id,
            codeValue: "parent el2",
          });
          const childElement1 = insertPhysicalElement({
            txn,
            modelId: elementsModel.id,
            categoryId: category1.id,
            parentId: parentElement1.id,
            codeValue: "child el",
          });
          const childElement2 = insertPhysicalElement({
            txn,
            modelId: elementsModel.id,
            categoryId: category2.id,
            parentId: parentElement2.id,
            codeValue: "child el2",
          });
          insertElementHasClassificationsRelationship({ txn, elementId: parentElement1.id, classificationId: classification1.id });
          insertElementHasClassificationsRelationship({ txn, elementId: parentElement2.id, classificationId: classification2.id });

          return { table, classification1, classification2, elementsModel, category1, category2, parentElement1, childElement1, parentElement2, childElement2 };
        }),
      );
      imodels.push(imodelConnection);
      return { imodelConnection, keys, ...createAccessAndCache({ imodelConnection, hierarchyConfig: { rootClassificationSystemCode } }) };
    })(),
    ["childrenOfDifferentCategories"]: await (async () => {
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, async (txn) => {
          await importClassificationSchema(imodel);

          const system = insertClassificationSystem({ txn, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ txn, parentId: system.id, codeValue: "clTable" });
          const classification = insertClassification({ txn, modelId: table.id, codeValue: "cl" });

          const elementsModel = insertPhysicalModelWithPartition({ txn, codeValue: "m" });
          const category = insertSpatialCategory({ txn, codeValue: "cat" });
          const category2 = insertSpatialCategory({ txn, codeValue: "cat2" });
          const parentElement = insertPhysicalElement({
            txn,
            modelId: elementsModel.id,
            categoryId: category.id,
            codeValue: "parent el",
          });
          const childElement = insertPhysicalElement({
            txn,
            modelId: elementsModel.id,
            categoryId: category2.id,
            parentId: parentElement.id,
            codeValue: "child el",
          });
          insertElementHasClassificationsRelationship({ txn, elementId: parentElement.id, classificationId: classification.id });

          return { table, classification, elementsModel, category, parentElement, childElement, category2 };
        }),
      );
      imodels.push(imodelConnection);
      return { imodelConnection, keys, ...createAccessAndCache({ imodelConnection, hierarchyConfig: { rootClassificationSystemCode } }) };
    })(),
  };
}
