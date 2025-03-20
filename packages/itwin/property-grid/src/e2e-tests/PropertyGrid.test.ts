/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import assert from "assert";
import { test } from "@playwright/test";
import { expandStagePanel, locateNode, locateWidget, takeScreenshot } from "./utils.js";

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
      await locateNode(treeWidget, "ProcessPhysicalModel").getByLabel("Expand").click();
      await locateNode(treeWidget, "Equipment").click();

      const propertyWidget = locateWidget(page, "property-grid");
      await propertyWidget.getByText("Equipment").first().waitFor();

      return propertyWidget;
    };

    test("single element selected", async ({ page }) => {
      const propertyWidget = await selectSingleElement(page);
      await takeScreenshot(page, propertyWidget);
    });

    test("single element selected - search bar expanded", async ({ page }) => {
      const propertyWidget = await selectSingleElement(page);
      await propertyWidget.getByRole("button", { name: "Expand searchbox" }).click();

      await propertyWidget.getByRole("button", { name: "Close searchbox" }).first().waitFor();

      await takeScreenshot(page, propertyWidget);
    });

    const selectSingleElementWithAncestry = async (page: Page) => {
      const treeWidget = locateWidget(page, "tree");
      await locateNode(treeWidget, "ProcessPhysicalModel").click();

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
      await propertyWidget.getByRole("button", { name: "Expand searchbox" }).click();

      await propertyWidget.getByRole("button", { name: "Close searchbox" }).first().waitFor();

      await takeScreenshot(page, propertyWidget);
    });

    const selectMultipleElements = async (page: Page) => {
      const treeWidget = locateWidget(page, "tree");
      const propertyWidget = locateWidget(page, "property-grid");
      const modelNode = locateNode(treeWidget, "ProcessPhysicalModel");

      await modelNode.getByLabel("Expand").click();
      await modelNode.click();
      await locateNode(treeWidget, "Equipment").click({ modifiers: ["Control"] });

      await propertyWidget.getByText("Multiple items").first().waitFor();
      return propertyWidget;
    };

    test("multiple elements selected", async ({ page }) => {
      const propertyWidget = await selectMultipleElements(page);
      await takeScreenshot(page, propertyWidget);
    });

    test("multiple elements selected - search bar expanded", async ({ page }) => {
      const propertyWidget = await selectMultipleElements(page);
      await propertyWidget.getByRole("button", { name: "Expand searchbox" }).click();
      await propertyWidget.getByRole("button", { name: "Close searchbox" }).first().waitFor();
      await takeScreenshot(page, propertyWidget);
    });

    test("elements list", async ({ page }) => {
      const propertyWidget = await selectMultipleElements(page);
      await propertyWidget.getByRole("button", { name: "Selected Elements" }).click();
      await propertyWidget.getByText("Selected Elements (2)").waitFor();
      await takeScreenshot(page, propertyWidget);
    });

    const selectElementFromElementList = async (page: Page) => {
      const propertyWidget = await selectMultipleElements(page);
      await propertyWidget.getByRole("button", { name: "Selected Elements" }).click();

      const elementList = propertyWidget.getByRole("list");
      await elementList.getByRole("listitem").filter({ hasText: "Equipment" }).click();

      await propertyWidget.getByTitle("BisCore.DictionaryModel").waitFor();

      return propertyWidget;
    };

    test("single element selected from elements list", async ({ page }) => {
      const propertyWidget = await selectElementFromElementList(page);

      await takeScreenshot(page, propertyWidget);
    });

    test("single element selected from elements list - search bar expanded", async ({ page }) => {
      const propertyWidget = await selectElementFromElementList(page);
      const expandSearchbarButtons = await propertyWidget.getByRole("button", { name: "Expand searchbox" }).all();

      await expandSearchbarButtons[0].click();

      await propertyWidget.getByRole("button", { name: "Close searchbox" }).first().waitFor();

      await takeScreenshot(page, propertyWidget);
    });

    test("single element selected - settings clicked", async ({ page }) => {
      const propertyWidget = await selectSingleElement(page);
      await propertyWidget.getByRole("button", { name: "Settings" }).click();
      await page.getByRole("menuitem", { name: "Hide Empty Values" }).waitFor();

      await takeScreenshot(page, propertyWidget);
    });

    test("single element selected - settings clicked - empty values hidden", async ({ page }) => {
      const propertyWidget = await selectSingleElement(page);

      await propertyWidget.getByRole("button", { name: "Settings" }).click();
      await page.getByRole("menuitem", { name: "Hide Empty Values" }).click();

      await propertyWidget.getByText("Is Private").first().waitFor();

      await takeScreenshot(page, propertyWidget);
    });

    test("single element selected - context menu", async ({ page }) => {
      const propertyWidget = await selectSingleElement(page);

      await propertyWidget.getByTitle("Is Private").click({ button: "right", position: { x: 5, y: 10 } });
      await page.getByRole("menuitem", { name: "Add to Favorite" }).waitFor();

      await takeScreenshot(page, propertyWidget);
    });

    test("single element selected - context menu - add to favorites", async ({ page }) => {
      const propertyWidget = await selectSingleElement(page);

      await propertyWidget.getByTitle("Is Private").click({ button: "right", position: { x: 5, y: 10 } });
      await page.getByRole("menuitem", { name: "Add to Favorite" }).click();
      await propertyWidget.getByRole("button", { name: "Favorite" }).first().waitFor();

      await takeScreenshot(page, propertyWidget);
    });

    test("single element selected - search", async ({ page }) => {
      const propertyWidget = await selectSingleElement(page);
      await propertyWidget.getByTitle("Is Private").waitFor();

      await propertyWidget.getByRole("button", { name: "Expand searchbox" }).click();
      const searchBox = propertyWidget.getByRole("searchbox");

      await searchBox.fill("Dictionary");
      await propertyWidget.getByTitle("Is Private").waitFor({ state: "hidden" });

      await takeScreenshot(page, propertyWidget);
    });

    test("single element selected - search - no matches", async ({ page }) => {
      const propertyWidget = await selectSingleElement(page);
      await propertyWidget.getByTitle("Is Private").waitFor();

      await propertyWidget.getByRole("button", { name: "Expand searchbox" }).click();
      const searchBox = propertyWidget.getByRole("searchbox");

      await searchBox.fill("Test");
      await propertyWidget.getByText(`There are no properties matching filter "Test"`).waitFor();

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
