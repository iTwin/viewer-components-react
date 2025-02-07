/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Locator } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  expandStagePanel,
  initTreeWidgetTest,
  locateInstanceFilter,
  locateNode,
  scrollTree,
  selectOperatorInDialog,
  selectPropertyInDialog,
  selectTree,
  selectValueInDialog,
  takeScreenshot,
  withDifferentDensities,
} from "./utils.js";

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
      await node.getByRole("button", { name: "Apply filter" }).click();

      await locateInstanceFilter(page).waitFor();
      await selectPropertyInDialog(page, "Code");
      await selectOperatorInDialog(page, "Equal");
      await selectValueInDialog(page, "Equipment - Insulation");

      await page.getByRole("button", { name: "Apply" }).click();

      // wait for filtered children to appear
      await locateNode(treeWidget, "Equipment - Insulation").waitFor();
      await treeWidget.getByRole("button", { name: "Clear active filter" }).waitFor();

      await takeScreenshot(page, treeWidget, { resetScroll: true });
    });

    test("node with active filtering - information message", async ({ page }) => {
      const node = locateNode(treeWidget, "Equipment");

      // hover the node for the button to appear
      await node.hover();
      await node.getByRole("button", { name: "Apply filter" }).click();

      await locateInstanceFilter(page).waitFor();
      await selectPropertyInDialog(page, "Is Private");

      await page.getByRole("button", { name: "Apply" }).click();

      // wait for message to appear
      await treeWidget.getByText("No child nodes match current filter").waitFor();
      await treeWidget.getByRole("button", { name: "Clear active filter" }).waitFor();

      await takeScreenshot(page, treeWidget, { resetScroll: true });
    });

    test("search", async ({ page }) => {
      await locateNode(treeWidget, "Equipment").waitFor();
      await treeWidget.getByRole("button", { name: "Open" }).click();
      await treeWidget.getByPlaceholder("Search...").fill("PipeSupport");

      // wait for non searched for nodes to disappear
      await locateNode(treeWidget, "Equipment").waitFor({ state: "hidden" });
      await takeScreenshot(page, treeWidget);
    });

    test("header buttons overflow", async ({ page }) => {
      await locateNode(treeWidget, "Equipment").waitFor();
      await treeWidget.getByRole("button", { name: "Open" }).click();
      await treeWidget.getByRole("button", { name: "More" }).click();
      await page.locator(".tree-header-button-dropdown-container").waitFor();
      await takeScreenshot(page, treeWidget);
    });

    test("shows outlines when focused using keyboard", async ({ page }) => {
      // click to focus on node
      const node = locateNode(treeWidget, "Equipment", 1);
      await node.click();
      const treeContainer = page.locator("#tw-tree-renderer-container");

      // focus on checkbox using keyboard
      await page.keyboard.press("Tab");

      // ensure checkbox is focused
      const checkbox = node.getByRole("checkbox");
      await expect(checkbox).toBeFocused();

      await takeScreenshot(page, node, { boundingComponent: treeContainer, expandBy: { top: 10, bottom: 10 } });

      // shrink panel
      await expandStagePanel(page, "right", -100);
      // scroll to the right side
      await scrollTree(page, 10000, 0);

      // re-focus on checkbox after resizing the panel
      const nodeBox = await node.boundingBox();
      await node.click({ position: nodeBox ? { x: nodeBox.width * 0.6, y: nodeBox.height * 0.5 } : undefined });
      await page.keyboard.press("Tab");

      await takeScreenshot(page, node, { boundingComponent: treeContainer, expandBy: { top: 10, bottom: 10 } });

      // expand panel
      await expandStagePanel(page, "right", 100);
      // scroll to the right side
      await scrollTree(page, -10000, -10000);

      // re-focus on checkbox after resizing the panel
      await node.click();
      await page.keyboard.press("Tab");

      // focus on expander
      await page.keyboard.press("Tab");
      const expander = node.getByLabel("Expand");
      await expect(expander).toBeFocused();

      await takeScreenshot(page, node, { resetScroll: true, boundingComponent: treeContainer, expandBy: { top: 10, bottom: 10 } });

      // navigate back to focus on the already selected node
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("ArrowDown");

      await expect(node).toBeFocused();

      await takeScreenshot(page, node, { resetScroll: true, boundingComponent: treeContainer, expandBy: { top: 10, bottom: 10 } });

      // click on a different node to avoid showing filtering buttons due to hover
      const hexNode = locateNode(treeWidget, "E-HEX");
      await hexNode.click();

      // focus back on the node we want to filter
      await page.keyboard.press("ArrowDown");

      // Focus on apply filter button
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");

      const applyFilterButton = node.getByRole("button", { name: "Apply filter" });
      await expect(applyFilterButton).toBeFocused();

      await takeScreenshot(page, node, { resetScroll: true, boundingComponent: treeContainer, expandBy: { top: 10, bottom: 10 } });

      // open filtering dialog
      await page.keyboard.press("Enter");

      await locateInstanceFilter(page).waitFor();
      await selectPropertyInDialog(page, "Code");
      await selectOperatorInDialog(page, "Equal");
      await selectValueInDialog(page, "Equipment - Insulation");

      await page.getByRole("button", { name: "Apply" }).click();
      await expect(applyFilterButton).toBeFocused();

      // navigate to clear filter button
      await page.keyboard.press("Shift+Tab");
      await takeScreenshot(page, node, { resetScroll: true, boundingComponent: treeContainer, expandBy: { top: 10, bottom: 10 } });

      // click the clear filter button
      await page.keyboard.press("Enter");
      await expect(applyFilterButton).toBeFocused();
    });

    test("hides all categories", async ({ page }) => {
      await locateNode(treeWidget, "Equipment").waitFor();
      await page.getByRole("button", { name: "Hide all" }).click();

      await expect(locateNode(treeWidget, "Equipment").getByRole("checkbox")).not.toBeChecked();
      await takeScreenshot(page, treeWidget);
    });

    test("hides all categories in filtered tree", async ({ page }) => {
      await locateNode(treeWidget, "Equipment").waitFor();
      await treeWidget.getByRole("button", { name: "Open" }).click();
      await treeWidget.getByPlaceholder("Search...").fill("sg-1");

      // wait for non searched for nodes to disappear
      await locateNode(treeWidget, "Equipment").waitFor({ state: "hidden" });

      await treeWidget.getByRole("button", { name: "More" }).click();
      await page.getByRole("button", { name: "Hide all" }).click();

      await treeWidget.getByRole("button", { name: "Close" }).click();

      await locateNode(treeWidget, "Equipment").waitFor({ state: "visible" });
      await takeScreenshot(page, treeWidget);
    });
  });
});
