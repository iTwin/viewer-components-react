/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

export interface Properties {
  showGroupColor: boolean;
  setShowGroupColor: (showGroupColor: boolean | ((showGroupColor: boolean) => boolean)) => void;
}

export const PropertiesContext = React.createContext<Properties>({
  showGroupColor: false,
  setShowGroupColor: () => { },
});

export const usePropertiesContext = (): Properties => {
  const context = React.useContext(PropertiesContext);
  if (!context) {
    throw new Error(
      "usePropertiesContext should be used within a PropertiesContext provider"
    );
  }
  return context;
};
