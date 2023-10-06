/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import assert from "assert";
import { test } from "@playwright/test";
import { expandStagePanel, locateWidget, takeScreenshot } from "./utils";

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
      await takeScreenshot(page, propertyWidget);
    });

    test("multiple elements selected", async ({ page }) => {
      const treeWidget = locateWidget(page, "tree");
      await treeWidget.getByText("BayTown").click();
      await treeWidget.getByText("ProcessPhysicalModel").click();

      const propertyWidget = locateWidget(page, "property-grid");
      await propertyWidget.getByText("Multiple items").first().waitFor();
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
