/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

export interface PropertiesGroupColor {
  showGroupColor: boolean;
  setShowGroupColor: (showGroupColor: boolean | ((showGroupColor: boolean) => boolean)) => void;
}

export const PropertiesGroupColorContext = React.createContext<PropertiesGroupColor>({
  showGroupColor: false,
  setShowGroupColor: () => {},
});

export const usePropertiesGroupColorContext = (): PropertiesGroupColor => {
  const context = React.useContext(PropertiesGroupColorContext);
  if (!context) {
    throw new Error("usePropertiesGroupColorContext should be used within a PropertiesGroupColorContext provider");
  }
  return context;
};
