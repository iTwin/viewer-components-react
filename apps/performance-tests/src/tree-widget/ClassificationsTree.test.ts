/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ClassificationsTreeDefinition, ClassificationsTreeIdsCache, TreeWidgetIdsCache } from "@itwin/tree-widget-react/internal";
import { Datasets } from "../util/Datasets.js";
import { run, TestIModelConnection } from "../util/TestUtilities.js";
import { StatelessHierarchyProvider } from "./StatelessHierarchyProvider.js";

import type { SnapshotDb } from "@itwin/core-backend";
import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchyDefinition } from "@itwin/presentation-hierarchies";
import type { IModelAccess } from "./StatelessHierarchyProvider.js";

describe("classifications tree", () => {
  const rootClassificationSystemCode = "50k classifications";

  runClassificationsPerformanceTest({
    testName: "loads initial view for iModel with 50k classifications",
    hierarchyConfig: { rootClassificationSystemCode },
    loadHierarchyProps: { shouldExpand: (node) => node.children && !!node.autoExpand },
    validateResult: (result) => {
      expect(result).to.eq(50);
    },
  });

  runClassificationsPerformanceTest({
    testName: "loads first branch for iModel with 50k classifications",
    hierarchyConfig: { rootClassificationSystemCode },
    loadHierarchyProps: { shouldExpand: (node, index) => node.children && index === 0 },
    validateResult: (result) => {
      expect(result).to.eq(50 /* tables */ + 1000 /* classifications */ + 3 /* classification + spatial category + drawing category */);
    },
  });
});

function runClassificationsPerformanceTest({
  testName,
  hierarchyConfig,
  loadHierarchyProps,
  validateResult,
}: {
  testName: string;
  hierarchyConfig: ConstructorParameters<typeof ClassificationsTreeDefinition>[0]["hierarchyConfig"];
  loadHierarchyProps?: Parameters<StatelessHierarchyProvider["loadHierarchy"]>[0];
  validateResult?: (result: number) => Promise<void> | void;
}) {
  return run<{
    iModel: SnapshotDb;
    imodelAccess: IModelAccess;
    idsCache: ClassificationsTreeIdsCache;
    hierarchyDefinition: HierarchyDefinition;
    iModelConnection: IModelConnection;
  }>({
    testName,
    setup: async () => {
      const { iModelConnection, iModel } = TestIModelConnection.openFile(Datasets.getIModelPath("50k classifications"));
      const imodelAccess = StatelessHierarchyProvider.createIModelAccess(iModel, "unbounded");
      const idsCache = new ClassificationsTreeIdsCache(imodelAccess, hierarchyConfig, { cache: new TreeWidgetIdsCache(iModelConnection), shouldDispose: true });
      const hierarchyDefinition = new ClassificationsTreeDefinition({ imodelAccess, idsCache, hierarchyConfig });
      return { iModel, imodelAccess, idsCache, hierarchyDefinition, iModelConnection };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.idsCache[Symbol.dispose]();
      if (!props.iModelConnection.isClosed) {
        await props.iModelConnection.close();
      }
    },
    test: async ({ imodelAccess, hierarchyDefinition }) => {
      using provider = new StatelessHierarchyProvider({
        imodelAccess,
        getHierarchyFactory: () => hierarchyDefinition,
      });
      const result = await provider.loadHierarchy(loadHierarchyProps);
      await validateResult?.(result);
    },
  });
}
