/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/**
 * Runs the interactive Changesets CLI, then prefixes its random output filename for CODEOWNERS.
 * Single-package changesets use the package name; multi-package changesets use "multi-package" prefix. Empty changesets are rejected because changes that
 * do not require a release need no changeset.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const changesetDirectory = path.resolve(".changeset");
const existingChangesets = new Set(getChangesetFiles());
const result = spawnSync("pnpm", ["exec", "changeset", "add", ...process.argv.slice(2)], { stdio: "inherit" });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

for (const changesetFile of getChangesetFiles().filter((file) => !existingChangesets.has(file))) {
  prefixChangeset(changesetFile);
}

function prefixChangeset(changesetFile) {
  const sourcePath = path.join(changesetDirectory, changesetFile);
  const content = fs.readFileSync(sourcePath, "utf8");
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)^---\r?\n/m);
  if (!frontmatter) {
    throw new Error(`Invalid changeset in ${changesetFile}.`);
  }

  const releaseLines = frontmatter[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const affectedPackages = releaseLines.map((line) => {
    const release = line.match(/^"([^"]+)":\s*(?:major|minor|patch)$/);
    if (!release) {
      throw new Error(`Invalid changeset release in ${changesetFile}: ${line}`);
    }
    return release[1];
  });

  if (affectedPackages.length === 0) {
    fs.unlinkSync(sourcePath);
    throw new Error("Empty changesets are not allowed. The generated file was removed.");
  }

  const packagePrefix = affectedPackages.length === 1 ? toFilePrefix(affectedPackages[0]) : "multi-package";
  const targetFile = `${packagePrefix}-${changesetFile}`;
  fs.renameSync(sourcePath, path.join(changesetDirectory, targetFile));
  console.log(`Created .changeset/${targetFile}`);
}

function toFilePrefix(packageName) {
  return packageName.replaceAll("/", "-");
}

function getChangesetFiles() {
  return fs.readdirSync(changesetDirectory).filter((file) => file.endsWith(".md") && file !== "README.md");
}
