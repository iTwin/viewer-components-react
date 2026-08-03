/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// Some of our components still use iTwinUI styles for padding and size, this should be removed when fully migrating away from iTwinUI. The iTwinUI styles are imported here so that they are available for all component tests.
import "@itwin/itwinui-react/styles.css";

import { afterEach, beforeAll } from "vitest";
import { cleanup } from "vitest-browser-react";

beforeAll(async () => {
  // Wait for fonts to be ready so text renders consistently in screenshots.
  await document.fonts.ready;
});

afterEach(() => {
  void cleanup();
});
