/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, it } from "vitest";
import { page } from "vitest/browser";
import { EmptyTreeContent, NoSearchMatches, SearchUnknownError, TooManySearchMatches } from "../../tree-widget-react/shared/components/EmptyTree.js";
import { COLOR_SCHEMES, renderWithTheme, validateSnapshot } from "./RenderUtils.js";

COLOR_SCHEMES.forEach((colorScheme) => {
  describe(`[${colorScheme}] <EmptyTree />`, () => {
    it("renders 'no data available' content", async () => {
      await page.viewport(300, 150);
      const { locator } = await renderWithTheme(<EmptyTreeContent />, { colorScheme });
      await validateSnapshot(locator);
    });

    it("renders 'no search matches'", async () => {
      await page.viewport(300, 150);
      const { locator } = await renderWithTheme(<NoSearchMatches base="modelsTree" />, { colorScheme });
      await validateSnapshot(locator);
    });

    it("renders 'too many search matches'", async () => {
      await page.viewport(300, 150);
      const { locator } = await renderWithTheme(<TooManySearchMatches base="modelsTree" />, { colorScheme });
      await validateSnapshot(locator);
    });

    it("renders 'unknown search error'", async () => {
      await page.viewport(300, 150);
      const { locator } = await renderWithTheme(<SearchUnknownError base="modelsTree" />, { colorScheme });
      await validateSnapshot(locator);
    });
  });
});
