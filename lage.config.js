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
      dependsOn: ["test-viewer#build"],
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
    "audit": {
      cache: false,
      dependsOn: [],
      outputs: [],
    },
    "extract-api": {
      dependsOn: ["build"],
      outputs: ["./api/**"],
      inputs: ["src/**"],
    },
    "check-internal": {
      dependsOn: ["extract-api"],
      outputs: [],
      inputs: ["api/**"],
    },
    docs: {
      dependsOn: ["build"],
      outputs: ["build/docs/**"],
      inputs: ["src/**"],
    },
    "update-extractions": {
      cache: false,
      dependsOn: [],
      outputs: ["learning/**"],
    },
    "check-extractions": {
      cache: false,
      dependsOn: [],
      outputs: [],
    },
    clean: {
      cache: false,
    },
  },
  cache: true,
};
