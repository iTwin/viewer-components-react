/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useRef, useState } from "react";
import { useIModelChangeListener } from "../UseIModelChangeListener.js";

import type { IModelConnection } from "@itwin/core-frontend";

/** @internal */
export interface UseIdsCacheProps<TCache, TCacheSpecificProps> {
  imodel: IModelConnection;
  createCache: (imodel: IModelConnection, cacheProps: TCacheSpecificProps) => TCache;
  cacheSpecificProps: TCacheSpecificProps;
}

/** @internal */
export function useIdsCache<TCache extends Disposable, TCacheSpecificProps extends object>(
  props: UseIdsCacheProps<TCache, TCacheSpecificProps>,
): { getCache: () => TCache } {
  const cacheRef = useRef<TCache | undefined>(undefined);
  const clearCacheRef = useRef(() => {
    cacheRef.current?.[Symbol.dispose]?.();
    cacheRef.current = undefined;
  });
  const { imodel, createCache, cacheSpecificProps } = props;

  const createCacheGetterRef = useRef((currImodel: IModelConnection, specificProps: TCacheSpecificProps) => {
    return () => {
      if (cacheRef.current === undefined) {
        cacheRef.current = createCache(currImodel, specificProps);
      }
      return cacheRef.current;
    };
  });

  const [getCache, setCacheGetter] = useState<() => TCache>(() => createCacheGetterRef.current(imodel, cacheSpecificProps));

  useEffect(() => {
    // clear cache in case it was created before `useEffect` was run first time
    clearCacheRef.current();

    // make sure all cache users rerender
    setCacheGetter(() => createCacheGetterRef.current(imodel, cacheSpecificProps));
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      clearCacheRef.current();
    };
  }, [imodel, cacheSpecificProps]);

  useIModelChangeListener({
    imodel,
    action: useCallback(() => {
      clearCacheRef.current();
      // make sure all cache users rerender
      setCacheGetter(() => createCacheGetterRef.current(imodel, cacheSpecificProps));
    }, [imodel, cacheSpecificProps]),
  });

  return {
    getCache,
  };
}
