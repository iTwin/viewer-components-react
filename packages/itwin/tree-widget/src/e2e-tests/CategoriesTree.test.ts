/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Locator } from "@playwright/test";
import { test } from "@playwright/test";
import {
  initTreeWidgetTest,
  locateInstanceFilter,
  locateNode,
  selectOperatorInDialog,
  selectPropertyInDialog,
  selectTree,
  selectValueInDialog,
  takeScreenshot,
  withDifferentDensities,
} from "./utils";

test.describe("Categories tree", () => {
  let treeWidget: Locator;

  test.beforeEach(async ({ page, baseURL }) => {
    treeWidget = await initTreeWidgetTest({ page, baseURL });
    await selectTree(treeWidget, "Categories");
  });

  withDifferentDensities(() => {
    test("initial tree", async ({ page }) => {
      // wait for element to be visible in the tree
      await locateNode(treeWidget, "Equipment").waitFor();
      await takeScreenshot(page, treeWidget);
    });

    test("expanded tree node", async ({ page }) => {
      const node = locateNode(treeWidget, "Equipment");
      await node.getByLabel("Expand").click();

      // wait for node at the bottom to be visible/loaded
      await locateNode(treeWidget, "Equipment - Insulation").waitFor();
      await takeScreenshot(page, treeWidget);
    });

    test("node with active filtering", async ({ page }) => {
      const node = locateNode(treeWidget, "Equipment", 1);

      // hover the node for the button to appear
      await node.hover();
      await node.getByTitle("Apply filter").click();

      await locateInstanceFilter(page).waitFor();
      await selectPropertyInDialog(page, "Code");
      await selectOperatorInDialog(page, "Equal");
      await selectValueInDialog(page, "Equipment - Insulation");

      await page.getByRole("button", { name: "Apply" }).click();

      // expand node to see filtered children
      await node.getByLabel("Expand").click();
      await locateNode(treeWidget, "Equipment - Insulation").waitFor();

      // scroll to origin to avoid flakiness due to auto-scroll
      await page.mouse.wheel(-10000, -10000);

      // hover the node for the button to appear
      await node.hover();
      await treeWidget.getByTitle("Clear active filter").waitFor();

      await takeScreenshot(page, treeWidget);
    });

    test("node with active filtering - information message", async ({ page }) => {
      const node = locateNode(treeWidget, "Equipment");

      // hover the node for the button to appear
      await node.hover();
      await node.getByTitle("Apply filter").click();

      await locateInstanceFilter(page).waitFor();
      await selectPropertyInDialog(page, "Is Private");

      await page.getByRole("button", { name: "Apply" }).click();

      // expand node to see filtered children
      await node.getByLabel("Expand").click();
      await treeWidget.getByText("No child nodes match current filter").waitFor();

      // scroll to origin to avoid flakiness due to auto-scroll
      await page.mouse.wheel(-10000, -10000);

      // hover the node for the button to appear
      await node.hover();
      await treeWidget.getByTitle("Clear active filter").waitFor();

      await takeScreenshot(page, treeWidget);
    });

    test("search", async ({ page }) => {
      await locateNode(treeWidget, "Equipment").waitFor();
      await treeWidget.getByTitle("Search for something").click();
      await treeWidget.getByPlaceholder("Search...").fill("PipeSupport");

      // wait for non searched for nodes to disappear
      await locateNode(treeWidget, "Equipment").waitFor({ state: "hidden" });
      await takeScreenshot(page, treeWidget);
    });

    test("header buttons overflow", async ({ page }) => {
      await locateNode(treeWidget, "Equipment").waitFor();
      await treeWidget.getByTitle("Search for something").click();
      await treeWidget.getByTitle("More").click();
      await page.locator(".tree-header-button-dropdown-container").waitFor();
      await takeScreenshot(page, treeWidget);
    });
  });
});
