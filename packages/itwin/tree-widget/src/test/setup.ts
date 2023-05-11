/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Node 15+ using MessageChannel prevents node.js process from exiting
// This becomes an issue when testing React code within JSDOM environment, as the test process cannot exit properly.
// https://github.com/facebook/react/issues/20756
const commonjsGlobal: { MessageChannel?: any } = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
if (commonjsGlobal.MessageChannel)
  delete commonjsGlobal.MessageChannel;

import jsdomGlobal from "jsdom-global";
jsdomGlobal();

import chai from "chai";
import chaiJestSnapshot from "chai-jest-snapshot";
import sinonChai from "sinon-chai";
import path from "path";

// setup chai
chai.should();
chai.use(chaiJestSnapshot);
chai.use(sinonChai);

before(async function () {
  chaiJestSnapshot.resetSnapshotRegistry();
});

beforeEach(function () {
  const currentTest = this.currentTest!;

  // set up snapshot name
  const sourceFilePath = currentTest.file?.replace(`lib${path.sep}cjs${path.sep}test`, `src${path.sep}test`).replace(/\.(jsx?|tsx?)$/, "");
  const snapPath = `${sourceFilePath}.snap`;
  chaiJestSnapshot.setFilename(snapPath);
  chaiJestSnapshot.setTestName(currentTest.fullTitle());
});

// This is required by I18n module
global.XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // eslint-disable-line @typescript-eslint/no-var-requires
