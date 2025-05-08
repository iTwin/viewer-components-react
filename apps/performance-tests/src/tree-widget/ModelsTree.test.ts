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
  createModelHierarchyNode,
  createTestDataForInitialDisplay,
  createViewport,
  getAllIModelElements,
  setupInitialDisplayState,
  validateHierarchyVisibility,
} from "./VisibilityUtilities.js";

import type { Id64Array } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
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
    testName: "changes visibility for 50k elements",
    setup: async () => {
      const { iModelConnection, iModel } = TestIModelConnection.openFile(Datasets.getIModelPath("50k 3D elements"));
      const imodelAccess = StatelessHierarchyProvider.createIModelAccess(iModel, "unbounded");
      const keys = await getAllIModelElements(imodelAccess);
      const testData = createTestDataForInitialDisplay(keys, false);

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
});
