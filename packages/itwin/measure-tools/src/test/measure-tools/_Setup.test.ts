/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, vi } from "vitest";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { BasicUnitsProvider } from "@itwin/core-quantity";
import { MeasureTools } from "../../MeasureTools.js";
import { TestUtils } from "../TestUtils.js";

// Before all tests, initialize any global services
beforeAll(async () => {
  const localization = new EmptyLocalization();
  await NoRenderApp.startup({ localization });
  await MeasureTools.startup({ localization });

  await IModelApp.quantityFormatter.setUnitsProvider(new BasicUnitsProvider());
  window.HTMLElement.prototype.scrollTo = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterAll(async () => {
  await TestUtils.cleanup();
});
