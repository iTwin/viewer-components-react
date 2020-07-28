/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  IModelApp,
  IModelConnection,
  Viewport,
} from "@bentley/imodeljs-frontend";
import {
  CategoryTree,
  toggleAllCategories,
  getCategories,
} from "@bentley/ui-framework";
import { IconButton } from "../IconButton";
import { SearchBar } from "../search-bar/SearchBar";
import { useTreeFilteringState } from "../TreeFilteringState";
import "./CategoriesTree.scss";
import { TreeWidget } from "../../TreeWidget";
import { CategoryVisibilityHandler } from "@bentley/ui-framework/lib/ui-framework/imodel-components/category-tree/CategoryVisibilityHandler";

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

  const invert = React.useCallback(async () => {
    const activeView = IModelApp.viewManager.getFirstOpenView();
    if (!activeView) {
      return;
    }

    const ids = await getCategories(props.iModel, activeView, filteredProvider);
    let enabled: string[] = [];
    let disabled: string[] = [];
    for (const id of ids) {
      if (activeView.view.viewsCategory(id)) {
        enabled.push(id);
      } else {
        disabled.push(id);
      }
    }
    // Disabled enabled
    CategoryVisibilityHandler.enableCategory(
      IModelApp.viewManager,
      props.iModel,
      enabled,
      false,
      true
    );
    // Enable disabled
    CategoryVisibilityHandler.enableCategory(
      IModelApp.viewManager,
      props.iModel,
      disabled,
      true,
      true
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
            title={TreeWidget.translate("showAll")}
            onClick={showAll}
          />
          <IconButton
            className={"tree-widget-category-tree-toolbar-icon"}
            key="hide-all-btn"
            icon="icon-visibility-hide-2"
            title={TreeWidget.translate("hideAll")}
            onClick={hideAll}
          />
          <IconButton
            key="invert-all-btn"
            className={"tree-widget-models-tree-toolbar-icon"}
            title={TreeWidget.translate("invert")}
            icon="icon-visibility-invert"
            onClick={invert}
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
