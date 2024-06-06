/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/**
 * Purpose of this script is to detect @internal APIs exposed through the barrel file of the given package.
 * That's a problem because:
 * - @internal APIs may expose dependencies that don't need to be specified as peer dependencies, making it difficult
 *   to identify whether a specific import should be a peer dependency or not.
 * - Consumers import contents of our package through the barrel file. Including @internal APIs there causes consumers
 *   to see those APIs as available for them to use.
 */

const fs = require("fs");
const path = require("path");
const yargs = require("yargs");

const argv = yargs(process.argv).argv;
const apiSummaryPath = argv.apiSummary;

if (!apiSummaryPath) {
  console.error(`Fail! Please specify the "apiSummary" argument as a path to the API summary file to check.`);
  process.exit(1);
}

if (!fs.existsSync(apiSummaryPath)) {
  console.error(`Fail! Provided API summary file path does not exist: "${apiSummaryPath}".`);
  process.exit(1);
}

// only look for non-indented tags which target root level APIs - we still want to allow things
// like @internal class functions and interface attributes
const re = /^\/\/ @internal/gm;
const content = fs.readFileSync(apiSummaryPath, { encoding: "utf8" });
if (re.test(content)) {
  console.error(`Fail! Detected exposed @internal APIs - please make sure they're not exported through barrel file and re-generate API summary.`);
  process.exit(1);
}

console.log(`OK! API summary "${path.basename(apiSummaryPath)}" does not contain root level @internal APIs.`);
