/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useCallback, useContext, useState } from "react";
import { Subject } from "rxjs";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { useIdsProvider } from "../internal/hooks/UseIdsProvider.js";
import { SharedIdsProvider } from "../internal/idsProviders/SharedIdsProvider.js";

import type { PropsWithChildren } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { GetIdsProviderProps } from "../internal/hooks/UseIdsProvider.js";
import type { SharedIdsProviderProps } from "../internal/idsProviders/SharedIdsProvider.js";

/** @internal */
interface SharedTreeContext {
  getIdsProvider: <TIdsProvider extends object = {}>(props: GetIdsProviderProps<TIdsProvider>) => TIdsProvider;
  getSharedIdsProvider: (props: Omit<SharedIdsProviderProps, "queryExecutor"> & { imodel: IModelConnection }) => SharedIdsProvider;
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
export function SharedTreeContextProvider({ children }: PropsWithChildren) {
  const { getIdsProvider } = useIdsProvider();
  const [cancelChangesInProgress] = useState(() => new Subject<void>());
  const getSharedIdsProvider = useCallback(
    ({ elementClassName, type, imodel, excludedElementClassNames }: Omit<SharedIdsProviderProps, "queryExecutor"> & { imodel: IModelConnection }) => {
      return getIdsProvider({
        imodel,
        idsProviderKey: `${type}-${elementClassName}-${[...(excludedElementClassNames ?? [])].sort().join(",")}-SharedIdsProvider`,
        createIdsProvider: () => new SharedIdsProvider({ elementClassName, type, excludedElementClassNames, queryExecutor: createECSqlQueryExecutor(imodel) }),
      });
    },
    [getIdsProvider],
  );
  return <sharedTreeContext.Provider value={{ getIdsProvider, getSharedIdsProvider, cancelChangesInProgress }}>{children}</sharedTreeContext.Provider>;
}
