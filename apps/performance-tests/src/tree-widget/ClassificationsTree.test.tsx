/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect } from "vitest";
import { SnapshotDb } from "@itwin/core-backend";
import { BaseIdsCache, ClassificationsTreeDefinition, ClassificationsTreeIdsCache } from "@itwin/tree-widget-react/internal";
import { Datasets } from "../util/Datasets.js";
import { run } from "../util/TestUtilities.js";
import { StatelessHierarchyProvider } from "./StatelessHierarchyProvider.js";

import type { HierarchyDefinition } from "@itwin/presentation-hierarchies";
import type { IModelAccess } from "./StatelessHierarchyProvider.js";

describe("classifications tree", () => {
  const rootClassificationSystemCode = "50k classifications";

  runClassificationsPerformanceTest({
    testName: "loads initial view for iModel with 50k classifications",
    hierarchyConfig: { rootClassificationSystemCode },
    loadHierarchyProps: { shouldExpand: (node) => node.children && !!node.autoExpand },
    validateResult: (result) => {
      expect(result).toBe(50);
    },
  });

  runClassificationsPerformanceTest({
    testName: "loads first branch for iModel with 50k classifications",
    hierarchyConfig: { rootClassificationSystemCode },
    loadHierarchyProps: { shouldExpand: (node, index) => node.children && index === 0 },
    validateResult: (result) => {
      expect(result).toBe(50 /* tables */ + 1000 /* classifications */ + 2 /* classification + spatial category */);
    },
  });
});

function runClassificationsPerformanceTest({
  testName,
  hierarchyConfig,
  loadHierarchyProps,
  validateResult,
  only,
}: {
  testName: string;
  hierarchyConfig: ConstructorParameters<typeof ClassificationsTreeDefinition>[0]["hierarchyConfig"];
  loadHierarchyProps?: Parameters<StatelessHierarchyProvider["loadHierarchy"]>[0];
  validateResult?: (result: number) => Promise<void> | void;
  only?: boolean;
}) {
  return run<{
    imodel: SnapshotDb;
    imodelAccess: IModelAccess;
    hierarchyDefinition: HierarchyDefinition;
  }>({
    testName,
    only,
    setup: async () => {
      const imodel = SnapshotDb.openFile(Datasets.getIModelPath("50k classifications"));
      const imodelAccess = StatelessHierarchyProvider.createIModelAccess(imodel, "unbounded");
      const baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, elementClassName: "BisCore:GeometricElement3d", type: "3d" });
      const idsCache = new ClassificationsTreeIdsCache({
        queryExecutor: imodelAccess,
        hierarchyConfig,
        baseIdsCache,
      });
      const hierarchyDefinition = new ClassificationsTreeDefinition({ imodelAccess, getIdsCache: () => idsCache, hierarchyConfig });
      return { imodel, imodelAccess, hierarchyDefinition };
    },
    cleanup: (props) => {
      props.imodel.close();
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
