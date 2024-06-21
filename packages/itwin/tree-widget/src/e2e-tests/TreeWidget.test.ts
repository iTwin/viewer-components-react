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

    test("tree selector", async ({ page }) => {
      await treeWidget.getByRole("combobox").click();
      await page.getByRole("listbox").waitFor();
      await takeScreenshot(page, treeWidget);
    });

    test("tree selector badge", async ({ page }) => {
      await selectTree(page, "External Sources");
      await page.getByText("The data required for this tree layout is not available in this iModel.").waitFor();

      await takeScreenshot(page, treeWidget);
    });
  };

  const statelessModelsTreeTestCases = (enlarged: boolean) => {
    test.describe("stateless models tree", () => {
      test.beforeEach(async ({ page }) => {
        await selectTree(page, "Models (Beta)");
        await locateNode(treeWidget, "BayTown").getByRole("checkbox", { name: "Visible: All models are visible", exact: true }).waitFor();
      });

      test("initial tree", async ({ page }) => {
        // wait for element to be visible in the tree
        await locateNode(treeWidget, "ProcessPhysicalModel").getByRole("checkbox", { name: "Visible: All categories visible", exact: true }).waitFor();
        await takeScreenshot(page, treeWidget);
      });

      test("expanded tree node", async ({ page }) => {
        const physicalModelNode = locateNode(treeWidget, "ProcessPhysicalModel");
        await physicalModelNode.getByLabel("Expand").click();

        // wait for node at the bottom to be visible/loaded
        await locateNode(treeWidget, "Tag-Category").waitFor();

        const pipeSupportNode = locateNode(treeWidget, "PipeSupport");
        await pipeSupportNode.getByLabel("Expand").click();

        const hangerRodNode = locateNode(treeWidget, "Hanger Rod");
        await hangerRodNode.getByLabel("Expand").click();

        // wait for node children to be visible/loaded
        await locateNode(treeWidget, "Hanger Rod [4-2UH]").waitFor();
        await takeScreenshot(page, treeWidget);
      });

      test("node with active filtering", async ({ page }) => {
        const physicalModelNode = locateNode(treeWidget, "ProcessPhysicalModel");

        // hover the node for the button to appear
        await physicalModelNode.hover();
        await physicalModelNode.getByTitle("Apply filter").click();

        await locateInstanceFilter(page).waitFor();
        await selectPropertyInDialog(page, "Code");
        await selectOperatorInDialog(page, "Equal");
        await selectValueInDialog(page, "PipeSupport");

        await page.getByRole("button", { name: "Apply" }).click();

        // expand node to see filtered children
        await physicalModelNode.getByLabel("Expand").click();
        await locateNode(treeWidget, "PipeSupport").waitFor();

        // scroll to origin to avoid flakiness due to auto-scroll
        await scrollTree(page, -10000, -10000);

        // hover the node for the button to appear
        await physicalModelNode.hover();
        await treeWidget.getByTitle("Clear active filter").waitFor();

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

        // expand node to see filtered children
        await physicalModelNode.getByLabel("Expand").click();
        await treeWidget.getByText("No child nodes match current filter").waitFor();

        // scroll to origin to avoid flakiness due to auto-scroll
        await scrollTree(page, -10000, -10000);

        // hover the node for the button to appear
        await physicalModelNode.hover();
        await treeWidget.getByTitle("Clear active filter").waitFor();

        await takeScreenshot(page, treeWidget);
      });

      test("instances focus", async ({ page }) => {
        const physicalModelNode = locateNode(treeWidget, "ProcessPhysicalModel");
        await physicalModelNode.getByLabel("Expand").click();

        // wait for all children nodes to be visible
        await locateNode(treeWidget, "Structure").waitFor();

        // when enlarged layout is used the instances focus button is not visible
        if (enlarged) {
          await treeWidget.getByTitle("More").click();
          await page.locator(".tree-header-button-dropdown-container").waitFor();
        }

        // enable instances focus and select a node
        await page.getByTitle("Enable Instance Focus").click();
        const pipeSupportNode = locateNode(treeWidget, "PipeSupport");
        await pipeSupportNode.click();

        // wait for non selected node to no longer be visible
        await locateNode(treeWidget, "Structure").waitFor({ state: "hidden" });
        await takeScreenshot(page, treeWidget);
      });

      test("selected node", async ({ page }) => {
        const node = locateNode(treeWidget, "BayTown");
        await node.click();

        // wait for node to become selected
        await expect(node).toHaveAttribute("aria-selected", "true");
        await takeScreenshot(page, treeWidget);
      });

      test("search", async ({ page }) => {
        const node = locateNode(treeWidget, "ProcessPhysicalModel");
        await node.getByLabel("Expand").click();

        // wait for node at the bottom to be visible/loaded
        await locateNode(treeWidget, "Tag-Category").waitFor();

        await treeWidget.getByTitle("Search for something").click();
        await treeWidget.getByPlaceholder("Search...").fill("Test");

        // wait for no nodes to be found matching search input
        await treeWidget.getByText(`There are no nodes matching filter - "Test"`).waitFor();
        await takeScreenshot(page, treeWidget);
      });

      test("search - too many results", async ({ page }) => {
        const node = locateNode(treeWidget, "ProcessPhysicalModel");
        await node.getByLabel("Expand").click();

        // wait for node at the bottom to be visible/loaded
        await locateNode(treeWidget, "Tag-Category").waitFor();

        await treeWidget.getByTitle("Search for something").click();
        await treeWidget.getByPlaceholder("Search...").fill("x");

        // wait for error message to be displayed
        await treeWidget.getByText(`There are too many matches for the given filter. Please be more specific.`).waitFor();
        await takeScreenshot(page, treeWidget);
      });

      test("instances focus - too many results", async ({ page }) => {
        const physicalModelNode = locateNode(treeWidget, "ProcessPhysicalModel");
        await physicalModelNode.getByLabel("Expand").click();

        // wait for all children nodes to be visible
        await locateNode(treeWidget, "Structure").waitFor();

        // when enlarged layout is used the instances focus button is not visible
        if (enlarged) {
          await treeWidget.getByTitle("More").click();
          await page.locator(".tree-header-button-dropdown-container").waitFor();
        }

        // enable instances focus and select a node
        await page.getByTitle("Enable Instance Focus").click();

        // select all elements in viewport
        const viewport = await page.getByTestId("viewport-component").boundingBox();
        expect(viewport).not.toBeNull();

        await page.mouse.move(0, 0);
        await page.mouse.down();
        await page.mouse.move(viewport!.width - 50, viewport!.height - 50);
        await page.mouse.up();

        // wait for error message to be displayed
        await treeWidget.getByText(`There are too many elements selected for focus mode.`).waitFor();
        await takeScreenshot(page, treeWidget);

        // click the disable focus text
        await treeWidget.getByText("Disable the focus mode").click();

        // when enlarged layout is used the instances focus button is not visible
        if (enlarged) {
          await treeWidget.getByTitle("More").click();
          await page.locator(".tree-header-button-dropdown-container").waitFor();
        }

        // ensure instance focus is turned off and hierarchy is visible
        await page.getByTitle("Enable Instance Focus").waitFor();
        await locateNode(treeWidget, "BayTown").waitFor();
      });

      test("button dropdown", async ({ page }) => {
        await treeWidget.getByTitle("Search for something").click();
        await treeWidget.getByTitle("More").click();
        await page.locator(".tree-header-button-dropdown-container").waitFor();
        await takeScreenshot(page, treeWidget);
      });

      test("shows outlines when focused using keyboard", async ({ page }) => {
        // select node to show selected outline
        const node = locateNode(treeWidget, "ProcessPhysicalModel");
        await node.click();

        // wait for node to become selected
        await expect(node).toHaveAttribute("aria-selected", "true");

        // focus on checkbox using keyboard
        await page.keyboard.press("Tab");

        // ensure checkbox is focused
        const checkbox = node.getByTitle("Visible: All categories visible");
        await expect(checkbox).toBeFocused();

        await takeScreenshot(page, node, { top: 10, bottom: 10 }, treeWidget);

        // shrink panel
        await expandStagePanel(page, "right", -100);

        // re-focus on checkbox after resizing the panel
        await node.click();
        await page.keyboard.press("Tab");

        // scroll to the right side
        await scrollTree(page, 10000, 0);
        await takeScreenshot(page, node, { top: 10, bottom: 10 }, treeWidget);

        // expand panel
        await expandStagePanel(page, "right", 100);

        // scroll to origin to avoid flakiness due to auto-scroll
        await scrollTree(page, -10000, -10000);

        // re-focus on checkbox after resizing the panel
        await node.click();
        await page.keyboard.press("Tab");

        // focus on expander
        await page.keyboard.press("Tab");
        const expander = node.getByLabel("Expand");
        await expect(expander).toBeFocused();

        await takeScreenshot(page, node, { top: 10, bottom: 10 }, treeWidget);

        // navigate back to focus on the already selected node
        await page.keyboard.press("ArrowUp");
        await page.keyboard.press("ArrowDown");

        await expect(node).toBeFocused();
        await expect(node).toHaveAttribute("aria-selected", "true");

        await takeScreenshot(page, node, { top: 10, bottom: 10 }, treeWidget);

        // Focus on apply filter button
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");

        await takeScreenshot(page, node, { top: 10, bottom: 10 }, treeWidget);

        // open filtering dialog
        await page.keyboard.press("Enter");

        await locateInstanceFilter(page).waitFor();
        await selectPropertyInDialog(page, "Code");
        await selectOperatorInDialog(page, "Equal");
        await selectValueInDialog(page, "PipeSupport");

        await page.getByRole("button", { name: "Apply" }).click();

        // bring focus on the node
        await node.click();

        // navigate to clear filter button
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");

        // scroll to origin to avoid flakiness due to auto-scroll
        await scrollTree(page, -10000, -10000);

        await takeScreenshot(page, node, { top: 10, bottom: 10 }, treeWidget);

        // navigate to apply filter button
        await page.keyboard.press("Tab");

        // scroll to origin to avoid flakiness due to auto-scroll
        await scrollTree(page, -10000, -10000);

        await takeScreenshot(page, node, { top: 10, bottom: 10 }, treeWidget);
      });
    });
  };

  const statelessCategoriesTreeTestCases = () => {
    test.describe("stateless categories tree", () => {
      test.beforeEach(async ({ page }) => {
        await selectTree(page, "Categories (Beta)");
      });

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
        await scrollTree(page, -10000, -10000);

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
        await scrollTree(page, -10000, -10000);

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

      test("button dropdown", async ({ page }) => {
        await locateNode(treeWidget, "Equipment").waitFor();
        await treeWidget.getByTitle("Search for something").click();
        await treeWidget.getByTitle("More").click();
        await page.locator(".tree-header-button-dropdown-container").waitFor();
        await takeScreenshot(page, treeWidget);
      });

      test("shows outlines when focused using keyboard", async ({ page }) => {
        // click to focus on node
        const node = locateNode(treeWidget, "Equipment", 1);
        await node.click();

        // focus on checkbox using keyboard
        await page.keyboard.press("Tab");

        // ensure checkbox is focused
        const checkbox = node.locator(".tw-tree-node-checkbox");
        await expect(checkbox).toBeFocused();

        await takeScreenshot(page, node, { top: 10, bottom: 10 }, treeWidget);

        // shrink panel
        await expandStagePanel(page, "right", -100);

        // re-focus on checkbox after resizing the panel
        await node.click();
        await page.keyboard.press("Tab");

        // scroll to the right side
        await scrollTree(page, 10000, 0);
        await takeScreenshot(page, node, { top: 10, bottom: 10 }, treeWidget);

        // expand panel
        await expandStagePanel(page, "right", 100);

        // scroll to origin to avoid flakiness due to auto-scroll
        await scrollTree(page, -10000, -10000);

        // re-focus on checkbox after resizing the panel
        await node.click();
        await page.keyboard.press("Tab");

        // focus on expander
        await page.keyboard.press("Tab");
        const expander = node.getByLabel("Expand");
        await expect(expander).toBeFocused();

        await takeScreenshot(page, node, { top: 10, bottom: 10 }, treeWidget);

        // navigate back to focus on the already selected node
        await page.keyboard.press("ArrowUp");
        await page.keyboard.press("ArrowDown");

        await expect(node).toBeFocused();

        await takeScreenshot(page, node, { top: 10, bottom: 10 }, treeWidget);

        // Focus on apply filter button
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");

        await takeScreenshot(page, node, { top: 10, bottom: 10 }, treeWidget);

        // open filtering dialog
        await page.keyboard.press("Enter");

        await locateInstanceFilter(page).waitFor();
        await selectPropertyInDialog(page, "Code");
        await selectOperatorInDialog(page, "Equal");
        await selectValueInDialog(page, "Equipment - Insulation");

        await page.getByRole("button", { name: "Apply" }).click();

        // bring focus on the node
        await node.click();

        // navigate to clear filter button
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");

        // scroll to origin to avoid flakiness due to auto-scroll
        await scrollTree(page, -10000, -10000);

        await takeScreenshot(page, node, { top: 10, bottom: 10 }, treeWidget);

        // navigate to apply filter button
        await page.keyboard.press("Tab");

        // scroll to origin to avoid flakiness due to auto-scroll
        await scrollTree(page, -10000, -10000);

        await takeScreenshot(page, node, { top: 10, bottom: 10 }, treeWidget);
      });
    });
  };

  const statelessIModelContentTreeTestCases = () => {
    test.describe("stateless imodel content tree", () => {
      test.beforeEach(async ({ page }) => {
        await selectTree(page, "iModel Content (Beta)");
      });

      test("initial tree", async ({ page }) => {
        // wait for element to be visible in the tree
        await locateNode(treeWidget, "ProcessPhysicalModel").waitFor();
        await takeScreenshot(page, treeWidget);
      });

      test("expanded tree node", async ({ page }) => {
        const plantDocumentModelNode = locateNode(treeWidget, "PlantDocumentModel");
        await plantDocumentModelNode.getByLabel("Expand").click();

        const pipeSupportNode = locateNode(treeWidget, "Drawing (4)");
        await pipeSupportNode.getByLabel("Expand").click();

        const coolersNode = locateNode(treeWidget, "OPPID-04-COOLERS");
        await coolersNode.getByLabel("Expand").click();

        const bordersNode = locateNode(treeWidget, "Border");
        await bordersNode.getByLabel("Expand").click();

        const graphicNode = locateNode(treeWidget, "Pid Graphic (1)");
        await graphicNode.getByLabel("Expand").click();

        await locateNode(treeWidget, "D_SIZE [3-T4]").waitFor();
        await takeScreenshot(page, treeWidget);
      });

      test("node with active filtering", async ({ page }) => {
        const node = locateNode(treeWidget, "ProcessPhysicalModel");

        // hover the node for the button to appear
        await node.hover();
        await node.getByTitle("Apply filter").click();

        await locateInstanceFilter(page).waitFor();
        await selectPropertyInDialog(page, "Code");
        await selectOperatorInDialog(page, "Equal");
        await selectValueInDialog(page, "PipeSupport");

        await page.getByRole("button", { name: "Apply" }).click();

        // expand node to see filtered children
        await node.getByLabel("Expand").click();
        await locateNode(treeWidget, "PipeSupport").waitFor();

        // scroll to origin to avoid flakiness due to auto-scroll
        await scrollTree(page, -10000, -10000);

        // hover the node for the button to appear
        await node.hover();
        await treeWidget.getByTitle("Clear active filter").waitFor();

        await takeScreenshot(page, treeWidget);
      });

      test("node with active filtering - information message", async ({ page }) => {
        const node = locateNode(treeWidget, "ProcessPhysicalModel");

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
        await scrollTree(page, -10000, -10000);

        // hover the node for the button to appear
        await node.hover();
        await treeWidget.getByTitle("Clear active filter").waitFor();

        await takeScreenshot(page, treeWidget);
      });
    });
  };

  const statelessExternalSourcesTreeTestCases = () => {
    test.describe("stateless external sources tree", () => {
      test.beforeEach(async ({ page }) => {
        await selectTree(page, "External Sources (Beta)");
      });

      test("no data in imodel", async ({ page }) => {
        await page.getByText("The data required for this tree layout is not available in this iModel.").waitFor();
        await takeScreenshot(page, treeWidget);
      });
    });
  };

  test.describe("default", () => {
    testCases("Tag-Category");
    statelessModelsTreeTestCases(false);
    statelessCategoriesTreeTestCases();
    statelessIModelContentTreeTestCases();
    statelessExternalSourcesTreeTestCases();
  });

  test.describe("enlarged", () => {
    test.beforeEach(async ({ page }) => {
      const expandedLayoutToggleButton = page.getByTitle("Toggle expanded layout");
      await expandedLayoutToggleButton.click();
    });

    testCases("SG-1-SG-0317-EX-OPM");
    statelessModelsTreeTestCases(true);
    statelessCategoriesTreeTestCases();
    statelessIModelContentTreeTestCases();
    statelessExternalSourcesTreeTestCases();
  });
});
