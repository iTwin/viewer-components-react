/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useCallback, useContext, useMemo } from "react";
import { useLatest } from "../internal/hooks/UseLatest.js";

import type { PropsWithChildren } from "react";

interface TelemetryContext {
  onPerformanceMeasured: (props: { featureId: string; duration: number }) => void;
  onFeatureUsed: (props: { featureId?: string; reportInteraction: boolean }) => void;
}

const defaultContextValue: TelemetryContext = {
  onPerformanceMeasured: () => {},
  onFeatureUsed: () => {},
};

const telemetryContext = createContext<TelemetryContext>(defaultContextValue);

/** @beta */
export interface TelemetryContextProviderProps {
  /** Callback that is invoked when performance of tracked feature is measured. */
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  /** Callback that is invoked when a tracked feature is used. */
  onFeatureUsed?: (featureId: string) => void;
  /** Unique identifier that is appended to feature id to help track which component used that feature. */
  componentIdentifier: string;
}

/**
 * Provides telemetry reporting for a tree and prefixes reported feature IDs with `componentIdentifier`.
 *
 * Standard tree components create this context automatically. When composing a custom tree from
 * `use*Tree` hooks, wrap the tree and any directly rendered header buttons with this provider so
 * they report through the same callbacks and component identifier.
 *
 * @beta
 */
export function TelemetryContextProvider({
  children,
  onPerformanceMeasured,
  onFeatureUsed,
  componentIdentifier,
}: PropsWithChildren<TelemetryContextProviderProps>) {
  const onPerformanceMeasuredRef = useLatest(onPerformanceMeasured);
  const onFeatureUsedRef = useLatest(onFeatureUsed);

  const contextValue = useMemo<TelemetryContext>(() => {
    return {
      onPerformanceMeasured: ({ featureId, duration }) => onPerformanceMeasuredRef.current?.(`${componentIdentifier}-${featureId}`, duration),
      onFeatureUsed: ({ featureId, reportInteraction }) => {
        if (reportInteraction !== false) {
          onFeatureUsedRef.current?.(`use-${componentIdentifier}`);
        }
        if (featureId) {
          onFeatureUsedRef.current?.(`${componentIdentifier}-${featureId}`);
        }
      },
    };
  }, [componentIdentifier, onPerformanceMeasuredRef, onFeatureUsedRef]);

  return <telemetryContext.Provider value={contextValue}>{children}</telemetryContext.Provider>;
}

/** @internal */
export function useTelemetryContext() {
  return useContext(telemetryContext);
}

type TrackedFeatures =
  | "visibility-change"
  | "hierarchy-level-filtering"
  | "search"
  | "hierarchy-level-size-limit-hit"
  | "zoom-to-node"
  | "error-timeout"
  | "error-unknown";
interface UseReportingActionProps<TAction> {
  action: TAction;
  featureId?: TrackedFeatures;
}

/** @internal */
export function useReportingAction<TAction extends (...args: any[]) => void>({ action, featureId }: UseReportingActionProps<TAction>) {
  const { onFeatureUsed } = useTelemetryContext();
  return useCallback<(...args: Parameters<TAction>) => void>(
    (...args) => {
      onFeatureUsed({ featureId, reportInteraction: true });
      action(...args);
    },
    [action, featureId, onFeatureUsed],
  );
}
