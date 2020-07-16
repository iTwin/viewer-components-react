/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
module.exports = {
  globals: {
    "ts-jest": {
      packageJson: "package.json",
    },
  },
  moduleNameMapper: {
    "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga|svg?.+)$":
      "<rootDir>/src/tests/mocks/fileMock.js",
    "\\.(scss|sass|css)$": "identity-obj-proxy",
  },
};
