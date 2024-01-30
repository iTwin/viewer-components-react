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
  scope: ["packages/itwin/*", "!packages/itwin/breakdown-trees"],
  ignorePatterns: [".nycrc", "eslint.config.js", ".mocharc.json", ".*ignore", ".github/**", ".vscode/**", "**/test/**", "pnpm-lock.yaml"],
  changehint: "Run 'pnpm change' to generate a change file",
  changelog: {
    customRenderers: {
      renderEntry: (entry) => {
        // %s = subject
        const commitMessage = execSync(`git log -1 --pretty=format:%s ${entry.commit}`, { encoding: "utf-8" });
        // match PR links
        const match = commitMessage.match(prRegex);
        return `- ${entry.comment}${getPRLink(match?.[1])}`;
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

/** @type {(a?: string) => string | undefined} */
function getPRLink(pr) {
  if (prPrefix && pr) return ` ([#${pr}](${prPrefix}${pr}))`;
  return "";
}
