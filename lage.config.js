/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @type {import("lage").ConfigOptions } */
module.exports = {
  pipeline: {
    build: {
      dependsOn: ["^build"],
      inputs: ["./src/**/*.*", "package.json"],
      outputs: ["./lib", "./build"],
    },
    test: {
      dependsOn: ["build"],
      outputs: [],
      inputs: ["lib/**"],
    },
    "test:e2e": {
      dependsOn: [],
      outputs: [],
      inputs: [],
    },
    cover: {
      dependsOn: ["build"],
      outputs: [],
      inputs: ["lib/**"],
    },
    lint: {
      dependsOn: ["build"],
      outputs: [],
      inputs: ["src/**"],
    },
    "extract-api": {
      dependsOn: ["build"],
      outputs: ["./api/**"],
      inputs: ["src/**"],
    },
    clean: {
      cache: false,
    },
  },
  cache: true,
};
