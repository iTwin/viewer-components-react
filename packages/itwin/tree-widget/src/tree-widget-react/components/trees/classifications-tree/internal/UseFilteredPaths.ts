/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useMemo, useState } from "react";
import { FilterLimitExceededError } from "../../common/TreeErrors.js";
import { useTelemetryContext } from "../../common/UseTelemetryContext.js";
import { ClassificationsTreeDefinition } from "../ClassificationsTreeDefinition.js";

import type { VisibilityTreeProps } from "../../common/components/VisibilityTree.js";
import type { ClassificationsTreeHierarchyConfiguration } from "../ClassificationsTreeDefinition.js";
import type { ClassificationsTreeIdsCache } from "./ClassificationsTreeIdsCache.js";

/** @internal */
export type ClassificationsTreeFilteringError = "tooManyFilterMatches" | "unknownFilterError";

type HierarchyFilteringPaths = Awaited<ReturnType<Required<VisibilityTreeProps>["getFilteredPaths"]>>;

/** @internal */
export function useFilteredPaths({
  filter,
  hierarchyConfiguration,
  getClassificationsTreeIdsCache,
  onFilteredPathsChanged,
}: {
  filter?: string;
  hierarchyConfiguration: ClassificationsTreeHierarchyConfiguration;
  getClassificationsTreeIdsCache: () => ClassificationsTreeIdsCache;
  onFilteredPathsChanged: (paths: HierarchyFilteringPaths | undefined) => void;
}): {
  getPaths: VisibilityTreeProps["getFilteredPaths"] | undefined;
  filteringError: ClassificationsTreeFilteringError | undefined;
} {
  const [filteringError, setFilteringError] = useState<ClassificationsTreeFilteringError | undefined>();
  const { onFeatureUsed } = useTelemetryContext();
  useEffect(() => {
    setFilteringError(undefined);
    if (!filter) {
      onFilteredPathsChanged(undefined);
    }
  }, [filter, onFilteredPathsChanged]);

  const getFilteredPaths = useMemo<VisibilityTreeProps["getFilteredPaths"] | undefined>(() => {
    if (!filter) {
      return undefined;
    }

    return async ({ imodelAccess }) => {
      onFeatureUsed({ featureId: "filtering", reportInteraction: true });
      try {
        const paths = await ClassificationsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: filter,
          idsCache: getClassificationsTreeIdsCache(),
          hierarchyConfig: hierarchyConfiguration,
        });
        onFilteredPathsChanged(paths);
        return paths;
      } catch (e) {
        const newError = e instanceof FilterLimitExceededError ? "tooManyFilterMatches" : "unknownFilterError";
        if (newError !== "tooManyFilterMatches") {
          const feature = e instanceof Error && e.message.includes("query too long to execute or server is too busy") ? "error-timeout" : "error-unknown";
          onFeatureUsed({ featureId: feature, reportInteraction: false });
        }
        setFilteringError(newError);
        return [];
      }
    };
  }, [filter, onFilteredPathsChanged, onFeatureUsed, getClassificationsTreeIdsCache, hierarchyConfiguration]);

  return {
    getPaths: getFilteredPaths,
    filteringError,
  };
}
