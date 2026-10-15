/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */

import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";

const logsWhichFailTest = ["was not wrapped in act"];
const originalConsoleError = console.error;
let caughtLogsWhichFailTest = new Array<string>();

beforeAll(() => {
  getGlobalThis().IS_REACT_ACT_ENVIRONMENT = true;
  // happy-dom has no layout engine, so elements report 0 size. Provide non-zero dimensions
  // so virtualized lists (`@tanstack/react-virtual`) compute a non-empty range and render rows.
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 600 });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 400 });
  console.error = (message?: any, ...optionalParams: any[]) => {
    if (typeof message === "string") {
      const caughtMessage = logsWhichFailTest.find((log) => message.includes(log));
      if (caughtMessage) {
        caughtLogsWhichFailTest.push(caughtMessage);
        return;
      }
    }
    originalConsoleError(message, ...optionalParams);
  };
});

beforeEach(() => {
  caughtLogsWhichFailTest = [];
  configure({ reactStrictMode: !process.env.DISABLE_STRICT_MODE });
});

afterEach(() => {
  cleanup();
  if (caughtLogsWhichFailTest.length > 0) {
    const messages = caughtLogsWhichFailTest.join("\n");
    caughtLogsWhichFailTest = [];
    throw new Error(`Test triggered the following console messages:\n${messages}`);
  }
});

afterAll(() => {
  console.error = originalConsoleError;
  delete getGlobalThis().IS_REACT_ACT_ENVIRONMENT;
});

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
