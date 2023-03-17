/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./CategoriesTree.scss";
import React, { useEffect, useState } from "react";
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { IModelApp, IModelConnection, ScreenViewport } from "@itwin/core-frontend";
import { CategoryTree } from "./CategoriesTree";
import { Category, CategoryVisibilityHandler, useCategories } from "./CategoryVisibilityHandler";
import { enableCategory } from "../CategoriesVisibilityUtils";
import { useTreeFilteringState } from "../../TreeFilteringState";
import { AutoSizer } from "../../utils/AutoSizer";
import type { CategoriesTreeHeaderButtonProps, CategoriesTreeProps } from "../../../types";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import { IconButton } from "../../IconButton";
import { TreeWidget } from "../../../TreeWidget";
import { SearchBar } from "../../search-bar/SearchBar";

export function CategoriesTreeComponent(props: CategoriesTreeProps) {
  const iModel = useActiveIModelConnection();
  const viewport = useActiveViewport();

  if (!iModel || !viewport) {
    return null;
  }

  return (
    <CategoriesTreeComponentImpl {...props} iModel={iModel} viewport={viewport} />
  );
}

CategoriesTreeComponent.ShowAllButton = ShowAllButton;
CategoriesTreeComponent.HideAllButton = HideAllButton;
CategoriesTreeComponent.InvertButton = InvertButton;

function CategoriesTreeComponentImpl(props: CategoriesTreeProps & { iModel: IModelConnection, viewport: ScreenViewport }) {
  const categories = useCategories(IModelApp.viewManager, props.iModel, props.viewport);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>();
  const {
    searchOptions,
    filterString,
    activeMatchIndex,
    onFilterApplied,
    filteredProvider,
  } = useTreeFilteringState();

  useEffect(() => {
    (async () => {
      if (filteredProvider)
        setFilteredCategories((await getFilteredCategories(filteredProvider)).map((category) => ({ key: category })));
      else
        setFilteredCategories(undefined);
    })();
  }, [filteredProvider]);

  return (
    <>
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
        {props.headerButtons
          ? props.headerButtons.map((btn, index) =>
            <React.Fragment key={index}>
              {btn({ viewport: props.viewport, categories, filteredCategories })}
            </React.Fragment>)
          : [
            <ShowAllButton viewport={props.viewport} categories={categories} filteredCategories={filteredCategories} key="show-all-btn" />,
            <HideAllButton viewport={props.viewport} categories={categories} filteredCategories={filteredCategories} key="hide-all-btn" />,
            <InvertButton viewport={props.viewport} categories={categories} filteredCategories={filteredCategories} key="invert-all-btn" />,
          ]
        }
      </SearchBar>
      <AutoSizer>
        {({ width, height }) => (
          <CategoryTree
            {...props}
            categories={categories}
            width={width}
            height={height}
            filterInfo={{ filter: filterString, activeMatchIndex }}
            onFilterApplied={onFilterApplied}
          />
        )}
      </AutoSizer>
    </>
  );
}

async function getFilteredCategories(filteredProvider: IPresentationTreeDataProvider) {
  const nodes = await filteredProvider.getNodes();
  return nodes.map((node) => CategoryVisibilityHandler.getInstanceIdFromTreeNodeKey(filteredProvider.getNodeKey(node)));
}

function ShowAllButton(props: CategoriesTreeHeaderButtonProps) {
  const showAll = () => {
    enableCategory(
      IModelApp.viewManager,
      props.viewport.iModel,
      (props.filteredCategories ?? props.categories).map((category) => category.key),
      true,
      true,
    );
  };

  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      icon="icon-visibility"
      title={TreeWidget.translate("showAll")}
      onClick={showAll}
    />
  );
}

function HideAllButton(props: CategoriesTreeHeaderButtonProps) {
  const hideAll = () => {
    enableCategory(
      IModelApp.viewManager,
      props.viewport.iModel,
      (props.filteredCategories ?? props.categories).map((category) => category.key),
      false,
      true,
    );
  };

  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      icon="icon-visibility-hide-2"
      title={TreeWidget.translate("hideAll")}
      onClick={hideAll}
    />
  );
}

function InvertButton(props: CategoriesTreeHeaderButtonProps) {
  const invert = () => {
    const ids = (props.filteredCategories ?? props.categories).map((category) => category.key);

    const enabled: string[] = [];
    const disabled: string[] = [];
    for (const id of ids) {
      if (props.viewport.view.viewsCategory(id)) {
        enabled.push(id);
      } else {
        disabled.push(id);
      }
    }
    // Disable enabled
    enableCategory(
      IModelApp.viewManager,
      props.viewport.iModel,
      enabled,
      false,
      true
    );

    // Enable disabled
    enableCategory(
      IModelApp.viewManager,
      props.viewport.iModel,
      disabled,
      true,
      true
    );
  };

  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      title={TreeWidget.translate("invert")}
      icon="icon-visibility-invert"
      onClick={invert}
    />
  );
}
