/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, it } from "vitest";
import { page } from "vitest/browser";
import { SkeletonTree } from "../../tree-widget-react/components/trees/common/components/SkeletonTree.js";
import { COLOR_SCHEMES, renderWithTheme, validateSnapshot } from "./RenderUtils.js";

COLOR_SCHEMES.forEach((colorScheme) => {
  describe(`[${colorScheme}] <SkeletonTree />`, () => {
    it("renders skeleton rows", async () => {
      await page.viewport(300, 320);
      const { locator } = await renderWithTheme(
        <div className="tw-content">
          <div className="tw-content-wrapper">
            <SkeletonTree />
          </div>
        </div>,
        { colorScheme },
      );
      await validateSnapshot(locator);
    });
  });
});
