/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SnapshotDb } from "@itwin/core-backend";
import type { Viewport } from "@itwin/core-frontend";
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

import type { Id64Array, Id64String } from "@itwin/core-bentley";
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
    models: Id64Array;
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
      return { iModel, imodelAccess, viewport, provider, handler, models: testData.models.map((model) => model.id), idsCache };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport.dispose();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      props.idsCache[Symbol.dispose]();
    },
    test: async ({ viewport, handler, provider, models }) => {
      await Promise.all(models.map(async (model) => handler.changeVisibility(createModelHierarchyNode(model), true)));
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
    categories: Id64Array;
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
      const query: ECSqlQueryDef = {
        ecsql: `
            SELECT
              Model.Id AS ECInstanceId
            FROM bis.GeometricElement3d
            LIMIT 1
          `,
      };
      let elementsModel = "";
      for await (const row of imodelAccess.createQueryReader(query, { limit: "unbounded" })) {
        elementsModel = row.ECInstanceId;
      }
      return { iModel, imodelAccess, viewport, provider, handler, categories: visibilityTargets.categories, elementsModel, idsCache };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport.dispose();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      props.idsCache[Symbol.dispose]();
    },
    test: async ({ viewport, handler, provider, categories, elementsModel }) => {
      await Promise.all(categories.map(async (category) => handler.changeVisibility(createCategoryHierarchyNode(category, true, elementsModel), false)));
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
    categories: Id64Array;
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
      const query: ECSqlQueryDef = {
        ecsql: `
            SELECT
              Model.Id AS ECInstanceId
            FROM bis.GeometricElement3d
            LIMIT 1
          `,
      };
      let elementsModel = "";
      for await (const row of imodelAccess.createQueryReader(query, { limit: "unbounded" })) {
        elementsModel = row.ECInstanceId;
      }

      await handler.changeVisibility(createModelHierarchyNode(elementsModel), true);
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
      return { iModel, imodelAccess, viewport, provider, handler, categories: visibilityTargets.categories, elementsModel, idsCache };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport.dispose();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      props.idsCache[Symbol.dispose]();
    },
    test: async ({ viewport, handler, provider, categories, elementsModel }) => {
      elementsModel;
      viewport.perModelCategoryVisibility.setOverride(elementsModel, categories, PerModelCategoryVisibility.Override.Hide);
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
      const query: ECSqlQueryDef = {
        ecsql: `
            SELECT
              ECInstanceId AS ECInstanceId,
              Category.Id AS CategoryId,
              Model.Id AS ModelId
            FROM bis.GeometricElement3d this
            WHERE Parent.Id IS NULL
            LIMIT 1
          `,
      };
      const node = { modelId: "", elementId: "", categoryId: "", subjectId: "0x1" };
      for await (const row of imodelAccess.createQueryReader(query, { limit: "unbounded" })) {
        node.elementId = row.ECInstanceId;
        node.modelId = row.ModelId;
        node.categoryId = row.CategoryId;
      }
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
      props.viewport.dispose();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      props.idsCache[Symbol.dispose]();
    },
    test: async ({ viewport, handler, provider, node }) => {
      await handler.changeVisibility(createElementHierarchyNode(node), true);
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
        differentNodeExpectations: {
          [node.modelId]: "partial",
          [node.subjectId]: "partial",
          [node.categoryId]: "partial",
          [node.elementId]: "visible",
        },
      });
    },
  });
});
