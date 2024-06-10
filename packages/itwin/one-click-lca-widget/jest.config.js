/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  transform: {
    "\\.(ts|js)$": ["ts-jest"],
  },
  moduleNameMapper: {
    "\\.(css|less|sass|scss)$": "<rootDir>/__mocks__/styleMock.js",
    "\\.(gif|ttf|eot|svg?.+|png)$": "<rootDir>/__mocks__/fileMock.js",
  },
};
