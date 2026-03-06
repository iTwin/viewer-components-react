/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import glob from "fast-glob";
import { defineConfig } from "tsdown";

const testFiles = await glob("src/test/**/*");
export default defineConfig({
  entry: testFiles,
  outDir: "./lib/test",
  format: ["esm"],
  fixedExtension: false,
  unbundle: true,
  clean: false,
  deps: {
    neverBundle: (id) => {
      if (id.match(/\/tree-widget-react\//i)) {
        return true;
      }

      return !id.match(/src\/test/i);
    },
  },
});
