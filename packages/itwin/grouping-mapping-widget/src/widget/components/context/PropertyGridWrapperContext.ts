/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import type { PropertyRecord } from "@itwin/appui-abstract";
import type { QueryBuilder } from "../QueryBuilder";

export interface PropertySelection {
  currentPropertyList: PropertyRecord[];
  setCurrentPropertyList: React.Dispatch<
  React.SetStateAction<PropertyRecord[]>
  >;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  queryBuilder?: QueryBuilder;
  setQueryBuilder: React.Dispatch<React.SetStateAction<QueryBuilder | undefined>>;
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
