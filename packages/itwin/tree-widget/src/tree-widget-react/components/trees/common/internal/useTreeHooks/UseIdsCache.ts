/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useState } from "react";
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
  const [state, setState] = useState<Record<IModelKey, Record<CacheKey, Disposable>>>({});

  const getCache = useCallback(
    <TCache extends Disposable>({ createCache, cacheKey, imodel }: GetCacheProps<TCache>) => {
      const imodelCaches = state[imodel.key];
      if (imodelCaches && imodelCaches[cacheKey]) {
        return imodelCaches[cacheKey] as TCache;
      }

      if (!imodelCaches) {
        let listener: () => void;
        if (imodel.isBriefcaseConnection()) {
          listener = registerTxnListeners(imodel.txns, () => {
            setState((prev) => {
              for (const cacheToDispose of Object.values(prev[imodel.key])) {
                cacheToDispose[Symbol.dispose]();
              }
              return { ...prev, [imodel.key]: {} };
            });
          });
        }
        imodel.onClose.addOnce(() => {
          listener();
          setState((prev) => {
            for (const cacheToDispose of Object.values(prev[imodel.key])) {
              cacheToDispose[Symbol.dispose]();
            }
            const newState = { ...prev };
            delete newState[imodel.key];
            return newState;
          });
        });
      }
      const cache = createCache();
      setState((prev) => ({ ...prev, [imodel.key]: { ...prev[imodel.key], [cacheKey]: cache } }));
      return cache;
    },
    [state],
  );

  return {
    getCache,
  };
}
