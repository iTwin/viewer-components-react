/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Locator } from "@playwright/test";
import { test } from "@playwright/test";
import { initTreeWidgetTest, locateNode, selectTree, takeScreenshot, withDifferentDensities } from "./utils";

test.describe("Widget", () => {
  let treeWidget: Locator;

  test.beforeEach(async ({ page, baseURL }) => {
    treeWidget = await initTreeWidgetTest({ page, baseURL });
    await locateNode(treeWidget, "Visible: All models are visible Collapse BayTown")
      .getByRole("checkbox", { name: "Visible: All models are visible", exact: true })
      .waitFor();
  });

  withDifferentDensities(() => {
    test("tree selector", async ({ page }) => {
      await treeWidget.getByRole("combobox").click();
      await page.getByRole("listbox").waitFor();
      await takeScreenshot(page, treeWidget);
    });

    test("tree selector badge", async ({ page }) => {
      await selectTree(treeWidget, "External sources");
      await page.getByText("The data required for this tree layout is not available in this iModel.").waitFor();
      await takeScreenshot(page, treeWidget);
    });
  });
});
