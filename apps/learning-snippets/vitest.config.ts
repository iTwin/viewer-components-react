/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    restoreMocks: true,
    include: ["src/test/**/*.test.{ts,tsx}"],
    setupFiles: ["src/setup.ts"],
    environmentOptions: {
      happyDOM: {
        settings: {
          // Prevent DOMException [NetworkError] when iTwinUI injects Google Fonts <link> elements
          disableCSSFileLoading: true,
          handleDisabledFileLoadingAsSuccess: true,
        },
      },
    },
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
          "@itwin/quantity-formatting-react",
          "@itwin/property-grid-react",
        ],
      },
    },
  },
});
