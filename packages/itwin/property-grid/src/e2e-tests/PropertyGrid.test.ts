/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import assert from "assert";
import { test } from "@playwright/test";
import { expandStagePanel, locateWidget, takeScreenshot } from "./utils";

import type { Page } from "@playwright/test";
test.beforeEach(async ({ page, baseURL }) => {
  assert(baseURL);
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.evaluate(async () => document.fonts.ready);
});

test.describe("property grid", () => {
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
      await propertyWidget.getByTitle("Open search bar").click();

      await propertyWidget.getByTitle("Close search bar").first().waitFor();

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
      await propertyWidget.getByTitle("Open search bar").click();

      await propertyWidget.getByTitle("Close search bar").first().waitFor();

      await takeScreenshot(page, propertyWidget);
    });

    const selectMultipleElements = async (page: Page) => {
      const treeWidget = locateWidget(page, "tree");
      const propertyWidget = locateWidget(page, "property-grid");

      await treeWidget.getByText("BayTown").click();
      await treeWidget.getByText("ProcessPhysicalModel").click();

      await propertyWidget.getByText("Multiple items").first().waitFor();
      return propertyWidget;
    };

    test("multiple elements selected", async ({ page }) => {
      const propertyWidget = await selectMultipleElements(page);
      await takeScreenshot(page, propertyWidget);
    });

    test("multiple elements selected - search bar expanded", async ({ page }) => {
      const propertyWidget = await selectMultipleElements(page);
      await propertyWidget.getByTitle("Open search bar").click();
      await propertyWidget.getByTitle("Close search bar").first().waitFor();
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

      const elementList = propertyWidget.getByRole("list");
      await elementList.getByRole("listitem").filter({ hasText: "BayTown" }).click();

      await propertyWidget.getByTitle("Empty seed file.").waitFor();

      return propertyWidget;
    };

    test("single element selected from elements list", async ({ page }) => {
      const propertyWidget = await selectElementFromElementList(page);

      await takeScreenshot(page, propertyWidget);
    });

    test("single element selected from elements list - search bar expanded", async ({ page }) => {
      const propertyWidget = await selectElementFromElementList(page);
      const expandSearchbarButtons = await propertyWidget.getByTitle("Open search bar").all();

      // use the second one, since the first one is hidden because of animation that is used for property grid.
      await expandSearchbarButtons[1].click();

      await propertyWidget.getByTitle("Close search bar").first().waitFor();

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

    // flaky: https://github.com/iTwin/appui/issues/635
    test.skip("single element selected - context menu", async ({ page }) => {
      const propertyWidget = await selectSingleElement(page);

      await propertyWidget.getByTitle("Description").click({ button: "right" });
      await page.getByTitle("Add this property to Favorite category").waitFor();

      await takeScreenshot(page, propertyWidget);
    });

    // flaky: https://github.com/iTwin/appui/issues/635
    test.skip("single element selected - context menu - add to favorites", async ({ page }) => {
      const propertyWidget = await selectSingleElement(page);

      await propertyWidget.getByTitle("Description").click({ button: "right" });
      await page.getByTitle("Add this property to Favorite category").click();
      await propertyWidget.getByText("Favorite").first().waitFor();

      await takeScreenshot(page, propertyWidget);
    });
  };

  test.describe("narrow", () => {
    testCases();
  });

  test.describe("wide", () => {
    test.beforeEach(async ({ page }) => {
      await expandStagePanel(page, "right", 400);
    });
    testCases();
  });
});
