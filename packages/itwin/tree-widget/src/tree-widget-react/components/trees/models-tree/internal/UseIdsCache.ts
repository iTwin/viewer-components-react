/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useRef, useState } from "react";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { useIModelChangeListener } from "../../common/internal/UseIModelChangeListener.js";
import { ModelsTreeIdsCache } from "./ModelsTreeIdsCache.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { ModelsTreeHierarchyConfiguration } from "../ModelsTreeDefinition.js";

/** @internal */
export function useIdsCache(imodel: IModelConnection, hierarchyConfig: ModelsTreeHierarchyConfiguration) {
  const cacheRef = useRef<ModelsTreeIdsCache | undefined>(undefined);
  const clearCacheRef = useRef(() => {
    cacheRef.current?.[Symbol.dispose]?.();
    cacheRef.current = undefined;
  });
  const createCacheGetterRef = useRef((currImodel: IModelConnection, currHierarchyConfig: ModelsTreeHierarchyConfiguration) => {
    return () => {
      if (cacheRef.current === undefined) {
        cacheRef.current = new ModelsTreeIdsCache(createECSqlQueryExecutor(currImodel), currHierarchyConfig);
      }
      return cacheRef.current;
    };
  });
  const [getCache, setCacheGetter] = useState<() => ModelsTreeIdsCache>(() => createCacheGetterRef.current(imodel, hierarchyConfig));

  useEffect(() => {
    // clear cache in case it was created before `useEffect` was run first time
    clearCacheRef.current();

    // make sure all cache users rerender
    setCacheGetter(() => createCacheGetterRef.current(imodel, hierarchyConfig));
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      clearCacheRef.current();
    };
  }, [imodel, hierarchyConfig]);

  useIModelChangeListener({
    imodel,
    action: useCallback(() => {
      clearCacheRef.current();
      // make sure all cache users rerender
      setCacheGetter(() => createCacheGetterRef.current(imodel, hierarchyConfig));
    }, [imodel, hierarchyConfig]),
  });

  return {
    getCache,
  };
}
