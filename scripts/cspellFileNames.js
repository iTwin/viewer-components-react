/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/** Script to check spelling in project filenames */

const { execSync } = require("child_process");
const { readdirSync } = require("fs");
const { join } = require("path");

const ignore = ["node_modules", ".git", "lib", "dist", "e2e-out", ".nyc_output", ".config."];

/**
 * Recursively find all files in a directory
 * @param {string} dir - Filesystem path to read from (e.g., "./scripts")
 * @param {string} base - Relative path prefix for output (e.g., "scripts")
 */
function findFiles(dir, base = "") {
  let files = [];
  // withFileTypes: true returns objects (with type info) instead of just strings
  // This avoids extra file system calls to check if each entry is a file or directory
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // Build relative path: "scripts/file.js" instead of "./scripts/file.js"
    const path = base ? `${base}/${entry.name}` : entry.name;
    if (ignore.some((pattern) => path.includes(pattern))) {
      continue;
    }

    if (entry.isDirectory()) {
      // Recursively search: dir for reading, path for building relative paths
      files.push(...findFiles(join(dir, entry.name), path));
    } else {
      files.push(path);
    }
  }
  return files;
}

const files = findFiles(".");
console.log(`Checking ${files.length} filenames...`);
const regex = /:(\d+):\d+ - Unknown word \(([^)]+)\)/;

try {
  // Pass filenames via stdin so cspell checks the filenames themselves, not file contents
  execSync("npx cspell stdin", { input: files.join("\n"), encoding: "utf-8" });
  console.log("Filename spell check passed");
} catch (error) {
  // Parse the error output to show full filenames
  const errorOutput = error.stdout || error.stderr || "";
  const lines = errorOutput.split("\n");

  console.error("\nFilename spelling errors found:\n");

  // Find lines with errors (format: :lineNumber:column - Unknown word)
  lines.forEach((line) => {
    const match = line.match(regex);
    if (match) {
      const lineNumber = parseInt(match[1], 10);
      const word = match[2];
      const filename = files[lineNumber - 1];
      if (filename) {
        console.error(filename);
        console.error(`└─ Unknown word: "${word}"\n`);
      }
    }
  });

  console.error(`CSpell: Files checked: ${files.length}, Issues found in filenames`);
  process.exit(1);
}
