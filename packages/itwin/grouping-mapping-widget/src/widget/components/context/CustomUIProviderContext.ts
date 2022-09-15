/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { createContext, useContext } from "react";
import type { CustomUIProvider } from "../provider/CustomUIProvider";

export const createDefaultCustomUIProvider = (): CustomUIProvider[] => {
  return [];
};

export const createCustomUIProvider = (
  providers: CustomUIProvider[] | undefined,
): CustomUIProvider[] => {
  if (undefined === providers) {
    return [];
  }
  return providers;
};

export const CustomUIProviderContext = createContext<CustomUIProvider[]>([]);

export const useCustomUIProvider = () => {
  const context = useContext(CustomUIProviderContext);
  if (!context) {
    throw new Error(
      "useCustomUIProvider should be used within a CustomUIProviderContext provider",
    );
  }
  return context;
};
