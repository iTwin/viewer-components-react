/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defineConfig, loadEnv, Plugin } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import react from "@vitejs/plugin-react";

const ENV_PREFIX = "IMJS_";

const injectedPackages = [
  "@itwin/property-grid-react",
  "@itwin/tree-widget-react",
  "@itwin/measure-tools-react",
  "@itwin/map-layers",
  "@itwin/geo-tools-react",
  "@itwin/grouping-mapping-widget",
  "@itwin/reports-config-widget-react",
  "@itwin/ec3-widget-react",
  "@itwin/one-click-lca-react",
];

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ENV_PREFIX);

  if (!env.IMJS_AUTH_CLIENT_CLIENT_ID) {
    throw new Error("Please add a valid OIDC client id to the .env file and restart. See the README for more information.");
  }
  if (!env.IMJS_AUTH_CLIENT_SCOPES) {
    throw new Error("Please add valid scopes for your OIDC client to the .env file and restart. See the README for more information.");
  }
  if (!env.IMJS_AUTH_CLIENT_REDIRECT_URI) {
    throw new Error("Please add a valid redirect URI to the .env file and restart. See the README for more information.");
  }

  const disableReloading = !!env.IMJS_DISABLE_HOT_RELOAD;

  return {
    plugins: [
      react(),
      viteStaticCopy({
        targets: [
          {
            // copy assets from `@itwin` dependencies
            src: "./node_modules/@itwin/*/lib/public/*",
            dest: ".",
          },
        ],
      }),
      ...(disableReloading ? [] : [reloadInjectedPackages(injectedPackages)]),
    ],
    server: {
      port: 3000,
      strictPort: true,
    },
    resolve: {
      alias: [
        {
          // Resolve SASS tilde imports.
          find: /^~(.*)$/,
          replacement: "$1",
        },
      ],
    },
    envPrefix: ENV_PREFIX,
    define: {
      "process.env.IMJS_URL_PREFIX": env.IMJS_URL_PREFIX ? `"${env.IMJS_URL_PREFIX}"` : `""`,
    },
  };
});

function reloadInjectedPackages(modules: string[]): Plugin {
  return {
    name: "watch-node-modules",
    configureServer: (server) => {
      server.watcher.options = {
        ...server.watcher.options,
        ignored: modules.map((m) => `!**/node_modules/${m}/**`),
      };

      (server.watcher as any)._userIgnored = undefined;
    },
    config: () => {
      return {
        optimizeDeps: {
          force: true,
          exclude: [...modules, "@itwin/itwinui-react"],
          include: modules.flatMap((mod) => forceIncludes.map((inc) => `${mod} > ${inc}`)),
        },
        resolve: {
          dedupe: ["@itwin/imodels-access-common", "@itwin/imodels-access-frontend"],
        },
      };
    },
  };
}

// list of dependencies that should be force optimized. This is needed to avoid errors like this:
// Uncaught SyntaxError: The requested module '/node_modules/.pnpm/someDep*' does not provide an export named 'someExport'
const forceIncludes = [
  "lodash",
  "react-split",
  "react-table",
  "react-dom",
  "react-dom/server",
  "react-redux",
  "react-transition-group",
  "simple-react-validator",
  "classnames",
  "ts-key-enum",
  "natural-compare-lite",
  "@emotion/react",
  "@seznam/compose-react-refs",
  "@floating-ui/react",
  "@tippyjs/react",
  "@tanstack/react-query",
  "@itwin/insights-client",
  "@itwin/presentation-frontend",
  "@itwin/presentation-components",
  "@itwin/imodel-components-react",
];
