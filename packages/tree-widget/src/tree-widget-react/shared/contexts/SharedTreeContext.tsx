/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Subject } from "rxjs";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { BaseIdsCache } from "../internal/caches/BaseIdsCache.js";
import { useIdsCache } from "../internal/hooks/UseIdsCache.js";

import type { PropsWithChildren } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { BaseIdsCacheProps } from "../internal/caches/BaseIdsCache.js";
import type { GetCacheProps } from "../internal/hooks/UseIdsCache.js";

/** @internal */
interface SharedTreeContext {
  getCache: <TCache extends object = {}>(props: GetCacheProps<TCache>) => TCache;
  getBaseIdsCache: (props: Omit<BaseIdsCacheProps, "queryExecutor"> & { imodel: IModelConnection }) => BaseIdsCache;
  cancelChangesInProgress: Subject<void>;
}

const sharedTreeContext = createContext<SharedTreeContext | undefined>(undefined);

/** @internal */
export function useSharedTreeContext(): SharedTreeContext {
  const context = useContext(sharedTreeContext);
  if (!context) {
    throw new Error("Requires `TreeWidgetContextProvider` to be present in components tree above.");
  }
  return context;
}

/** @internal */
export function SharedTreeContextProvider({ children, showWarning }: PropsWithChildren<{ showWarning?: boolean }>) {
  const context = useContext(sharedTreeContext);

  if (context) {
    return children;
  }
  return <SharedTreeContextProviderImpl showWarning={showWarning}>{children}</SharedTreeContextProviderImpl>;
}

function SharedTreeContextProviderImpl({ children, showWarning }: PropsWithChildren<{ showWarning?: boolean }>) {
  const { getCache } = useIdsCache();
  const [cancelChangesInProgress] = useState(() => new Subject<void>());
  useEffect(() => {
    if (showWarning) {
      // eslint-disable-next-line no-console
      console.warn("Wrap tree components with a single `TreeWidgetContextProvider` to provide shared tree resources.");
    }
  }, [showWarning]);
  const getBaseIdsCache = useCallback(
    ({ elementClassName, type, imodel, excludedElementClassNames }: Omit<BaseIdsCacheProps, "queryExecutor"> & { imodel: IModelConnection }) => {
      return getCache({
        imodel,
        cacheKey: `${type}-${elementClassName}-${[...(excludedElementClassNames ?? [])].sort().join(",")}-BaseIdsCache`,
        createCache: () => new BaseIdsCache({ elementClassName, type, excludedElementClassNames, queryExecutor: createECSqlQueryExecutor(imodel) }),
      });
    },
    [getCache],
  );
  return <sharedTreeContext.Provider value={{ getCache, getBaseIdsCache, cancelChangesInProgress }}>{children}</sharedTreeContext.Provider>;
}
