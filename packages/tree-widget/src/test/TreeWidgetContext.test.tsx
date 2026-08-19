/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from "vitest";
import { useTelemetryContext } from "../tree-widget-react/shared/contexts/TelemetryContext.js";
import { TreeWidgetContextProvider } from "../tree-widget-react/TreeWidgetContext.js";
import { renderHook } from "./TestUtils.js";

import type { PropsWithChildren } from "react";
import type { ILogger } from "@itwin/presentation-shared";

describe("TreeWidgetContextProvider", () => {
  it("provides the logger to telemetry context", () => {
    const localization = { getLocalizedString: (key: string) => key };
    const logger = createTestLogger();
    const wrapper = ({ children }: PropsWithChildren) => (
      <TreeWidgetContextProvider localization={localization} logger={logger}>
        {children}
      </TreeWidgetContextProvider>
    );

    const { result } = renderHook(useTelemetryContext, { wrapper });

    expect(result.current.logger).toBe(logger);
  });
});

function createTestLogger(): ILogger {
  return {
    isEnabled: () => true,
    logError: vi.fn(),
    logWarning: vi.fn(),
    logInfo: vi.fn(),
    logTrace: vi.fn(),
  };
}
