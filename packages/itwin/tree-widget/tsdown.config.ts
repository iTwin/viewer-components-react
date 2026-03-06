/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defineConfig } from "tsdown";
import { babel } from "@rollup/plugin-babel";

export default defineConfig({
  entry: ["./src/tree-widget-react.ts", "./src/tree-widget-react-internal.ts"],
  outDir: "./lib",
  format: ["esm"],
  copy: [
    { from: "./public", to: "./lib", flatten: false },
    { from: "./src/**/*.{css,scss}", to: "./lib", flatten: false },
  ],
  fixedExtension: false,
  unbundle: true,
  deps: {
    neverBundle: [/\.css$/, "@itwin/presentation-frontend"],
  },
  plugins: [
    babel({
      babelHelpers: "bundled",
      parserOpts: {
        sourceType: "module",
        plugins: ["jsx", "typescript"],
      },
      plugins: [
        [
          "babel-plugin-react-compiler",
          {
            target: "18",
          },
        ],
      ],
      extensions: [".js", ".jsx", ".ts", ".tsx"],
    }),
  ],
});
