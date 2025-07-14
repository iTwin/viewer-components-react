/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect } from "react";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { useIdsCache } from "../../common/internal/useTreeHooks/UseIdsCache.js";
import { CategoriesTreeIdsCache } from "./CategoriesTreeIdsCache.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchyFilteringPath } from "@itwin/presentation-hierarchies";

/** @internal */
export function useCategoriesIdsCache(imodel: IModelConnection, viewType: "2d" | "3d", filteredPaths?: HierarchyFilteringPath[]) {
  const { getCache } = useIdsCache<CategoriesTreeIdsCache, { viewType: "2d" | "3d" }>({
    imodel,
    createCache: (currIModel, createCacheProps) => new CategoriesTreeIdsCache(createECSqlQueryExecutor(currIModel), createCacheProps.viewType),
    cacheSpecificProps: { viewType },
  });

  useEffect(() => {
    getCache().clearFilteredElementsModels();
  }, [filteredPaths, getCache]);

  return {
    getCache,
  };
}
