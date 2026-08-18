/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, describe, expect, it, vi } from "vitest";
// __PUBLISH_EXTRACT_START__ TreeWidget.TreeWidgetInitializeImports
import { TreeWidget } from "@itwin/tree-widget-react";
import type { ILogger } from "@itwin/presentation-shared";
// __PUBLISH_EXTRACT_END__

describe("Tree widget", () => {
  describe("Learning snippets", () => {
    afterEach(() => {
      TreeWidget.terminate();
    });

    it("initializes with a custom logger", async () => {
      // __PUBLISH_EXTRACT_START__ TreeWidget.TreeWidgetInitialize
      async function initializeTreeWidget(logger?: ILogger) {
        await TreeWidget.initialize(logger);
      }
      // __PUBLISH_EXTRACT_END__

      const customLogger: ILogger = { isEnabled: () => true, logError: vi.fn(), logWarning: vi.fn(), logInfo: vi.fn(), logTrace: vi.fn() };
      await initializeTreeWidget(customLogger);

      TreeWidget.logger.logInfo("test-category", "test message");
      expect(customLogger.logInfo).toHaveBeenCalledWith("test-category", "test message");
    });
  });
});
