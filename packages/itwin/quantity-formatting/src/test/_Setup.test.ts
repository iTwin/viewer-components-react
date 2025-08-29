/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, beforeEach, vi } from "vitest";

import { NoRenderApp } from "@itwin/core-frontend";
import { EmptyLocalization } from "@itwin/core-common";

import { QuantityFormatting } from "../QuantityFormatting.js";

// Before all tests, initialize any global services
beforeAll(async () => {
  const localization = new EmptyLocalization();
  await NoRenderApp.startup({ localization });
  await QuantityFormatting.startup({ localization });
  window.HTMLElement.prototype.scrollTo = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterAll(async () => {
  QuantityFormatting.terminate();
});
