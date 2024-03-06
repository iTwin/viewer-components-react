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

// make sure to open the filter dialog before calling this.
async function selectPropertyInDialog(page: Page, propertyText: string) {
  const filterBuilder = page.locator(".presentation-property-filter-builder");

  await filterBuilder.getByPlaceholder("Choose property").click();

  // ensure that options are loaded
  await page.getByRole("menuitem", { name: "Model" }).waitFor();
  await page.getByRole("menuitem", { name: propertyText }).click();
}

test.describe("tree widget", () => {
  const testCases = (lastNodeLabel: string) => {
    test("initial tree", async ({ page }) => {
      // wait for element to be visible in the tree
      await locateNode(treeWidget, "ProcessPhysicalModel").getByRole("checkbox", { name: "Visible", exact: true }).waitFor();
      await takeScreenshot(page, treeWidget);
    });

    test("expanded tree node", async ({ page }) => {
      const node = locateNode(treeWidget, "ProcessPhysicalModel");
      await node.getByTestId("tree-node-expansion-toggle").click();

      // wait for node at the bottom to be visible/loaded
      await locateNode(treeWidget, lastNodeLabel).waitFor();
      await takeScreenshot(page, treeWidget);
    });

    test("fully expanded tree node", async ({ page }) => {
      const physicalModelNode = locateNode(treeWidget, "ProcessPhysicalModel");
      await physicalModelNode.getByTestId("tree-node-expansion-toggle").click();

      // wait for node at the bottom to be visible/loaded
      await locateNode(treeWidget, lastNodeLabel).waitFor();
      const pipeSupportNode = locateNode(treeWidget, "PipeSupport");
      await pipeSupportNode.getByTestId("tree-node-expansion-toggle").click();

      // wait for node at the bottom to be visible/loaded
      await locateNode(treeWidget, "Hanger Rod [4-2UH]").waitFor();
      await takeScreenshot(page, treeWidget);
    });

    test("node with active filtering - information message", async ({ page }) => {
      const physicalModelNode = locateNode(treeWidget, "ProcessPhysicalModel");

      // hover the node for the button to appear
      await physicalModelNode.hover();
      await physicalModelNode.getByTitle("Apply filter").click();

      await locateInstanceFilter(page).waitFor();
      await selectPropertyInDialog(page, "Is Private");

      await page.getByRole("button", { name: "Apply" }).click();

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

      await page
        .getByRole("combobox")
        .filter({ has: page.getByText("Is true") })
        .click();
      await page.getByRole("option", { name: "Is true" }).waitFor();
      await page.getByRole("option", { name: "Is false" }).click();

      await page.getByRole("button", { name: "Apply" }).click();

      // hover the node for buttons to appear
      await physicalModelNode.hover();
      await treeWidget.getByTitle("Clear active filter").waitFor();

      // wait for node at the bottom to be visible/loaded
      await locateNode(treeWidget, lastNodeLabel).waitFor();
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

    test("button dropdown", async ({ page }) => {
      await treeWidget.getByTitle("Search for something").click();
      await treeWidget.getByTitle("More").click();
      await page.locator(".tree-header-button-dropdown-container").waitFor();
      await takeScreenshot(page, treeWidget);
    });

    test("tree selector", async ({ page }) => {
      await treeWidget.getByRole("combobox").click();
      await page.getByRole("listbox").waitFor();
      await takeScreenshot(page, treeWidget);
    });
  };

  test.describe("default", () => {
    testCases("Tag-Category");
  });

  test.describe("enlarged", () => {
    test.beforeEach(async ({ page }) => {
      const expandedLayoutToggleButton = page.getByTitle("Toggle expanded layout");
      await expandedLayoutToggleButton.click();
      await treeWidget.locator(".tree-widget-tree-header.enlarge").waitFor();
    });

    testCases("SG-1-SG-0317-EX-OPM");
  });
});
