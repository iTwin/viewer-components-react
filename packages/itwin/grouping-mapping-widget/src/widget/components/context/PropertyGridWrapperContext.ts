/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import type { PropertyRecord } from "@itwin/appui-abstract";
import type { QueryBuilder } from "../QueryBuilder";

export interface PropertySelection {
  currentPropertyList: PropertyRecord[];
  setCurrentPropertyList: (value: PropertyRecord[]) => void;
  setQuery: (value: string) => void;
  queryBuilder?: QueryBuilder;
  setQueryBuilder: (value: QueryBuilder | undefined) => void;
  isUpdating: boolean;
  resetView: () => Promise<void>;
}

export const PropertyGridWrapperContext = React.createContext<PropertySelection>({
  currentPropertyList: [],
  setCurrentPropertyList: () => [],
  setQuery: () => "",
  setQueryBuilder: () => undefined,
  isUpdating: false,
  resetView: async () => { },
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
