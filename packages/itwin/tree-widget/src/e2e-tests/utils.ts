/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import assert from "assert";
import { expect, test } from "@playwright/test";

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

  const handleX = handlePos.x + handlePos.width * 0.5;
  const handleY = handlePos.y + handlePos.height * 0.5;
  await page.mouse.move(handleX, handleY, { steps: 10 });
  await page.mouse.down();

  switch (side) {
    case "left":
      await page.mouse.move(handleX + px, handleY, { steps: 25 });
      break;
    case "right":
      await page.mouse.move(handleX - px, handleY, { steps: 25 });
      break;
    case "top":
      await page.mouse.move(handleX, handleY - px, { steps: 25 });
      break;
    case "bottom":
      await page.mouse.move(handleX, handleY + px, { steps: 25 });
      break;
  }
  await page.mouse.up();
};

export async function initTreeWidgetTest({ page, baseURL }: { page: Page; baseURL: string | undefined }) {
  assert(baseURL);
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.evaluate(async () => document.fonts.ready);
  // expand panel size to ~300px
  await expandStagePanel(page, "right", 110);
  const widget = locateWidget(page, "tree");
  await widget.waitFor();
  return widget;
}

// make sure to open the filter dialog before calling this.
export async function selectPropertyInDialog(page: Page, propertyText: string) {
  const filterDialog = page.getByRole("dialog");

  await filterDialog.getByPlaceholder("Choose property").click();

  // ensure that options are loaded
  await page.getByRole("menuitem", { name: "Model", exact: true }).waitFor();
  await page.getByRole("menuitem", { name: propertyText, exact: true }).click();
}

// make sure to open the filter dialog before calling this.
export async function selectOperatorInDialog(page: Page, operatorText: string) {
  const filterDialog = page.getByRole("dialog");

  await filterDialog.getByText("Contains").click();
  await page.getByRole("option", { name: operatorText, exact: true }).click();

  await filterDialog.getByText("Contains").waitFor({ state: "hidden" });
  await filterDialog.getByText(operatorText).waitFor();
}

// make sure to open the filter dialog before calling this.
export async function selectValueInDialog(page: Page, valueText: string) {
  const filterDialog = page.getByRole("dialog");

  // search for one character less to not have to differentiate between entered value and option in dropdown
  await filterDialog.getByPlaceholder("Select provided value(s)").fill(valueText);
  const dropdown = page.getByRole("listbox");
  await dropdown.getByText(valueText).click();
  await dropdown.getByRole("option", { name: valueText, selected: true }).waitFor();
}

export async function selectTree(widget: Locator, treeLabel: string) {
  await widget.getByText("ProcessPhysicalModel").waitFor();
  await widget.getByRole("combobox").selectOption({ label: treeLabel });
}

export async function scrollTree(page: Page, x: number, y: number) {
  // get the parent of the tree renderer that is scrollable
  const container = page.locator("#tw-tree-renderer-container");
  await container.evaluate(
    (e: SVGElement | HTMLElement, scrollAmount: { left: number; top: number }) => {
      e.scrollBy({ ...scrollAmount, behavior: "instant" } as unknown as ScrollToOptions);
    },
    { left: x, top: y },
  );
}

export function withDifferentDensities(cb: (density: "default" | "enlarged") => void) {
  ["default" as const, "enlarged" as const].forEach((density) => {
    test.describe(`Density: ${density}`, () => {
      density === "enlarged" &&
        test.beforeEach(async ({ page }) => {
          const expandedLayoutToggleButton = page.getByRole("button", { name: "Toggle expanded layout" });
          await expandedLayoutToggleButton.click();
        });
      cb(density);
    });
  });
}

interface TakeScreenshotOptions {
  expandBy?: { top?: number; right?: number; bottom?: number; left?: number };
  boundingComponent?: Locator;
  resetScroll?: boolean;
}

export async function takeScreenshot(page: Page, component: Locator, options?: TakeScreenshotOptions) {
  const boundingBox = await getBoundedBoundingBox(component, options?.boundingComponent);
  const expansion = { top: 0, right: 0, bottom: 0, left: 0, ...options?.expandBy };
  const clip = {
    x: boundingBox.x - expansion.left,
    y: boundingBox.y - expansion.top,
    width: boundingBox.width + expansion.left + expansion.right,
    height: boundingBox.height + expansion.top + expansion.bottom,
  };

  if (options?.resetScroll) {
    await scrollTree(page, -10000, -10000);
  }

  await expect(page).toHaveScreenshot({ clip });
}

async function getBoundedBoundingBox(component: Locator, boundingComponent?: Locator) {
  const box = await component.boundingBox();
  assert(box);

  if (boundingComponent) {
    const bounds = await boundingComponent.boundingBox();
    assert(bounds);
    const left = Math.max(box.x, bounds.x);
    const top = Math.max(box.y, bounds.y);
    const right = Math.min(box.x + box.width, bounds.x + bounds.width);
    const bottom = Math.min(box.y + box.height, bounds.y + bounds.height);
    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    };
  }

  return box;
}

export async function expandNode(page: Page, node: Locator) {
  await node.focus();
  await page.keyboard.press("ArrowRight");
}

export async function getErrorDropdown(treeWidget: Locator, errorAmount: number = 1) {
  const dropdown = treeWidget.getByRole("button", { name: `${errorAmount} issue(s) found` });
  await dropdown.waitFor();
  return dropdown;
}
