/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback } from "react";

/** @internal */
export interface UseFeatureReportingProps {
  treeIdentifier: string;
  onFeatureUsed?: (featureId: string) => void;
}

/** @internal */
export interface UseFeatureReportingResult {
  reportUsage?: (props: { featureId?: string; reportInteraction: boolean }) => void;
}

/**
 * Enables feature reporting for a tree component.
 * @internal
 */
export function useFeatureReporting(props: UseFeatureReportingProps): UseFeatureReportingResult {
  const { treeIdentifier, onFeatureUsed } = props;

  const reportUsage = useCallback(
    ({ featureId, reportInteraction }: { featureId?: string; reportInteraction: boolean }) => {
      if (reportInteraction !== false) {
        onFeatureUsed?.(`use-${treeIdentifier}`);
      }
      if (featureId) {
        onFeatureUsed?.(`${treeIdentifier}-${featureId}`);
      }
    },
    [treeIdentifier, onFeatureUsed],
  );

  if (!onFeatureUsed) {
    return { reportUsage: undefined };
  }

  return { reportUsage };
}
