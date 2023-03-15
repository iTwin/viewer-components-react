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
  treeHeaderButtons: React.ReactNode[];
}

export function TreeHeaderComponent({
  searchOptions,
  treeHeaderButtons,
}: TreeHeaderComponentProps) {
  return (
    <SearchBar
      value=""
      className="tree-widget-header-tree-search-bar"
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
      {treeHeaderButtons}
    </SearchBar>
  );
}
