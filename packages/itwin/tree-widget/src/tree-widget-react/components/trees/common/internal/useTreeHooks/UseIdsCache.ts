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
  getCache: <TCache extends Disposable>(createCacheProps: GetCacheProps<TCache>) => TCache;
} {
  const state = useRef<Record<IModelKey, Record<CacheKey, Disposable>>>({});
  const [forceRerender, setForceRerender] = useState(0);
  const getCache = useCallback(
    <TCache extends Disposable>({ createCache, cacheKey, imodel }: GetCacheProps<TCache>) => {
      const imodelCaches = state.current[imodel.key];
      if (imodelCaches && imodelCaches[cacheKey]) {
        return imodelCaches[cacheKey] as TCache;
      }

      if (!imodelCaches) {
        let listener: undefined | (() => void);
        if (imodel.isBriefcaseConnection()) {
          listener = registerTxnListeners(imodel.txns, () => {
            for (const cacheToDispose of Object.values(state.current[imodel.key])) {
              cacheToDispose[Symbol.dispose]();
            }
            state.current[imodel.key] = {};
            setForceRerender((prev) => prev + 1);
          });
        }
        imodel.onClose.addOnce(() => {
          for (const cacheToDispose of Object.values(state.current[imodel.key])) {
            cacheToDispose[Symbol.dispose]();
          }
          delete state.current[imodel.key];
          listener?.();
          setForceRerender((prev) => prev + 1);
        });
      }
      const cache = createCache();
      state.current = { ...state.current, [imodel.key]: { ...state.current[imodel.key], [cacheKey]: cache } };
      return cache;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [forceRerender],
  );

  return {
    getCache,
  };
}
