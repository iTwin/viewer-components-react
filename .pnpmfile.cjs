/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

function readPackage(pkg, context) {
  if (pkg.dependencies["@types/react"] === "*") {
    pkg.dependencies["@types/react"] = undefined;
    pkg.peerDependencies["@types/react"] = "*";
  }
  if (pkg.peerDependencies["react"] !== undefined && pkg.peerDependencies["@types/react"] === undefined) {
    pkg.peerDependencies["@types/react"] = "*";
  }
  if (pkg.name === "@itwin/map-layers-formats") {
    pkg.peerDependencies["@itwin/core-frontend"] = pkg.version;
  }
  if (pkg.name === "simple-react-validator") {
    pkg.peerDependencies["react"] = "*";
  }

  // patch peer dependencies of packages from `itwinjs-core` to make sure that they are resolved to same version.
  // peer dependencies in those packages are defined with `^` and that allows to resolve some of them to different version.
  if (corePackages.includes(pkg.name) && pkg.peerDependencies) {
    const fixedPeers = Object.entries(pkg.peerDependencies).reduce(
      (deps, [name, version]) => ({ ...deps, [name]: corePackages.includes(name) ? version.replaceAll("^", "") : version }),
      {},
    );
    pkg.peerDependencies = fixedPeers;
  }

  // patch peer dependencies of packages from `appui` to make sure that they are resolved to same version.
  if (appuiPackages.includes(pkg.name) && pkg.peerDependencies) {
    const fixedPeers = Object.entries(pkg.peerDependencies).reduce(
      (deps, [name, version]) => ({ ...deps, [name]: appuiPackages.includes(name) ? version.replaceAll("^", "") : version }),
      {},
    );
    pkg.peerDependencies = fixedPeers;
  }

  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};

const corePackages = [
  "@itwin/appui-abstract",
  "@itwin/core-bentley",
  "@itwin/core-common",
  "@itwin/core-frontend",
  "@itwin/core-geometry",
  "@itwin/core-i18n",
  "@itwin/core-markup",
  "@itwin/core-orbitgt",
  "@itwin/core-quantity",
  "@itwin/core-telemetry",
  "@itwin/ecschema-metadata",
  "@itwin/frontend-devtools",
  "@itwin/map-layers-formats",
  "@itwin/map-layers-auth",
  "@itwin/presentation-common",
  "@itwin/presentation-frontend",
  "@itwin/webgl-compatibility",
  "@itwin/appui-abstract",
  "@itwin/build-tools",
  "@itwin/certa",
  "@itwin/core-backend",
  "@itwin/presentation-backend",
];

const appuiPackages = ["@itwin/appui-layout-react", "@itwin/appui-react", "@itwin/components-react", "@itwin/core-react", "@itwin/imodel-components-react"];
