/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, it, vi } from "vitest";
import { page } from "vitest/browser";
import { DebouncedSearchBox } from "../../tree-widget-react/components/tree-header/SearchBox.js";
import { COLOR_SCHEMES, renderWithTheme, validateSnapshot } from "./RenderUtils.js";

COLOR_SCHEMES.forEach((colorScheme) => {
  describe(`[${colorScheme}] <DebouncedSearchBox />`, () => {
    it("renders collapsed search button", async () => {
      await page.viewport(300, 60);
      const { locator } = await renderWithTheme(
        <div style={{ display: "flex", width: 300, height: 40 }}>
          <DebouncedSearchBox isOpened={false} setIsOpened={vi.fn()} onSearch={vi.fn()} delay={300} />
        </div>,
        { colorScheme },
      );
      await validateSnapshot(locator);
    });

    it("renders expanded search input", async () => {
      await page.viewport(300, 60);
      const { locator } = await renderWithTheme(
        <div style={{ display: "flex", width: 300, height: 40 }}>
          <DebouncedSearchBox isOpened={true} setIsOpened={vi.fn()} onSearch={vi.fn()} delay={300} />
        </div>,
        { colorScheme },
      );
      await validateSnapshot(locator);
    });
  });
});
