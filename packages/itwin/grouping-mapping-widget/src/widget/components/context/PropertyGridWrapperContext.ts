/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import type { PropertyRecord } from "@itwin/appui-abstract";
import type { QueryBuilder } from "../Groups/QueryBuilder/QueryBuilder";

export interface PropertySelection {
  currentPropertyList: PropertyRecord[];
  setCurrentPropertyList: (value: PropertyRecord[] | ((value: PropertyRecord[]) => PropertyRecord[])) => void;
  setQuery: (value: string) => void;
  queryBuilder?: QueryBuilder;
  isUpdating: boolean;
}

export const PropertyGridWrapperContext = React.createContext<PropertySelection>({
  currentPropertyList: [],
  setCurrentPropertyList: () => [],
  setQuery: () => "",
  isUpdating: false,
});

export const usePropertyGridWrapper = (): PropertySelection => {
  const context = React.useContext(PropertyGridWrapperContext);
  if (!context) {
    throw new Error(
      "usePropertyGridWrapperContext should be used within a PropertyGridWrapperContext provider"
    );
  }
  return context;
};
