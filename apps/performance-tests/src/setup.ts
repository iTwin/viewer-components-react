/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
// WARNING: The order of imports in this file is important!

// setup chai
import * as chai from "chai";
import sinonChai from "sinon-chai";
chai.use(sinonChai);

// get rid of various xhr errors in the console
import globalJsdom from "global-jsdom";
import * as jsdom from "jsdom";
globalJsdom(undefined, {
  virtualConsole: new jsdom.VirtualConsole().sendTo(console, { omitJSDOMErrors: true }),
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

// supply mocha hooks
import path from "path";
const { cleanup, configure } = await import("@testing-library/react");
import v8 from "node:v8";
export const mochaHooks = {
  beforeAll() {
    getGlobalThis().IS_REACT_ACT_ENVIRONMENT = true;
  },
  beforeEach() {
    // enable strict mode for each test by default
    configure({ reactStrictMode: !process.env.DISABLE_STRICT_MODE });
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
