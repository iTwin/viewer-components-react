/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useRef, useState } from "react";
import { registerTxnListeners } from "@itwin/presentation-core-interop";

import type { IModelConnection } from "@itwin/core-frontend";

type IModelKey = string;
type IdsProviderKey = string;

/** @internal */
export interface GetIdsProviderProps<TIdsProvider> {
  createIdsProvider: () => TIdsProvider;
  idsProviderKey: IdsProviderKey;
  imodel: IModelConnection;
}

/** @internal */
export function useIdsProvider(): {
  getIdsProvider: <TIdsProvider extends object = {}>(props: GetIdsProviderProps<TIdsProvider>) => TIdsProvider;
} {
  const state = useRef<Record<IModelKey, Record<IdsProviderKey, object>>>({});
  const [forceRerender, setForceRerender] = useState({});
  const getIdsProvider = useCallback(
    <TIdsProvider extends object = {}>({ createIdsProvider, idsProviderKey, imodel }: GetIdsProviderProps<TIdsProvider>) => {
      const imodelIdsProviders = state.current[imodel.key];
      if (imodelIdsProviders && imodelIdsProviders[idsProviderKey]) {
        return imodelIdsProviders[idsProviderKey] as TIdsProvider;
      }

      // Create the ids provider before adding event listeners, to avoid race conditions
      const idsProvider = createIdsProvider();
      state.current = { ...state.current, [imodel.key]: { ...state.current[imodel.key], [idsProviderKey]: idsProvider } };

      if (!imodelIdsProviders) {
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
      return idsProvider;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [forceRerender],
  );

  return {
    getIdsProvider,
  };
}
