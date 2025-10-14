/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useContext, useEffect, useState } from "react";
import { TreeWidgetIdsCache } from "./internal/TreeWidgetIdsCache.js";

import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { PropsWithChildren } from "react";

/** @internal */
interface TreeWidgetContext {
  treeWidgetIdsCache?: TreeWidgetIdsCache;
}

const treeWidgetContext = createContext<TreeWidgetContext>({ treeWidgetIdsCache: undefined });

/**
 * A React hook for getting focused instances context. The context must be provided
 * using `FocusedInstancesContextProvider`.
 *
 * @internal
 */
export function useTreeWidgetContext(): TreeWidgetContext {
  return useContext(treeWidgetContext);
}

/**
 * A React context provider for setting up tree widget context, which can then be acquired
 * using `useTreeWidgetContext` hook.
 *
 * @public
 */
export function TreeWidgetContextProvider({
  queryExecutor,
  children,
}: PropsWithChildren<{ queryExecutor: LimitingECSqlQueryExecutor; treeType: "2d" }>) {
  const [state, setState] = useState<TreeWidgetContext>({
    treeWidgetIdsCache: new TreeWidgetIdsCache(queryExecutor),
  });

  useEffect(() => {
    setState({ treeWidgetIdsCache: new TreeWidgetIdsCache(queryExecutor) });
  }, [queryExecutor])

  return <treeWidgetContext.Provider value={state}>{children}</treeWidgetContext.Provider>;
}
