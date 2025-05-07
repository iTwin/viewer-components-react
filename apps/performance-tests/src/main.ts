/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { UiFramework } from "@itwin/appui-react";
import { EmptyLocalization, IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { setLogger } from "@itwin/presentation-hierarchies";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { TreeWidget } from "@itwin/tree-widget-react";
import { Datasets } from "./util/Datasets.js";
import { LOGGER } from "./util/Logging.cjs";

before(async () => {
  setLogger(LOGGER);
  await initializePresentationTesting({
    backendHostProps: {
      profileName: "vcr-performance-tests",
    },
    backendProps: {
      caching: {
        hierarchies: {
          mode: HierarchyCacheMode.Memory,
        },
      },
    },
    rpcs: [SnapshotIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
  });
  //eslint-disable-next-line @itwin/no-internal
  ECSchemaRpcImpl.register();
  // await IModelHost.startup({
  //   profileName: "presentation-performance-tests",
  // });
  await Datasets.initialize("./datasets");
  await UiFramework.initialize();
  await TreeWidget.initialize(new EmptyLocalization());
});

after(async () => {
  // await IModelHost.shutdown();
  await terminatePresentationTesting();
  UiFramework.terminate();
  TreeWidget.terminate();
});
