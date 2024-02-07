/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Locator, Page } from "@playwright/test";
import assert from "assert";
import { expect, test } from "@playwright/test";
import { expandStagePanel, locateInstanceFilter, locateNode, locateWidget, takeScreenshot } from "./utils";

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

  test("fully expanded tree node", async ({ page }) => {
    const physicalModelNode = locateNode(treeWidget, "ProcessPhysicalModel");
    await physicalModelNode.getByTestId("tree-node-expansion-toggle").click();

    // wait for node at the bottom to be visible/loaded
    await locateNode(treeWidget, "Tag-Category").waitFor();
    const pipeSupportNode = locateNode(treeWidget, "PipeSupport");
    await pipeSupportNode.getByTestId("tree-node-expansion-toggle").click();

    // wait for node at the bottom to be visible/loaded
    await locateNode(treeWidget, "Hanger Rod [4-2UH]").waitFor();
    await takeScreenshot(page, treeWidget);
  });

  // make sure to open the filter dialog before calling this.
  async function selectPropertyInDialog(page: Page, propertyText: string) {
    const filterBuilder = page.locator(".presentation-property-filter-builder");

    await filterBuilder.getByPlaceholder("Choose property").click();

    // ensure that options are loaded
    await page.locator(".property-display-label", { hasText: "Model" }).waitFor();
    await page.locator(".property-display-label", { hasText: propertyText }).click();
  }

  test("node with active filtering - information message", async ({ page }) => {
    const physicalModelNode = locateNode(treeWidget, "ProcessPhysicalModel");

    // hover the node for the button to appear
    await physicalModelNode.hover();
    await physicalModelNode.getByTitle("Apply filter").click();

    await locateInstanceFilter(page).waitFor();
    await selectPropertyInDialog(page, "Is Private");

    await page.locator(".presentation-instance-filter-dialog-apply-button", { hasText: "Apply" }).click();

    // hover the node for the button to appear
    await physicalModelNode.hover();
    await treeWidget.getByTitle("Clear active filter").waitFor();

    await takeScreenshot(page, treeWidget);
  });

  test("node with active filtering - filtered nodes", async ({ page }) => {
    const physicalModelNode = locateNode(treeWidget, "ProcessPhysicalModel");

    // hover the node for the button to appear
    await physicalModelNode.hover();
    await physicalModelNode.getByTitle("Apply filter").click();

    await locateInstanceFilter(page).waitFor();
    await selectPropertyInDialog(page, "Is Private");

    // TO-DO: add ability to locate dialog rule operator items without using iTwinUI selectors
    await page.locator(".rule-operator", { hasText: "Is True" }).click();
    await page.locator(".iui-menu-item", { hasText: "Is True" }).waitFor();
    await page.locator(".iui-menu-item", { hasText: "Is False" }).click();

    await page.locator(".presentation-instance-filter-dialog-apply-button", { hasText: "Apply" }).click();

    // hover the node for the button to appear
    await physicalModelNode.hover();
    await treeWidget.getByTitle("Clear active filter").waitFor();

    // ensure the last node is loaded before taking a screenshot to avoid flakiness
    await locateNode(treeWidget, "SWS-1-SWS-0311-EX-OPM").waitFor();
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
