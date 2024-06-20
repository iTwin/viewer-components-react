/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import assert from "assert";
import { expect } from "@playwright/test";

import type { Locator, Page } from "@playwright/test";

export const locateNode = (tree: Page | Locator, name: string, level?: number) => tree.getByRole("treeitem", { name, level });
export const locateWidget = (page: Page | Locator, widgetName: string) => page.locator(`.${widgetName}-widget`);
export const locateInstanceFilter = (page: Page | Locator) => page.locator(`.presentation-instance-filter`);

type PanelSide = "left" | "right" | "top" | "bottom";
export const locatePanel = (page: Page, side: PanelSide) => page.locator(`.nz-widgetPanels-panel.nz-${side}`);

export const expandStagePanel = async (page: Page, side: PanelSide, px: number) => {
  const widgetPanel = locatePanel(page, side);
  const handlePos = await widgetPanel.locator(".nz-grip-container").locator(".nz-handle").boundingBox();
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

export async function takeScreenshot(
  page: Page,
  component: Locator,
  expandBy?: { top?: number; right?: number; bottom?: number; left?: number },
  boundingComponent?: Locator,
) {
  const boundingBox = await getBoundedBoundingBox(component, boundingComponent);
  const expansion = { ...{ top: 0, right: 0, bottom: 0, left: 0 }, ...expandBy };
  const clip = {
    x: boundingBox.x - expansion.left,
    y: boundingBox.y - expansion.top,
    width: boundingBox.width + expansion.left + expansion.right,
    height: boundingBox.height + expansion.top + expansion.bottom,
  };

  await expect(page).toHaveScreenshot({ clip });
}

async function getBoundedBoundingBox(component: Locator, boundingComponent?: Locator) {
  const box = await component.boundingBox();
  assert(box);

  if (boundingComponent) {
    const bounds = await boundingComponent.boundingBox();
    assert(bounds);
    return {
      x: Math.max(box.x, bounds.x),
      y: Math.max(box.y, bounds.y),
      width: box.width - Math.max(0, box.x + box.width - (bounds.x + bounds.width)),
      height: box.height - Math.max(0, box.y + box.height - (bounds.y + bounds.height)),
    };
  }

  return box;
}
