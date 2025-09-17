/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SnapshotDb } from "@itwin/core-backend";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { CategoriesTreeDefinition, CategoriesTreeIdsCache, createCategoriesTreeVisibilityHandler } from "@itwin/tree-widget-react/internal";
import { Datasets } from "../util/Datasets.js";
import { run, TestIModelConnection } from "../util/TestUtilities.js";
import { StatelessHierarchyProvider } from "./StatelessHierarchyProvider.js";
import {
  createCategoryHierarchyNode,
  createDefinitionContainerHierarchyNode,
  createTestDataForInitialDisplay,
  createViewport,
  getVisibilityTargets,
  setupInitialDisplayState,
  validateHierarchyVisibility,
} from "./VisibilityUtilities.js";

import type { Id64String } from "@itwin/core-bentley";
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
      const hierarchyConfig = {
        hideSubCategories: false,
        showElements: false,
      };
      using idsCache = new CategoriesTreeIdsCache(imodelAccess, "3d");
      const filtering = {
        paths: await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          limit: "unbounded",
          label: "sc",
          viewType: "3d",
          idsCache,
          hierarchyConfig,
        }),
      };
      expect(filtering.paths.length).to.eq(50000);
      using provider = new StatelessHierarchyProvider({
        imodelAccess,
        getHierarchyFactory: () => new CategoriesTreeDefinition({ imodelAccess, idsCache, viewType: "3d", hierarchyConfig }),
        filtering,
      });
      const result = await provider.loadHierarchy({ shouldExpand: () => false });
      expect(result).to.eq(1);
    },
  });

  run<{
    iModel: SnapshotDb;
    imodelAccess: IModelAccess;
    viewport: Viewport;
    idsCache: CategoriesTreeIdsCache;
    handler: HierarchyVisibilityHandler & Disposable;
    provider: HierarchyProvider & Disposable;
    category: Id64String;
  }>({
    testName: "changing category visibility changes visibility for 50k subCategories",
    setup: async () => {
      const { iModelConnection, iModel } = TestIModelConnection.openFile(Datasets.getIModelPath("50k subcategories"));
      const imodelAccess = StatelessHierarchyProvider.createIModelAccess(iModel, "unbounded");
      const visibilityTargets = await getVisibilityTargets(imodelAccess);
      const testData = createTestDataForInitialDisplay({ visibilityTargets, visible: false });

      const viewport = await createViewport({
        iModelConnection,
        testData,
      });
      setupInitialDisplayState({
        viewport,
        ...testData,
      });
      const hierarchyConfig = {
        hideSubCategories: false,
        showElements: false,
      };
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, "3d");
      const handler = createCategoriesTreeVisibilityHandler({ imodelAccess, idsCache, viewport });
      const provider = createIModelHierarchyProvider({
        hierarchyDefinition: new CategoriesTreeDefinition({ idsCache, imodelAccess, viewType: "3d", hierarchyConfig }),
        imodelAccess,
      });
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
      expect(visibilityTargets.categories.length).to.be.eq(1);
      return { iModel, imodelAccess, idsCache, viewport, provider, handler, category: visibilityTargets.categories[0] };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport[Symbol.dispose]();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      props.idsCache[Symbol.dispose]();
    },
    test: async ({ viewport, handler, provider, category }) => {
      await handler.changeVisibility(createCategoryHierarchyNode(category, true), true);
      viewport.renderFrame();
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
    idsCache: CategoriesTreeIdsCache;
    viewport: Viewport;
    handler: HierarchyVisibilityHandler & Disposable;
    provider: HierarchyProvider & Disposable;
    definitionContainer: Id64String;
  }>({
    // TODO: https://github.com/iTwin/viewer-components-react/issues/1454
    skip: true,
    testName: "changing definition container visibility changes visibility for 50k categories",
    setup: async () => {
      const { iModelConnection, iModel } = TestIModelConnection.openFile(Datasets.getIModelPath("50k categories"));
      const imodelAccess = StatelessHierarchyProvider.createIModelAccess(iModel, "unbounded");
      const visibilityTargets = await getVisibilityTargets(imodelAccess);
      const testData = createTestDataForInitialDisplay({ visibilityTargets, visible: false });

      const viewport = await createViewport({
        iModelConnection,
        testData,
      });
      setupInitialDisplayState({
        viewport,
        ...testData,
      });
      const hierarchyConfig = {
        hideSubCategories: false,
        showElements: false,
      };
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, "3d");
      const handler = createCategoriesTreeVisibilityHandler({ imodelAccess, idsCache, viewport });
      const provider = createIModelHierarchyProvider({
        hierarchyDefinition: new CategoriesTreeDefinition({ idsCache, imodelAccess, viewType: "3d", hierarchyConfig }),
        imodelAccess,
      });
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
      const definitionContainer = iModel.elements.getElementProps(visibilityTargets.categories[0]).model;
      return { iModel, imodelAccess, viewport, idsCache, provider, handler, definitionContainer };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport[Symbol.dispose]();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      props.idsCache[Symbol.dispose]();
    },
    test: async ({ viewport, handler, provider, definitionContainer }) => {
      await handler.changeVisibility(createDefinitionContainerHierarchyNode(definitionContainer), true);
      viewport.renderFrame();
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
    },
  });
});
