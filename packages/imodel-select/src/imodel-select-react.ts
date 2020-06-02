/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// cSpell:ignore iconpicker lineweight

export { IModelSelect } from "./IModelSelect";
export { IModelInfo } from "./api/IModelInfoService";
export { ProjectInfo } from "./api/ProjectInfoService";
export { IModelSelector } from "./components/IModelSelector";
export { ProjectSelector } from "./components/ProjectSelector";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
// istanbul ignore next
if (
  typeof BUILD_SEMVER !== "undefined" &&
  typeof window !== "undefined" &&
  window
) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("imodel-select-react", BUILD_SEMVER);
}
