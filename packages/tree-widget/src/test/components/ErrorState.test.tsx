/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, it, vi } from "vitest";
import { page } from "vitest/browser";
import { ErrorState } from "../../tree-widget-react/components/tree-header/ErrorState.js";
import { COLOR_SCHEMES, renderWithTheme, validateSnapshot } from "./RenderUtils.js";

COLOR_SCHEMES.forEach((colorScheme) => {
  describe(`[${colorScheme}] <ErrorState />`, () => {
    it("renders error message with retry button", async () => {
      await page.viewport(300, 200);
      const { locator } = await renderWithTheme(
        <div style={{ width: 300, height: 200 }}>
          <ErrorState error={new Error("Something went wrong")} resetErrorBoundary={vi.fn()} />
        </div>,
        { colorScheme },
      );
      await validateSnapshot(locator);
    });
  });
});
