/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Locator } from "@playwright/test";
import { test } from "@playwright/test";
import { initTreeWidgetTest, locateNode, selectTree, takeScreenshot } from "./utils.js";

test.describe("Widget", () => {
  let treeWidget: Locator;

  test.beforeEach(async ({ page, baseURL }) => {
    treeWidget = await initTreeWidgetTest({ page, baseURL });
    await locateNode(treeWidget, "ProcessPhysicalModel").waitFor();
  });

  test("tree selector", async ({ page }) => {
    await treeWidget.getByRole("combobox").click();
    await takeScreenshot(page, treeWidget);
  });

  // Skipped because tree selector does not support icons at the moment
  test.skip("tree selector badge", async ({ page }) => {
    await selectTree(treeWidget, "External sources");
    await page.getByText("The data required for this tree layout is not available in this iModel.").waitFor();
    await takeScreenshot(page, treeWidget);
  });
});
