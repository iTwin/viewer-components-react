/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import { IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";

export async function initializeLearningSnippetsTests() {
  const outDir = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..", "..", "lib", "test", "out", `${process.pid}`);
  fs.mkdirSync(outDir, { recursive: true });

  await initializePresentationTesting({
    backendProps: {
      caching: {
        hierarchies: {
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          mode: HierarchyCacheMode.Memory,
        },
      },
    },
    testOutputDir: path.join(outDir, "output"),
    backendHostProps: {
      cacheDir: path.join(outDir, "cache"),
    },
    rpcs: [IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
  });
  // eslint-disable-next-line @itwin/no-internal
  ECSchemaRpcImpl.register();
}

export async function terminateLearningSnippetsTests() {
  await terminatePresentationTesting();
}
