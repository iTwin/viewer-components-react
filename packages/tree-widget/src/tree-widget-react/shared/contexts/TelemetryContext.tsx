/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { Logger } from "@itwin/core-bentley";
import { createLogger } from "@itwin/presentation-core-interop";
import { setLogger as setHierarchiesLogger } from "@itwin/presentation-hierarchies";
import { setLogger as setHierarchiesReactLogger } from "@itwin/presentation-hierarchies-react";
import { useLatest } from "../internal/hooks/UseLatest.js";

import type { PropsWithChildren } from "react";
import type { ILogger } from "@itwin/presentation-shared";

const defaultLogger = createLogger(Logger);
let registeredLogger: ILogger | undefined;

interface TelemetryContext {
  onPerformanceMeasured: (props: { featureId: string; duration: number; componentIdentifierPrefix?: string }) => void;
  onFeatureUsed: (props: { featureId?: string; reportInteraction: boolean; componentIdentifierPrefix?: string }) => void;
  logger: ILogger;
}

const telemetryContext = createContext<TelemetryContext | undefined>(undefined);

/** @internal */
export interface TelemetryContextProviderProps {
  /** Callback that is invoked when performance of tracked feature is measured. */
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  /** Callback that is invoked when a tracked feature is used. */
  onFeatureUsed?: (featureId: string) => void;
  /** Unique identifier that is appended to feature id to help track which component used that feature. */
  componentIdentifier: string;
  logger?: ILogger;
}

/** @internal */
export function TelemetryContextProvider({
  children,
  onPerformanceMeasured,
  onFeatureUsed,
  componentIdentifier,
  logger,
}: PropsWithChildren<TelemetryContextProviderProps>) {
  const parentContext = useContext(telemetryContext);

  const onPerformanceMeasuredRef = useLatest(onPerformanceMeasured);
  const onFeatureUsedRef = useLatest(onFeatureUsed);

  const contextValue = useMemo<TelemetryContext>(() => {
    return {
      // Parent logger is the one which is registered first, so return it if it exists.
      logger: parentContext?.logger ?? logger ?? defaultLogger,
      onPerformanceMeasured: ({ featureId, duration, componentIdentifierPrefix = componentIdentifier }) => {
        if (onPerformanceMeasuredRef.current) {
          onPerformanceMeasuredRef.current(`${componentIdentifierPrefix}-${featureId}`, duration);
          return;
        }
        parentContext?.onPerformanceMeasured({ featureId, duration, componentIdentifierPrefix });
      },
      onFeatureUsed: ({ featureId, reportInteraction, componentIdentifierPrefix = componentIdentifier }) => {
        if (!onFeatureUsedRef.current) {
          parentContext?.onFeatureUsed({ featureId, reportInteraction, componentIdentifierPrefix });
          return;
        }
        if (reportInteraction !== false) {
          onFeatureUsedRef.current(`use-${componentIdentifierPrefix}`);
        }
        if (featureId) {
          onFeatureUsedRef.current(`${componentIdentifierPrefix}-${featureId}`);
        }
      },
    };
  }, [componentIdentifier, onPerformanceMeasuredRef, onFeatureUsedRef, parentContext, logger]);

  useEffect(() => {
    // Parent context already registered a logger, no need to do anything here.
    if (parentContext) {
      return;
    }

    const didRegister = registeredLogger === undefined;
    if (didRegister) {
      registeredLogger = contextValue.logger;
      setHierarchiesLogger(contextValue.logger);
      setHierarchiesReactLogger(contextValue.logger);
    }
    return () => {
      if (didRegister) {
        registeredLogger = undefined;
        setHierarchiesLogger(undefined);
        setHierarchiesReactLogger(undefined);
      }
    };
  }, [contextValue.logger, parentContext]);

  return <telemetryContext.Provider value={contextValue}>{children}</telemetryContext.Provider>;
}

const defaultContextValue: TelemetryContext = {
  onPerformanceMeasured: () => {},
  onFeatureUsed: () => {},
  logger: defaultLogger,
};

/** @internal */
export function useTelemetryContext() {
  return useContext(telemetryContext) ?? defaultContextValue;
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
