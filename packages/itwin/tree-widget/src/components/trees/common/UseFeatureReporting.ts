/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useRef } from "react";

/** @internal */
export interface UseFeatureReportingProps {
  treeIdentifier: string;
  onFeatureUsed?: (featureId: string) => void;
}

/** @internal */
export interface UseFeatureReportingResult {
  reportUsage: (props: { featureId?: UsageTrackedFeatures; reportInteraction: boolean }) => void;
}

/**
 * Features that are tracked for usage.
 * @internal
 */
export type UsageTrackedFeatures = "visibility-change" | "hierarchy-level-filtering" | "filtering" | "hierarchy-level-size-limit-hit" | "zoom-to-node";

/**
 * Enables feature reporting for a tree component.
 * @internal
 */
export function useFeatureReporting(props: UseFeatureReportingProps): UseFeatureReportingResult {
  const { treeIdentifier, onFeatureUsed } = props;
  const onFeatureUsedRef = useRef(onFeatureUsed);

  useEffect(() => {
    onFeatureUsedRef.current = onFeatureUsed;
  }, [onFeatureUsed]);

  const reportUsage = useCallback(
    ({ featureId, reportInteraction }: { featureId?: UsageTrackedFeatures; reportInteraction: boolean }) => {
      if (reportInteraction !== false) {
        onFeatureUsedRef.current?.(`use-${treeIdentifier}`);
      }
      if (featureId) {
        onFeatureUsedRef.current?.(`${treeIdentifier}-${featureId}`);
      }
    },
    [treeIdentifier],
  );

  return { reportUsage };
}

/** @internal */
export function useReportingAction<T extends (...args: any[]) => void>(
  action: T,
  reportUsage?: (props: { featureId?: UsageTrackedFeatures; reportInteraction: true }) => void,
): T {
  const reportingAction = useCallback(
    (...args: any[]) => {
      reportUsage?.({ reportInteraction: true });
      action(...args);
    },
    [action, reportUsage],
  );
  return reportingAction as T;
}
