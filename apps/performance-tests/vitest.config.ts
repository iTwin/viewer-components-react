/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defineConfig } from "vitest/config";
import TestReporter from "./src/util/TestReporter.js";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    testTimeout: 300000,
    fileParallelism: false,
    isolate: false,
    setupFiles: ["src/main.ts"],
    reporters: [new TestReporter()],
    css: false,
    server: {
      deps: {
        inline: [
          "@stratakit/foundations",
          "@stratakit/icons",
          "@itwin/appui-react",
          "@itwin/components-react",
          "@itwin/core-react",
          "@itwin/imodel-components-react",
          "@itwin/presentation-components",
          "@itwin/presentation-hierarchies-react",
          "@itwin/presentation-testing",
          "@itwin/tree-widget-react",
        ],
      },
    },
  },
});
