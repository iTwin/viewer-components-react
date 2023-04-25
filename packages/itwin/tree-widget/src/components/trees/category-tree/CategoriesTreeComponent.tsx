/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "../VisibilityTreeBase.scss";
import React, { useEffect, useState } from "react";
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { IModelApp, IModelConnection, ScreenViewport } from "@itwin/core-frontend";
import { SvgVisibilityHalf, SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { CategoryTree, CategoryTreeProps } from "./CategoriesTree";
import { CategoryInfo, CategoryVisibilityHandler, hideAllCategories, invertAllCategories, showAllCategories, useCategories } from "./CategoryVisibilityHandler";
import { useTreeFilteringState } from "../../TreeFilteringState";
import { AutoSizer } from "../../utils/AutoSizer";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import { TreeWidget } from "../../../TreeWidget";
import { TreeHeader, TreeHeaderButtonProps } from "../../tree-header/TreeHeader";

export interface CategoriesTreeHeaderButtonProps extends TreeHeaderButtonProps {
  categories: CategoryInfo[];
  filteredCategories?: CategoryInfo[];
}

export interface CategoriesTreeComponentProps extends Omit<CategoryTreeProps,
| "iModel"
| "activeView"
| "width"
| "height"
| "filterInfo"
| "onFilterApplied"
| "categories"
| "viewManager"
> {
  headerButtons?: Array<(props: CategoriesTreeHeaderButtonProps) => React.ReactNode>;
}

export function CategoriesTreeComponent(props: CategoriesTreeComponentProps) {
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
CategoriesTreeComponent.InvertAllButton = InvertAllButton;
CategoriesTreeComponent.id = "categories-tree";
CategoriesTreeComponent.getLabel = () => TreeWidget.translate("categories");

function CategoriesTreeComponentImpl(props: CategoriesTreeComponentProps & { iModel: IModelConnection, viewport: ScreenViewport }) {
  const categories = useCategories(IModelApp.viewManager, props.iModel, props.viewport);
  const [filteredCategories, setFilteredCategories] = useState<CategoryInfo[]>();
  const {
    searchOptions,
    filterString,
    onFilterApplied,
    filteredProvider,
  } = useTreeFilteringState();

  useEffect(() => {
    (async () => {
      if (filteredProvider)
        setFilteredCategories((await getFilteredCategories(filteredProvider, filterString)));
      else
        setFilteredCategories(undefined);
    })();
  }, [filteredProvider, filterString]);

  return (
    <>
      <TreeHeader
        placeholder={TreeWidget.translate("search")}
        title={TreeWidget.translate("searchForSomething")}
        onFilterClear={searchOptions.onFilterCancel}
        onFilterStart={searchOptions.onFilterStart}
        onSelectedChanged={searchOptions.onResultSelectedChanged}
        resultCount={searchOptions.matchedResultCount}
        selectedIndex={searchOptions.activeMatchIndex}
      >
        {props.headerButtons
          ? props.headerButtons.map(
            (btn, index) =>
              <React.Fragment key={index}>
                {btn({ viewport: props.viewport, categories, filteredCategories })}
              </React.Fragment>
          )
          : [
            <ShowAllButton viewport={props.viewport} categories={categories} filteredCategories={filteredCategories} key="show-all-btn" />,
            <HideAllButton viewport={props.viewport} categories={categories} filteredCategories={filteredCategories} key="hide-all-btn" />,
            <InvertAllButton viewport={props.viewport} categories={categories} filteredCategories={filteredCategories} key="invert-all-btn" />,
          ]
        }
      </TreeHeader>
      <AutoSizer>
        {({ width, height }) => (
          <CategoryTree
            {...props}
            categories={categories}
            width={width}
            height={height}
            filterInfo={{ filter: filterString, activeMatchIndex: searchOptions.activeMatchIndex }}
            onFilterApplied={onFilterApplied}
            activeView={props.viewport}
          />
        )}
      </AutoSizer>
    </>
  );
}

async function getFilteredCategories(filteredProvider: IPresentationTreeDataProvider, filterString: string) {
  const filteredCategories: CategoryInfo[] = [];
  const filteredNodePaths = await filteredProvider.getFilteredNodePaths(filterString);
  for (const filteredNodePath of filteredNodePaths) {
    const filteredCategoryId = CategoryVisibilityHandler.getInstanceIdFromTreeNodeKey(filteredNodePath.node.key);
    const filteredSubCategoriesIds: string[] = [];
    for (const filteredNodePathChildren of filteredNodePath.children) {
      filteredSubCategoriesIds.push(CategoryVisibilityHandler.getInstanceIdFromTreeNodeKey(filteredNodePathChildren.node.key));
    }
    filteredCategories.push({ categoryId: filteredCategoryId, subCategoryIds: filteredSubCategoriesIds });
  }
  return filteredCategories;
}

function ShowAllButton(props: CategoriesTreeHeaderButtonProps) {
  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      size="small"
      styleType="borderless"
      title={TreeWidget.translate("showAll")}
      onClick={() => void showAllCategories(props)}
    >
      <SvgVisibilityShow />
    </IconButton>
  );
}

function HideAllButton(props: CategoriesTreeHeaderButtonProps) {
  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      size="small"
      styleType="borderless"
      title={TreeWidget.translate("hideAll")}
      onClick={() => void hideAllCategories(props)}
    >
      <SvgVisibilityHide />
    </IconButton>
  );
}

function InvertAllButton(props: CategoriesTreeHeaderButtonProps) {
  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      title={TreeWidget.translate("invert")}
      size="small"
      styleType="borderless"
      onClick={() => void invertAllCategories(props)}
    >
      <SvgVisibilityHalf />
    </IconButton>
  );
}
