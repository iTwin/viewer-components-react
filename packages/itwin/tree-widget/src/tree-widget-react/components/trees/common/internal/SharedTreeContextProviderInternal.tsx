/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useCallback, useContext, useEffect } from "react";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { BaseIdsCache } from "./caches/BaseIdsCache.js";
import { useIdsCache } from "./useTreeHooks/UseIdsCache.js";

import type { PropsWithChildren } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { BaseIdsCacheProps } from "./caches/BaseIdsCache.js";
import type { GetCacheProps } from "./useTreeHooks/UseIdsCache.js";

/** @internal */
interface SharedTreeContextInternal {
  getCache: <TCache extends Disposable>(props: GetCacheProps<TCache>) => TCache;
  getBaseIdsCache: (props: Omit<BaseIdsCacheProps, "queryExecutor"> & { imodel: IModelConnection }) => BaseIdsCache;
}

const treeWidgetContextInternal = createContext<SharedTreeContextInternal | undefined>(undefined);

/** @internal */
export function useSharedTreeContextInternal(): SharedTreeContextInternal {
  const context = useContext(treeWidgetContextInternal);
  if (!context) {
    throw new Error("Requires `SharedTreeContextProvider` to be present in components tree above.");
  }
  return context;
}

/** @internal */
export function SharedTreeContextProviderInternal({ children, showWarning }: PropsWithChildren<{ showWarning?: boolean }>) {
  const context = useContext(treeWidgetContextInternal);

  if (context) {
    return children;
  }
  return <SharedTreeContextProviderInternalImpl showWarning={showWarning}>{children}</SharedTreeContextProviderInternalImpl>;
}

function SharedTreeContextProviderInternalImpl({ children, showWarning }: PropsWithChildren<{ showWarning?: boolean }>) {
  const { getCache } = useIdsCache();
  useEffect(() => {
    if (showWarning) {
      // eslint-disable-next-line no-console
      console.warn("Wrap tree components with a single `SharedTreeContextProvider` to improve trees' performance.");
    }
  }, [showWarning]);
  const getBaseIdsCache = useCallback(
    ({ elementClassName, type, imodel }: Omit<BaseIdsCacheProps, "queryExecutor"> & { imodel: IModelConnection }) => {
      return getCache({
        imodel,
        cacheKey: `${type}-${elementClassName}-BaseIdsCache`,
        createCache: () => new BaseIdsCache({ elementClassName, type, queryExecutor: createECSqlQueryExecutor(imodel) }),
      });
    },
    [getCache],
  );
  return <treeWidgetContextInternal.Provider value={{ getCache, getBaseIdsCache }}>{children}</treeWidgetContextInternal.Provider>;
}
