/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */

import { afterEach, beforeAll, beforeEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";

const handleMessages: Array<{ message: string; type: "error" | "warn" | "log"; handle: "failTest" | "ignoreMessage" }> = [
  { message: "was not wrapped in act", type: "error", handle: "failTest" },
  { message: `CSS variable not found`, type: "log", handle: "ignoreMessage" },
  // TODO: Should be removed after core 5.8 is consumed
  { message: "there are no unsaved changes", type: "log", handle: "ignoreMessage" },
];

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

let caughtFailTestMessages = new Array<string>();

const getOverriddenMethod = (originalMethod: (message?: any, ...optionalParams: any[]) => void, type: "error" | "warn" | "log") => {
  return (message?: any, ...optionalParams: any[]) => {
    if (typeof message === "string") {
      const caughtMessage = handleMessages.find((m) => m.type === type && message.includes(m.message));
      if (caughtMessage) {
        if (caughtMessage.handle === "failTest") {
          caughtFailTestMessages.push(caughtMessage.message);
        }
        return;
      }
    }
    originalMethod(message, ...optionalParams);
  };
};

beforeAll(() => {
  console.error = getOverriddenMethod(originalConsoleError, "error");
  console.warn = getOverriddenMethod(originalConsoleWarn, "warn");
  console.log = getOverriddenMethod(originalConsoleLog, "log");
});

beforeEach(() => {
  caughtFailTestMessages = [];
  configure({ reactStrictMode: !process.env.DISABLE_STRICT_MODE });
});

afterEach(() => {
  cleanup();
  if (caughtFailTestMessages.length > 0) {
    const messages = caughtFailTestMessages.join("\n");
    caughtFailTestMessages = [];
    throw new Error(`Test triggered the following console messages:\n${messages}`);
  }
});
afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});
