/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
const fs = require("fs");
const path = require("path");
const watch = process.argv[2] && process.argv[2] === "--watch";

const packages = [
  {
    name: "@itwin/tree-widget-react",
    dir: "tree-widget",
  },
  {
    name: "@itwin/property-grid-react",
    dir: "property-grid",
  },
];

linkPackages();

function linkPackages() {
  for (const pack of packages) {
    const sourcePath = getSourceLibPath(pack.dir, pack.libDirName);
    if (!fs.existsSync(sourcePath)) {
      console.warn(`Package ${pack.name} source path does not exist: ${sourcePath}`);
      continue;
    }
    const targetPath = getTargetLibPath(pack.name, pack.libDirName);

    copyChangedFiles(pack.name, sourcePath, targetPath);

    if (watch) {
      let lastChange = undefined;
      fs.watch(sourcePath, { recursive: true }, () => {
        const now = new Date();
        if (now === lastChange) {
          return;
        }
        lastChange = now;
        setTimeout(() => {
          if (now === lastChange) {
            copyChangedFiles(pack.name, sourcePath, targetPath);
            lastChange = undefined;
          }
        }, 100);
      });
    }
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

function getTargetLibPath(packageName, distDirName) {
  const packagePath = path.resolve(__dirname, "../node_modules", packageName);
  const realPath = fs.realpathSync(packagePath);
  return path.resolve(realPath, distDirName ?? "lib");
}

function getSourceLibPath(packageDir, distDirName) {
  const sourcePath = path.resolve(__dirname, "../../../packages/itwin", packageDir);
  return path.resolve(sourcePath, distDirName ?? "lib");
}
