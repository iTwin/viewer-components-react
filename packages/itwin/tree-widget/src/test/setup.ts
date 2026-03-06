/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
// WARNING: The order of imports in this file is important!

// setup chai
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiJestSnapshot from "chai-jest-snapshot";
import sinonChai from "sinon-chai";
chai.use(chaiJestSnapshot);
chai.use(sinonChai);
chai.use(chaiAsPromised);

// get rid of various xhr errors in the console
import globalJsdom from "global-jsdom";
import * as jsdom from "jsdom";
globalJsdom(undefined, {
  virtualConsole: new jsdom.VirtualConsole().forwardTo(console, { jsdomErrors: "none" }),
});

// setup browser environment
// needed for context menu to work in tests
global.DOMRect = class DOMRect {
  public bottom: number = 0;
  public left: number = 0;
  public right: number = 0;
  public top: number = 0;
  constructor(
    public x = 0,
    public y = 0,
    public width = 0,
    public height = 0,
  ) {}
  public static fromRect(other?: DOMRectInit): DOMRect {
    return new DOMRect(other?.x, other?.y, other?.width, other?.height);
  }
  public toJSON() {
    return JSON.stringify(this);
  }
};

global.CSS = {
  supports: (_k: string, _v: string) => false,
} as any;

// flag to indicate if act warning happened.
let actWarningHappened = false;
// eslint-disable-next-line no-console
const originalConsoleError = console.error;
// eslint-disable-next-line no-console
console.error = (...args: unknown[]) => {
  if (args.length > 0 && typeof args[0] === "string" && args[0].includes("was not wrapped in act")) {
    actWarningHappened = true;
  }
  originalConsoleError(...args);
};

// supply mocha hooks
import path from "path";
const { cleanup, configure } = await import("@testing-library/react");
import v8 from "node:v8";
export const mochaHooks = {
  beforeAll() {
    chaiJestSnapshot.resetSnapshotRegistry();
    getGlobalThis().IS_REACT_ACT_ENVIRONMENT = true;
  },
  beforeEach(this: Mocha.Context) {
    // enable strict mode for each test by default
    configure({ reactStrictMode: !process.env.DISABLE_STRICT_MODE });

    // set up snapshot name
    const currentTest = this.currentTest!;
    const sourceFilePath = currentTest.file?.replace(`lib${path.sep}esm${path.sep}test`, `src${path.sep}test`).replace(/\.(jsx?|tsx?)$/, "");
    const snapPath = `${sourceFilePath}.snap`;
    chaiJestSnapshot.setFilename(snapPath);
    chaiJestSnapshot.setTestName(currentTest.fullTitle());

    failTestsOnActWarnings(currentTest);
  },
  afterEach() {
    cleanup();
  },
  afterAll() {
    delete getGlobalThis().IS_REACT_ACT_ENVIRONMENT;
    v8.takeCoverage();
  },
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

function checkActWarnings() {
  if (actWarningHappened) {
    actWarningHappened = false;
    throw new Error("Test triggered 'not wrapped in act' warning");
  }
}

function failTestsOnActWarnings(currentTest: Mocha.Test) {
  if (!currentTest.fn) {
    return;
  }
  // wrap the test fn to check for act warnings after it completes
  actWarningHappened = false;
  const originalFn = currentTest.fn;
  if (currentTest.sync) {
    currentTest.fn = function (this: Mocha.Context, done: (err?: unknown) => void) {
      (originalFn as Mocha.Func).call(this, (err?: unknown) => {
        if (err) {
          return done(err);
        }
        try {
          checkActWarnings();
          done();
        } catch (e) {
          done(e);
        }
      });
    };
  } else {
    currentTest.fn = async function (this: Mocha.Context) {
      await (originalFn as Mocha.AsyncFunc).call(this);
      checkActWarnings();
    };
  }
}
