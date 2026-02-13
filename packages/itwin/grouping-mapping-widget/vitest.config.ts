/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "react-dom/client": "react-dom",
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    dir: "src",
    css: false,
    server: {
      deps: {
        inline: [
          "@itwin/appui-react",
          "@itwin/components-react",
          "@itwin/core-react",
          "@itwin/imodel-components-react",
          "@itwin/presentation-components",
          "@tanstack/react-query",
        ],
      },
    },
  },
});
