/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "../VisibilityTreeBase.scss";
import classNames from "classnames";
import { Fragment, useEffect, useState } from "react";
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";
import { TreeWidget } from "../../../TreeWidget";
import { TreeHeader } from "../../tree-header/TreeHeader";
import { useTreeFilteringState } from "../../TreeFilteringState";
import { AutoSizer } from "../../utils/AutoSizer";
import { CategoryTree } from "./CategoriesTree";
import { HideAllButton, InvertAllButton, ShowAllButton } from "./CategoriesTreeButtons";
import { CategoryVisibilityHandler, useCategories } from "./CategoryVisibilityHandler";

import type { CategoriesTreeHeaderButtonProps, CategoryInfo } from "./CategoriesTreeButtons";
import type { IModelConnection, ScreenViewport } from "@itwin/core-frontend";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { CategoryTreeProps } from "./CategoriesTree";

/**
 * Props for [[CategoriesTreeComponent]].
 * @public
 */
export interface CategoriesTreeComponentProps
  extends Omit<
    CategoryTreeProps,
    "iModel" | "activeView" | "width" | "height" | "filterInfo" | "onFilterApplied" | "categories" | "categoryVisibilityHandler" | "viewManager"
  > {
  /**
   * Renderers of header buttons. Defaults to:
   * ```ts
   * [
   *   CategoriesTreeComponent.ShowAllButton,
   *   CategoriesTreeComponent.HideAllButton,
   *   CategoriesTreeComponent.InvertAllButton,
   * ]
   * ```
   */
  headerButtons?: Array<(props: CategoriesTreeHeaderButtonProps) => React.ReactNode>;
}

/**
 * A component that renders [[CategoriesTree]] and a header with filtering capabilities
 * and header buttons.
 * @public
 */
export const CategoriesTreeComponent = (props: CategoriesTreeComponentProps) => {
  const iModel = useActiveIModelConnection();
  const viewport = useActiveViewport();

  if (!iModel || !viewport) {
    return null;
  }

  return <CategoriesTreeComponentImpl {...props} iModel={iModel} viewport={viewport} />;
};

/**
 * Renders a "Show all" button that enables display of all categories and their subcategories.
 * @public
 */
CategoriesTreeComponent.ShowAllButton = ShowAllButton;

/**
 * Renders a "Hide all" button that disables display of all categories.
 * @public
 */
CategoriesTreeComponent.HideAllButton = HideAllButton;

/**
 * Renders an "Invert all" button that inverts display of all categories.
 * @public
 */
CategoriesTreeComponent.InvertAllButton = InvertAllButton;

/**
 * Id of the component. May be used when a creating a [[TreeDefinition]] for [[SelectableTree]].
 * @public
 */
CategoriesTreeComponent.id = "categories-tree";

/**
 * Label of the component. May be used when a creating a [[TreeDefinition]] for [[SelectableTree]].
 * @public
 */
CategoriesTreeComponent.getLabel = () => TreeWidget.translate("categories");

function CategoriesTreeComponentImpl(props: CategoriesTreeComponentProps & { iModel: IModelConnection; viewport: ScreenViewport }) {
  const categories = useCategories(IModelApp.viewManager, props.iModel, props.viewport);
  const [filteredCategories, setFilteredCategories] = useState<CategoryInfo[]>();
  const { searchOptions, filterString, onFilterApplied, filteredProvider } = useTreeFilteringState();

  useEffect(() => {
    void (async () => {
      if (filteredProvider) {
        setFilteredCategories(await getFilteredCategories(filteredProvider));
      } else {
        setFilteredCategories(undefined);
      }
    })();
  }, [filteredProvider]);

  return (
    <div className={classNames("tree-widget-tree-with-header", props.density === "enlarged" && "enlarge")}>
      <TreeHeader
        onFilterClear={searchOptions.onFilterCancel}
        onFilterStart={searchOptions.onFilterStart}
        onSelectedChanged={searchOptions.onResultSelectedChanged}
        resultCount={searchOptions.matchedResultCount}
        selectedIndex={searchOptions.activeMatchIndex}
        density={props.density}
      >
        {props.headerButtons
          ? props.headerButtons.map((btn, index) => (
              <Fragment key={index}>
                {btn({ viewport: props.viewport, categories, filteredCategories, density: props.density, onFeatureUsed: props.onFeatureUsed })}
              </Fragment>
            ))
          : [
              <ShowAllButton
                viewport={props.viewport}
                categories={categories}
                filteredCategories={filteredCategories}
                key="show-all-btn"
                density={props.density}
                onFeatureUsed={props.onFeatureUsed}
              />,
              <HideAllButton
                viewport={props.viewport}
                categories={categories}
                filteredCategories={filteredCategories}
                key="hide-all-btn"
                density={props.density}
                onFeatureUsed={props.onFeatureUsed}
              />,
              <InvertAllButton
                viewport={props.viewport}
                categories={categories}
                filteredCategories={filteredCategories}
                key="invert-all-btn"
                density={props.density}
                onFeatureUsed={props.onFeatureUsed}
              />,
            ]}
      </TreeHeader>
      <div className="tree-widget-tree-content">
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
      </div>
    </div>
  );
}

async function getFilteredCategories(filteredProvider: IPresentationTreeDataProvider) {
  const filteredCategories: CategoryInfo[] = [];
  const nodes = await filteredProvider.getNodes();
  for (const node of nodes) {
    if (!isPresentationTreeNodeItem(node)) {
      continue;
    }
    const filteredCategoryId = CategoryVisibilityHandler.getInstanceIdFromTreeNodeKey(node.key);
    const filteredSubCategoriesIds = node.hasChildren
      ? (await filteredProvider.getNodes(node))
          .filter(isPresentationTreeNodeItem)
          .map((child) => CategoryVisibilityHandler.getInstanceIdFromTreeNodeKey(child.key))
      : [];
    filteredCategories.push({ categoryId: filteredCategoryId, subCategoryIds: filteredSubCategoriesIds });
  }
  return filteredCategories;
}
