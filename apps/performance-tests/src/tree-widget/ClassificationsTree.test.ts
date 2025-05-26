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

describe("classifications tree", () => {
  const rootClassificationSystemCode = "50k classifications";

  run<{ imodel: SnapshotDb; imodelAccess: IModelAccess; idsCache: ClassificationsTreeIdsCache }>({
    testName: "creates initial view from iModel with 50k classifications",
    setup: async () => {
      const imodel = SnapshotDb.openFile(Datasets.getIModelPath("50k classifications"));
      const imodelAccess = StatelessHierarchyProvider.createIModelAccess(imodel, "unbounded");
      const idsCache = new ClassificationsTreeIdsCache(imodelAccess, { rootClassificationSystemCode });
      return { imodel, imodelAccess, idsCache };
    },
    cleanup: (props) => {
      props.imodel.close();
      props.idsCache[Symbol.dispose]();
    },
    test: async ({ imodelAccess, idsCache }) => {
      using provider = new StatelessHierarchyProvider({
        imodelAccess,
        getHierarchyFactory: () =>
          new ClassificationsTreeDefinition({
            imodelAccess,
            idsCache,
            hierarchyConfig: {
              rootClassificationSystemCode,
            },
          }),
      });
      const result = await provider.loadHierarchy({ depth: 1 });
      expect(result).to.eq(10);
    },
  });
});
