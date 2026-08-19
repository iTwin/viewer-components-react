/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from "vitest";
import { IModelApp } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_START__ TreeWidget.TreeWidgetLoggerImports
import { TreeWidgetContextProvider } from "@itwin/tree-widget-react";
import type { ILogger } from "@itwin/presentation-shared";
// __PUBLISH_EXTRACT_END__
import { render } from "./TestUtils.js";

describe("Tree widget", () => {
  describe("Learning snippets", () => {
    it("uses a custom logger", () => {
      // __PUBLISH_EXTRACT_START__ TreeWidget.TreeWidgetLogger
      function MyTreeWidget({ logger }: { logger: ILogger }) {
        return (
          <TreeWidgetContextProvider localization={IModelApp.localization} logger={logger}>
            {/* tree components */}
          </TreeWidgetContextProvider>
        );
      }
      // __PUBLISH_EXTRACT_END__

      const customLogger: ILogger = {
        isEnabled: vi.fn(() => true),
        logError: vi.fn(),
        logWarning: vi.fn(),
        logInfo: vi.fn(),
        logTrace: vi.fn(),
      };
      expect(() => render(<MyTreeWidget logger={customLogger} />)).not.toThrow();
    });
  });
});
