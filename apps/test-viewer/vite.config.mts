/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { readFileSync } from "fs";
import { defineConfig, loadEnv, Plugin } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import react from "@vitejs/plugin-react";

const ENV_PREFIX = "IMJS_";

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

  const reloadConfig = getReloadConfig(env.IMJS_ENABLE_HOT_RELOAD);

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
          {
            // copy assets from `@bentley` dependencies
            src: "./node_modules/@bentley/*/lib/public/*",
            dest: ".",
          },
        ],
      }),
      ...(reloadConfig ? [reloadInjectedPackages(reloadConfig)] : []),
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
    build: {
      assetsInlineLimit: (filePath) => {
        if (filePath.includes("@itwin/itwinui-icons/")) return false;
        return undefined;
      },
    },
  };
});

function getReloadConfig(config?: string) {
  if (!!config) {
    return config === "polling" ? { usePolling: true } : {};
  }
  return undefined;
}

function reloadInjectedPackages(config: { usePolling?: boolean }): Plugin {
  const { rootDependencies, injectedPackages } = getRootConfig();
  const include = [...injectedPackages, "@itwin/itwinui-react"].flatMap((mod) => getModuleIncludes(mod));
  return {
    name: "watch-node-modules",
    configureServer: (server) => {
      server.watcher.options = {
        ...server.watcher.options,
        ...config,
        ignored: ["**/build/**", "**/node_modules/.vite/**", ...injectedPackages.map((mod) => `!**/node_modules/${mod}/lib/esm/**`)],
      };
      (server.watcher as any)._userIgnored = undefined;
    },
    config: () => {
      return {
        optimizeDeps: {
          force: true,
          exclude: [...injectedPackages, "@itwin/itwinui-react"],
          include: [...rootDependencies, ...include, ...forceInclude],
        },
      };
    },
  };
}

function getRootConfig() {
  const packageJson = JSON.parse(readFileSync("./package.json", { encoding: "utf-8" }));
  const injectedPackages = Object.keys(packageJson.dependenciesMeta);
  const excluded = [...excludedDeps, ...injectedPackages, "@itwin/itwinui-react"];
  return {
    injectedPackages,
    rootDependencies: Object.keys(packageJson.dependencies).filter((dep) => !excluded.includes(dep)),
  };
}

function getModuleIncludes(module: string) {
  const packageJson = JSON.parse(readFileSync(`./node_modules/${module}/package.json`, { encoding: "utf-8" }));
  const deps = Object.keys(packageJson.dependencies);
  return deps.filter((dep) => !excludedDeps.includes(dep)).map((dep) => `${module} > ${dep}`);
}

const excludedDeps = ["@bentley/icons-generic-webfont", "@bentley/icons-generic", "@itwin/imodels-access-common"];
const forceInclude = ["react-dom/server"];
