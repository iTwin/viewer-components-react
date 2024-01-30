/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Locator } from "@playwright/test";
import assert from "assert";
import { expect, test } from "@playwright/test";
import { expandStagePanel, locateNode, locateWidget, takeScreenshot } from "./utils";

let treeWidget: Locator;
test.beforeEach(async ({ page, baseURL }) => {
  assert(baseURL);
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.evaluate(async () => document.fonts.ready);
  // expand panel size to ~300px
  await expandStagePanel(page, "right", 100);
  treeWidget = locateWidget(page, "tree");
  await treeWidget.waitFor();
});

test.describe("should match image snapshot", () => {
  test("initial tree", async ({ page }) => {
    // wait for element to be visible in the tree
    await locateNode(treeWidget, "ProcessPhysicalModel").getByRole("checkbox", { name: "Visible", exact: true }).waitFor();
    await takeScreenshot(page, treeWidget);
  });

  test("expanded tree node", async ({ page }) => {
    const node = locateNode(treeWidget, "ProcessPhysicalModel");
    await node.getByTestId("tree-node-expansion-toggle").click();

    // wait for node at the bottom to be visible/loaded
    await locateNode(treeWidget, "Tag-Category").waitFor();
    await takeScreenshot(page, treeWidget);
  });

  test("selected node", async ({ page }) => {
    const node = locateNode(treeWidget, "BayTown");
    await node.click();

    // wait for node to become selected
    await expect(node).toHaveClass(/is-selected/);
    await takeScreenshot(page, treeWidget);
  });

  test("search", async ({ page }) => {
    await treeWidget.getByText("BayTown").waitFor();
    await treeWidget.getByTitle("Search for something").click();
    await treeWidget.getByPlaceholder("Search...").fill("Model");
    await treeWidget.locator(".components-activehighlight").waitFor();
    await takeScreenshot(page, treeWidget);
  });
});
