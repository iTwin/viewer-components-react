import * as React from "react";
import { IconButton } from "../IconButton";
import { SearchBar } from "../search-bar/SearchBar";
import { SearchOptions } from "../TreeFilteringState";
import { TreeWidget } from "../../TreeWidget";
import "./TreeHeader.scss";

export interface TreeHeaderComponentProps {
  showAll?: () => void;
  hideAll?: () => void;
  invert?: () => void;
  searchOptions: SearchOptions;
}

export function TreeHeaderComponent(props: TreeHeaderComponentProps) {
  const { searchOptions } = props;

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
        <div>
          {props.showAll &&
          <IconButton
            className={"tree-widget-header-tree-toolbar-icon"}
            key="show-all-btn"
            icon="icon-visibility"
            title={TreeWidget.translate("showAll")}
            onClick={props.showAll}
          />}
          {props.hideAll &&
          <IconButton
            className={"tree-widget-header-tree-toolbar-icon"}
            key="hide-all-btn"
            icon="icon-visibility-hide-2"
            title={TreeWidget.translate("hideAll")}
            onClick={props.hideAll}
          />}
          {props.invert &&
          <IconButton
            key="invert-all-btn"
            className={"tree-widget-header-tree-toolbar-icon"}
            title={TreeWidget.translate("invert")}
            icon="icon-visibility-invert"
            onClick={props.invert}
          />}
        </div>
      </SearchBar>
  )
}