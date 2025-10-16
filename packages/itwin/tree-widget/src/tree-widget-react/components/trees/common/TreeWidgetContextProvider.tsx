/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useContext, useEffect, useState } from "react";
import { TreeWidgetIdsCache } from "./internal/TreeWidgetIdsCache.js";

import type { PropsWithChildren } from "react";
import type { IModelConnection } from "@itwin/core-frontend";

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
 * A React context provider for setting up tree widget context. Use this context provider to wrap T
 *
 * @public
 */
export function TreeWidgetContextProvider({ imodelConnection, children }: PropsWithChildren<{ imodelConnection: IModelConnection }>) {
  const [state, setState] = useState<TreeWidgetContext>({
    treeWidgetIdsCache: new TreeWidgetIdsCache(imodelConnection),
  });

  useEffect(() => {
    setState({ treeWidgetIdsCache: new TreeWidgetIdsCache(imodelConnection) });
  }, [imodelConnection]);

  return <treeWidgetContext.Provider value={state}>{children}</treeWidgetContext.Provider>;
}
