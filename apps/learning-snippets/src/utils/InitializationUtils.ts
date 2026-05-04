/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as url from "url";
import { IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { HierarchyCacheMode, initializeCore, terminateCore } from "test-utilities";

export async function initializeLearningSnippetsTests() {
  await initializeCore({
    testOutputDir: path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..", "..", "lib", "test", "out", `${process.pid}`),
    backendProps: {
      caching: {
        hierarchies: {
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          mode: HierarchyCacheMode.Memory,
        },
      },
    },
    rpcs: [IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
  });
  // eslint-disable-next-line @itwin/no-internal
  ECSchemaRpcImpl.register();
}

export async function terminateLearningSnippetsTests() {
  await terminateCore();
}
