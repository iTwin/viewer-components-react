/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useRef } from "react";

/**
 * Defines callback that is used by `Tree` component to report usage of features.
 * @beta
 */
export type ReportUsageCallback<TFeatures extends string> = (props: { featureId?: TFeatures; reportInteraction: boolean }) => void;

interface UseFeatureReportingProps {
  treeIdentifier: string;
  onFeatureUsed?: (featureId: string) => void;
}

interface UseFeatureReportingResult<TFeatures extends string> {
  reportUsage: ReportUsageCallback<TFeatures>;
}

/**
 * Creates callback that can be passed to `Tree` component to track feature usage.
 * @beta
 */
export function useFeatureReporting<TFeatures extends string>(props: UseFeatureReportingProps): UseFeatureReportingResult<TFeatures> {
  const { treeIdentifier, onFeatureUsed } = props;
  const onFeatureUsedRef = useRef(onFeatureUsed);

  useEffect(() => {
    onFeatureUsedRef.current = onFeatureUsed;
  }, [onFeatureUsed]);

  const reportUsage = useCallback(
    ({ featureId, reportInteraction }: { featureId?: TFeatures; reportInteraction: boolean }) => {
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

interface UseReportingActionProps<TAction, TFeatures> {
  action: TAction;
  featureId?: TFeatures;
  reportUsage?: (props: { featureId?: TFeatures; reportInteraction: true }) => void;
}

/** @internal */
export function useReportingAction<TAction extends (...args: any[]) => void, TFeatures extends string>({
  action,
  featureId,
  reportUsage,
}: UseReportingActionProps<TAction, TFeatures>) {
  return useCallback<(...args: Parameters<TAction>) => void>(
    (...args) => {
      reportUsage?.({ featureId, reportInteraction: true });
      action(...args);
    },
    [action, reportUsage, featureId],
  );
}
