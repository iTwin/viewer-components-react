/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { Locator, Page } from "@playwright/test";
import assert from "assert";

export const locateNode = (tree: Page | Locator, name: string) => tree.getByRole("treeitem", { name });

export const locateWidget = (page: Page | Locator, widgetName: string) => page.locator(`.${widgetName}-widget`);

type PanelSide = "left" | "right" | "top" | "bottom";
export const locatePanel = (page: Page, side: PanelSide) => page.locator(`.nz-widgetPanels-panel.nz-${side}`);

export const expandStagePanel = async (page: Page, side: PanelSide, px: number) => {
  const widgetPanel = locatePanel(page, side);
  const handlePos = await widgetPanel
    .locator(".nz-grip-container")
    .locator(".nz-handle")
    .boundingBox();
  assert(handlePos);

  await page.mouse.move(handlePos.x, handlePos.y);
  await page.mouse.down();

  switch (side) {
    case "left":
      await page.mouse.move(handlePos.x + px, handlePos.y);
      break;
    case "right":
      await page.mouse.move(handlePos.x - px, handlePos.y);
      break;
    case "top":
      await page.mouse.move(handlePos.x, handlePos.y - px);
      break;
    case "bottom":
      await page.mouse.move(handlePos.x, handlePos.y + px);
      break;
  }
  await page.mouse.up();
};
