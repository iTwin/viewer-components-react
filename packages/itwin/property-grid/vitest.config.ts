/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { coverageConfigDefaults, defineConfig } from "vitest/config";

const logsToIgnore = ["CSS variable not found"];

export default defineConfig({
  test: {
    environment: "happy-dom",
    css: false,
    include: ["src/test/**/*.test.ts?(x)"],
    setupFiles: ["src/test/setup.ts"],
    onConsoleLog(log) {
      if (logsToIgnore.some((logToIgnore) => log.includes(logToIgnore))) {
        return false;
      }
    },
    environmentOptions: {
      happyDOM: {
        settings: {
          // Prevent DOMException [NetworkError] when iTwinUI injects Google Fonts <link> elements
          disableCSSFileLoading: true,
          handleDisabledFileLoadingAsSuccess: true,
        },
      },
    },
    restoreMocks: true,
    testTimeout: 60000,
    server: {
      deps: {
        inline: ["@itwin/appui-react", "@itwin/components-react", "@itwin/core-react", "@itwin/imodel-components-react", "@itwin/presentation-components"],
      },
    },
    coverage: {
      provider: "v8",
      include: ["src/property-grid-react/**/*"],
      exclude: [...coverageConfigDefaults.exclude, "**/*.d.ts", "**/*.d.tsx"],
      reporter: ["text-summary", "lcov", "cobertura"],
      reportsDirectory: "./lib/test/coverage",
    },
  },
});
