/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useRef, useState } from "react";
import { registerTxnListeners } from "@itwin/presentation-core-interop";

import type { IModelConnection } from "@itwin/core-frontend";

type IModelKey = string;
type CacheKey = string;

/** @internal */
export interface GetCacheProps<TCache> {
  createCache: () => TCache;
  cacheKey: CacheKey;
  imodel: IModelConnection;
}

/** @internal */
export function useIdsCache(): {
  getCache: <TCache extends object = {}>(createCacheProps: GetCacheProps<TCache>) => TCache;
} {
  const state = useRef<Record<IModelKey, Record<CacheKey, object>>>({});
  const [forceRerender, setForceRerender] = useState({});
  const getCache = useCallback(
    <TCache extends object = {}>({ createCache, cacheKey, imodel }: GetCacheProps<TCache>) => {
      const imodelCaches = state.current[imodel.key];
      if (imodelCaches && imodelCaches[cacheKey]) {
        return imodelCaches[cacheKey] as TCache;
      }

      // Create the cache before adding event listeners, to avoid race conditions
      const cache = createCache();
      state.current = { ...state.current, [imodel.key]: { ...state.current[imodel.key], [cacheKey]: cache } };

      if (!imodelCaches) {
        let listener: undefined | (() => void);
        if (imodel.isBriefcaseConnection()) {
          listener = registerTxnListeners(imodel.txns, () => {
            state.current[imodel.key] = {};
            setForceRerender({});
          });
        }
        imodel.onClose.addOnce(() => {
          delete state.current[imodel.key];
          listener?.();
          setForceRerender({});
        });
      }
      return cache;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [forceRerender],
  );

  return {
    getCache,
  };
}
