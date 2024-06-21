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
  await page.getByRole("menuitem", { name: "Model", exact: true }).waitFor();
  await page.getByRole("menuitem", { name: propertyText, exact: true }).click();
}

// make sure to open the filter dialog before calling this.
async function selectOperatorInDialog(page: Page, operatorText: string) {
  const filterBuilder = page.locator(".presentation-property-filter-builder");

  await filterBuilder.getByText("Contains").click();
  await page.getByRole("option", { name: operatorText, exact: true }).click();

  await filterBuilder.getByText("Contains").waitFor({ state: "hidden" });
  await filterBuilder.getByText(operatorText).waitFor();
}

// make sure to open the filter dialog before calling this.
async function selectValueInDialog(page: Page, valueText: string) {
  const filterBuilder = page.locator(".presentation-property-filter-builder");

  // search for one character less to not have to differentiate between entered value and option in dropdown
  await page.locator(".presentation-async-select-values-container input").fill(valueText.slice(0, -1));
  await page.getByText(valueText, { exact: true }).click();

  await filterBuilder.getByText(`option ${valueText}, selected.`).waitFor();
}

async function selectTree(page: Page, tree: string) {
  await treeWidget.getByText("BayTown").waitFor();
  await treeWidget.getByRole("combobox").click();
  await page.getByRole("listbox").waitFor();
  await page.getByText(tree, { exact: true }).click();
}

async function scrollTree(page: Page, x: number, y: number) {
  // get the parent of the tree renderer that is scrollable
  const container = page.locator("div:has(> .tw-tree-renderer)");
  await container.evaluate(
    (e: SVGElement | HTMLElement, scrollAmount: { left: number; top: number }) => {
      e.scrollBy(scrollAmount);
    },
    { left: x, top: y },
  );
}

test.describe("tree widget", () => {
  const testCases = (lastNodeLabel: string) => {
    test.beforeEach(async () => {
      await locateNode(treeWidget, "BayTown").getByRole("checkbox", { name: "Visible: At least one model is visible", exact: true }).waitFor();
    });

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

      // wait until filter is applied
      await treeWidget.getByText("There are no child nodes matching current filter").waitFor();

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

  test.beforeEach(async ({ page, baseURL }) => {
    treeWidget = await initTreeWidgetTest({ page, baseURL });
    await locateNode(treeWidget, "BayTown").getByRole("checkbox", { name: "Visible: All models are visible", exact: true }).waitFor();
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
