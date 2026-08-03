/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, it, vi } from "vitest";
import { page } from "vitest/browser";
import { WidgetHeader } from "../../tree-widget-react/tree-header/WidgetHeader.js";
import { COLOR_SCHEMES, renderWithTheme, validateSnapshot } from "./RenderUtils.js";

import type { TreeContentDefinition } from "../../tree-widget-react/tree-header/WidgetHeader.js";

const trees: TreeContentDefinition[] = [
  { id: "models", label: "Models", isSearchable: true, render: () => <div>Models tree</div> },
  { id: "categories", label: "Categories", isSearchable: true, render: () => <div>Categories tree</div> },
];

COLOR_SCHEMES.forEach((colorScheme) => {
  describe(`[${colorScheme}] <WidgetHeader />`, () => {
    it("renders tree selector with search button", async () => {
      await page.viewport(400, 200);
      const { locator } = await renderWithTheme(<WidgetHeader defaultSelectedContentId="models" trees={trees} onSelect={vi.fn()} onSearch={vi.fn()} />, {
        colorScheme,
      });
      await validateSnapshot(locator, { skipA11y: ["select-name"] });
    });

    it("renders search input when search is enabled", async () => {
      await page.viewport(400, 200);
      const { locator } = await renderWithTheme(<WidgetHeader defaultSelectedContentId="models" trees={trees} onSelect={vi.fn()} onSearch={vi.fn()} />, {
        colorScheme,
      });
      await page.getByRole("button", { name: "Search the tree" }).click();
      await validateSnapshot(locator);
    });

    it("renders loading header", async () => {
      await page.viewport(400, 200);
      const loadingTrees: TreeContentDefinition[] = [{ id: "loading", label: "", render: () => null }];
      const { locator } = await renderWithTheme(
        <WidgetHeader defaultSelectedContentId="loading" trees={loadingTrees} onSelect={vi.fn()} onSearch={vi.fn()} />,
        { colorScheme },
      );
      await validateSnapshot(locator);
    });
  });
});
