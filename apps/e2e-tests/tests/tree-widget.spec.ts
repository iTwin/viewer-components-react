/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { test, expect } from '@playwright/test';
import assert from "assert";
import { expandStagePanel, locateNode, locateWidget } from "./utils";

test.describe("tree-widget", () => {

  test.beforeEach(async ({ page, baseURL }) => {
    assert(baseURL);
    await page.goto(baseURL);
  })

  test.describe("should match image snapshot", () => {

    const testCases = () => {

      test("initial tree", async ({ page }) => {
        const treeWidget = locateWidget(page, "tree");
        await treeWidget.waitFor();

        // wait for element to be visible in the tree
        await locateNode(treeWidget, "ProcessPhysicalModel").getByRole("checkbox", { name: "Visible", exact: true }).waitFor();
        await expect(treeWidget).toHaveScreenshot();
      })

      test("expanded tree node", async ({ page }) => {
        const treeWidget = locateWidget(page, "tree");
        await treeWidget.waitFor();

        const node = locateNode(treeWidget, "ProcessPhysicalModel");
        await node.getByRole("button").click();

        // wait for node at the bottom to be visible/loaded
        await locateNode(treeWidget, "Tag-Category").waitFor();
        await expect(treeWidget).toHaveScreenshot();
      })

      test("single element selected", async ({ page }) => {
        const treeWidget = locateWidget(page, "tree");
        await treeWidget.waitFor();
        const node = locateNode(treeWidget, "BayTown");
        await node.click();

        // wait for node to become selected
        await expect(node).toHaveClass(/is-selected/);
        await expect(treeWidget).toHaveScreenshot();
      })

      test("searching element", async ({ page }) => {
        const treeWidget = locateWidget(page, "tree");
        await treeWidget.waitFor();
        await treeWidget.getByText("BayTown").waitFor();
        await treeWidget.getByTitle("Search for something").click();
        await treeWidget.getByPlaceholder("Search...").fill("Model");
        await treeWidget.locator(".components-activehighlight").waitFor();
        await expect(treeWidget).toHaveScreenshot();
      })

    }

    test.describe("stage panel size - initial", () => {
      testCases();
    })

    test.describe("stage panel size - expanded", () => {
      test.beforeEach(async ({ page }) => {
        await expandStagePanel(page, "right", 400);
      })
      testCases();
    })

  })
})
