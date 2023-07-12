/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "../VisibilityTreeBase.scss";
import { useCallback, useEffect, useMemo } from "react";
import { ControlledTree, SelectionMode, useTreeModel } from "@itwin/components-react";
import { useDisposable } from "@itwin/core-react";
import { isPresentationTreeNodeItem, usePresentationTreeNodeLoader } from "@itwin/presentation-components";
import { TreeWidget } from "../../../TreeWidget";
import { ClassGroupingOption } from "../Common";
import { VisibilityTreeEventHandler } from "../VisibilityTreeEventHandler";
import { createVisibilityTreeRenderer, useVisibilityTreeFiltering, VisibilityTreeNoFilteredData } from "../VisibilityTreeRenderer";
import { ModelsVisibilityHandler, SubjectModelIdsCache } from "./ModelsVisibilityHandler";
import { createRuleset, createSearchRuleset } from "./Utils";

import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { SingleSchemaClassSpecification } from "@itwin/presentation-common";
import type { IFilteredPresentationTreeDataProvider, IPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { BaseFilterableTreeProps } from "../Common";
import type { ModelsTreeSelectionPredicate } from "./ModelsVisibilityHandler";
import type { TreeContextMenuProps } from "../ContextMenu";

const PAGING_SIZE = 20;

/**
 * Props for configuring the hierarchy in [[ModelsTree]].
 * @public
 */
export interface ModelsTreeHierarchyConfiguration {
  /** Should the tree group displayed element nodes by class. Defaults to `ClassGroupingOption.No`. */
  enableElementsClassGrouping?: ClassGroupingOption;
  /**
   * Defines the `bis.GeometricElement3d` sub-class that should be used to load element nodes.
   * Defaults to `bis.GeometricElement3d`. It's expected for the given class to derive from it.
   */
  elementClassSpecification?: SingleSchemaClassSpecification;
  /** Should the tree show models without elements. */
  showEmptyModels?: boolean;
}

/**
 * Props for [[ModelsTree]] component.
 * @public
 */
export interface ModelsTreeProps extends BaseFilterableTreeProps, TreeContextMenuProps {
  /**
   * Predicate which indicates whether node can be selected or no
   */
  selectionPredicate?: ModelsTreeSelectionPredicate;
  /**
   * Active view used to determine and control visibility
   */
  activeView: Viewport;
  /**
   * Ref to the root HTML element used by this component
   */
  rootElementRef?: React.Ref<HTMLDivElement>;
  /**
   * Configuration options for the hierarchy loaded in the component.
   */
  hierarchyConfig?: ModelsTreeHierarchyConfiguration;
  /**
   * Auto-update the hierarchy when data in the iModel changes.
   * @alpha
   */
  enableHierarchyAutoUpdate?: boolean;
  /**
   * Custom visibility handler.
   */
  modelsVisibilityHandler?: ModelsVisibilityHandler;
}

/**
 * A tree component that shows a subject - model - category - element
 * hierarchy along with checkboxes that represent and allow changing
 * the display of those instances.
 * @public
 */
export function ModelsTree(props: ModelsTreeProps) {
  const { nodeLoader, onItemsRendered } = useModelsTreeNodeLoader(props);
  const { filteredNodeLoader, isFiltering, nodeHighlightingProps } = useVisibilityTreeFiltering(nodeLoader, props.filterInfo, props.onFilterApplied);
  const filterApplied = filteredNodeLoader !== nodeLoader;

  const { activeView, modelsVisibilityHandler, selectionPredicate } = props;

  const visibilityHandler = useVisibilityHandler(
    nodeLoader.dataProvider.rulesetId,
    props.iModel,
    activeView,
    modelsVisibilityHandler,
    getFilteredDataProvider(filteredNodeLoader.dataProvider),
    props.enableHierarchyAutoUpdate);
  const eventHandler = useDisposable(useCallback(() => new VisibilityTreeEventHandler({
    nodeLoader: filteredNodeLoader,
    visibilityHandler,
    selectionPredicate: (node) => !selectionPredicate || !isPresentationTreeNodeItem(node) ? true : selectionPredicate(node.key, ModelsVisibilityHandler.getNodeType(node)),
  }), [filteredNodeLoader, visibilityHandler, selectionPredicate]));

  const treeModel = useTreeModel(filteredNodeLoader.modelSource);
  const treeRenderer = createVisibilityTreeRenderer({
    contextMenuItems: props.contextMenuItems,
    nodeRendererProps: {
      iconsEnabled: true,
      descriptionEnabled: false,
      levelOffset: 10,
      disableRootNodeCollapse: true,
    },
  });

  const overlay = isFiltering ? <div className="filteredTreeOverlay" /> : undefined;

  // istanbul ignore next
  const noFilteredDataRenderer = useCallback(() => {
    return <VisibilityTreeNoFilteredData
      title={TreeWidget.translate("modelTree.noModelFound")}
      message={TreeWidget.translate("modelTree.noMatchingModelNames")}
    />;
  }, []);

  return (
    <div className="tree-widget-visibility-tree-base" ref={props.rootElementRef}>
      <ControlledTree
        nodeLoader={filteredNodeLoader}
        model={treeModel}
        selectionMode={props.selectionMode || SelectionMode.None}
        eventsHandler={eventHandler}
        treeRenderer={treeRenderer}
        nodeHighlightingProps={nodeHighlightingProps}
        noDataRenderer={filterApplied ? noFilteredDataRenderer : undefined}
        onItemsRendered={onItemsRendered}
        width={props.width}
        height={props.height}
      />
      {overlay}
    </div>
  );
}

function useModelsTreeNodeLoader(props: ModelsTreeProps) {
  const rulesets = {
    general: useMemo(() => createRuleset({
      enableElementsClassGrouping: !!props.hierarchyConfig?.enableElementsClassGrouping,
      elementClassSpecification: props.hierarchyConfig?.elementClassSpecification,
      showEmptyModels: props.hierarchyConfig?.showEmptyModels,
    }), [props.hierarchyConfig?.enableElementsClassGrouping, props.hierarchyConfig?.elementClassSpecification, props.hierarchyConfig?.showEmptyModels]),
    search: useMemo(() => createSearchRuleset({
      elementClassSpecification: props.hierarchyConfig?.elementClassSpecification,
      showEmptyModels: props.hierarchyConfig?.showEmptyModels,
    }), [props.hierarchyConfig?.elementClassSpecification, props.hierarchyConfig?.showEmptyModels]),
  };

  const { nodeLoader, onItemsRendered } = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    ruleset: rulesets.general,
    appendChildrenCountForGroupingNodes: (props.hierarchyConfig?.enableElementsClassGrouping === ClassGroupingOption.YesWithCounts),
    pagingSize: PAGING_SIZE,
    enableHierarchyAutoUpdate: props.enableHierarchyAutoUpdate,
  });
  const { nodeLoader: searchNodeLoader, onItemsRendered: onSearchItemsRendered } = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    ruleset: rulesets.search,
    pagingSize: PAGING_SIZE,
    enableHierarchyAutoUpdate: props.enableHierarchyAutoUpdate,
  });

  const activeNodeLoader = props.filterInfo?.filter ? searchNodeLoader : nodeLoader;
  const activeItemsRenderedCallback = props.filterInfo?.filter ? onSearchItemsRendered : onItemsRendered;

  return {
    nodeLoader: activeNodeLoader,
    onItemsRendered: activeItemsRenderedCallback,
  };
}

