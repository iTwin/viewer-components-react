/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from "vitest";
import { getLogger as getHierarchiesLogger } from "@itwin/presentation-hierarchies";
import { getLogger as getHierarchiesReactLogger } from "@itwin/presentation-hierarchies-react";
import { TelemetryContextProvider, useTelemetryContext } from "../../tree-widget-react/shared/contexts/UseTelemetryContext.js";
import { render, renderHook } from "../TestUtils.js";

import type { PropsWithChildren } from "react";
import type { ILogger } from "@itwin/presentation-shared";

describe("TelemetryContextProvider", () => {
  it("provides and configures a custom logger", () => {
    const logger = createTestLogger();
    const wrapper = ({ children }: PropsWithChildren) => (
      <TelemetryContextProvider componentIdentifier="root" logger={logger}>
        {children}
      </TelemetryContextProvider>
    );

    const { result } = renderHook(useTelemetryContext, { wrapper });

    expect(result.current.logger).toBe(logger);
    expect(getHierarchiesLogger()).toBe(logger);
    expect(getHierarchiesReactLogger()).toBe(logger);
  });

  it("inherits the parent logger when a nested provider does not specify one", () => {
    const parentLogger = createTestLogger();
    const wrapper = ({ children }: PropsWithChildren) => (
      <TelemetryContextProvider componentIdentifier="parent" logger={parentLogger}>
        <TelemetryContextProvider componentIdentifier="child">{children}</TelemetryContextProvider>
      </TelemetryContextProvider>
    );

    const { result } = renderHook(useTelemetryContext, { wrapper });

    expect(result.current.logger).toBe(parentLogger);
    expect(getHierarchiesLogger()).toBe(parentLogger);
    expect(getHierarchiesReactLogger()).toBe(parentLogger);
  });

  it("keeps the parent logger when a nested provider specifies a different one", () => {
    const parentLogger = createTestLogger();
    const childLogger = createTestLogger();
    const wrapper = ({ children }: PropsWithChildren) => (
      <TelemetryContextProvider componentIdentifier="parent" logger={parentLogger}>
        <TelemetryContextProvider componentIdentifier="child" logger={childLogger}>
          {children}
        </TelemetryContextProvider>
      </TelemetryContextProvider>
    );

    const { result } = renderHook(useTelemetryContext, { wrapper });

    expect(result.current.logger).toBe(parentLogger);
    expect(getHierarchiesLogger()).toBe(parentLogger);
    expect(getHierarchiesReactLogger()).toBe(parentLogger);
  });

  it("uses the nested provider identifier when reporting through parent callbacks", () => {
    const onPerformanceMeasured = vi.fn();
    const onFeatureUsed = vi.fn();
    const wrapper = ({ children }: PropsWithChildren) => (
      <TelemetryContextProvider componentIdentifier="parent" onPerformanceMeasured={onPerformanceMeasured} onFeatureUsed={onFeatureUsed}>
        <TelemetryContextProvider componentIdentifier="child">{children}</TelemetryContextProvider>
      </TelemetryContextProvider>
    );

    const { result } = renderHook(useTelemetryContext, { wrapper });
    result.current.onPerformanceMeasured({ featureId: "load", duration: 123 });
    result.current.onFeatureUsed({ featureId: "search", reportInteraction: true });

    expect(onPerformanceMeasured).toHaveBeenCalledWith("child-load", 123);
    expect(onFeatureUsed).toHaveBeenNthCalledWith(1, "use-child");
    expect(onFeatureUsed).toHaveBeenNthCalledWith(2, "child-search");
  });

  it("keeps the first registered logger when another provider unmounts", () => {
    const firstLogger = createTestLogger();
    const secondLogger = createTestLogger();
    const { rerender } = render(
      <>
        <TelemetryContextProvider key="first" componentIdentifier="first" logger={firstLogger}>
          <div />
        </TelemetryContextProvider>
        <TelemetryContextProvider key="second" componentIdentifier="second" logger={secondLogger}>
          <div />
        </TelemetryContextProvider>
      </>,
    );
    expect(getHierarchiesLogger()).toBe(firstLogger);
    expect(getHierarchiesReactLogger()).toBe(firstLogger);

    rerender(
      <TelemetryContextProvider key="first" componentIdentifier="first" logger={firstLogger}>
        <div />
      </TelemetryContextProvider>,
    );

    expect(getHierarchiesLogger()).toBe(firstLogger);
    expect(getHierarchiesReactLogger()).toBe(firstLogger);
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
