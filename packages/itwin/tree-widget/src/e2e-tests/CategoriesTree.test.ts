/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Locator } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  expandNode,
  getErrorDropdown,
  initTreeWidgetTest,
  locateInstanceFilter,
  locateNode,
  selectOperatorInDialog,
  selectPropertyInDialog,
  selectTree,
  selectValueInDialog,
  takeScreenshot,
} from "./utils.js";

test.describe("Categories tree", () => {
  let treeWidget: Locator;

  test.beforeEach(async ({ page, baseURL }) => {
    treeWidget = await initTreeWidgetTest({ page, baseURL });
    await selectTree(treeWidget, "Categories");
    await locateNode(treeWidget, "Equipment").getByRole("button", { name: "Determining visibility..." }).waitFor({ state: "detached" });
  });

  test("initial tree", async ({ page }) => {
    // wait for element to be visible in the tree
    const node = locateNode(treeWidget, "Equipment");
    await node.hover();
    const visibilityAction = node.getByRole("button", { name: "Visible" });
    await expect(visibilityAction).toBeVisible();
    await takeScreenshot(page, treeWidget);
  });

  test("expanded tree node", async ({ page }) => {
    const node = locateNode(treeWidget, "Equipment");
    await expandNode(page, node);

    // wait for node at the bottom to be visible/loaded
    await locateNode(treeWidget, "Equipment - Insulation").waitFor();
    await takeScreenshot(page, treeWidget);
  });

  test("node with active filtering", async ({ page }) => {
    const node = locateNode(treeWidget, "Equipment", 1);

    // hover the node for the button to appear
    await node.hover();
    await node.getByRole("button", { name: "Apply filter" }).click();

    await locateInstanceFilter(page).waitFor();
    await selectPropertyInDialog(page, "Code");
    await selectOperatorInDialog(page, "Equal");
    await selectValueInDialog(page, "Equipment - Insulation");

    await page.getByRole("button", { name: "Apply" }).click();

    // wait for filtered children to appear
    await locateNode(treeWidget, "Equipment - Insulation").waitFor();

    await takeScreenshot(page, treeWidget, { resetScroll: true });
  });

  test("node with active filtering - information message", async ({ page }) => {
    const node = locateNode(treeWidget, "Equipment", 1);

    // hover the node for the button to appear
    await node.hover();
    await node.getByRole("button", { name: "Apply filter" }).click();

    await locateInstanceFilter(page).waitFor();
    await selectPropertyInDialog(page, "Is Private");

    await page.getByRole("button", { name: "Apply" }).click();

    // wait for message to appear
    const errorDropdown = await getErrorDropdown(treeWidget);
    await takeScreenshot(page, treeWidget, { resetScroll: true });
    await errorDropdown.click();
    await takeScreenshot(page, treeWidget, { resetScroll: true });
  });

  test("search", async ({ page }) => {
    await locateNode(treeWidget, "Equipment").waitFor();
    await treeWidget.getByRole("button", { name: "Search the tree" }).click();
    await treeWidget.getByPlaceholder("Search...").fill("PipeSupport");

    // wait for non searched for nodes to disappear
    await locateNode(treeWidget, "PipeSupport")
      .getByRole("button", { name: "Visible: Category display enabled through category selector", includeHidden: true })
      .waitFor({ state: "hidden" });
    await locateNode(treeWidget, "Equipment").waitFor({ state: "hidden" });
    await takeScreenshot(page, treeWidget);
  });

  test("shows outlines when focused using keyboard", async ({ page }) => {
    // click to focus on node
    const node = locateNode(treeWidget, "Equipment", 1);
    await node.focus();
    const treeContainer = page.locator("#tw-tree-renderer-container");
    const visibilityAction = node.getByRole("button", { name: "Visible" });
    await expect(visibilityAction).toBeVisible();

    await takeScreenshot(page, node, { boundingComponent: treeContainer, expandBy: { top: 10, bottom: 10 } });

    // focus on checkbox using keyboard
    await page.keyboard.press("Tab");

    // ensure visibility action is focused
    await expect(visibilityAction).toBeFocused();
    await takeScreenshot(page, node, { boundingComponent: treeContainer, expandBy: { top: 10, bottom: 10 } });

    // focus on apply filter button
    await page.keyboard.press("ArrowRight");

    const applyFilterButton = node.getByRole("button", { name: "Apply filter" });
    await expect(applyFilterButton).toBeFocused();
    await takeScreenshot(page, node, { boundingComponent: treeContainer, expandBy: { top: 10, bottom: 10 } });

    // open filtering dialog
    await page.keyboard.press("Enter");

    await locateInstanceFilter(page).waitFor();
    await selectPropertyInDialog(page, "Code");
    await selectOperatorInDialog(page, "Equal");
    await selectValueInDialog(page, "Equipment - Insulation");

    await page.getByRole("button", { name: "Apply" }).click();
    await locateNode(treeWidget, "Equipment - Insulation").waitFor();

    await takeScreenshot(page, node, { resetScroll: true, boundingComponent: treeContainer, expandBy: { top: 10, bottom: 10 } });
  });

  test("hides all categories", async ({ page }) => {
    await locateNode(treeWidget, "Equipment").waitFor();
    await page.getByRole("button", { name: "Hide all" }).click();

    await expect(locateNode(treeWidget, "Equipment").getByRole("button", { name: "Hidden" })).not.toBeVisible();
    await takeScreenshot(page, treeWidget);
  });

  test("hides all categories in filtered tree", async ({ page }) => {
    await locateNode(treeWidget, "Equipment").waitFor();
    await treeWidget.getByRole("button", { name: "Search the tree" }).click();
    const searchBox = treeWidget.getByPlaceholder("Search...");
    await searchBox.fill("sg-1");

    // wait for non searched for nodes to disappear
    await locateNode(treeWidget, "Equipment").waitFor({ state: "hidden" });

    await page.getByRole("button", { name: "Hide all" }).click();

    await searchBox.clear();

    const node = locateNode(treeWidget, "Equipment");
    await node.waitFor({ state: "visible" });
    await node.getByRole("button", { name: "Visible: All subCategories are visible", includeHidden: true }).waitFor({ state: "attached" });
    await takeScreenshot(page, treeWidget);
  });
});
