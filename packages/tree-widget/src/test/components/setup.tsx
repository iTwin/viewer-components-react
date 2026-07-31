/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, beforeAll } from "vitest";
import { cleanup } from "vitest-browser-react";

beforeAll(async () => {
  // Wait for fonts to be ready so text renders consistently in screenshots.
  await document.fonts.ready;
});

afterEach(() => {
  cleanup();
});
