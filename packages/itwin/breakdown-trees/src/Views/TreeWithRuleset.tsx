/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useTreeFilteringState } from "./visibility/TreeFilteringState";
import * as React from "react";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";
import { usePresentationTreeNodeLoader } from "@itwin/presentation-components";
import type { HighlightableTreeProps, TreeModel, TreeModelNode, TreeModelSource } from "@itwin/components-react";
import { ControlledTree, SelectionMode, useTreeModel } from "@itwin/components-react";
import styles from "./TreeWithRulesetTree.module.scss";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import { BreakdownTrees } from "../BreakdownTrees";
import type { FunctionIconInfo, TreeNodeFunctionIconInfoMapper } from "./FunctionalityProviders/TreeNodeFunctionIconMapper";
import { SelectRelatedFunctionalityProvider } from "./FunctionalityProviders/SelectRelatedFunctionalityProvider";
import { ZoomFunctionalityProvider } from "./FunctionalityProviders/ZoomFunctionalityProvider";
import { SearchBar } from "./SearchBar/SearchBar";
import type { Ruleset } from "@itwin/presentation-common";
import { NodeKey } from "@itwin/presentation-common";
import { PropertyRecord } from "@itwin/appui-abstract";
import type { OptionItemHandler } from "./OptionItemHandlers/OptionItemHandler";
import { useSelectionTrackingUnifiedSelectionTreeEventHandler } from "./EventHandlers/SelectionTrackingUnifiedSelectionTreeEventHandler";
import { useNodesWithFunctionsRenderer } from "./NodeRenderers/FunctionalTreeNodeRenderer";
import { MoreOptionsButton } from "./MoreOptionsButton";
import { ToolbarItemKeys, TreeNodeFunctionsToolbar } from "./TreeNodeFunctionsToolbar";
import type { BeEvent, IDisposable } from "@itwin/core-bentley";
import { VisibilityHandler } from "./EventHandlers/VisibilityHandler";
import classNames from "classnames";
import "./global.scss";
import { useResizeObserver } from "@itwin/core-react";
import { useVisibilityTreeFiltering, VisibilityTreeNoFilteredData } from "@itwin/tree-widget-react";

export interface TreeWithRulesetEventHandlers {
  onZoomToElement: BeEvent<() => void>;
  onSelectRelated: BeEvent<() => void>;
}

/**
 * Properties for the [[ControlledSpatialContainmentTree]] component
 * @internal
 */
export interface ControlledTreeProps {
  iModel: IModelConnection;
  dataProvider: IPresentationTreeDataProvider;
  pageSize?: number;
  treeName: string;
  loadedRuleset: Ruleset;
  displayGuids: boolean;
  optionItems: OptionItemHandler[];
  treeNodeIconMapper: TreeNodeFunctionIconInfoMapper;
  searchTools: boolean;
  setIsDisplayGuids: (displayGuids: boolean) => void;
  enableVisibility: boolean;
  eventHandlers?: TreeWithRulesetEventHandlers;
}

/**
 * Controlled tree wrapper.
 * **Note:** it is required for the tree to use [[PresentationTreeDataProvider]]
 * @internal
 */
