/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useCallback, useContext, useState } from "react";
import { Subject } from "rxjs";
import { useIdsProvider } from "../internal/hooks/UseIdsProvider.js";
import { createIModelAccess } from "../internal/hooks/UseIModelAccess.js";
import { createSharedIdsProvider } from "../internal/idsProviders/SharedIdsProvider.js";

import type { PropsWithChildren } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { GetIdsProviderProps } from "../internal/hooks/UseIdsProvider.js";
import type { SharedIdsProvider, SharedIdsProviderProps } from "../internal/idsProviders/SharedIdsProvider.js";

type GetSharedIdsProviderProps = Omit<SharedIdsProviderProps, "imodelAccess"> & { imodel: IModelConnection };

/** @internal */
interface SharedTreeContext {
  getIdsProvider: <TIdsProvider extends object = {}>(props: GetIdsProviderProps<TIdsProvider>) => TIdsProvider;
  getSharedIdsProvider: (props: GetSharedIdsProviderProps) => SharedIdsProvider;
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
    ({ elementClassName, imodel, excludedElementClassNames, perspective }: GetSharedIdsProviderProps) => {
      return getIdsProvider({
        imodel,
        idsProviderKey: `${perspective}-${elementClassName}-${[...(excludedElementClassNames ?? [])].sort().join(",")}-SharedIdsProvider`,
        createIdsProvider: () =>
          createSharedIdsProvider({
            elementClassName,
            excludedElementClassNames,
            perspective,
            imodelAccess: createIModelAccess({ imodel, hierarchyLevelSizeLimit: "unbounded" }),
          }),
      });
    },
    [getIdsProvider],
  );
  return <sharedTreeContext.Provider value={{ getIdsProvider, getSharedIdsProvider, cancelChangesInProgress }}>{children}</sharedTreeContext.Provider>;
}
