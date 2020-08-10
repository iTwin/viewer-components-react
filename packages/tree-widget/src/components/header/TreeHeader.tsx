/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
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
  toggle2D?: () => void;
  toggle2DIcon?: string;
  toggle3D?: () => void;
  toggle3DIcon?: string;
  searchOptions: SearchOptions;
}

export function TreeHeaderComponent({
  searchOptions,
  showAll,
  hideAll,
  invert,
  toggle2D,
  toggle2DIcon,
  toggle3D,
  toggle3DIcon,
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
      <div>
        {showAll && (
          <IconButton
            className={"tree-widget-header-tree-toolbar-icon"}
            key="show-all-btn"
            icon="icon-visibility"
            title={TreeWidget.translate("showAll")}
            onClick={showAll}
          />
        )}
        {hideAll && (
          <IconButton
            className={"tree-widget-header-tree-toolbar-icon"}
            key="hide-all-btn"
            icon="icon-visibility-hide-2"
            title={TreeWidget.translate("hideAll")}
            onClick={hideAll}
          />
        )}
        {invert && (
          <IconButton
            key="invert-all-btn"
            className={"tree-widget-header-tree-toolbar-icon"}
            title={TreeWidget.translate("invert")}
            icon="icon-visibility-invert"
            onClick={invert}
          />
        )}
        {toggle2D && toggle2DIcon && (
          <IconButton
            className={"tree-widget-header-tree-toolbar-icon"}
            key="view-2d-btn"
            icon={toggle2DIcon}
            title={TreeWidget.translate("toggle2DViews")}
            onClick={toggle2D}
            label={TreeWidget.translate("label2D")}
          />
        )}
        {toggle3D && toggle3DIcon && (
          <IconButton
            className={"tree-widget-header-tree-toolbar-icon"}
            key="view-3d-btn"
            icon={toggle3DIcon}
            title={TreeWidget.translate("toggle3DViews")}
            onClick={toggle3D}
            label={TreeWidget.translate("label3D")}
          />
        )}
      </div>
    </SearchBar>
  );
}
