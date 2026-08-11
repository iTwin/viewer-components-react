/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { configDefaults, coverageConfigDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";

const logsToIgnore = ["CSS variable not found", "ECClass 'PresentationRules.Ruleset' does not exist or could not be loaded."];

export default defineConfig({
  test: {
    onConsoleLog(log) {
      if (logsToIgnore.some((logToIgnore) => log.includes(logToIgnore))) {
        return false;
      }
    },
    projects: [
      {
        test: {
          name: "tree-widget-unit",
          environment: "jsdom",
          css: false,
          include: ["src/test/**/*.test.ts?(x)"],
          exclude: [...configDefaults.exclude, "src/test/components/**"],
          setupFiles: ["src/test/setup.ts"],
          restoreMocks: true,
          testTimeout: 60000,
          server: {
            deps: {
              inline: [
                "@stratakit/foundations",
                "@stratakit/icons",
                "@stratakit/mui",
                "@mui/material",
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
        },
      },
      {
        // Experimental component (browser) tests. They render tree-widget components in a real browser and validate
        // them via screenshots, so we can catch unwanted visual changes (e.g. while migrating StrataKit -> MUI).
        plugins: [react()],
        optimizeDeps: { include: ["@stratakit/structures", "vitest-browser-react", "axe-core"] },
        test: {
          name: "tree-widget-components",
          include: ["src/test/components/**/*.test.{ts,tsx}"],
          setupFiles: ["src/test/components/setup.tsx"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium", viewport: { width: 800, height: 600 } }],
            expect: {
              toMatchScreenshot: {
                comparatorName: "pixelmatch",
                comparatorOptions: { threshold: 0.2, allowedMismatchedPixelRatio: 0.01 },
              },
            },
          },
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/tree-widget-react/**/*"],
      exclude: [...coverageConfigDefaults.exclude, "**/*.d.ts", "**/*.d.tsx"],
      reporter: ["text-summary", "lcov", "cobertura"],
      reportsDirectory: "./lib/test/coverage",
    },
  },
});