// tslint:disable-next-line:variable-name naming-convention
export const ControlledTreeWrapper: React.FC<ControlledTreeProps> = (props: ControlledTreeProps) => {
  const [selectedTreeNodes, setSelectedTreeNodes] = React.useState<TreeModelNode[]>([]);

  const alterNodeLabel = React.useCallback((node: TreeModelNode): PropertyRecord => {
    if (!props.displayGuids) {
      if (isPresentationTreeNodeItem(node.item)) {
        const elementKey = node.item.key;
        if (NodeKey.isInstancesNodeKey(elementKey)) {
          const labelValue: any = node.label.value;
          const displayVal: string = labelValue.displayValue;
          const pos = displayVal.lastIndexOf("[");
          const nodeLabel = PropertyRecord.fromString(pos > -1 ? displayVal.substring(0, pos) : displayVal);
          return nodeLabel;
        }
      }
    }
    return node.label;
  }, [props.displayGuids]);

  const expandTree = () => {
    const selectedElemId = props.iModel.selectionSet.elements;
    if (selectedElemId.size === 0 || selectedElemId.size > 10) {
      return;
    }
    const treeModelData = nodeLoader.modelSource.getModel();
    let selectedNodesCount: number = 0;
    // Find corresponding treeNodes from selected elements in view
    for (const treeNode of treeModelData.iterateTreeModelNodes()) {
      const nodeKey = isPresentationTreeNodeItem(treeNode.item) ? treeNode.item.key : undefined;
      if (!nodeKey) {
        break;
      }
      if (NodeKey.isInstancesNodeKey(nodeKey)) {
        const mappedInstance = nodeKey.instanceKeys.find((instanceKey) => selectedElemId.has(instanceKey.id));
        if (mappedInstance) {
          selectedNodesCount++;
          expandParentNodes(treeNode, treeModelData);
        }
      }
      if (selectedElemId.size === selectedNodesCount)
        break;
    }
  };

  const expandParentNodes = (treeNode: TreeModelNode, treeModelData: TreeModel) => {
    if (treeNode.parentId) {
      const parentNode = treeModelData.getNode(treeNode.parentId);
      if (parentNode) {
        if (!parentNode.isExpanded) {
          unifiedSelectionEventHandler.onNodeExpanded({ nodeId: parentNode.id });
        }
        expandParentNodes(parentNode, treeModelData);
      }
    }
  };

  const optionHandlerItems = [...props.optionItems];
  const onNewSelectionSetCallback = React.useCallback((newSelection: TreeModelNode[]) => { setSelectedTreeNodes(newSelection); }, []);

  const { nodeLoader } = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    ruleset: props.loadedRuleset.id,
    pagingSize: props.pageSize || 20,
    enableHierarchyAutoUpdate: true,
  });

  const model: TreeModel = nodeLoader.modelSource.getModel();
  let overlay: React.ReactNode;
  let filteredNodeLoader: any;
  let nodeHighlightingProps: HighlightableTreeProps | undefined;
  let searchBar: React.ReactNode;
  let isFilteringOn = false;
  const functionsToolbar = <TreeNodeFunctionsToolbar treeNodeIconMapper={props.treeNodeIconMapper} selectedNodes={selectedTreeNodes} treeModel={model} />;
  const {
    searchOptions,
    filterString,
    activeMatchIndex,
    onFilterApplied,
  } = useTreeFilteringState();
  const noFilteredDataRenderer = React.useCallback(() => {
    return <VisibilityTreeNoFilteredData
      title={BreakdownTrees.translate("searchTool.noData")}
      message={BreakdownTrees.translate("searchTool.noMatchingItem")}
    />;
  }, []);

  const filterInfo = { filter: filterString, activeMatchIndex };
  const treeFiltering = useVisibilityTreeFiltering(nodeLoader, filterInfo, onFilterApplied);
  if (props.searchTools) {
    filteredNodeLoader = treeFiltering.filteredNodeLoader;
    nodeHighlightingProps = treeFiltering.nodeHighlightingProps;
    overlay = treeFiltering.isFiltering ? <div className={styles.filteredTreeOverlay} /> : undefined;
    isFilteringOn = treeFiltering.isFiltering;

    searchBar = <SearchBar
      value={filterString}
      valueChangedDelay={500}
      placeholder={BreakdownTrees.translate("searchTool.placeHolder")}
      title={BreakdownTrees.translate("searchTool.title")}
      filteringInProgress={searchOptions.isFiltering}
      onFilterCancel={searchOptions.onFilterCancel}
      onFilterClear={searchOptions.onFilterCancel}
      onFilterStart={searchOptions.onFilterStart}
      onSelectedChanged={searchOptions.onResultSelectedChanged}
      resultCount={searchOptions.matchedResultCount ?? 0}
    >
      {functionsToolbar}
    </SearchBar>;
  } else {
    filteredNodeLoader = nodeLoader;
  }
  const filterApplied = filteredNodeLoader !== nodeLoader;
  const treeModel = useTreeModel(filteredNodeLoader.modelSource);
  const viewPort = IModelApp.viewManager.selectedView;
  const visibilityHandler = useVisibilityHandler(filteredNodeLoader.dataProvider.rulesetId, filteredNodeLoader.dataProvider, filteredNodeLoader.modelSource, viewPort);
  const unifiedSelectionEventHandler = useSelectionTrackingUnifiedSelectionTreeEventHandler({ nodeLoader: filteredNodeLoader, collapsedChildrenDisposalEnabled: false, onNewSelectionSetCallback, visibilityHandler });

  const toolBarSection = props.searchTools ? searchBar : functionsToolbar;
  const selectionSet = props.iModel.selectionSet.elements;
  React.useEffect(() => {
    if (!isFilteringOn)
      expandTree();
  }, [selectionSet, isFilteringOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const nodeRenderer = useNodesWithFunctionsRenderer(props.enableVisibility, props.treeNodeIconMapper, visibilityHandler, model, selectedTreeNodes.length, alterNodeLabel);

  const [height, setHeight] = React.useState(0);
  const [width, setWidth] = React.useState(0);
  const handleResize = React.useCallback((w: number, h: number) => {
    setHeight(h);
    setWidth(w);
  }, []);
  const ref = useResizeObserver<HTMLDivElement>(handleResize);
  return (
    <div className={classNames("custom-tree-component-overwrites", styles.customTreeContent)}>
      <div className={styles.customTreeToolbar}>
        {toolBarSection}
        <MoreOptionsButton optionItems={optionHandlerItems} />
      </div>

      <div ref={ref} className={classNames("tree-component-overwrites", styles.customTreeContainer)}>
        <ControlledTree
          model={treeModel}
          nodeLoader={filteredNodeLoader}
          eventsHandler={unifiedSelectionEventHandler}
          selectionMode={SelectionMode.Extended}
          nodeHighlightingProps={nodeHighlightingProps}
          noDataRenderer={filterApplied ? noFilteredDataRenderer : undefined}
          // pass custom tree renderer that will render each node
          treeRenderer={nodeRenderer}
          width={width}
          height={height}
        />
        {overlay}
      </div>
    </div>
  );
};

const useVisibilityHandler = (rulesetId: string, treeDataProvider: IPresentationTreeDataProvider, modelSource: TreeModelSource, activeView?: Viewport) => {
  const previous = React.useRef<IDisposable>();

  React.useEffect(() => () => previous.current?.dispose(), []);

  return React.useMemo(() => {
    if (previous.current)
      previous.current.dispose();

    const handler = new VisibilityHandler({ rulesetId, viewport: activeView, treeDataProvider, modelSource });
    previous.current = handler;
    return handler;
  }, [rulesetId, treeDataProvider, modelSource, activeView]);
};

export function populateMapWithCommonMenuItems(treeName: string, treeFunctionalityMapper: TreeNodeFunctionIconInfoMapper, dataProvider: IPresentationTreeDataProvider, rulesetId: string, eventHandlers?: TreeWithRulesetEventHandlers) {
  treeFunctionalityMapper.registerForNodesOfClasses(["BisCore:GeometricElement3d"], {
    key: ToolbarItemKeys.zoom,
    label: BreakdownTrees.translate("contextMenu.zoomSelectedLabel"),
    functionalityProvider: new ZoomFunctionalityProvider(treeName, dataProvider, eventHandlers?.onZoomToElement),
    toolbarIcon: "icon-re-center",
  });
  const selectRelatedIcon: FunctionIconInfo = {
    key: ToolbarItemKeys.selectRelated,
    label: BreakdownTrees.translate("contextMenu.selectRelatedLabel"),
    functionalityProvider: new SelectRelatedFunctionalityProvider(treeName, dataProvider, rulesetId, eventHandlers?.onSelectRelated),
    toolbarIcon: "icon-selection",
  };
  treeFunctionalityMapper.registerGlobal(selectRelatedIcon);
  treeFunctionalityMapper.registerForNodesOfClasses(["BisCore:Element"], selectRelatedIcon);
}
