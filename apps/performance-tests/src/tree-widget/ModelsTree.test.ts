/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SnapshotDb } from "@itwin/core-backend";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import {
  createModelsTreeVisibilityHandler,
  defaultModelsTreeHierarchyConfiguration,
  ModelsTreeDefinition,
  ModelsTreeIdsCache,
} from "@itwin/tree-widget-react/internal";
import { Datasets } from "../util/Datasets.js";
import { run, TestIModelConnection } from "../util/TestUtilities.js";
import { StatelessHierarchyProvider } from "./StatelessHierarchyProvider.js";
import {
  createCategoryHierarchyNode,
  createElementHierarchyNode,
  createModelHierarchyNode,
  createTestDataForInitialDisplay,
  createViewport,
  getVisibilityTargets,
  setupInitialDisplayState,
  validateHierarchyVisibility,
} from "./VisibilityUtilities.js";

import type { Viewport } from "@itwin/core-frontend";
import type { Id64String } from "@itwin/core-bentley";
import type { HierarchyProvider } from "@itwin/presentation-hierarchies";
import type { ECSqlQueryDef, InstanceKey } from "@itwin/presentation-shared";
import type { HierarchyVisibilityHandler } from "@itwin/tree-widget-react";
import type { IModelAccess } from "./StatelessHierarchyProvider.js";

