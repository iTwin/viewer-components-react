/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SnapshotDb } from "@itwin/core-backend";
import { ClassificationsTreeDefinition, ClassificationsTreeIdsCache } from "@itwin/tree-widget-react/internal";
import { Datasets } from "../util/Datasets.js";
import { run } from "../util/TestUtilities.js";
import { StatelessHierarchyProvider } from "./StatelessHierarchyProvider.js";

import type { IModelAccess } from "./StatelessHierarchyProvider.js";
import type { HierarchyDefinition } from "@itwin/presentation-hierarchies";

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
  return run<{ imodel: SnapshotDb; imodelAccess: IModelAccess; idsCache: ClassificationsTreeIdsCache; hierarchyDefinition: HierarchyDefinition }>({
    testName,
    setup: async () => {
      const imodel = SnapshotDb.openFile(Datasets.getIModelPath("50k classifications"));
      const imodelAccess = StatelessHierarchyProvider.createIModelAccess(imodel, "unbounded");
      const idsCache = new ClassificationsTreeIdsCache(imodelAccess, hierarchyConfig);
      const hierarchyDefinition = new ClassificationsTreeDefinition({ imodelAccess, idsCache, hierarchyConfig });
      return { imodel, imodelAccess, idsCache, hierarchyDefinition };
    },
    cleanup: (props) => {
      props.imodel.close();
      props.idsCache[Symbol.dispose]();
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
