/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, it, vi } from "vitest";
import { page } from "vitest/browser";
import { TreeWidgetComponentImpl } from "../../tree-widget-react/TreeWidgetComponentImpl.js";
import { COLOR_SCHEMES, renderWithTheme, validateSnapshot } from "./RenderUtils.js";

vi.mock("@itwin/appui-react", () => ({
  useActiveIModelConnection: () => ({ key: "test-imodel" }),
}));

COLOR_SCHEMES.forEach((colorScheme) => {
  describe(`[${colorScheme}] <TreeWidgetComponentImpl />`, () => {
    it("renders loading state", async () => {
      await page.viewport(400, 300);
      const { locator } = await renderWithTheme(
        // `shouldShow` never resolves, so the widget stays in its loading state.
        <TreeWidgetComponentImpl trees={[{ id: "tree", getLabel: () => "Tree", render: () => null, shouldShow: async () => new Promise(() => {}) }]} />,
        { colorScheme },
      );
      await validateSnapshot(locator);
    });
  });
});
