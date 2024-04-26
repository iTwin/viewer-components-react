/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "../VisibilityTreeBase.scss";
import classNames from "classnames";
import { Fragment, useEffect, useState } from "react";
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { SvgVisibilityHalf, SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";
import { TreeWidget } from "../../../TreeWidget";
import { TreeHeader } from "../../tree-header/TreeHeader";
import { useTreeFilteringState } from "../../TreeFilteringState";
import { AutoSizer } from "../../utils/AutoSizer";
import { CategoryTree } from "./CategoriesTree";
import { CategoryVisibilityHandler, hideAllCategories, invertAllCategories, showAllCategories, useCategories } from "./CategoryVisibilityHandler";

import type { IModelConnection, ScreenViewport } from "@itwin/core-frontend";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { TreeHeaderButtonProps } from "../../tree-header/TreeHeader";
import type { CategoryTreeProps } from "./CategoriesTree";
import type { CategoryInfo } from "./CategoryVisibilityHandler";
/**
 * Props that get passed to [[CategoriesTreeComponent]] header button renderer.
 * @see CategoriesTreeComponentProps.headerButtons
 * @public
 */
export interface CategoriesTreeHeaderButtonProps extends TreeHeaderButtonProps {
  /** A list of categories available in the iModel */
  categories: CategoryInfo[];
  /** In case the tree is filtered, a list of filtered categories. */
  filteredCategories?: CategoryInfo[];
}

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
  const contentClassName = classNames("tree-widget-tree-content", props.density === "enlarged" && "enlarge");

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
    <div className="tree-widget-tree-with-header">
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
      <div className={contentClassName}>
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

function ShowAllButton(props: CategoriesTreeHeaderButtonProps) {
  return (
    <IconButton
      size={props.density === "enlarged" ? "large" : "small"}
      styleType="borderless"
      title={TreeWidget.translate("showAll")}
      onClick={() => {
        props.onFeatureUsed?.(`${CategoriesTreeComponent.id}-showall`);
        void showAllCategories(
          (props.filteredCategories ?? props.categories).map((category) => category.categoryId),
          props.viewport,
        );
      }}
    >
      <SvgVisibilityShow />
    </IconButton>
  );
}

function HideAllButton(props: CategoriesTreeHeaderButtonProps) {
  return (
    <IconButton
      size={props.density === "enlarged" ? "large" : "small"}
      styleType="borderless"
      title={TreeWidget.translate("hideAll")}
      onClick={() => {
        props.onFeatureUsed?.(`${CategoriesTreeComponent.id}-hideall`);
        void hideAllCategories(
          (props.filteredCategories ?? props.categories).map((category) => category.categoryId),
          props.viewport,
        );
      }}
    >
      <SvgVisibilityHide />
    </IconButton>
  );
}

function InvertAllButton(props: CategoriesTreeHeaderButtonProps) {
  return (
    <IconButton
      title={TreeWidget.translate("invert")}
      size={props.density === "enlarged" ? "large" : "small"}
      styleType="borderless"
      onClick={() => {
        props.onFeatureUsed?.(`${CategoriesTreeComponent.id}-invert`);
        void invertAllCategories(props.filteredCategories ?? props.categories, props.viewport);
      }}
    >
      <SvgVisibilityHalf />
    </IconButton>
  );
}
