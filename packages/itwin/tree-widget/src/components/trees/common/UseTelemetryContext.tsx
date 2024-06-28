/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";

import type { PropsWithChildren } from "react";

type TrackedFeatures = "visibility-change" | "hierarchy-level-filtering" | "filtering" | "hierarchy-level-size-limit-hit" | "zoom-to-node";

interface TelemetryContext {
  onPerformanceMeasured: (featureId: string, duration: number) => void;
  onFeatureUsed: (props: { featureId?: TrackedFeatures; reportInteraction: boolean }) => void;
}

const telemetryContext = createContext<TelemetryContext | undefined>(undefined);

export interface TelemetryContextProviderProps {
  /** Callback that is invoked when performance of tracked feature is measured. */
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  /** Callback that is invoked when a tracked feature is used. */
  onFeatureUsed?: (featureId: string) => void;
  /** Unique identifier that is appended to feature id to help track which component used that feature. */
  identifier: string;
}

/** @beta */
export function TelemetryContextProvider({ children, onPerformanceMeasured, onFeatureUsed, identifier }: PropsWithChildren<TelemetryContextProviderProps>) {
  const onPerformanceMeasuredRef = useLatest(onPerformanceMeasured);
  const onFeatureUsedRef = useLatest(onFeatureUsed);

  const contextValue = useMemo<TelemetryContext>(() => {
    return {
      onPerformanceMeasured: (featureId, duration) => onPerformanceMeasuredRef.current?.(`${identifier}-${featureId}`, duration),
      onFeatureUsed: ({ featureId, reportInteraction }) => {
        if (reportInteraction !== false) {
          onFeatureUsedRef.current?.(`use-${identifier}`);
        }
        if (featureId) {
          onFeatureUsedRef.current?.(`${identifier}-${featureId}`);
        }
      },
    };
  }, [identifier, onPerformanceMeasuredRef, onFeatureUsedRef]);

  return <telemetryContext.Provider value={contextValue}>{children}</telemetryContext.Provider>;
}

const defaultContextValue: TelemetryContext = {
  onPerformanceMeasured: () => {},
  onFeatureUsed: () => {},
};

export function useTelemetryContext() {
  return useContext(telemetryContext) ?? defaultContextValue;
}

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

function useLatest<T>(value: T) {
  const ref = useRef<T>(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
