/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";

import type { PropsWithChildren } from "react";

/**
 * Features that are tracked for performance.
 * @public
 */
export type PerformanceTrackedFeatures = "properties-load" | "elements-list-load";

/** @internal */
export interface TelemetryContext {
  onPerformanceMeasured: (featureId: PerformanceTrackedFeatures, elapsedTime: number) => void;
}

const telemetryContext = createContext<TelemetryContext>({
  onPerformanceMeasured: () => {},
});

interface TelemetryContextProviderProps {
  onPerformanceMeasured?: (featureId: PerformanceTrackedFeatures, elapsedTime: number) => void;
}

/**
 * Provides callbacks to log telemetry events for specific features.
 * @public
 */
export function TelemetryContextProvider({ onPerformanceMeasured, children }: PropsWithChildren<TelemetryContextProviderProps>) {
  const onPerformanceMeasuredRef = useRef(onPerformanceMeasured);
  useLayoutEffect(() => {
    onPerformanceMeasuredRef.current = onPerformanceMeasured;
  }, [onPerformanceMeasured]);

  const [value] = useState(() => ({
    onPerformanceMeasured: (feature: PerformanceTrackedFeatures, elapsedTime: number) => {
      onPerformanceMeasuredRef.current && onPerformanceMeasuredRef.current(feature, elapsedTime);
    },
  }));

  return <telemetryContext.Provider value={value}>{children}</telemetryContext.Provider>;
}

/** @internal */
export function useTelemetryContext() {
  return useContext(telemetryContext);
}
