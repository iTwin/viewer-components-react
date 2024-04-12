import { useCallback, useEffect, useRef } from "react";

import type { IModelConnection } from "@itwin/core-frontend";
import type { Ruleset } from "@itwin/presentation-common";

export interface UsePerformanceReportingProps {
  treeIdentifier: string;
  iModel: IModelConnection;
  ruleset: Ruleset;
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
}

export interface UsePerformanceReportingResult {
  onNodeLoaded?: (props: { node: string; duration: number }) => void;
}

export function usePerformanceReporting(props: UsePerformanceReportingProps): UsePerformanceReportingResult {
  const { treeIdentifier, iModel, ruleset, onPerformanceMeasured } = props;
  const firstLoadRef = useRef(true);

  useEffect(() => {
    firstLoadRef.current = true;
  }, [iModel, ruleset]);

  const onNodeLoaded = useCallback(
    ({ node, duration }: { node: string; duration: number }) => {
      if (firstLoadRef.current && node === "root") {
        onPerformanceMeasured?.(`${treeIdentifier}-initial-load`, duration);
        firstLoadRef.current = false;
        return;
      }
      onPerformanceMeasured?.(`${treeIdentifier}-hierarchy-level-load`, duration);
    },
    [treeIdentifier, onPerformanceMeasured],
  );

  return { onNodeLoaded: onPerformanceMeasured ? onNodeLoaded : undefined };
}
