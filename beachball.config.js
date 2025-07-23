/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
const { execSync } = require("child_process");

/** @type {import("beachball").BeachballConfig } */
module.exports = {
  bumpDeps: false,
  access: "public",
  tag: "latest",
  scope: ["packages/itwin/*"], // Can be used to exclude packages that are in dev release, i.e. "!packages/itwin/map-layers"
  ignorePatterns: [
    ".nycrc",
    "eslint.config.js",
    ".mocharc.json",
    ".*ignore",
    ".github/**",
    ".vscode/**",
    "**/test/**",
    "**/e2e-tests/**",
    "pnpm-lock.yaml",
    "playwright.config.ts",
  ],
  changehint: "Run 'pnpm change' to generate a change file",
  changelog: {
    customRenderers: {
      renderEntry: (entry) => {
        return `- ${entry.comment}${getPRLink(entry.commit)}`;
      },
    },
  },
  publish: true,
};

const remoteUrl = execSync("git remote get-url origin", { encoding: "utf-8" }).trim();
const prPrefix = getPRPrefix(remoteUrl);
const prRegex = prPrefix.startsWith("https://github.com") ? /#([0-9]+)/ : /^Merged PR ([0-9]+):/;

/** @type {(a:string) => string | undefined} */
function getPRPrefix(url) {
  if (url.startsWith("https://github.com"))
    // GitHub HTTPS
    return url.replace(/\.git$/, "") + "/pull/";
  if (url.includes("@github.com"))
    // GitHub SSH
    return `https://${url.split("@")[1]}/pull/`;
}

/** @type {(a: string) => string | undefined} */
function getPRNumber(commitHash) {
  // beachball might not find commit and uses `not available` string as commit hash. Do not try to look up PR number if there is no valid commit hash.
  if (commitHash === "not available") {
    return undefined;
  }

  // %s = subject
  const commitMessage = execSync(`git log -1 --pretty=format:%s ${commitHash}`, { encoding: "utf-8" });
  // match PR links
  const match = commitMessage.match(prRegex);
  return match?.[1];
}

/** @type {(a: string) => string | undefined} */
function getPRLink(commitHash) {
  const pr = getPRNumber(commitHash);
  if (prPrefix && pr) {
    return ` ([#${pr}](${prPrefix}${pr}))`;
  }
  return "";
}
