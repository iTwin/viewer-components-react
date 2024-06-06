/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "../VisibilityTreeBase.scss";
import classNames from "classnames";
import { useCallback, useEffect, useState } from "react";
import { SelectionMode } from "@itwin/components-react";
import { IModelApp } from "@itwin/core-frontend";
import { PresentationTree } from "@itwin/presentation-components";
import { Presentation } from "@itwin/presentation-frontend";
import { TreeWidget } from "../../../TreeWidget";
import { FilterableTreeRenderer } from "../common/TreeRenderer";
import { useFeatureReporting } from "../common/UseFeatureReporting";
import { usePerformanceReporting } from "../common/UsePerformanceReporting";
import { useVisibilityTreeState } from "../common/UseVisibilityTreeState";
import { addCustomTreeNodeItemLabelRenderer, combineTreeNodeItemCustomizations } from "../common/Utils";
import { createVisibilityTreeRenderer, FilterableVisibilityTreeNodeRenderer, VisibilityTreeNoFilteredData } from "../VisibilityTreeRenderer";
import { CategoriesTreeComponent } from "./CategoriesTreeComponent";
import { CategoryVisibilityHandler } from "./CategoryVisibilityHandler";

import type { CategoryInfo } from "./CategoriesTreeButtons";
import type { FilterableTreeNodeRendererProps } from "../common/TreeRenderer";
import type { IModelConnection, SpatialViewState, ViewManager, Viewport } from "@itwin/core-frontend";
import type { Ruleset } from "@itwin/presentation-common";
import type { IFilteredPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { BaseFilterableTreeProps, HierarchyLevelConfig } from "../common/Types";

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
export interface CategoryTreeProps extends BaseFilterableTreeProps {
  /** Flag for accommodating all viewports */
  allViewports?: boolean;
  /** Active viewport */
  activeView: Viewport;
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
  /**
   * Props for configuring hierarchy level.
   * @beta
   */
  hierarchyLevelConfig?: HierarchyLevelConfig;
  /**
   * Callback that is invoked when performance of tracked feature is measured.
   * @param featureId ID of the feature.
   * @param elapsedTime Elapsed time of the feature.
   * @beta
   */
  onPerformanceMeasured?: (featureId: string, elapsedTime: number) => void;
  /**
   * Callback that is invoked when a tracked feature is used.
   * @param featureId ID of the feature.
   * @beta
   */
  onFeatureUsed?: (feature: string) => void;
}

/**
 * Tree which displays and manages display of categories contained in an iModel.
 * @public
 */
export function CategoryTree(props: CategoryTreeProps) {
  // istanbul ignore next
  const viewManager = props.viewManager ?? IModelApp.viewManager;
  const { activeView, allViewports, categoryVisibilityHandler, onFilterApplied, density, hierarchyLevelConfig, onPerformanceMeasured, onFeatureUsed } = props;

  const visibilityHandler = useCategoryVisibilityHandler(viewManager, props.iModel, props.categories, activeView, allViewports, categoryVisibilityHandler);
  const onFilterChange = useCallback(
    (dataProvider?: IFilteredPresentationTreeDataProvider, matchesCount?: number) => {
      if (onFilterApplied && dataProvider && matchesCount !== undefined) {
        onFilterApplied(dataProvider, matchesCount);
      }
    },
    [onFilterApplied],
  );

  const { reportUsage } = useFeatureReporting({ treeIdentifier: CategoriesTreeComponent.id, onFeatureUsed });
  const { onNodeLoaded } = usePerformanceReporting({
    treeIdentifier: CategoriesTreeComponent.id,
    onPerformanceMeasured,
  });

  const state = useVisibilityTreeState({
    imodel: props.iModel,
    ruleset: RULESET_CATEGORIES,
    pagingSize: PAGING_SIZE,
    visibilityHandler,
    customizeTreeNodeItem,
    filterInfo: props.filterInfo,
    onFilterChange,
    hierarchyLevelSizeLimit: hierarchyLevelConfig?.sizeLimit,
    enableHierarchyAutoUpdate: true,
    onNodeLoaded,
    reportUsage,
  });

  useEffect(() => {
    setViewType(activeView); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [activeView]);

  const baseRendererProps = {
    reportUsage,
    contextMenuItems: props.contextMenuItems,
    nodeLabelRenderer: props.nodeLabelRenderer,
    density: props.density,
    nodeRendererProps: {
      iconsEnabled: false,
      descriptionEnabled: true,
      levelOffset: 10,
      onVisibilityToggled: () => reportUsage({ featureId: "visibility-change", reportInteraction: true }),
    },
  };

  const noFilteredDataRenderer = useCallback(() => {
    return (
      <VisibilityTreeNoFilteredData
        title={TreeWidget.translate("categoriesTree.noCategoryFound")}
        message={TreeWidget.translate("categoriesTree.noMatchingCategoryNames")}
      />
    );
  }, []);

  if (!state) {
    return null;
  }

  const isFilterApplied = state.filteringResult?.filteredProvider !== undefined;
  const overlay = state.filteringResult?.isFiltering ? <div className="filteredTreeOverlay" /> : undefined;
  return (
    <div className={classNames("tree-widget-visibility-tree-base", "tree-widget-tree-container")}>
      <PresentationTree
        width={props.width}
        height={props.height}
        state={state}
        selectionMode={props.selectionMode ?? SelectionMode.None}
        treeRenderer={
          hierarchyLevelConfig?.isFilteringEnabled
            ? (rendererProps) => (
                <FilterableTreeRenderer
                  {...rendererProps}
                  {...baseRendererProps}
                  nodeLoader={state.nodeLoader}
                  nodeRenderer={(nodeProps) => <CategoriesTreeNodeRenderer {...nodeProps} density={density} />}
                />
              )
            : createVisibilityTreeRenderer(baseRendererProps)
        }
        descriptionsEnabled={true}
        noDataRenderer={isFilterApplied ? noFilteredDataRenderer : undefined}
      />
      {overlay}
    </div>
  );
}

interface CategoriesTreeNodeRendererProps extends FilterableTreeNodeRendererProps {
  density?: "default" | "enlarged";
}

function CategoriesTreeNodeRenderer(props: CategoriesTreeNodeRendererProps) {
  return (
    <FilterableVisibilityTreeNodeRenderer
      {...props}
      iconsEnabled={false}
      descriptionEnabled={true}
      levelOffset={10}
      isEnlarged={props.density === "enlarged"}
      onVisibilityToggled={() => props.reportUsage?.({ featureId: "visibility-change", reportInteraction: true })}
    />
  );
}

function useCategoryVisibilityHandler(
  viewManager: ViewManager,
  imodel: IModelConnection,
  categories: CategoryInfo[],
  activeView: Viewport,
  allViewports?: boolean,
  visibilityHandler?: CategoryVisibilityHandler,
) {
  const [state, setState] = useState<CategoryVisibilityHandler>();

  useEffect(() => {
    if (visibilityHandler) {
      return;
    }

    const defaultHandler = new CategoryVisibilityHandler({ viewManager, imodel, categories, activeView, allViewports });
    setState(defaultHandler);
    return () => {
      defaultHandler.dispose();
    };
  }, [viewManager, imodel, categories, activeView, allViewports, visibilityHandler]);

  return visibilityHandler ?? state;
}

async function setViewType(activeView: Viewport) {
  const view = activeView.view as SpatialViewState;
  const viewType = view.is3d() ? "3d" : "2d";
  await Presentation.presentation.vars(RULESET_CATEGORIES.id).setString("ViewType", viewType);
}

const customizeTreeNodeItem = combineTreeNodeItemCustomizations([addCustomTreeNodeItemLabelRenderer]);