function useVisibilityHandler(
  rulesetId: string,
  iModel: IModelConnection,
  activeView: Viewport,
  visibilityHandler?: ModelsVisibilityHandler,
  filteredDataProvider?: IFilteredPresentationTreeDataProvider,
  hierarchyAutoUpdateEnabled?: boolean,
) {
  const subjectModelIdsCache = useMemo(() => new SubjectModelIdsCache(iModel), [iModel]);

  const defaultVisibilityHandler = useDisposable(useCallback(
    () =>
      new ModelsVisibilityHandler({ rulesetId, viewport: activeView, hierarchyAutoUpdateEnabled, subjectModelIdsCache }),
    [rulesetId, activeView, subjectModelIdsCache, hierarchyAutoUpdateEnabled])
  );

  const handler = visibilityHandler ?? defaultVisibilityHandler;

  useEffect(() => {
    handler && handler.setFilteredDataProvider(filteredDataProvider);
  }, [handler, filteredDataProvider]);

  return handler;
}

const isFilteredDataProvider = (dataProvider: IPresentationTreeDataProvider | IFilteredPresentationTreeDataProvider): dataProvider is IFilteredPresentationTreeDataProvider => {
  const filteredProvider = dataProvider as IFilteredPresentationTreeDataProvider;
  return filteredProvider.nodeMatchesFilter !== undefined && filteredProvider.getActiveMatch !== undefined && filteredProvider.countFilteringResults !== undefined;
};

const getFilteredDataProvider = (dataProvider: IPresentationTreeDataProvider | IFilteredPresentationTreeDataProvider): IFilteredPresentationTreeDataProvider | undefined => {
  return isFilteredDataProvider(dataProvider) ? dataProvider : undefined;
};
