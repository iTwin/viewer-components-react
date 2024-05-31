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

async function selectTree(page: Page, tree: string) {
  await treeWidget.getByText("BayTown").waitFor();
  await treeWidget.getByRole("combobox").click();
  await page.getByRole("listbox").waitFor();
  await page.getByText(tree, { exact: true }).click();
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
      await treeWidget.getByText("BayTown").waitFor();
      await treeWidget.getByTitle("Search for something").click();
      await treeWidget.getByPlaceholder("Search...").fill("Model");
      await treeWidget.locator(".components-activehighlight").waitFor();
      await takeScreenshot(page, treeWidget);
    });

    test("button dropdown", async ({ page }) => {
      await treeWidget.getByText("BayTown").waitFor();
      await treeWidget.getByTitle("Search for something").click();
      await treeWidget.getByTitle("More").click();
      await page.locator(".tree-header-button-dropdown-container").waitFor();
      await takeScreenshot(page, treeWidget);
    });

    test("tree selector", async ({ page }) => {
      await treeWidget.getByText("BayTown").waitFor();
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
      });

      test("initial tree", async ({ page }) => {
        // wait for element to be visible in the tree
        await locateNode(treeWidget, "ProcessPhysicalModel").getByRole("checkbox", { name: "Visible", exact: true }).waitFor();
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

      test("node with active filtering - information message", async ({ page }) => {
        const physicalModelNode = locateNode(treeWidget, "ProcessPhysicalModel");

        // hover the node for the button to appear
        await physicalModelNode.hover();
        await physicalModelNode.getByTitle("Apply filter").click();

        await locateInstanceFilter(page).waitFor();
        await selectPropertyInDialog(page, "Is Private");

        await page.getByRole("button", { name: "Apply" }).click();
        await physicalModelNode.getByLabel("Expand").click();

        // wait until filter is applied
        await treeWidget.getByText("No child nodes match current filter").waitFor();

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
        await expect(node).toHaveClass(/selected/);
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

      test("button dropdown", async ({ page }) => {
        await treeWidget.getByText("BayTown").waitFor();
        await treeWidget.getByTitle("Search for something").click();
        await treeWidget.getByTitle("More").click();
        await page.locator(".tree-header-button-dropdown-container").waitFor();
        await takeScreenshot(page, treeWidget);
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

      test("node with active filtering - information message", async ({ page }) => {
        const node = locateNode(treeWidget, "Equipment");

        // hover the node for the button to appear
        await node.hover();
        await node.getByTitle("Apply filter").click();

        await locateInstanceFilter(page).waitFor();
        await selectPropertyInDialog(page, "Is Private");

        await page.getByRole("button", { name: "Apply" }).click();
        await node.getByLabel("Expand").click();

        // wait until filter is applied
        await treeWidget.getByText("No child nodes match current filter").waitFor();

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

      test("hierarchy-limit-exceeded", async ({ page }) => {
        const node = locateNode(treeWidget, "ProcessPhysicalModel");
        await node.getByLabel("Expand").click();

        // wait for hierarchy level limit exceeded text to appear
        await treeWidget.getByText(/hierarchy level size limit/).waitFor();
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
        await node.getByLabel("Expand").click();

        // wait until filter is applied
        await treeWidget.getByText("No child nodes match current filter").waitFor();

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
      await treeWidget.locator(".tree-widget-tree-header.enlarge").waitFor();
    });

    testCases("SG-1-SG-0317-EX-OPM");
    statelessModelsTreeTestCases(true);
    statelessCategoriesTreeTestCases();
    statelessIModelContentTreeTestCases();
    statelessExternalSourcesTreeTestCases();
  });
});
