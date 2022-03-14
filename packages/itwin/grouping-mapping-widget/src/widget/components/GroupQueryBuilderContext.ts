/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import type { PropertyRecord } from "@itwin/appui-abstract";
import { QueryBuilder } from "./QueryBuilder";

export interface PropertySelection {
  currentPropertyList: PropertyRecord[];
  setCurrentPropertyList: React.Dispatch<
  React.SetStateAction<PropertyRecord[]>
  >;
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  queryBuilder: QueryBuilder;
  setQueryBuilder: React.Dispatch<React.SetStateAction<QueryBuilder>>;
  isLoading: boolean;
  isRendering: boolean;
}
export const GroupQueryBuilderContext = React.createContext<PropertySelection>({
  currentPropertyList: [],
  setCurrentPropertyList: () => [],
  query: "",
  setQuery: () => "",
  queryBuilder: new QueryBuilder(undefined),
  setQueryBuilder: () => new QueryBuilder(undefined),
  isLoading: false,
  isRendering: false,
});
