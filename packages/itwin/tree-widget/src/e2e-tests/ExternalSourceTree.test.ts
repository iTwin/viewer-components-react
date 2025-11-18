/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { test } from "@playwright/test";
import { initTreeWidgetTest, selectTree, takeScreenshot } from "./utils.js";

import type { Locator } from "@playwright/test";

test.describe("External sources tree", () => {
  let treeWidget: Locator;

  test.beforeEach(async ({ page, baseURL }) => {
    treeWidget = await initTreeWidgetTest({ page, baseURL });
    await selectTree(treeWidget, "External sources");
  });

  test("no data in imodel", async ({ page }) => {
    await page.getByText("The data required for this tree layout is not available in this iModel.").waitFor();
    await takeScreenshot(page, treeWidget);
  });
});
