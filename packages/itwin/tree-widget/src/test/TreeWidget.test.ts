/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, describe, expect, it } from "vitest";
import { TreeWidget } from "../tree-widget-react/TreeWidget.js";

describe("TreeWidget", () => {
  afterEach(() => {
    TreeWidget.terminate();
  });

  it("initializes only once", async () => {
    await TreeWidget.initialize();
    const firstLogger = TreeWidget.logger;

    await TreeWidget.initialize();
    expect(TreeWidget.logger).toBe(firstLogger);
  });

  it("`logger` throws if not initialized", () => {
    expect(() => TreeWidget.logger).toThrow();
  });
});
