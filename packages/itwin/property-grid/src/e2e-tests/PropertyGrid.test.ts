/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import assert from "assert";
import type { Page } from "@playwright/test";
import { test } from "@playwright/test";
import { expandStagePanel, locateWidget, takeScreenshot } from "./utils";

test.beforeEach(async ({ page, baseURL }) => {
  assert(baseURL);
  await page.goto(baseURL);
});

test.describe("property grid snapshots", () => {

  const testCases = () => {

    const selectSingleElement = async (page: Page) => {
      const treeWidget = locateWidget(page, "tree");
      await treeWidget.getByText("BayTown").click();

      const propertyWidget = locateWidget(page, "property-grid");
      await propertyWidget.getByText("BayTown").first().waitFor();

      return propertyWidget;
    };

    test("single element selected", async ({ page }) => {
      const propertyWidget = await selectSingleElement(page);
      await takeScreenshot(page, propertyWidget);
    });

    test("single element selected - search bar expanded", async ({ page }) => {
      const propertyWidget = await selectSingleElement(page);
      await propertyWidget.getByTitle("Expand Searchbar").click();

      await propertyWidget.getByTitle("Contract Searchbar").first().waitFor();

      await takeScreenshot(page, propertyWidget);
    });

    const selectSingleElementWithAncestry = async (page: Page) => {
      const treeWidget = locateWidget(page, "tree");
      await treeWidget.getByText("BayTown").waitFor();
      await treeWidget.getByText("ProcessPhysicalModel").click();

      const propertyWidget = locateWidget(page, "property-grid");
      await propertyWidget.getByText("ProcessPhysicalModel").first().waitFor();

      return propertyWidget;
    };

    test("single element with ancestry navigation", async ({ page }) => {
      const propertyWidget = await selectSingleElementWithAncestry(page);

      await takeScreenshot(page, propertyWidget);
    });

    test("single element with ancestry navigation - search bar expanded", async ({ page }) => {
      const propertyWidget = await selectSingleElementWithAncestry(page);
      await propertyWidget.getByTitle("Expand Searchbar").click();

      await propertyWidget.getByTitle("Contract Searchbar").first().waitFor();

      await takeScreenshot(page, propertyWidget);
    });

    const selectMultipleElements = async (page: Page) => {
      const treeWidget = locateWidget(page, "tree");
      await treeWidget.getByText("BayTown").click();

      const propertyWidget = locateWidget(page, "property-grid");
      await treeWidget.getByText("ProcessPhysicalModel").click();

      await propertyWidget.getByTitle("Selected Elements").first().waitFor();

      return propertyWidget;
    };

    test("multiple elements selected", async ({ page }) => {
      const propertyWidget = await selectMultipleElements(page);
      await takeScreenshot(page, propertyWidget);
    });

    test("multiple elements selected - search bar expanded", async ({ page }) => {
      const propertyWidget = await selectMultipleElements(page);
      await propertyWidget.getByTitle("Expand Searchbar").click();
      await propertyWidget.getByTitle("Contract Searchbar").first().waitFor();

      await takeScreenshot(page, propertyWidget);
    });

    test("elements list", async ({ page }) => {
      const propertyWidget = await selectMultipleElements(page);
      await propertyWidget.getByTitle("Selected Elements").click();

      await propertyWidget.getByText("Selected Elements").waitFor();
      await takeScreenshot(page, propertyWidget);
    });

    const selectElementFromElementList = async (page: Page) => {
      const propertyWidget = await selectMultipleElements(page);
      await propertyWidget.getByTitle("Selected Elements").click();

      await propertyWidget.getByTitle("Back").first().waitFor();
      await propertyWidget.getByText("BayTown", { exact: false }).first().click();

      await propertyWidget.getByText("BayTown", { exact: false }).first().waitFor();

      return propertyWidget;
    };

    test("single element selected from elements list", async ({ page }) => {
      const propertyWidget = await selectElementFromElementList(page);

      await takeScreenshot(page, propertyWidget);
    });

    test("single element selected from elements list - search bar expanded", async ({ page }) => {
      const propertyWidget = await selectElementFromElementList(page);
      const expandSearchbarButtons = await propertyWidget.getByTitle("Expand Searchbar").all();

      // use the second one, since the first one is hidden because of animation that is used for property grid.
      await expandSearchbarButtons[1].click();

      await propertyWidget.getByTitle("Contract Searchbar").first().waitFor();

      await takeScreenshot(page, propertyWidget);
    });

    test("single element selected - settings clicked", async ({ page }) => {
      const propertyWidget = await selectSingleElement(page);
      await propertyWidget.getByTitle("Settings").click();
      await page.getByTitle("Hide properties with empty values").waitFor();

      await takeScreenshot(page, propertyWidget);
    });

    test("single element selected - settings clicked - empty values hidden", async ({ page }) => {
      const propertyWidget = await selectSingleElement(page);

      await propertyWidget.getByTitle("Settings").click();
      await page.getByTitle("Hide properties with empty values").click();

      await propertyWidget.getByText("BayTown").first().waitFor();

      await takeScreenshot(page, propertyWidget);
    });

    test("single element selected - context menu", async ({ page }) => {
      const propertyWidget = await selectSingleElement(page);

      await propertyWidget.getByTitle("Description").click({ button: "right" });
      await page.getByTitle("Add this property to Favorite category").waitFor();

      await takeScreenshot(page, propertyWidget);
    });

    test("single element selected - context menu - add to favorites", async ({ page }) => {
      const propertyWidget = await selectSingleElement(page);

      await propertyWidget.getByTitle("Description").click({ button: "right" });
      await page.getByTitle("Add this property to Favorite category").click();
      await propertyWidget.getByText("Favorite").first().waitFor();

      await takeScreenshot(page, propertyWidget);
    });

  };

  test.describe("stage panel size - narrow", () => {
    testCases();
  });

  test.describe("stage panel size - wide", () => {
    test.beforeEach(async ({ page }) => {
      await expandStagePanel(page, "right", 400);
    });
    testCases();
  });

});
