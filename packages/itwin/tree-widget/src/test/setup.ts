/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import chai from "chai";
import chaiJestSnapshot from "chai-jest-snapshot";
import chaiSubset from "chai-subset";
import globalJsdom from "global-jsdom";
import * as jsdom from "jsdom";
import path from "path";
import sinonChai from "sinon-chai";

// get rid of various xhr errors in the console
globalJsdom(undefined, {
  virtualConsole: new jsdom.VirtualConsole().sendTo(console, { omitJSDOMErrors: true }),
});

// setup chai
chai.should();
chai.use(chaiJestSnapshot);
chai.use(chaiSubset);
chai.use(sinonChai);

before(async function () {
  chaiJestSnapshot.resetSnapshotRegistry();
  getGlobalThis().IS_REACT_ACT_ENVIRONMENT = true;
});

after(() => {
  delete getGlobalThis().IS_REACT_ACT_ENVIRONMENT;
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

// needed for context menu to work in tests
global.DOMRect = class DOMRect {
  public bottom: number=0;
  public left: number=0;
  public right: number=0;
  public top: number=0;
  constructor(public x=0, public y=0, public width=0, public height=0) {}
  public static fromRect(other?: DOMRectInit): DOMRect {
    return new DOMRect(other?.x, other?.y, other?.width, other?.height);
  }
  public toJSON() {
    return JSON.stringify(this);
  }
};

function getGlobalThis(): typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean } {
  if (typeof globalThis !== "undefined") {
    return globalThis;
  }
  if (typeof self !== "undefined") {
    return self;
  }
  if (typeof window !== "undefined") {
    return window;
  }
  if (typeof global !== "undefined") {
    return global;
  }
  throw new Error("unable to locate global object");
}
