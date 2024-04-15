/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/** @internal */
export interface UsePerformanceReportingProps {
  treeIdentifier: string;
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
}

/** @internal */
export interface UsePerformanceReportingResult {
  onNodeLoaded?: (props: { node: string; duration: number }) => void;
}

/**
 * Enables performance reporting for a tree component.
 * @internal
 */
export function usePerformanceReporting(props: UsePerformanceReportingProps): UsePerformanceReportingResult {
  const { treeIdentifier, onPerformanceMeasured } = props;

  const onNodeLoaded = ({ node, duration }: { node: string; duration: number }) => {
    if (node === "root") {
      onPerformanceMeasured?.(`${treeIdentifier}-initial-load`, duration);
      return;
    }
    onPerformanceMeasured?.(`${treeIdentifier}-hierarchy-level-load`, duration);
  };

  return { onNodeLoaded: onPerformanceMeasured ? onNodeLoaded : undefined };
}
