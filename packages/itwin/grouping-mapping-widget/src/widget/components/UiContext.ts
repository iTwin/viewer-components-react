/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

export interface UiContextProps {
  lastGroupMode: string;
  setGroupMode: React.Dispatch<React.SetStateAction<string>>;
}

export const UiContext = React.createContext<UiContextProps>({
  lastGroupMode: "Selection",
  setGroupMode: () => "Selection"
});
