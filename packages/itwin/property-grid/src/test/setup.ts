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
import * as chai from "chai";
import sinonChai from "sinon-chai";

jsdomGlobal();

// setup chai
chai.use(sinonChai);

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

const raf = global.requestAnimationFrame;
const caf = global.cancelAnimationFrame;
before(() => {
  Object.defineProperty(global, "requestAnimationFrame", {
    writable: true,
    value: (cb: FrameRequestCallback) => {
      return setTimeout(cb, 0);
    },
  });
  Object.defineProperty(global, "cancelAnimationFrame", {
    writable: true,
    value: (handle: number) => {
      clearTimeout(handle);
    },
  });
});

after(() => {
  Object.defineProperty(global, "requestAnimationFrame", {
    writable: true,
    value: raf,
  });
  Object.defineProperty(global, "cancelAnimationFrame", {
    writable: true,
    value: caf,
  });
});
