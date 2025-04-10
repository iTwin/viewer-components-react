/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useRef, useState } from "react";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { useIModelChangeListener } from "../../common/internal/UseIModelChangeListener.js";
import { CategoriesTreeIdsCache } from "./CategoriesTreeIdsCache.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchyFilteringPath } from "@itwin/presentation-hierarchies";

/** @internal */
export function useIdsCache(imodel: IModelConnection, viewType: "2d" | "3d", filteredPaths?: HierarchyFilteringPath[]) {
  const cacheRef = useRef<CategoriesTreeIdsCache | undefined>(undefined);
  const clearCacheRef = useRef(() => () => {
    cacheRef.current?.[Symbol.dispose]?.();
    cacheRef.current = undefined;
  });
  const createCacheGetterRef = useRef((currImodel: IModelConnection, currViewType: "2d" | "3d") => () => {
    if (cacheRef.current === undefined) {
      cacheRef.current = new CategoriesTreeIdsCache(createECSqlQueryExecutor(currImodel), currViewType);
    }
    return cacheRef.current;
  });
  const [getCache, setCacheGetter] = useState<() => CategoriesTreeIdsCache>(() => createCacheGetterRef.current(imodel, viewType));

  useEffect(() => {
    // clear cache in case it was created before `useEffect` was run first time
    clearCacheRef.current();

    // make sure all cache users rerender
    setCacheGetter(() => createCacheGetterRef.current(imodel, viewType));
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      clearCacheRef.current();
    };
  }, [imodel, viewType]);

  useEffect(() => {
    cacheRef.current?.clearFilteredElementsModels();
  }, [filteredPaths]);

  useIModelChangeListener({
    imodel,
    action: useCallback(() => {
      clearCacheRef.current();
      // make sure all cache users rerender
      setCacheGetter(() => createCacheGetterRef.current(imodel, viewType));
    }, [imodel, viewType]),
  });

  return {
    getCache,
  };
}
