/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SnapshotDb } from "@itwin/core-backend";
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
  collectNodes,
  createCategoryHierarchyNode,
  createElementHierarchyNode,
  createModelHierarchyNode,
  createTestDataForInitialDisplay,
  createViewport,
  getVisibilityTargets,
  setupInitialDisplayState,
  validateHierarchyVisibility,
} from "./VisibilityUtilities.js";

import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchyNode, HierarchyProvider } from "@itwin/presentation-hierarchies";
import type { ECSqlQueryDef, InstanceKey } from "@itwin/presentation-shared";
import type { HierarchyVisibilityHandler } from "@itwin/tree-widget-react";
import type { IModelAccess } from "./StatelessHierarchyProvider.js";
import type { TreeWidgetTestingViewport } from "./VisibilityUtilities.js";

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
      const search = {
        paths: await ModelsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          limit: "unbounded",
          targetItems,
          idsCache,
          hierarchyConfig: defaultModelsTreeHierarchyConfiguration,
        }),
      };
      expect(search.paths.length).to.eq(50000);
      using provider = new StatelessHierarchyProvider({
        imodelAccess,
        getHierarchyFactory: () => new ModelsTreeDefinition({ imodelAccess, idsCache, hierarchyConfig: defaultModelsTreeHierarchyConfiguration }),
        search,
      });
      const result = await provider.loadHierarchy({ shouldExpand: (node) => node.children && !!node.autoExpand });
      expect(result).to.eq(2);
    },
  });
  run<{
    iModel: SnapshotDb;
    idsCache: ModelsTreeIdsCache;
    imodelAccess: IModelAccess;
    viewport: TreeWidgetTestingViewport;
    handler: HierarchyVisibilityHandler & Disposable;
    provider: HierarchyProvider & Disposable;
    elementsModel: Id64String;
    iModelConnection: IModelConnection;
    hierarchyNodes: HierarchyNode[];
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
      const hierarchyNodes = await collectNodes({ provider, ignoreChildren: (node) => !!node.extendedData?.isCategory });
      await validateHierarchyVisibility({
        hierarchyNodes,
        handler,
        viewport,
        expectations: "all-hidden",
      });
      const elementsModel = iModel.elements.getElementProps(visibilityTargets.elements[0]).model;
      return { iModel, imodelAccess, viewport, provider, handler, elementsModel, idsCache, iModelConnection, hierarchyNodes };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport[Symbol.dispose]();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      props.idsCache[Symbol.dispose]();
      if (!props.iModelConnection.isClosed) {
        await props.iModelConnection.close();
      }
    },
    test: async ({ viewport, handler, hierarchyNodes, elementsModel }) => {
      // Add one element to always draw set to trigger additional queries
      viewport.setAlwaysDrawn({ elementIds: new Set([elementsModel]) });
      viewport.renderFrame();
      await handler.changeVisibility(createModelHierarchyNode(elementsModel), true);
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
    idsCache: ModelsTreeIdsCache;
    imodelAccess: IModelAccess;
    viewport: TreeWidgetTestingViewport;
    handler: HierarchyVisibilityHandler & Disposable;
    provider: HierarchyProvider & Disposable;
    elementsModel: Id64String;
    iModelConnection: IModelConnection;
    hierarchyNodes: HierarchyNode[];
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
      const hierarchyNodes = await collectNodes({ provider });
      await validateHierarchyVisibility({
        hierarchyNodes,
        handler,
        viewport,
        expectations: "all-hidden",
      });
      const elementsModel = iModel.elements.getElementProps(visibilityTargets.elements[0]).model;
      return { iModel, imodelAccess, viewport, provider, handler, elementsModel, idsCache, iModelConnection, hierarchyNodes };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport[Symbol.dispose]();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      props.idsCache[Symbol.dispose]();
      if (!props.iModelConnection.isClosed) {
        await props.iModelConnection.close();
      }
    },
    test: async ({ viewport, handler, hierarchyNodes, elementsModel }) => {
      await handler.changeVisibility(createModelHierarchyNode(elementsModel), true);
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
    idsCache: ModelsTreeIdsCache;
    imodelAccess: IModelAccess;
    viewport: TreeWidgetTestingViewport;
    handler: HierarchyVisibilityHandler & Disposable;
    provider: HierarchyProvider & Disposable;
    elementsCategory: Id64String;
    elementsModel: Id64String;
    iModelConnection: IModelConnection;
    hierarchyNodes: HierarchyNode[];
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
      const hierarchyNodes = await collectNodes({ provider });
      await validateHierarchyVisibility({
        hierarchyNodes,
        handler,
        viewport,
        expectations: "all-visible",
      });
      const elementsModel = iModel.elements.getElementProps(visibilityTargets.elements[0]).model;
      expect(visibilityTargets.categories.length).to.be.eq(1);
      const elementsCategory = visibilityTargets.categories[0];
      return { iModel, imodelAccess, viewport, provider, handler, elementsCategory, elementsModel, idsCache, iModelConnection, hierarchyNodes };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport[Symbol.dispose]();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      props.idsCache[Symbol.dispose]();
      if (!props.iModelConnection.isClosed) {
        await props.iModelConnection.close();
      }
    },
    test: async ({ viewport, handler, hierarchyNodes, elementsCategory, elementsModel }) => {
      await handler.changeVisibility(createCategoryHierarchyNode(elementsCategory, elementsModel, true), false);
      await validateHierarchyVisibility({
        hierarchyNodes,
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
    viewport: TreeWidgetTestingViewport;
    handler: HierarchyVisibilityHandler & Disposable;
    provider: HierarchyProvider & Disposable;
    elementsCategory: Id64String;
    elementsModel: Id64String;
    iModelConnection: IModelConnection;
    hierarchyNodes: HierarchyNode[];
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
      const hierarchyNodes = await collectNodes({ provider });

      const elementsModel = iModel.elements.getElementProps(visibilityTargets.elements[0]).model;
      expect(visibilityTargets.categories.length).to.be.eq(1);
      const elementsCategory = visibilityTargets.categories[0];

      await handler.changeVisibility(createModelHierarchyNode(elementsModel), true);
      await validateHierarchyVisibility({
        hierarchyNodes,
        handler,
        viewport,
        expectations: "all-visible",
      });
      return { iModel, imodelAccess, viewport, provider, handler, elementsCategory, elementsModel, idsCache, iModelConnection, hierarchyNodes };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport[Symbol.dispose]();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      props.idsCache[Symbol.dispose]();
      if (!props.iModelConnection.isClosed) {
        await props.iModelConnection.close();
      }
    },
    test: async ({ viewport, handler, hierarchyNodes, elementsCategory, elementsModel }) => {
      viewport.setPerModelCategoryOverride({ modelIds: elementsModel, categoryIds: elementsCategory, override: "hide" });
      await validateHierarchyVisibility({
        hierarchyNodes,
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
    viewport: TreeWidgetTestingViewport;
    handler: HierarchyVisibilityHandler & Disposable;
    provider: HierarchyProvider & Disposable;
    node: { modelId: Id64String; categoryId: Id64String; elementId: Id64String; subjectId: Id64String };
    iModelConnection: IModelConnection;
    hierarchyNodes: HierarchyNode[];
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
      const hierarchyNodes = await collectNodes({ provider });

      const elementsModel = iModel.elements.getElementProps(visibilityTargets.elements[0]).model;
      expect(visibilityTargets.categories.length).to.be.eq(1);
      const elementsCategory = visibilityTargets.categories[0];
      const node = { modelId: elementsModel, elementId: visibilityTargets.elements[0], categoryId: elementsCategory, subjectId: "0x1" };
      await validateHierarchyVisibility({
        hierarchyNodes,
        handler,
        viewport,
        expectations: "all-hidden",
      });

      return { iModel, imodelAccess, viewport, provider, handler, node, idsCache, iModelConnection, hierarchyNodes };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport[Symbol.dispose]();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      props.idsCache[Symbol.dispose]();
      if (!props.iModelConnection.isClosed) {
        await props.iModelConnection.close();
      }
    },
    test: async ({ viewport, handler, hierarchyNodes, node }) => {
      await handler.changeVisibility(createElementHierarchyNode(node), true);
      await validateHierarchyVisibility({
        hierarchyNodes,
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
          parentIds: {
            [node.elementId]: "visible",
          },
        },
      });
    },
  });

  run<{
    iModel: SnapshotDb;
    idsCache: ModelsTreeIdsCache;
    imodelAccess: IModelAccess;
    viewport: TreeWidgetTestingViewport;
    handler: HierarchyVisibilityHandler & Disposable;
    provider: HierarchyProvider & Disposable;
    node: { modelId: Id64String; categoryId: Id64String; elementId: Id64String; subjectId: Id64String };
    iModelConnection: IModelConnection;
    hierarchyNodes: HierarchyNode[];
  }>({
    testName: "changing element visibility changes only parent nodes visibility with 50k child elements with different categories",
    setup: async () => {
      const { iModelConnection, iModel } = TestIModelConnection.openFile(Datasets.getIModelPath("50k 3D child elements with different categories"));
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
        // lets child categories visible in selector except top most elements category
        categories: testData.categories.map((category, index) => ({ ...category, visible: index !== 0 })),
      });
      const idsCache = new ModelsTreeIdsCache(imodelAccess, defaultModelsTreeHierarchyConfiguration);
      const handler = createModelsTreeVisibilityHandler({ idsCache, viewport, imodelAccess });
      const provider = createIModelHierarchyProvider({
        hierarchyDefinition: new ModelsTreeDefinition({ idsCache, imodelAccess, hierarchyConfig: defaultModelsTreeHierarchyConfiguration }),
        imodelAccess,
      });
      const hierarchyNodes = await collectNodes({ provider });

      const elementsModel = iModel.elements.getElementProps(visibilityTargets.elements[0]).model;
      expect(visibilityTargets.categories.length).to.be.eq(3);
      const elementsCategory = visibilityTargets.categories[0];
      const node = { modelId: elementsModel, elementId: visibilityTargets.elements[0], categoryId: elementsCategory, subjectId: "0x1" };
      await validateHierarchyVisibility({
        hierarchyNodes,
        handler,
        viewport,
        expectations: "all-hidden",
      });

      return { iModel, imodelAccess, viewport, provider, handler, node, idsCache, iModelConnection, hierarchyNodes };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport[Symbol.dispose]();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      props.idsCache[Symbol.dispose]();
      if (!props.iModelConnection.isClosed) {
        await props.iModelConnection.close();
      }
    },
    test: async ({ viewport, handler, hierarchyNodes, node }) => {
      await handler.changeVisibility(createElementHierarchyNode(node), true);
      await validateHierarchyVisibility({
        hierarchyNodes,
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
          parentIds: {
            [node.elementId]: "visible",
          },
        },
      });
    },
  });
});
