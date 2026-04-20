/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Subject } from "rxjs";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { BaseIdsCache } from "./caches/BaseIdsCache.js";
import { useIdsCache } from "./useTreeHooks/UseIdsCache.js";

import type { PropsWithChildren } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { BaseIdsCacheProps } from "./caches/BaseIdsCache.js";
import type { GetCacheProps } from "./useTreeHooks/UseIdsCache.js";

/** @internal */
interface SharedTreeContextInternal {
  getCache: <TCache extends object = {}>(props: GetCacheProps<TCache>) => TCache;
  getBaseIdsCache: (props: Omit<BaseIdsCacheProps, "queryExecutor"> & { imodel: IModelConnection }) => BaseIdsCache;
  cancelChangesInProgress: Subject<void>;
  changesInProgress: Set<Promise<void>>;
  updateChangesInProgress: (promise: Promise<void>, action: "add" | "remove") => void;
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
  const [cancelChangesInProgress] = useState(() => new Subject<void>());
  const [changesInProgress, setOngoing] = useState(() => new Set<Promise<void>>());
  const updateChangesInProgress = useCallback(
    (promise: Promise<void>, action: "add" | "remove") => {
      if (action === "add") {
        setOngoing((prev) => new Set(prev).add(promise));
        return;
      }
      setOngoing((prev) => {
        const newSet = new Set(prev);
        newSet.delete(promise);
        return newSet;
      });
    },
    [setOngoing],
  );
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
  return (
    <treeWidgetContextInternal.Provider value={{ getCache, getBaseIdsCache, cancelChangesInProgress, changesInProgress, updateChangesInProgress }}>
      {children}
    </treeWidgetContextInternal.Provider>
  );
}
