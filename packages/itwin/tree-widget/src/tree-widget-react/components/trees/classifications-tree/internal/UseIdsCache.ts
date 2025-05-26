/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useRef, useState } from "react";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { useIModelChangeListener } from "../../common/internal/UseIModelChangeListener.js";
import { ClassificationsTreeIdsCache } from "./ClassificationsTreeIdsCache.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { ClassificationsTreeHierarchyConfiguration } from "../ClassificationsTreeDefinition.js";

/** @internal */
export function useIdsCache(imodel: IModelConnection, hierarchyConfig: ClassificationsTreeHierarchyConfiguration) {
  const cacheRef = useRef<ClassificationsTreeIdsCache | undefined>(undefined);
  const clearCacheRef = useRef(() => () => {
    cacheRef.current?.[Symbol.dispose]?.();
    cacheRef.current = undefined;
  });
  const createCacheGetterRef = useRef((currIModel: IModelConnection, currHierarchyConfig: ClassificationsTreeHierarchyConfiguration) => () => {
    if (cacheRef.current === undefined) {
      cacheRef.current = new ClassificationsTreeIdsCache(createECSqlQueryExecutor(currIModel), currHierarchyConfig);
    }
    return cacheRef.current;
  });
  const [getCache, setCacheGetter] = useState<() => ClassificationsTreeIdsCache>(() => createCacheGetterRef.current(imodel, hierarchyConfig));

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
