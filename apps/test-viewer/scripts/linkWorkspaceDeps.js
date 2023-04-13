/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const fs = require("fs");
const path = require("path");

const packages = [{
  name: "@itwin/tree-widget-react",
  dir: "tree-widget"
}, {
  name: "@itwin/property-grid-react",
  dir: "property-grid"
}, {
  name: "@itwin/measure-tools-react",
  dir: "measure-tools"
}
]

linkPackages();

function linkPackages() {
  for (const package of packages) {
    const sourcePath = getSourceLibPath(package.dir, packages.libDirName);
    if (!fs.existsSync(sourcePath)) {
      console.warn(`Package ${package.name} source path does not exist: ${sourcePath}`);
      continue;
    }
    const targetPath = getTargetLibPath(package.name, package.libDirName);

    copyChangedFiles(package.name, sourcePath, targetPath);

    let lastChange = undefined;
    fs.watch(sourcePath, { recursive: true }, () => {
      const now = new Date();
      if (now === lastChange) {
        return;
      }
      lastChange = now;
      setTimeout(() => {
        if (now === lastChange) {
          copyChangedFiles(package.name, sourcePath, targetPath);
          lastChange = undefined;
        }
      }, 100);
    });
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
