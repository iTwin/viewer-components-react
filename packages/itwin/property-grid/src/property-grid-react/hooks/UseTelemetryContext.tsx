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

/**
 * Features that are tracked for usage.
 * @public
 */
export type UsageTrackedFeatures =
  | "single-element"
  | "multiple-elements"
  | "elements-list"
  | "single-element-from-list"
  | "ancestor-navigation"
  | "context-menu"
  | "hide-empty-values-enabled"
  | "hide-empty-values-disabled"
  | "filter-properties";

/** @internal */
export interface TelemetryContext {
  onPerformanceMeasured: (featureId: PerformanceTrackedFeatures, elapsedTime: number) => void;
  onFeatureUsed: (featureId: UsageTrackedFeatures) => void;
}

const telemetryContext = createContext<TelemetryContext>({
  onPerformanceMeasured: () => {},
  onFeatureUsed: () => {},
});

interface TelemetryContextProviderProps {
  onPerformanceMeasured?: (featureId: PerformanceTrackedFeatures, elapsedTime: number) => void;
  onFeatureUsed?: (featureId: UsageTrackedFeatures) => void;
}

/**
 * Provides callbacks to log telemetry events for specific features.
 * @public
 */
export function TelemetryContextProvider({ onPerformanceMeasured, onFeatureUsed, children }: PropsWithChildren<TelemetryContextProviderProps>) {
  const onPerformanceMeasuredRef = useRef(onPerformanceMeasured);
  const onFeatureUsedRef = useRef(onFeatureUsed);

  useLayoutEffect(() => {
    onPerformanceMeasuredRef.current = onPerformanceMeasured;
    onFeatureUsedRef.current = onFeatureUsed;
  }, [onPerformanceMeasured, onFeatureUsed]);

  const [value] = useState(() => ({
    onPerformanceMeasured: (feature: PerformanceTrackedFeatures, elapsedTime: number) => {
      onPerformanceMeasuredRef.current && onPerformanceMeasuredRef.current(feature, elapsedTime);
    },
    onFeatureUsed: (feature: UsageTrackedFeatures) => {
      onFeatureUsedRef.current && onFeatureUsedRef.current(feature);
    },
  }));

  return <telemetryContext.Provider value={value}>{children}</telemetryContext.Provider>;
}

/** @internal */
export function useTelemetryContext() {
  return useContext(telemetryContext);
}
