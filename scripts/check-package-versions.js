/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/**
 * Prevents feature pull requests from changing public package versions. Changesets publishes
 * versions that are newer than those on npm, even when the version was edited manually.
 * Restricting version changes to the trusted Changesets release pull request ensures package
 * versions, changelogs, and release metadata are generated together. Newly public packages must
 * start at 0.0.0 so they cannot be published before Changesets assigns their release version.
 */
const fs = require("fs");
const { execFileSync } = require("child_process");

const base = process.argv[2] ?? "origin/master";
const changedFiles = new Set([...getChangedPackageFiles(`${base}...HEAD`), ...getChangedPackageFiles("HEAD")]);

const errors = [];

for (const file of changedFiles) {
  const currentPackage = JSON.parse(fs.readFileSync(file, "utf8"));
  if (currentPackage.private) {
    continue;
  }

  const basePackage = readPackageAtRevision(base, file);
  if (!basePackage || basePackage.private) {
    if (currentPackage.version !== "0.0.0") {
      errors.push(`${file}: newly public packages must start at version 0.0.0, found ${currentPackage.version}`);
    }
    continue;
  }

  if (currentPackage.version !== basePackage.version) {
    errors.push(`${file}: version changed from ${basePackage.version} to ${currentPackage.version}`);
  }
}

if (errors.length > 0) {
  console.error("Package versions may only be changed by the Changesets release pull request:\n");
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Public package versions are unchanged.");

function readPackageAtRevision(revision, file) {
  try {
    return JSON.parse(execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }));
  } catch {
    return undefined;
  }
}

function getChangedPackageFiles(revision) {
  return execFileSync("git", ["diff", "--name-only", "--diff-filter=AM", revision], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter((file) => file.endsWith("package.json"));
}
