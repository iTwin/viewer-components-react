/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { coverageConfigDefaults, defineConfig } from "vitest/config";

const logsToIgnore = [
  "CSS variable not found",
  // TODO: Should be removed after core 5.8 is consumed
  "there are no unsaved changes",
];

export default defineConfig({
  test: {
    environment: "jsdom",
    css: false,
    include: ["src/test/**/*.test.ts?(x)"],
    setupFiles: ["src/test/setup.ts"],
    onConsoleLog(log) {
      if (logsToIgnore.some((logToIgnore) => log.includes(logToIgnore))) {
        return false;
      }
    },
    restoreMocks: true,
    testTimeout: 60000,
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
        ],
      },
    },
    coverage: {
      provider: "v8",
      include: ["src/tree-widget-react/**/*"],
      exclude: [...coverageConfigDefaults.exclude, "**/*.d.ts", "**/*.d.tsx"],
      reporter: ["text-summary", "lcov", "cobertura"],
      reportsDirectory: "./lib/test/coverage",
    },
  },
});
