/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "../VisibilityTreeBase.scss";
import { useCallback, useEffect } from "react";
import { ControlledTree, SelectionMode, useTreeModel } from "@itwin/components-react";
import { IModelApp } from "@itwin/core-frontend";
import { useDisposable } from "@itwin/core-react";
import { usePresentationTreeNodeLoader } from "@itwin/presentation-components";
import { Presentation } from "@itwin/presentation-frontend";
import { TreeWidget } from "../../../TreeWidget";
import { VisibilityTreeEventHandler } from "../VisibilityTreeEventHandler";
import { createVisibilityTreeRenderer, useVisibilityTreeFiltering, VisibilityTreeNoFilteredData } from "../VisibilityTreeRenderer";
import { CategoryVisibilityHandler } from "./CategoryVisibilityHandler";

import type { IModelConnection, SpatialViewState, ViewManager, Viewport } from "@itwin/core-frontend";
import type { Ruleset } from "@itwin/presentation-common";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { VisibilityTreeFilterInfo } from "../Common";
import type { CategoryInfo } from "./CategoryVisibilityHandler";

const PAGING_SIZE = 20;

/**
 * Presentation rules used by ControlledCategoriesTree
 * @internal
 */
export const RULESET_CATEGORIES: Ruleset = require("./Categories.json"); // eslint-disable-line @typescript-eslint/no-var-requires

/**
 * Properties for the [[CategoryTree]] component
 * @public
 */
export interface CategoryTreeProps {
  /** Flag for accommodating all viewports */
  allViewports?: boolean;
  /** Active viewport */
  activeView: Viewport;
  /**
   * An IModel to pull data from
   */
  iModel: IModelConnection;
  /** Width of the component */
  width: number;
  /** Height of the component */
  height: number;
  /**
   * Information for tree filtering.
   * @alpha
   */
  filterInfo?: VisibilityTreeFilterInfo;
  /**
   * Callback invoked when tree is filtered.
   */
  onFilterApplied?: (filteredDataProvider: IPresentationTreeDataProvider, matchesCount: number) => void;
  /**
   * Available iModel categories
   */
  categories: CategoryInfo[];
  /**
   * Custom category visibility handler to use for testing
   * @internal
   */
  categoryVisibilityHandler?: CategoryVisibilityHandler;
  /**
   * Custom view manager to use for testing
   * @internal
   */
  viewManager?: ViewManager;
}

/**
 * Tree which displays and manages display of categories contained in an iModel.
 * @public
 */
export function CategoryTree(props: CategoryTreeProps) {
  const { nodeLoader } = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    ruleset: RULESET_CATEGORIES,
    pagingSize: PAGING_SIZE,
  });

  const { filteredNodeLoader, isFiltering, nodeHighlightingProps } = useVisibilityTreeFiltering(nodeLoader, props.filterInfo, props.onFilterApplied);
  // istanbul ignore next
  const viewManager = props.viewManager ?? IModelApp.viewManager;
  const { activeView, allViewports, categoryVisibilityHandler } = props;
  const visibilityHandler = useCategoryVisibilityHandler(viewManager, props.iModel, props.categories, activeView, allViewports, categoryVisibilityHandler);

  useEffect(() => {
    setViewType(activeView); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [activeView]);

  const eventHandler = useDisposable(useCallback(() => new VisibilityTreeEventHandler({
    nodeLoader: filteredNodeLoader,
    visibilityHandler,
  }), [filteredNodeLoader, visibilityHandler]));

  const treeModel = useTreeModel(filteredNodeLoader.modelSource);
  const treeRenderer = createVisibilityTreeRenderer({ iconsEnabled: false, descriptionEnabled: true, levelOffset: 10 });
  const overlay = isFiltering ? <div className="filteredTreeOverlay" /> : undefined;
  const filterApplied = filteredNodeLoader !== nodeLoader;

  const noFilteredDataRenderer = useCallback(() => {
    return <VisibilityTreeNoFilteredData
      title={TreeWidget.translate("categoriesTree.noCategoryFound")}
      message={TreeWidget.translate("categoriesTree.noMatchingCategoryNames")}
    />;
  }, []);

  return (
    <div className="tree-widget-visibility-tree-base">
      <ControlledTree
        nodeLoader={filteredNodeLoader}
        model={treeModel}
        selectionMode={SelectionMode.None}
        eventsHandler={eventHandler}
        treeRenderer={treeRenderer}
        descriptionsEnabled={true}
        nodeHighlightingProps={nodeHighlightingProps}
        noDataRenderer={filterApplied ? noFilteredDataRenderer : undefined}
        width={props.width}
        height={props.height}
      />
      {overlay}
    </div>
  );
}

function useCategoryVisibilityHandler(viewManager: ViewManager, imodel: IModelConnection, categories: CategoryInfo[], activeView: Viewport, allViewports?: boolean, visibilityHandler?: CategoryVisibilityHandler) {
  const defaultVisibilityHandler = useDisposable(useCallback(
    () =>
      new CategoryVisibilityHandler({ viewManager, imodel, categories, activeView, allViewports }),
    [viewManager, imodel, categories, activeView, allViewports]),
  );
  // istanbul ignore next
  return visibilityHandler ?? defaultVisibilityHandler;
}

async function setViewType(activeView: Viewport) {
  const view = activeView.view as SpatialViewState;
  // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
  const viewType = view.is3d() ? "3d" : "2d"; // eslint-disable-line @itwin/no-internal
  await Presentation.presentation.vars(RULESET_CATEGORIES.id).setString("ViewType", viewType);
}
