/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";
import TestReporter from "./src/util/TestReporter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const treeWidgetRoot = path.resolve(__dirname, "../../packages/itwin/tree-widget");
const treeWidgetSrc = path.resolve(treeWidgetRoot, "src");

function collectDepsFromPackage(...packageDirs: string[]): string[] {
  const deps = new Set<string>();
  for (const dir of packageDirs) {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(dir, "package.json"), "utf-8"));
    for (const dep of Object.keys(pkg.peerDependencies ?? {})) {
      deps.add(dep);
    }
    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      deps.add(dep);
    }
    for (const dep of Object.keys(pkg.devDependencies ?? {})) {
      deps.add(dep);
    }
  }
  return [...deps];
}

export default defineConfig({
  // Debugging dependencies (in this case tree-widget) is not easy since source maps don't seem to work.
  // Adding these aliases allows adding breakpoints straight into the source code and it does not need to be built.
  resolve: {
    alias: [
      { find: "@itwin/tree-widget-react/internal", replacement: path.resolve(treeWidgetSrc, "tree-widget-react-internal.ts") },
      { find: "@itwin/tree-widget-react", replacement: path.resolve(treeWidgetSrc, "tree-widget-react.ts") },
    ],
    // Dedupe ensures that shared dependencies (e.g. @itwin/core-frontend) resolve from this app's
    // node_modules rather than the tree-widget package's node_modules, preventing duplicate package errors.
    dedupe: collectDepsFromPackage(treeWidgetRoot, __dirname),
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    testTimeout: 300_000,
    fileParallelism: false,
    setupFiles: ["src/setup.ts"],
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
