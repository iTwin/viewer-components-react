/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useContext, useEffect, useRef, useState } from "react";

import type { PropsWithChildren } from "react";

/**
 * Features that are tracked for usage analytics.
 * @beta
 */
export type UsageTrackedFeatures =
  // Main panel actions
  | "advanced-options-expand"
  | "advanced-options-collapse"
  | "format-apply"
  | "format-clear"
  // Selector actions
  | "format-set-select"
  | "format-select"
  | "format-set-search"
  | "format-search"
  // Format set panel
  | "unit-system-change"
  // Format type
  | "format-type-change"
  // Unit options
  | "unit-change"
  | "unit-label-change"
  | "append-unit-label-toggle"
  | "uom-separator-change"
  // Precision
  | "precision-change"
  // Advanced options
  | "decimal-separator-change"
  | "thousands-separator-toggle"
  | "thousands-separator-change"
  | "sign-option-change"
  | "show-trailing-zeros-toggle"
  | "keep-decimal-point-toggle"
  | "keep-single-zero-toggle"
  | "zero-empty-toggle";

/** @internal */
export interface TelemetryContext {
  onFeatureUsed: (featureId: UsageTrackedFeatures) => void;
}

const telemetryContext = createContext<TelemetryContext>({
  onFeatureUsed: () => {},
});

/**
 * Props for the TelemetryContextProvider component.
 * @beta
 */
export interface TelemetryContextProviderProps {
  /** Callback that is invoked when a tracked feature is used. */
  onFeatureUsed?: (featureId: UsageTrackedFeatures) => void;
}

/**
 * Provides callbacks to log telemetry events for specific features.
 * @beta
 */
export function TelemetryContextProvider({ onFeatureUsed, children }: PropsWithChildren<TelemetryContextProviderProps>) {
  const onFeatureUsedRef = useRef(onFeatureUsed);

  useEffect(() => {
    onFeatureUsedRef.current = onFeatureUsed;
  }, [onFeatureUsed]);

  // Create a stable context value that never changes reference across re-renders.
  // This prevents unnecessary re-renders of all context consumers while still
  // allowing the callback prop to change (accessed via the ref).
  const [value] = useState(() => ({
    onFeatureUsed: (feature: UsageTrackedFeatures) => {
      onFeatureUsedRef.current && onFeatureUsedRef.current(feature);
    },
  }));

  return <telemetryContext.Provider value={value}>{children}</telemetryContext.Provider>;
}

/**
 * Hook to access telemetry context for reporting feature usage.
 * @internal
 */
export function useTelemetryContext() {
  return useContext(telemetryContext);
}
