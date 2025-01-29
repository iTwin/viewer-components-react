/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll } from "vitest";

import { NoRenderApp } from "@itwin/core-frontend";
import { MeasureTools } from "../../MeasureTools.js";
import { TestUtils } from "../TestUtils.js";
import { EmptyLocalization } from "@itwin/core-common";

// Before all tests, initialize any global services
beforeAll(async () => {
  const localization = new EmptyLocalization();
  await NoRenderApp.startup({ localization });
  await MeasureTools.startup({ localization });
});

afterAll(async () => {
  await TestUtils.cleanup();
});
