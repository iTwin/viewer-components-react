/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const ENV_PREFIX = "IMJS_";

const treeWidgetRoot = path.resolve(rootDir, "../../packages/tree-widget");
const treeWidgetSrc = path.resolve(rootDir, "../../packages/tree-widget/src");

function collectDepsFromPackage(...packageDirs: string[]): string[] {
  const deps = new Set<string>();
  for (const dir of packageDirs) {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(dir, "package.json"), "utf-8"));
    for (const dep of Object.keys(pkg.peerDependencies ?? {})) {
      deps.add(dep);
    }
  }
  return [...deps];
}
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ENV_PREFIX);

  // For e2e tests, we don't do auth, so no need to supply these values
  if (env.IMJS_BUILD_MODE !== "e2e") {
    if (!env.IMJS_AUTH_CLIENT_CLIENT_ID) {
      throw new Error("Please add a valid OIDC client id to the .env file and restart. See the README for more information.");
    }
    if (!env.IMJS_AUTH_CLIENT_SCOPES) {
      throw new Error("Please add valid scopes for your OIDC client to the .env file and restart. See the README for more information.");
    }
    if (!env.IMJS_AUTH_CLIENT_REDIRECT_URI) {
      throw new Error("Please add a valid redirect URI to the .env file and restart. See the README for more information.");
    }
  }

  return {
    plugins: [
      react(),
      viteStaticCopy({
        targets: [
          {
            // copy assets from `@itwin` dependencies
            src: "./node_modules/@itwin/*/lib/public",
            dest: ".",
            // strip `node_modules/@itwin/package/lib/public` from the copied path.
            rename: { stripBase: 5 },
          },
        ],
      }),
    ],
    server: {
      port: 3000,
      strictPort: true,
    },
    optimizeDeps: {
      force: true,
    },
    resolve: {
      alias: [
        // Debugging dependencies (in this case tree-widget) is not easy since source maps don't seem to work.
        // Adding these aliases allows adding breakpoints straight into the source code and it does not need to be built.
        { find: "@itwin/tree-widget-react", replacement: path.resolve(treeWidgetSrc, "tree-widget-react.ts") },
        {
          // Resolve SASS tilde imports.
          find: /^~(.*)$/,
          replacement: "$1",
        },
      ],
      // Dedupe tree-widget's deps so its source imports resolve from this app's node_modules
      // rather than tree-widget's own node_modules, preventing duplicate package instances.
      dedupe: [
        ...collectDepsFromPackage(treeWidgetRoot),
        // These StrataKit packages create module-level React contexts (e.g. foundations' `RootContext`).
        // They are transitive deps (via `@stratakit/mui` / `@itwin/presentation-hierarchies-react`), so they
        // are not listed in tree-widget's peerDependencies and thus not covered by `collectDepsFromPackage`.
        // Without deduping them, the build resolves them from both this app's and tree-widget's node_modules,
        // producing distinct `RootContext` objects and a "RootContext is undefined" crash at runtime.
        "@stratakit/foundations",
      ],
    },
    envPrefix: ENV_PREFIX,
    define: {
      "process.env.IMJS_URL_PREFIX": env.IMJS_URL_PREFIX ? `"${env.IMJS_URL_PREFIX}"` : `""`,
    },
    build: {
      assetsInlineLimit: (filePath) => {
        if (filePath.includes("@itwin/itwinui-icons/")) return false;
        return undefined;
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ["if-function"],
        },
      },
    },
  };
});