describe("models tree", () => {
  run<{ iModel: SnapshotDb; imodelAccess: IModelAccess; targetItems: Array<InstanceKey> }>({
    testName: "creates initial filtered view for 50k target items",
    setup: async () => {
      const iModel = SnapshotDb.openFile(Datasets.getIModelPath("50k 3D elements"));
      const imodelAccess = StatelessHierarchyProvider.createIModelAccess(iModel, "unbounded");
      const targetItems = new Array<InstanceKey>();
      const query: ECSqlQueryDef = {
        ecsql: `SELECT CAST(IdToHex(ECInstanceId) AS TEXT) AS ECInstanceId FROM bis.GeometricElement3d`,
      };
      for await (const row of imodelAccess.createQueryReader(query, { limit: "unbounded" })) {
        targetItems.push({ id: row.ECInstanceId, className: "Generic:PhysicalObject" });
      }
      return { iModel, imodelAccess, targetItems };
    },
    cleanup: (props) => props.iModel.close(),
    test: async ({ imodelAccess, targetItems }) => {
      using idsCache = new ModelsTreeIdsCache(imodelAccess, defaultModelsTreeHierarchyConfiguration);
      const filtering = {
        paths: await ModelsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          limit: "unbounded",
          targetItems,
          idsCache,
          hierarchyConfig: defaultModelsTreeHierarchyConfiguration,
        }),
      };
      expect(filtering.paths.length).to.eq(50000);
      using provider = new StatelessHierarchyProvider({
        imodelAccess,
        getHierarchyFactory: () => new ModelsTreeDefinition({ imodelAccess, idsCache, hierarchyConfig: defaultModelsTreeHierarchyConfiguration }),
        filtering,
      });
      const result = await provider.loadHierarchy({ depth: 2 });
      expect(result).to.eq(2);
    },
  });

  run<{
    iModel: SnapshotDb;
    idsCache: ModelsTreeIdsCache;
    imodelAccess: IModelAccess;
    viewport: Viewport;
    handler: HierarchyVisibilityHandler & Disposable;
    provider: HierarchyProvider & Disposable;
    elementsModel: Id64String;
  }>({
    testName: "validates categories visibility for imodel with 50k categories",
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
      const idsCache = new ModelsTreeIdsCache(imodelAccess, defaultModelsTreeHierarchyConfiguration);
      const handler = createModelsTreeVisibilityHandler({ idsCache, viewport, imodelAccess });
      const provider = createIModelHierarchyProvider({
        hierarchyDefinition: new ModelsTreeDefinition({ idsCache, imodelAccess, hierarchyConfig: defaultModelsTreeHierarchyConfiguration }),
        imodelAccess,
      });
      await validateHierarchyVisibility({
        ignoreChildren: (node) => !!node.extendedData?.isCategory,
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
      const elementsModel = iModel.elements.getElementProps(visibilityTargets.elements[0]).model;
      return { iModel, imodelAccess, viewport, provider, handler, elementsModel, idsCache };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport[Symbol.dispose]();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      props.idsCache[Symbol.dispose]();
    },
    test: async ({ viewport, handler, provider, elementsModel }) => {
      // Add one element to always draw set to trigger additional queries
      viewport.setAlwaysDrawn(new Set([elementsModel]));
      viewport.renderFrame();
      await handler.changeVisibility(createModelHierarchyNode(elementsModel), true);
      viewport.renderFrame();
      await validateHierarchyVisibility({
        ignoreChildren: (node) => !!node.extendedData?.isCategory,
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
    },
  });

  run<{
    iModel: SnapshotDb;
    idsCache: ModelsTreeIdsCache;
    imodelAccess: IModelAccess;
    viewport: Viewport;
    handler: HierarchyVisibilityHandler & Disposable;
    provider: HierarchyProvider & Disposable;
    elementsModel: Id64String;
  }>({
    testName: "changing model visibility changes visibility for 50k elements",
    setup: async () => {
      const { iModelConnection, iModel } = TestIModelConnection.openFile(Datasets.getIModelPath("50k 3D elements"));
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
      const idsCache = new ModelsTreeIdsCache(imodelAccess, defaultModelsTreeHierarchyConfiguration);
      const handler = createModelsTreeVisibilityHandler({ idsCache, viewport, imodelAccess });
      const provider = createIModelHierarchyProvider({
        hierarchyDefinition: new ModelsTreeDefinition({ idsCache, imodelAccess, hierarchyConfig: defaultModelsTreeHierarchyConfiguration }),
        imodelAccess,
      });
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
      const elementsModel = iModel.elements.getElementProps(visibilityTargets.elements[0]).model;
      return { iModel, imodelAccess, viewport, provider, handler, elementsModel, idsCache };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport[Symbol.dispose]();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      props.idsCache[Symbol.dispose]();
    },
    test: async ({ viewport, handler, provider, elementsModel }) => {
      await handler.changeVisibility(createModelHierarchyNode(elementsModel), true);
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
    idsCache: ModelsTreeIdsCache;
    imodelAccess: IModelAccess;
    viewport: Viewport;
    handler: HierarchyVisibilityHandler & Disposable;
    provider: HierarchyProvider & Disposable;
    elementsCategory: Id64String;
    elementsModel: Id64String;
  }>({
    testName: "changing category visibility changes visibility for 50k elements",
    setup: async () => {
      const { iModelConnection, iModel } = TestIModelConnection.openFile(Datasets.getIModelPath("50k 3D elements"));
      const imodelAccess = StatelessHierarchyProvider.createIModelAccess(iModel, "unbounded");
      const visibilityTargets = await getVisibilityTargets(imodelAccess);
      const testData = createTestDataForInitialDisplay({ visibilityTargets, visible: true });

      const viewport = await createViewport({
        iModelConnection,
        testData,
      });
      setupInitialDisplayState({
        viewport,
        ...testData,
      });
      const idsCache = new ModelsTreeIdsCache(imodelAccess, defaultModelsTreeHierarchyConfiguration);
      const handler = createModelsTreeVisibilityHandler({ idsCache, viewport, imodelAccess });
      const provider = createIModelHierarchyProvider({
        hierarchyDefinition: new ModelsTreeDefinition({ idsCache, imodelAccess, hierarchyConfig: defaultModelsTreeHierarchyConfiguration }),
        imodelAccess,
      });
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
      const elementsModel = iModel.elements.getElementProps(visibilityTargets.elements[0]).model;
      expect(visibilityTargets.categories.length).to.be.eq(1);
      const elementsCategory = visibilityTargets.categories[0];
      return { iModel, imodelAccess, viewport, provider, handler, elementsCategory, elementsModel, idsCache };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport[Symbol.dispose]();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      props.idsCache[Symbol.dispose]();
    },
    test: async ({ viewport, handler, provider, elementsCategory, elementsModel }) => {
      await handler.changeVisibility(createCategoryHierarchyNode(elementsCategory, true, elementsModel), false);
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
    },
  });

  run<{
    iModel: SnapshotDb;
    idsCache: ModelsTreeIdsCache;
    imodelAccess: IModelAccess;
    viewport: Viewport;
    handler: HierarchyVisibilityHandler & Disposable;
    provider: HierarchyProvider & Disposable;
    elementsCategory: Id64String;
    elementsModel: Id64String;
  }>({
    testName: "changing per-model-category override changes visibility for 50k elements",
    setup: async () => {
      const { iModelConnection, iModel } = TestIModelConnection.openFile(Datasets.getIModelPath("50k 3D elements"));
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
      const idsCache = new ModelsTreeIdsCache(imodelAccess, defaultModelsTreeHierarchyConfiguration);
      const handler = createModelsTreeVisibilityHandler({ idsCache, viewport, imodelAccess });
      const provider = createIModelHierarchyProvider({
        hierarchyDefinition: new ModelsTreeDefinition({ idsCache, imodelAccess, hierarchyConfig: defaultModelsTreeHierarchyConfiguration }),
        imodelAccess,
      });

      const elementsModel = iModel.elements.getElementProps(visibilityTargets.elements[0]).model;
      expect(visibilityTargets.categories.length).to.be.eq(1);
      const elementsCategory = visibilityTargets.categories[0];

      await handler.changeVisibility(createModelHierarchyNode(elementsModel), true);
      viewport.renderFrame();
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
      return { iModel, imodelAccess, viewport, provider, handler, elementsCategory, elementsModel, idsCache };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport[Symbol.dispose]();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      props.idsCache[Symbol.dispose]();
    },
    test: async ({ viewport, handler, provider, elementsCategory, elementsModel }) => {
      viewport.perModelCategoryVisibility.setOverride(elementsModel, elementsCategory, PerModelCategoryVisibility.Override.Hide);
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
    },
  });

  run<{
    iModel: SnapshotDb;
    idsCache: ModelsTreeIdsCache;
    imodelAccess: IModelAccess;
    viewport: Viewport;
    handler: HierarchyVisibilityHandler & Disposable;
    provider: HierarchyProvider & Disposable;
    node: { modelId: Id64String; categoryId: Id64String; elementId: Id64String; subjectId: Id64String };
  }>({
    testName: "changing element visibility changes only parent nodes visibility with 50k elements",
    setup: async () => {
      const { iModelConnection, iModel } = TestIModelConnection.openFile(Datasets.getIModelPath("50k 3D elements"));
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
      const idsCache = new ModelsTreeIdsCache(imodelAccess, defaultModelsTreeHierarchyConfiguration);
      const handler = createModelsTreeVisibilityHandler({ idsCache, viewport, imodelAccess });
      const provider = createIModelHierarchyProvider({
        hierarchyDefinition: new ModelsTreeDefinition({ idsCache, imodelAccess, hierarchyConfig: defaultModelsTreeHierarchyConfiguration }),
        imodelAccess,
      });

      const elementsModel = iModel.elements.getElementProps(visibilityTargets.elements[0]).model;
      expect(visibilityTargets.categories.length).to.be.eq(1);
      const elementsCategory = visibilityTargets.categories[0];
      const node = { modelId: elementsModel, elementId: visibilityTargets.elements[0], categoryId: elementsCategory, subjectId: "0x1" };
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });

      return { iModel, imodelAccess, viewport, provider, handler, node, idsCache };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport[Symbol.dispose]();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      props.idsCache[Symbol.dispose]();
    },
    test: async ({ viewport, handler, provider, node }) => {
      await handler.changeVisibility(createElementHierarchyNode(node), true);
      viewport.renderFrame();
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: {
          default: "all-hidden",
          instances: {
            [node.modelId]: "partial",
            [node.subjectId]: "partial",
            [node.categoryId]: "partial",
            [node.elementId]: "visible",
          },
        },
      });
    },
  });
});
