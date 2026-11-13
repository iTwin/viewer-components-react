/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

const fs = require("fs");
const path = require("path");

const sourcePath = path.resolve(__dirname, "../../test-utilities/lib");
const packagePath = path.resolve(__dirname, "../node_modules/test-utilities");
const targetPath = path.resolve(fs.realpathSync(packagePath), "lib");

if (!fs.existsSync(sourcePath)) {
  throw new Error("Build test-utilities before building property-grid.");
}

if (sourcePath !== targetPath) {
  fs.cpSync(sourcePath, targetPath, {
    recursive: true,
    filter: (source, target) => {
      if (!fs.existsSync(target)) {
        return true;
      }
      const sourceStat = fs.statSync(source);
      return sourceStat.isDirectory() || sourceStat.mtime.getTime() > fs.statSync(target).mtime.getTime();
    },
  });
}
