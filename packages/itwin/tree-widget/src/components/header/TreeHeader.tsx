/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { SearchBar } from "../search-bar/SearchBar";
import type { SearchOptions } from "../TreeFilteringState";
import { TreeWidget } from "../../TreeWidget";
import "./TreeHeader.scss";

export interface TreeHeaderComponentProps {
  searchOptions: SearchOptions;
  children: React.ReactNode;
}

export function TreeHeaderComponent({
  searchOptions,
  children,
}: TreeHeaderComponentProps) {
  return (
    <SearchBar
      value=""
      valueChangedDelay={500}
      placeholder={TreeWidget.translate("search")}
      title={TreeWidget.translate("searchForSomething")}
      filteringInProgress={searchOptions.isFiltering}
      onFilterCancel={searchOptions.onFilterCancel}
      onFilterClear={searchOptions.onFilterCancel}
      onFilterStart={searchOptions.onFilterStart}
      onSelectedChanged={searchOptions.onResultSelectedChanged}
      resultCount={searchOptions.matchedResultCount ?? 0}
    >
      {children}
    </SearchBar>
  );
}
