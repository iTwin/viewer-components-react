/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const fs = require("extra-fs");
const path = require("path");

const packages = [{
  name: "@itwin/tree-widget-react",
  dir: "tree-widget"
}, {
  name: "@itwin/property-grid-react",
  dir: "property-grid"
}]

const args = process.argv.slice(2);
const scripName = process.argv[1];
const packageName = args[0];
const isHardLink = args[1];

if (packageName !== undefined && typeof packageName !== "string") {
  throw new Error(`Usage: ${scripName} [package name] [--hard]`);
}
if (isHardLink !== undefined && isHardLink !== "--hard") {
  throw new Error(`Usage: ${scripName} [package name] [--hard]`);
}

linkPackages(packageName, isHardLink);

function linkPackages(packageName, hardLink) {
  for (const package of packages) {
    if (packageName && package.name !== packageName)
      continue;

    const sourcePath = getSourceLibPath(package.dir, packages.libDirName);
    if (!fs.existsSync(sourcePath)) {
      console.warn(`Package ${package.name} source path does not exist: ${sourcePath}`);
      continue;
    }
    const targetPath = getTargetLibPath(package.name, package.libDirName);
    if (fs.existsSync(targetPath)) {
      console.log(`Deleting package ${package.name} linked folder: ${targetPath}`);
      fs.rmSync(targetPath, { recursive: true })
    }

    if (hardLink) {
      console.log(`Hard linking ${package.name}: ${sourcePath} -> ${targetPath}`);
      hardLinkFiles(sourcePath, targetPath);
      continue;
    }

    console.log(`Copying package ${package.name}: ${sourcePath} -> ${targetPath}`);
    fs.cpSync(sourcePath, targetPath, { recursive: true });
  }
}

function getTargetLibPath(packageName, distDirName) {
  const packagePath = path.resolve("node_modules", packageName);
  const realPath = fs.realpathSync(packagePath);
  return path.resolve(realPath, distDirName ?? "lib");
}

function getSourceLibPath(packageDir, distDirName) {
  const sourcePath = path.resolve("../../packages/itwin", packageDir);
  return path.resolve(sourcePath, distDirName ?? "lib");
}

function hardLinkFiles(source, target) {
  const sourceFiles = fs.readdirSync(source);
  for (const sourceFile of sourceFiles) {
    const sourcePath = path.resolve(source, sourceFile);
    const targetPath = path.resolve(target, sourceFile);

    if (fs.statSync(sourcePath).isDirectory()) {
      if (sourceFile === "test") {
        console.log(`Skipping directory: ${sourcePath}`)
        continue;
      }

      hardLinkFiles(sourcePath, targetPath);
      continue;
    }

    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir))
      fs.mkdirSync(targetDir, { recursive: true });

    console.log(`Linking: ${sourcePath} -> ${targetPath}`);
    fs.linkSync(sourcePath, targetPath)
  }
}