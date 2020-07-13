/*---------------------------------------------------------------------------------------------
right (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  IModelApp,
  IModelConnection,
  Viewport,
} from "@bentley/imodeljs-frontend";
import { CategoryTree, toggleAllCategories } from "@bentley/ui-framework";
import { IconButton } from "../IconButton";
import { SearchBar } from "../search-bar/SearchBar";
import { useTreeFilteringState } from "../TreeFilteringState";
import "./CategoriesTree.scss";
import { TreeWidget } from "../../TreeWidget";

export interface CategoriesTreeComponentProps {
  iModel: IModelConnection;
  allViewports?: boolean;
  activeView?: Viewport;
  enablePreloading?: boolean;
}

export function CategoriesTreeComponent(props: CategoriesTreeComponentProps) {
  const {
    searchOptions,
    filterString,
    activeMatchIndex,
    onFilterApplied,
    filteredProvider,
  } = useTreeFilteringState();

  const showAll = React.useCallback(async () => {
    return toggleAllCategories(
      IModelApp.viewManager,
      props.iModel,
      true,
      undefined,
      true,
      filteredProvider
    );
  }, [props.iModel, filteredProvider]);

  const hideAll = React.useCallback(async () => {
    return toggleAllCategories(
      IModelApp.viewManager,
      props.iModel,
      false,
      undefined,
      true,
      filteredProvider
    );
  }, [props.iModel, filteredProvider]);

  return (
    <>
      <SearchBar
        value=""
        className="tree-widget-category-tree-search-bar"
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
        <div className="viewer-categories-toolbar">
          <IconButton
            className={"tree-widget-category-tree-toolbar-icon"}
            key="show-all-btn"
            icon="icon-visibility"
            onClick={showAll}
          />
          <IconButton
            className={"tree-widget-category-tree-toolbar-icon"}
            key="hide-all-btn"
            icon="icon-visibility-hide-2"
            onClick={hideAll}
          />
        </div>
      </SearchBar>
      <CategoryTree
        {...props}
        enablePreloading={props.enablePreloading}
        filterInfo={{ filter: filterString, activeMatchIndex }}
        onFilterApplied={onFilterApplied}
      />
    </>
  );
}
