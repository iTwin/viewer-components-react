/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
const { execSync } = require("child_process");
const cpx = require("cpx2");

function safeJsonParse(data) {
  try {
    const json = JSON.parse(data);
    return json;
  } catch {
    const json = JSON.parse("[" + data.replaceAll(" ", "").replaceAll("\n", "").replaceAll("[{", "{").replaceAll("}]{", "},{").replaceAll("}]", "}") + "]");
    return json;
  }
}

// gathers docs from all workspace packages to the root folder

// get all packages in pnpm workspace (this include root package)

// `pnpm list -r --depth -1 --only-projects --json` generates an invalid json
const allWorkspacePackages = safeJsonParse(execSync("pnpm list -r --depth -1 --only-projects --json", { encoding: "utf-8" }));

// get info about root package
const [{ name: workspaceRootName, path: workspaceRootPath }] = JSON.parse(execSync("pnpm list -w --only-projects --json", { encoding: "utf-8" }));

// filter out root package
const workspacePackages = allWorkspacePackages.filter(({ name }) => name !== workspaceRootName);
console.log(workspacePackages);

for (const package of workspacePackages) {
  // copy docs build from each package to the root
  cpx.copySync(`${package.path}/build/**`, `${workspaceRootPath}/build`);
}
