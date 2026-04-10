/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";

beforeAll(() => {
  getGlobalThis().IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  configure({ reactStrictMode: !process.env.DISABLE_STRICT_MODE });
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
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
