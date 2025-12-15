/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useMemo, useState } from "react";
import { FilterLimitExceededError } from "../../common/TreeErrors.js";
import { useTelemetryContext } from "../../common/UseTelemetryContext.js";
import { ClassificationsTreeDefinition } from "../ClassificationsTreeDefinition.js";

import type { GuidString } from "@itwin/core-bentley";
import type { VisibilityTreeProps } from "../../common/components/VisibilityTree.js";
import type { ClassificationsTreeHierarchyConfiguration } from "../ClassificationsTreeDefinition.js";
import type { ClassificationsTreeIdsCache } from "./ClassificationsTreeIdsCache.js";

/** @internal */
export type ClassificationsTreeSearchError = "tooManySearchMatches" | "unknownSearchError";

type HierarchySearchPaths = Awaited<ReturnType<Required<VisibilityTreeProps>["getSearchPaths"]>>;

/** @internal */
export function useSearchPaths({
  searchText,
  hierarchyConfiguration,
  getClassificationsTreeIdsCache,
  onSearchPathsChanged,
  componentId,
}: {
  searchText?: string;
  hierarchyConfiguration: ClassificationsTreeHierarchyConfiguration;
  getClassificationsTreeIdsCache: () => ClassificationsTreeIdsCache;
  onSearchPathsChanged: (paths: HierarchySearchPaths | undefined) => void;
  componentId: GuidString;
}): {
  getPaths: VisibilityTreeProps["getSearchPaths"] | undefined;
  searchError: ClassificationsTreeSearchError | undefined;
} {
  const [searchError, setSearchError] = useState<ClassificationsTreeSearchError | undefined>();
  const { onFeatureUsed } = useTelemetryContext();
  useEffect(() => {
    setSearchError(undefined);
    if (!searchText) {
      onSearchPathsChanged(undefined);
    }
  }, [searchText, onSearchPathsChanged]);

  const getSearchPaths = useMemo<VisibilityTreeProps["getSearchPaths"] | undefined>(() => {
    if (!searchText) {
      return undefined;
    }

    return async ({ imodelAccess, abortSignal }) => {
      onFeatureUsed({ featureId: "search", reportInteraction: true });
      try {
        const paths = await ClassificationsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: searchText,
          idsCache: getClassificationsTreeIdsCache(),
          hierarchyConfig: hierarchyConfiguration,
          componentId,
          abortSignal,
        });
        onSearchPathsChanged(paths);
        return paths;
      } catch (e) {
        const newError = e instanceof FilterLimitExceededError ? "tooManySearchMatches" : "unknownSearchError";
        if (newError !== "tooManySearchMatches") {
          const feature = e instanceof Error && e.message.includes("query too long to execute or server is too busy") ? "error-timeout" : "error-unknown";
          onFeatureUsed({ featureId: feature, reportInteraction: false });
        }
        setSearchError(newError);
        return [];
      }
    };
  }, [searchText, onSearchPathsChanged, onFeatureUsed, getClassificationsTreeIdsCache, hierarchyConfiguration, componentId]);

  return {
    getPaths: getSearchPaths,
    searchError,
  };
}
