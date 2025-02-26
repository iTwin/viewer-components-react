/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Locator } from "@playwright/test";
import { test } from "@playwright/test";
import {
  initTreeWidgetTest,
  locateInstanceFilter,
  locateNode,
  selectOperatorInDialog,
  selectPropertyInDialog,
  selectTree,
  selectValueInDialog,
  takeScreenshot,
} from "./utils.js";

test.describe("iModel content tree", () => {
  let treeWidget: Locator;

  test.beforeEach(async ({ page, baseURL }) => {
    treeWidget = await initTreeWidgetTest({ page, baseURL });
    await selectTree(treeWidget, "iModel content");
  });

  test("initial tree", async ({ page }) => {
    // wait for element to be visible in the tree
    await locateNode(treeWidget, "ProcessPhysicalModel").waitFor();
    await takeScreenshot(page, treeWidget);
  });

  test("expanded tree node", async ({ page }) => {
    const plantDocumentModelNode = locateNode(treeWidget, "PlantDocumentModel");
    await plantDocumentModelNode.getByRole("button", { name: "Toggle", includeHidden: true }).click();

    const pipeSupportNode = locateNode(treeWidget, "Drawing (4)");
    await pipeSupportNode.getByRole("button", { name: "Toggle", includeHidden: true }).click();

    const coolersNode = locateNode(treeWidget, "OPPID-04-COOLERS");
    await coolersNode.getByRole("button", { name: "Toggle", includeHidden: true }).click();

    const bordersNode = locateNode(treeWidget, "Border");
    await bordersNode.getByRole("button", { name: "Toggle", includeHidden: true }).click();

    const graphicNode = locateNode(treeWidget, "Pid Graphic (1)");
    await graphicNode.getByRole("button", { name: "Toggle", includeHidden: true }).click();

    await locateNode(treeWidget, "D_SIZE [3-T4]").waitFor();
    await takeScreenshot(page, treeWidget);
  });

  test("node with active filtering", async ({ page }) => {
    const node = locateNode(treeWidget, "ProcessPhysicalModel");

    // hover the node for the button to appear
    await node.hover();
    await node.getByRole("button", { name: "Apply filter" }).click();

    await locateInstanceFilter(page).waitFor();
    await selectPropertyInDialog(page, "Code");
    await selectOperatorInDialog(page, "Equal");
    await selectValueInDialog(page, "PipeSupport");

    await page.getByRole("button", { name: "Apply" }).click();

    // wait for filtered children to appear
    await locateNode(treeWidget, "PipeSupport").waitFor();

    await takeScreenshot(page, treeWidget, { resetScroll: true });
  });

  test("node with active filtering - information message", async ({ page }) => {
    const node = locateNode(treeWidget, "ProcessPhysicalModel");

    // hover the node for the button to appear
    await node.hover();
    await node.getByRole("button", { name: "Apply filter" }).click();

    await locateInstanceFilter(page).waitFor();
    await selectPropertyInDialog(page, "Is Private");

    await page.getByRole("button", { name: "Apply" }).click();

    // wait for message to appear
    await treeWidget.getByText("No child nodes match current filter").waitFor();

    await takeScreenshot(page, treeWidget, { resetScroll: true });
  });
});
