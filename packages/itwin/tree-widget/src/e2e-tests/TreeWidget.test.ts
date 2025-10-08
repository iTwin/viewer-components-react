/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Locator } from "@playwright/test";
import { test } from "@playwright/test";
import { initTreeWidgetTest, locateNode, selectTree, takeScreenshot } from "./utils.js";

// Skipped because tree selector uses native `select` element. Expanded selected are rendered by OS and they are not
// part of the page so playwright cannot see them when taking screenshot.
// Same issue is in puppeteer https://github.com/puppeteer/puppeteer/issues/1306
test.describe.skip("Widget", () => {
  let treeWidget: Locator;

  test.beforeEach(async ({ page, baseURL }) => {
    treeWidget = await initTreeWidgetTest({ page, baseURL });
    await locateNode(treeWidget, "ProcessPhysicalModel").getByRole("button", { name: "Determining visibility..." }).waitFor({ state: "detached" });
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
