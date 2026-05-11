/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
const fs = require("fs");
const path = require("path");

const packages = [
  {
    name: "test-utilities",
    dir: "test-utilities",
  },
];

linkPackages();

function linkPackages() {
  for (const pack of packages) {
    const sourcePath = getSourceLibPath(pack.dir);
    if (!fs.existsSync(sourcePath)) {
      console.warn(`Package ${pack.name} source path does not exist: ${sourcePath}`);
      continue;
    }
    const targetPath = getTargetLibPath(pack.name);

    copyChangedFiles(pack.name, sourcePath, targetPath);
  }
}

function copyChangedFiles(packageName, sourceDir, targetDir) {
  console.log(`[${new Date().toLocaleTimeString()}] Updating ${packageName}`);
  fs.cpSync(sourceDir, targetDir, {
    recursive: true,
    filter: (source, dest) => {
      if (!fs.existsSync(dest)) {
        return true;
      }
      const sourceStat = fs.statSync(source);
      if (sourceStat.isDirectory()) {
        return true;
      }
      const destStat = fs.statSync(dest);
      return sourceStat.mtime.getTime() > destStat.mtime.getTime();
    },
  });
}

function getTargetLibPath(packageName) {
  const packagePath = path.resolve(__dirname, "../node_modules", packageName);
  const realPath = fs.realpathSync(packagePath);
  return path.resolve(realPath, "lib");
}

function getSourceLibPath(packageDir) {
  const sourcePath = path.resolve(__dirname, "../../", packageDir);
  return path.resolve(sourcePath, "lib");
}
