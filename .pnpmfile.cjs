/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

function readPackage(pkg) {
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

  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};
