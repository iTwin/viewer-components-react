/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useRef } from "react";

import type { IModelConnection } from "@itwin/core-frontend";

/** @internal */
export interface UsePerformanceReportingProps {
  treeIdentifier: string;
  iModel: IModelConnection;
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
  const { treeIdentifier, iModel, onPerformanceMeasured } = props;
  const firstLoadRef = useRef(true);

  useEffect(() => {
    firstLoadRef.current = true;
  }, [iModel]);

  const onNodeLoaded = ({ node, duration }: { node: string; duration: number }) => {
    if (firstLoadRef.current && node === "root") {
      onPerformanceMeasured?.(`${treeIdentifier}-initial-load`, duration);
      firstLoadRef.current = false;
      return;
    }
    onPerformanceMeasured?.(`${treeIdentifier}-hierarchy-level-load`, duration);
  };

  return { onNodeLoaded: onPerformanceMeasured ? onNodeLoaded : undefined };
}
