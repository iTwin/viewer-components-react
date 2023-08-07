/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect, test } from "@playwright/test";
import assert from "assert";
import { expandStagePanel, locateWidget } from "./utils";

test.beforeEach(async ({ page, baseURL }) => {
  assert(baseURL);
  await page.goto(baseURL);
});

test.describe("should match image snapshot", () => {

  const testCases = () => {

    test("single element selected", async ({ page }) => {
      const treeWidget = locateWidget(page, "tree");
      await treeWidget.getByText("BayTown").click();

      const propertyWidget = locateWidget(page, "property-grid");
      await propertyWidget.getByText("BayTown").first().waitFor();
      await expect(propertyWidget).toHaveScreenshot();
    });

    test("multiple elements selected", async ({ page }) => {
      const treeWidget = locateWidget(page, "tree");
      await treeWidget.getByText("BayTown").click();
      await treeWidget.getByText("ProcessPhysicalModel").click();

      const propertyWidget = locateWidget(page, "property-grid");
      await propertyWidget.getByText("Multiple items").first().waitFor();
      await expect(propertyWidget).toHaveScreenshot();
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
