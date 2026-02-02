/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useRef, useState } from "react";
import { useIModelChangeListener } from "../UseIModelChangeListener.js";

import type { GuidString } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";

/** @internal */
export interface CreateCacheProps<TCacheSpecificProps extends object = {}> {
  imodel: IModelConnection;
  specificProps: TCacheSpecificProps;
  componentId: GuidString;
  viewType: "2d" | "3d";
}

/** @internal */
export interface UseIdsCacheProps<TCache, TCacheSpecificProps extends object = {}> {
  imodel: IModelConnection;
  createCache: (props: CreateCacheProps<TCacheSpecificProps>) => TCache;
  cacheSpecificProps: TCacheSpecificProps;
  componentId: GuidString;
  cacheType: "2d" | "3d";
}

function useIdsCacheOfSpecificViewType<TCache extends Disposable, TCacheSpecificProps extends object>(
  props: UseIdsCacheProps<TCache, TCacheSpecificProps> & { viewType: "2d" | "3d" },
): { getCache: () => TCache } {
  const cacheRef = useRef<TCache | undefined>(undefined);
  const clearCacheRef = useRef(() => {
    cacheRef.current?.[Symbol.dispose]?.();
    cacheRef.current = undefined;
  });
  const { imodel, createCache, cacheSpecificProps } = props;

  const createCacheGetterRef = useRef((currImodel: IModelConnection, specificProps: TCacheSpecificProps, componentId: GuidString) => {
    return () => {
      if (cacheRef.current === undefined) {
        cacheRef.current = createCache({ imodel: currImodel, specificProps, componentId, viewType: props.viewType });
      }
      return cacheRef.current;
    };
  });

  const [getCache, setCacheGetter] = useState<() => TCache>(() => createCacheGetterRef.current(imodel, cacheSpecificProps, props.componentId));

  useEffect(() => {
    // clear cache in case it was created before `useEffect` was run first time
    clearCacheRef.current();

    // make sure all cache users rerender
    setCacheGetter(() => createCacheGetterRef.current(imodel, cacheSpecificProps, props.componentId));
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      clearCacheRef.current();
    };
  }, [imodel, cacheSpecificProps, props.componentId]);

  useIModelChangeListener({
    imodel,
    action: useCallback(() => {
      clearCacheRef.current();
      // make sure all cache users rerender
      setCacheGetter(() => createCacheGetterRef.current(imodel, cacheSpecificProps, props.componentId));
    }, [imodel, cacheSpecificProps, props.componentId]),
  });

  return {
    getCache,
  };
}

/** @internal */
export function useIdsCache<TCache extends Disposable, TCacheSpecificProps extends object = {}>(
  props: UseIdsCacheProps<TCache, TCacheSpecificProps>,
): { getCache: () => TCache } {
  const { getCache: get2dCache } = useIdsCacheOfSpecificViewType<TCache, TCacheSpecificProps>({ ...props, viewType: "2d" });
  const { getCache: get3dCache } = useIdsCacheOfSpecificViewType<TCache, TCacheSpecificProps>({ ...props, viewType: "3d" });

  const getCache = useCallback(() => {
    return props.cacheType === "2d" ? get2dCache() : get3dCache();
  }, [props.cacheType, get2dCache, get3dCache]);

  return {
    getCache,
  };
}
