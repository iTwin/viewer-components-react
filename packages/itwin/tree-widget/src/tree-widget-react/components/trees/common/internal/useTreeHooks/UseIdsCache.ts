/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useRef, useState } from "react";
import { useTreeWidgetContext } from "../../TreeWidgetContextProvider.js";
import { useIModelChangeListener } from "../UseIModelChangeListener.js";

import type { TreeWidgetIdsCache } from "../TreeWidgetIdsCache.js";
import type { IModelConnection } from "@itwin/core-frontend";
/** @internal */
export interface CreateCacheProps<TCacheSpecificProps> {
  imodel: IModelConnection;
  specificProps: TCacheSpecificProps;
  treeWidgetIdsCache: TreeWidgetIdsCache | undefined;
}

/** @internal */
export interface UseIdsCacheProps<TCache, TCacheSpecificProps> {
  imodel: IModelConnection;
  createCache: (props: CreateCacheProps<TCacheSpecificProps>) => TCache;
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
  const { treeWidgetIdsCache } = useTreeWidgetContext();
  const { imodel, createCache, cacheSpecificProps } = props;

  const createCacheGetterRef = useRef(
    (currImodel: IModelConnection, specificProps: TCacheSpecificProps, currTreeWidgetIdsCache: TreeWidgetIdsCache | undefined) => {
      return () => {
        if (cacheRef.current === undefined) {
          cacheRef.current = createCache({ imodel: currImodel, specificProps, treeWidgetIdsCache: currTreeWidgetIdsCache });
        }
        return cacheRef.current;
      };
    },
  );

  const [getCache, setCacheGetter] = useState<() => TCache>(() => createCacheGetterRef.current(imodel, cacheSpecificProps, treeWidgetIdsCache));

  useEffect(() => {
    // clear cache in case it was created before `useEffect` was run first time
    clearCacheRef.current();

    // make sure all cache users rerender
    setCacheGetter(() => createCacheGetterRef.current(imodel, cacheSpecificProps, treeWidgetIdsCache));
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      clearCacheRef.current();
    };
  }, [imodel, cacheSpecificProps, treeWidgetIdsCache]);

  useIModelChangeListener({
    imodel,
    action: useCallback(() => {
      clearCacheRef.current();
      // make sure all cache users rerender
      setCacheGetter(() => createCacheGetterRef.current(imodel, cacheSpecificProps, treeWidgetIdsCache));
    }, [imodel, cacheSpecificProps, treeWidgetIdsCache]),
  });

  return {
    getCache,
  };
}
