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

export async function initTreeWidgetTest({ page, baseURL }: { page: Page; baseURL: string | undefined }) {
  assert(baseURL);
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.evaluate(async () => document.fonts.ready);
  // expand panel size to ~300px
  await expandStagePanel(page, "right", 100);
  const widget = locateWidget(page, "tree");
  await widget.waitFor();
  return widget;
}

// make sure to open the filter dialog before calling this.
export async function selectPropertyInDialog(page: Page, propertyText: string) {
  const filterBuilder = page.locator(".presentation-property-filter-builder");

  await filterBuilder.getByPlaceholder("Choose property").click();

  // ensure that options are loaded
  await page.getByRole("menuitem", { name: "Model", exact: true }).waitFor();
  await page.getByRole("menuitem", { name: propertyText, exact: true }).click();
}

// make sure to open the filter dialog before calling this.
export async function selectOperatorInDialog(page: Page, operatorText: string) {
  const filterBuilder = page.locator(".presentation-property-filter-builder");

  await filterBuilder.getByText("Contains").click();
  await page.getByRole("option", { name: operatorText, exact: true }).click();

  await filterBuilder.getByText("Contains").waitFor({ state: "hidden" });
  await filterBuilder.getByText(operatorText).waitFor();
}

// make sure to open the filter dialog before calling this.
export async function selectValueInDialog(page: Page, valueText: string) {
  const filterBuilder = page.locator(".presentation-property-filter-builder");

  // search for one character less to not have to differentiate between entered value and option in dropdown
  await page.locator(".presentation-async-select-values-container input").fill(valueText.slice(0, -1));
  await page.getByText(valueText, { exact: true }).click();

  await filterBuilder.getByText(`option ${valueText}, selected.`).waitFor();
}

export async function selectTree(widget: Locator, treeLabel: string) {
  await widget.getByText("BayTown").waitFor();
  await widget.getByRole("combobox").click();
  await widget.page().getByRole("listbox").getByText(treeLabel, { exact: true }).click();
}

export async function scrollTree(page: Page, x: number, y: number) {
  // get the parent of the tree renderer that is scrollable
  const container = page.locator("div:has(> .tw-tree-renderer)");
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
          const expandedLayoutToggleButton = page.getByTitle("Toggle expanded layout");
          await expandedLayoutToggleButton.click();
        });
      cb(density);
    });
  });
}

interface TakeScreenshotOptions {
  expandBy?: { top?: number; right?: number; bottom?: number; left?: number };
  boundingComponent?: Locator;
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
