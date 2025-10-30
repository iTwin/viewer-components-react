/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SnapshotDb } from "@itwin/core-backend";
import { assert } from "@itwin/core-bentley";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import {
  CategoriesTreeDefinition,
  CategoriesTreeIdsCache,
  CategoriesVisibilityHandler,
  defaultCategoriesTreeHierarchyConfiguration,
} from "@itwin/tree-widget-react/internal";
import { Datasets } from "../util/Datasets.js";
import { run, TestIModelConnection } from "../util/TestUtilities.js";
import { StatelessHierarchyProvider } from "./StatelessHierarchyProvider.js";
import {
  collectNodes,
  createCategoryHierarchyNode,
  createDefinitionContainerHierarchyNode,
  createTestDataForInitialDisplay,
  createViewport,
  getVisibilityTargets,
  setupInitialDisplayState,
  validateHierarchyVisibility,
} from "./VisibilityUtilities.js";

import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { HierarchyNode, HierarchyProvider } from "@itwin/presentation-hierarchies";
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
          hierarchyConfig: defaultCategoriesTreeHierarchyConfiguration,
        }),
      };
      expect(filtering.paths.length).to.eq(50000);
      const provider = new StatelessHierarchyProvider({
        imodelAccess,
        getHierarchyFactory: () =>
          new CategoriesTreeDefinition({ imodelAccess, idsCache, viewType: "3d", hierarchyConfig: defaultCategoriesTreeHierarchyConfiguration }),
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
    category: Id64String;
    iModelConnection: IModelConnection;
    hierarchyNodes: HierarchyNode[];
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
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, "3d");
      const handler = new CategoriesVisibilityHandler({ idsCache, viewport, hierarchyConfig: defaultCategoriesTreeHierarchyConfiguration });
      const provider = createIModelHierarchyProvider({
        hierarchyDefinition: new CategoriesTreeDefinition({
          idsCache,
          imodelAccess,
          viewType: "3d",
          hierarchyConfig: defaultCategoriesTreeHierarchyConfiguration,
        }),
        imodelAccess,
      });
      const hierarchyNodes = await collectNodes({ provider });
      await validateHierarchyVisibility({
        hierarchyNodes,
        handler,
        viewport,
        expectations: "all-hidden",
      });
      expect(visibilityTargets.categories.length).to.be.eq(1);
      return { iModel, imodelAccess, viewport, provider, handler, category: visibilityTargets.categories[0], iModelConnection, hierarchyNodes };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport[Symbol.dispose]();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      if (!props.iModelConnection.isClosed) {
        await props.iModelConnection.close();
      }
    },
    test: async ({ viewport, handler, hierarchyNodes, category }) => {
      await handler.changeVisibility(createCategoryHierarchyNode(category, true), true);
      await validateHierarchyVisibility({
        hierarchyNodes,
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
    rootDefinitionContainer: Id64String;
    iModelConnection: IModelConnection;
    hierarchyNodes: HierarchyNode[];
  }>({
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
      const idsCache = new CategoriesTreeIdsCache(imodelAccess, "3d");
      const handler = new CategoriesVisibilityHandler({ idsCache, viewport, hierarchyConfig: defaultCategoriesTreeHierarchyConfiguration });
      const provider = createIModelHierarchyProvider({
        hierarchyDefinition: new CategoriesTreeDefinition({
          idsCache,
          imodelAccess,
          viewType: "3d",
          hierarchyConfig: defaultCategoriesTreeHierarchyConfiguration,
        }),
        imodelAccess,
      });
      const hierarchyNodes = await collectNodes({ provider });
      await validateHierarchyVisibility({
        hierarchyNodes,
        handler,
        viewport,
        expectations: "all-hidden",
      });
      const categoriesDefinitionContainers = new Set<Id64String>();
      visibilityTargets.categories.forEach((categoryId) => {
        categoriesDefinitionContainers.add(iModel.elements.getElementProps(categoryId).model);
      });
      const rootDefinitionContainer = visibilityTargets.definitionContainers.find(
        (definitionContainerId) => !categoriesDefinitionContainers.has(definitionContainerId),
      );
      expect(rootDefinitionContainer).to.not.be.undefined;
      assert(rootDefinitionContainer !== undefined);
      return { iModel, imodelAccess, viewport, idsCache, provider, handler, rootDefinitionContainer, iModelConnection, hierarchyNodes };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport[Symbol.dispose]();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      if (!props.iModelConnection.isClosed) {
        await props.iModelConnection.close();
      }
    },
    test: async ({ viewport, handler, hierarchyNodes, rootDefinitionContainer }) => {
      await handler.changeVisibility(createDefinitionContainerHierarchyNode(rootDefinitionContainer), true);
      await validateHierarchyVisibility({
        hierarchyNodes,
        handler,
        viewport,
        expectations: "all-visible",
      });
    },
  });
});
