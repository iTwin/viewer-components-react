/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SnapshotDb } from "@itwin/core-backend";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { CategoriesTreeDefinition, CategoriesTreeIdsCache, CategoriesVisibilityHandler } from "@itwin/tree-widget-react/internal";
import { Datasets } from "../util/Datasets.js";
import { run, TestIModelConnection } from "../util/TestUtilities.js";
import { StatelessHierarchyProvider } from "./StatelessHierarchyProvider.js";
import {
  createCategoryHierarchyNode,
  createTestDataForInitialDisplay,
  createViewport,
  getAllItems,
  setupInitialDisplayState,
  validateHierarchyVisibility,
} from "./VisibilityUtilities.js";

import type { Id64Array } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { HierarchyProvider } from "@itwin/presentation-hierarchies";
import type { HierarchyVisibilityHandler } from "@itwin/tree-widget-react";
import type { IModelAccess } from "./StatelessHierarchyProvider.js";

describe("categories tree", () => {
  run<{ iModel: SnapshotDb; imodelAccess: IModelAccess }>({
    testName: "creates initial filtered view for 50k items",
    setup: async () => {
      const iModel = SnapshotDb.openFile(Datasets.getIModelPath("50k subcategories"));
      const imodelAccess = StatelessHierarchyProvider.createIModelAccess(iModel, "unbounded");
      return { iModel, imodelAccess };
    },
    cleanup: (props) => props.iModel.close(),
    test: async ({ imodelAccess }) => {
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, "3d");
      const filtering = {
        paths: await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          limit: "unbounded",
          label: "sc",
          viewType: "3d",
          idsCache,
        }),
      };
      expect(filtering.paths.length).to.eq(50000);
      const provider = new StatelessHierarchyProvider({
        imodelAccess,
        getHierarchyFactory: () => new CategoriesTreeDefinition({ imodelAccess, idsCache, viewType: "3d" }),
        filtering,
      });
      const result = await provider.loadHierarchy({ depth: 1 });
      expect(result).to.eq(1);
    },
  });

  run<{ iModel: SnapshotDb; imodelAccess: IModelAccess }>({
    testName: "creates initial filtered view for 5k items",
    setup: async () => {
      const iModel = SnapshotDb.openFile(Datasets.getIModelPath("5k subcategories"));
      const imodelAccess = StatelessHierarchyProvider.createIModelAccess(iModel, "unbounded");
      return { iModel, imodelAccess };
    },
    cleanup: (props) => props.iModel.close(),
    test: async ({ imodelAccess }) => {
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, "3d");
      const filtering = {
        paths: await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          limit: "unbounded",
          label: "sc",
          viewType: "3d",
          idsCache,
        }),
      };
      expect(filtering.paths.length).to.eq(5000);
      using provider = new StatelessHierarchyProvider({
        imodelAccess,
        getHierarchyFactory: () => new CategoriesTreeDefinition({ imodelAccess, idsCache, viewType: "3d" }),
        filtering,
      });
      const result = await provider.loadHierarchy({ depth: 1 });
      expect(result).to.eq(1);
    },
  });

  run<{
    iModel: SnapshotDb;
    imodelAccess: IModelAccess;
    viewport: Viewport;
    handler: HierarchyVisibilityHandler & Disposable;
    provider: HierarchyProvider & Disposable;
    categories: Id64Array;
  }>({
    testName: "changes visibility for 5k items",
    setup: async () => {
      const { iModelConnection, iModel } = TestIModelConnection.openFile(Datasets.getIModelPath("5k subcategories"));
      const imodelAccess = StatelessHierarchyProvider.createIModelAccess(iModel, "unbounded");
      const keys = await getAllItems(imodelAccess);
      const testData = createTestDataForInitialDisplay(keys, false);

      const viewport = await createViewport({
        iModelConnection,
        testData,
      });
      setupInitialDisplayState({
        viewport,
        ...testData,
      });
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, "3d");
      const handler = new CategoriesVisibilityHandler({ idsCache, viewport });
      const provider = createIModelHierarchyProvider({
        hierarchyDefinition: new CategoriesTreeDefinition({ idsCache, imodelAccess, viewType: "3d" }),
        imodelAccess,
      });
      return { iModel, imodelAccess, viewport, provider, handler, categories: testData.categories.map((category) => category.id) };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport.dispose();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
    },
    test: async ({ viewport, handler, provider, categories }) => {
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
      await Promise.all(categories.map(async (category) => handler.changeVisibility(createCategoryHierarchyNode(category), true)));
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
    },
  });

  run<{
    iModel: SnapshotDb;
    imodelAccess: IModelAccess;
    viewport: Viewport;
    handler: HierarchyVisibilityHandler & Disposable;
    provider: HierarchyProvider & Disposable;
    categories: Id64Array;
  }>({
    testName: "changes visibility for 50k items",
    setup: async () => {
      const { iModelConnection, iModel } = TestIModelConnection.openFile(Datasets.getIModelPath("50k subcategories"));
      const imodelAccess = StatelessHierarchyProvider.createIModelAccess(iModel, "unbounded");
      const keys = await getAllItems(imodelAccess);
      const testData = createTestDataForInitialDisplay(keys, false);

      const viewport = await createViewport({
        iModelConnection,
        testData,
      });
      setupInitialDisplayState({
        viewport,
        ...testData,
      });
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, "3d");
      const handler = new CategoriesVisibilityHandler({ idsCache, viewport });
      const provider = createIModelHierarchyProvider({
        hierarchyDefinition: new CategoriesTreeDefinition({ idsCache, imodelAccess, viewType: "3d" }),
        imodelAccess,
      });
      return { iModel, imodelAccess, viewport, provider, handler, categories: testData.categories.map((category) => category.id) };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport.dispose();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
    },
    test: async ({ viewport, handler, provider, categories }) => {
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
      await Promise.all(categories.map(async (category) => handler.changeVisibility(createCategoryHierarchyNode(category), true)));
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
    },
  });
});
