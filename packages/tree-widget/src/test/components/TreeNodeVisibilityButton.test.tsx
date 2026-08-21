/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { VisibilityAction, VisibilityContextProvider } from "../../tree-widget-react/shared/components/TreeNodeVisibilityButton.js";
import { createTreeNode } from "../trees/TreeUtils.js";
import { renderWithTheme } from "./RenderUtils.js";

const visibilityStates = ["visible", "partial", "hidden"] as const;

describe("VisibilityAction", () => {
  it.each(visibilityStates)("sets the resolved %s visibility state on its button", async (state) => {
    await renderWithTheme(
      <VisibilityContextProvider getVisibilityButtonState={() => ({ state })} onVisibilityButtonClick={vi.fn()}>
        <VisibilityAction node={createTreeNode()} />
      </VisibilityContextProvider>,
    );

    await expect.element(page.getByRole("button")).toHaveAttribute("data-visibility-state", state);
  });
});
