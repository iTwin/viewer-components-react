/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useContext, useState } from "react";
import { IModelAppUserPreferencesStorage } from "./api/PreferencesStorage.js";

import type { PropsWithChildren } from "react";
import type { PreferencesStorage } from "./api/PreferencesStorage.js";

/** @internal */
export interface PreferencesContext {
  storage: PreferencesStorage;
}

const preferencesContext = createContext<PreferencesContext>({ storage: new IModelAppUserPreferencesStorage() });

/** @internal */
export interface PreferencesContextProviderProps {
  storage?: PreferencesStorage;
}

/** @internal */
export function PreferencesContextProvider({ storage, children }: PropsWithChildren<PreferencesContextProviderProps>) {
  const [contextValue] = useState(() => ({
    storage: storage ?? new IModelAppUserPreferencesStorage(),
  }));

  return <preferencesContext.Provider value={contextValue}>{children}</preferencesContext.Provider>;
}

/** @internal */
export function usePreferencesContext() {
  return useContext(preferencesContext);
}
