/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Locator } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  expandNode,
  initTreeWidgetTest,
  locateInstanceFilter,
  locateNode,
  selectOperatorInDialog,
  selectPropertyInDialog,
  selectTree,
  selectValueInDialog,
  takeScreenshot,
} from "./utils.js";

test.describe("Models tree", () => {
  let treeWidget: Locator;

  test.beforeEach(async ({ page, baseURL }) => {
    treeWidget = await initTreeWidgetTest({ page, baseURL });
    await selectTree(treeWidget, "Models");
    await locateNode(treeWidget, "ProcessPhysicalModel").getByRole("button", { name: "Determining visibility..." }).waitFor({ state: "detached" });
  });

  test("disabled selection", async ({ page }) => {
    // disable nodes' selection
    await page.getByRole("button", { name: "Toggle tree nodes' selection" }).click();

    const physicalModelNode = locateNode(treeWidget, "ProcessPhysicalModel");
    await physicalModelNode.click();
    await expect(physicalModelNode).toHaveAttribute("aria-selected", "false");

    await expandNode(page, physicalModelNode);
    const equipmentNode = locateNode(treeWidget, "Equipment");
    await equipmentNode.click();
    await expect(equipmentNode).toHaveAttribute("aria-selected", "false");

    await expandNode(page, equipmentNode);
    const parReboilerGroupingNode = locateNode(treeWidget, "Par. Reboiler");
    await parReboilerGroupingNode.click();
    await expect(parReboilerGroupingNode).toHaveAttribute("aria-selected", "false");

    await expandNode(page, parReboilerGroupingNode);
    const parReboilerInstanceNode = locateNode(treeWidget, "EX-302 [4-106]");
    await parReboilerInstanceNode.click();
    await expect(parReboilerInstanceNode).toHaveAttribute("aria-selected", "false");
  });

  test("initial tree", async ({ page }) => {
    // wait for element to be visible in the tree
    await locateNode(treeWidget, "ProcessPhysicalModel").getByRole("button", { name: "Determining visibility..." }).waitFor({ state: "detached" });
    await takeScreenshot(page, treeWidget);
  });

  test("expanded tree node", async ({ page }) => {
    const physicalModelNode = locateNode(treeWidget, "ProcessPhysicalModel");
    await expandNode(page, physicalModelNode);

    const pipeSupportNode = locateNode(treeWidget, "PipeSupport");
    await expandNode(page, pipeSupportNode);

    const hangerRodNode = locateNode(treeWidget, "Hanger Rod");
    await expandNode(page, hangerRodNode);

    // wait for node children to be visible/loaded
    await locateNode(treeWidget, "Hanger Rod [4-2UH]").waitFor();
    await takeScreenshot(page, treeWidget);
  });

  test("selected node", async ({ page }) => {
    const node = locateNode(treeWidget, "ProcessPhysicalModel");
    await node.getByRole("button", { name: "Determining visibility..." }).waitFor({ state: "detached" });
    await node.click();

    // wait for node to become selected
    await expect(node).toHaveAttribute("aria-selected", "true");
    await takeScreenshot(page, treeWidget);
  });

  test("node with active filtering", async ({ page }) => {
    const physicalModelNode = locateNode(treeWidget, "ProcessPhysicalModel");

    // hover the node for the button to appear
    await physicalModelNode.hover();
    await physicalModelNode.getByRole("button", { name: "Apply filter" }).click();

    await locateInstanceFilter(page).waitFor();
    await selectPropertyInDialog(page, "Code");
    await selectOperatorInDialog(page, "Equal");
    await selectValueInDialog(page, "PipeSupport");

    await page.getByRole("button", { name: "Apply" }).click();

    // wait for filtered children to appear
    await locateNode(treeWidget, "PipeSupport").waitFor();

    await takeScreenshot(page, treeWidget, { resetScroll: true });
  });

  test("node with active filtering - information message", async ({ page }) => {
    const physicalModelNode = locateNode(treeWidget, "ProcessPhysicalModel");

    // hover the node for the button to appear
    await physicalModelNode.hover();
    await physicalModelNode.getByRole("button", { name: "Apply filter" }).click();

    await locateInstanceFilter(page).waitFor();
    await selectPropertyInDialog(page, "Is Private");

    await page.getByRole("button", { name: "Apply" }).click();

    // wait for message to appear
    await treeWidget.getByText("No child nodes match current filter").waitFor();

    await takeScreenshot(page, treeWidget, { resetScroll: true });
  });

  test("search", async ({ page }) => {
    await treeWidget.getByRole("button", { name: "Search the tree" }).click();
    await treeWidget.getByPlaceholder("Search...").fill("[4-1F5]");

    // wait for node to be found
    await treeWidget.getByText(`E-104B-TOP [4-1F5]`).waitFor();
    await takeScreenshot(page, treeWidget);
  });

  test("search - not found", async ({ page }) => {
    const node = locateNode(treeWidget, "ProcessPhysicalModel");
    await expandNode(page, node);

    await treeWidget.getByRole("button", { name: "Search the tree" }).click();
    await treeWidget.getByPlaceholder("Search...").fill("Test");

    // wait for no nodes to be found matching search input
    await treeWidget.getByText(`No results were found for your search query.`).waitFor();
    await takeScreenshot(page, treeWidget);
  });

  test("search - too many results", async ({ page }) => {
    const node = locateNode(treeWidget, "ProcessPhysicalModel");
    await expandNode(page, node);

    await treeWidget.getByRole("button", { name: "Search the tree" }).click();
    await treeWidget.getByPlaceholder("Search...").fill("x");

    // wait for error message to be displayed
    await treeWidget.getByText(`There are too many matches for your search query.`).waitFor();
    await takeScreenshot(page, treeWidget);
  });

  test("instances focus", async ({ page }) => {
    const physicalModelNode = locateNode(treeWidget, "ProcessPhysicalModel");
    await expandNode(page, physicalModelNode);

    // wait for all children nodes to be visible
    await locateNode(treeWidget, "Structure").waitFor();

    // enable instances focus and select a node
    await page.getByRole("button", { name: "Enable Instance Focus" }).click();
    const pipeSupportNode = locateNode(treeWidget, "PipeSupport");
    await pipeSupportNode.click();

    // wait for non selected node to no longer be visible
    await locateNode(treeWidget, "Structure").waitFor({ state: "hidden" });
    await takeScreenshot(page, treeWidget);
  });

  test("instances focus - too many results", async ({ page }) => {
    const physicalModelNode = locateNode(treeWidget, "ProcessPhysicalModel");
    await expandNode(page, physicalModelNode);

    // wait for all children nodes to be visible
    await locateNode(treeWidget, "Structure").waitFor();

    // enable instances focus and select a node
    await page.getByRole("button", { name: "Enable instance focus mode" }).click();

    // select all elements in viewport
    const viewport = await page.getByTestId("viewport-component").boundingBox();
    expect(viewport).not.toBeNull();

    await page.mouse.move(50, 50, { steps: 25 });
    await page.mouse.down();
    await page.mouse.move(viewport!.width - 50, viewport!.height - 50, { steps: 25 });
    await page.mouse.up();

    // wait for error message to be displayed
    await treeWidget.getByText(`There are too many elements selected for focus mode.`).waitFor();
    await takeScreenshot(page, treeWidget);

    // click the disable focus text
    await treeWidget.getByText("disable the focus mode").click();

    // ensure instance focus is turned off and hierarchy is visible
    await page.getByRole("button", { name: "Enable instance focus mode" }).waitFor();
    await locateNode(treeWidget, "ProcessPhysicalModel").waitFor();
  });

  test("shows outlines when focused using keyboard", async ({ page }) => {
    // select node to show selected outline
    const node = locateNode(treeWidget, "ProcessPhysicalModel");
    await node.click();
    const treeContainer = page.locator("#tw-tree-renderer-container");

    // wait for node to become selected
    await expect(node).toHaveAttribute("aria-selected", "true");

    // focus visibility action using keyboard
    await page.keyboard.press("Tab");

    // ensure visibility action is focused
    const visibilityAction = node.getByRole("button", { name: "Visible" });
    await expect(visibilityAction).toBeFocused();
    await takeScreenshot(page, node, { boundingComponent: treeContainer, expandBy: { top: 10, bottom: 10 } });

    // Focus on apply filter button
    await page.keyboard.press("ArrowRight");
    const applyFilterButton = node.getByRole("button", { name: "Apply filter" });
    await expect(applyFilterButton).toBeFocused();

    await takeScreenshot(page, node, { boundingComponent: treeContainer, expandBy: { top: 10, bottom: 10 } });

    // open filtering dialog
    await page.keyboard.press("Enter");

    await locateInstanceFilter(page).waitFor();
    await selectPropertyInDialog(page, "Code");
    await selectOperatorInDialog(page, "Equal");
    await selectValueInDialog(page, "PipeSupport");

    await page.getByRole("button", { name: "Apply" }).click();
    await locateNode(treeWidget, "PipeSupport").waitFor();

    await takeScreenshot(page, node, { resetScroll: true, boundingComponent: treeContainer, expandBy: { top: 10, bottom: 10 } });
  });
});
