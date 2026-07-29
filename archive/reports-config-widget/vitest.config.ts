/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { defineConfig } from "vitest/config";

export default defineConfig({
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
    server: {
      deps: {
        inline: [
          "@itwin/appui-react",
          "@itwin/components-react",
          "@itwin/core-react",
          "@itwin/imodel-components-react",
        ],
      },
    },
  },
});
