/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const yargs = require("yargs");
const argv = yargs(process.argv).argv;

// parse args
const isCheck = "check" in argv;
const targets = argv.targets;
if (!targets) {
  console.error(
    `Fail! Please specify the "targets" argument as a comma-separated list of paths to the target directories and files where extraction insertions need to be made.`,
  );
  process.exit(1);
}

// get workspace root path
const [{ path: workspaceRootPath }] = JSON.parse(execFileSync("pnpm", ["list", "-w", "--only-projects", "--json"], { shell: true, encoding: "utf-8" }));

// gather extractions from different packages into the workspace root
console.log(`Gathering extractions from different packages...`);
execFileSync("node", [path.join(workspaceRootPath, "scripts", "gatherDocs.js")], { stdio: "inherit", cwd: workspaceRootPath });

// set up constants
const extractionsDir = path.join(workspaceRootPath, "build/docs/extract");
const extractionStart = "<!-- BEGIN EXTRACTION -->";
const extractionEnd = "<!-- END EXTRACTION -->";
const targetFileExtensions = [".ts", ".tsx", ".md"];
const re = /^(\s*)(?:<!--|\/\/|\/\*)\s*\[\[include:\s*([\w\d\._-]+|\[(?:\s*,?\s*[\w\d\._-]+)+\])(?:,[\s]*([\w\d_]+))?\]\]/;
const reIndentIndex = 1;
const reExtractionNameIndex = 2;
const reExtractionTypeIndex = 3;

const changedFiles = [];
targets.split(",").forEach((target) => {
  console.log(`Processing target "${target}"...`);
  const targetStat = fs.lstatSync(target);
  if (targetStat.isDirectory(target)) {
    fs.readdirSync(target, { recursive: true }).forEach((fileName) => {
      handleTargetFile(path.join(target, fileName));
    });
  } else if (targetStat.isFile(target)) {
    handleTargetFile(target);
  } else {
    console.error(`Fail! Target "${target}" is not a valid directory or file.`);
    process.exit(1);
  }

  execFileSync("prettier", ["--write", target], { shell: true, encoding: "utf-8" });

  if (isCheck) {
    const gitStatus = execFileSync("git", ["status", "--porcelain=v1", target], { encoding: "utf-8" });
    if (gitStatus) {
      changedFiles.push(gitStatus);
    }
  }
});

if (isCheck && changedFiles.length > 0) {
  console.error();
  console.error(`Fail! The following files have been modified:`);
  console.error(changedFiles.join(""));
  console.error(`You should run the "update-extractions" script and commit the changes.`);
  process.exit(1);
}

function handleTargetFile(targetFilePath) {
  const { ext } = path.parse(targetFilePath);
  if (!targetFileExtensions.includes(ext)) {
    return;
  }

  // read the target file and all insertions that need to be made
  const insertions = [];
  const content = fs.readFileSync(targetFilePath, { encoding: "utf8" });
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    const match = line.match(re);
    if (match) {
      const indent = match[reIndentIndex];
      const extractionName = match[reExtractionNameIndex];
      const extractionType = match[reExtractionTypeIndex];
      insertions.push({
        line: index,
        extraction: {
          name: extractionName,
          type: extractionType,
          indent: indent.length,
        },
      });
    }
  });
  if (insertions.length === 0) {
    return;
  }

  // sort insertions by line number in descending order, otherwise all line numbers will be off after we start splicing
  insertions.sort((a, b) => b.line - a.line);

  // handle each insertion
  insertions.forEach((insertion) => {
    const extractionNames =
      insertion.extraction.name.startsWith("[") && insertion.extraction.name.endsWith("]")
        ? insertion.extraction.name
            .slice(1, -1)
            .split(",")
            .map((name) => name.trim())
        : [insertion.extraction.name];
    let extractionContent = extractionNames
      .reduce((acc, extractionName) => {
        const extractionPath = path.join(extractionsDir, extractionName);
        console.log(extractionPath);
        if (!fs.existsSync(extractionPath)) {
          console.error(
            `Fail! Extraction file "${extractionPath}" does not exist (referenced from ${targetFilePath}). Did you run the "docs" script where the extraction is defined?`,
          );
          process.exit(1);
        }
        return [...acc, fs.readFileSync(extractionPath, { encoding: "utf8" }).trim()];
      }, [])
      .join("\n\n");
    if (insertion.extraction.type) {
      extractionContent = `\`\`\`${insertion.extraction.type}\n${extractionContent}\n\`\`\``;
    }
    let insertionContent = `${extractionStart}\n${extractionContent}\n${extractionEnd}`;
    if (insertion.extraction.indent > 0) {
      insertionContent = insertionContent
        .split("\n")
        .map((line) => `${" ".repeat(insertion.extraction.indent)}${line}`)
        .join("\n");
    }

    const nextLine = lines[insertion.line + 1];
    if (!nextLine.trimStart().startsWith(extractionStart)) {
      lines.splice(insertion.line + 1, 0, insertionContent);
      console.log(`Inserted extraction "${insertion.extraction.name}" at line ${insertion.line + 1} in file "${targetFilePath}".`);
    } else {
      let existingExtractionLinesCount = 0;
      let didFindExtractionEnd = false;
      for (let i = insertion.line + 2; i < lines.length; ++i) {
        if (lines[i].trimStart().startsWith(extractionEnd)) {
          didFindExtractionEnd = true;
          break;
        }
        ++existingExtractionLinesCount;
      }
      if (!didFindExtractionEnd) {
        console.error(`Fail! Extraction end for "${insertion.extraction.name}" not found in file "${targetFilePath}".`);
        process.exit(1);
      }
      lines.splice(insertion.line + 1, existingExtractionLinesCount + 2, insertionContent);
      console.log(`Updated extraction "${insertion.extraction.name}" at line ${insertion.line + 1} in file "${targetFilePath}".`);
    }
  });

  fs.writeFileSync(targetFilePath, lines.join("\n"));
}
