/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defineConfig, loadEnv } from "vite";
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
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ["legacy-js-api", "import", "global-builtin"],
          quietDeps: true,
        },
      },
    },
  };
});
