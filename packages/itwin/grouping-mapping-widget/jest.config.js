/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    transform: {
      "\\.(ts)$": ['ts-jest'],
    },
    moduleNameMapper: {
      "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga|svg?.+)$":
        "<rootDir>/__mocks__/fileMock.js",
      "\\.(scss|sass|css)$": "jest-transform-stub",
    },
    roots: [
      "./src/",
    ],
  }