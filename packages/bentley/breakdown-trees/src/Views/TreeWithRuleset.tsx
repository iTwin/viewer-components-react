/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import { useTreeFilteringState } from "./visibility/TreeFilteringState";
import * as React from "react";
import { IPresentationTreeDataProvider, usePresentationTreeNodeLoader } from "@itwin/presentation-components";
import { ControlledTree, HighlightableTreeProps, SelectionMode, TreeModel, TreeModelNode, TreeModelSource, useTreeModel } from "@itwin/components-react";
import styles from "./TreeWithRulesetTree.module.scss";
import { useVisibilityTreeFiltering, VisibilityTreeNoFilteredData } from "@itwin/appui-react";
import { IModelApp, IModelConnection, Viewport } from "@itwin/core-frontend";
import { BreakdownTrees } from "../BreakdownTrees";
import { FunctionIconInfo, SelectRelatedFunctionalityProvider, TreeNodeFunctionIconInfoMapper, ZoomFunctionalityProvider } from "./FunctionalityProviders";
import { SearchBar } from "./SearchBar/SearchBar";
import { NodeKey, Ruleset } from "@itwin/presentation-common";
import { PropertyRecord } from "@itwin/appui-abstract";
import { OptionItemHandler } from "./OptionItemHandlers";
import { useSelectionTrackingUnifiedSelectionTreeEventHandler } from "./EventHandlers/SelectionTrackingUnifiedSelectionTreeEventHandler";
import { useNodesWithFunctionsRenderer } from "./NodeRenderers/FunctionalTreeNodeRenderer";
import { MoreOptionsButton } from "./MoreOptionsButton";
import { ToolbarItemKeys, TreeNodeFunctionsToolbar } from "./TreeNodeFunctionsToolbar";
import { BeEvent, IDisposable } from "@itwin/core-bentley";
import { VisibilityHandler } from "./EventHandlers/VisibilityHandler";
import classNames from "classnames";
import "./global.scss";
import { useResizeObserver } from "@itwin/core-react";

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
      const elementKey = props.dataProvider.getNodeKey(node.item);
      if (NodeKey.isInstancesNodeKey(elementKey)) {
        const labelValue: any = node.label.value;
        const displayVal: string = labelValue.displayValue;
        const pos = displayVal.lastIndexOf("[");
        const nodeLabel = PropertyRecord.fromString(pos > -1 ? displayVal.substring(0, pos) : displayVal);
        return nodeLabel;
      }
    }
    return node.label;
  }, [props.displayGuids, props.dataProvider]);

  const expandTree = () => {
    const selectionSet = props.iModel.selectionSet.elements;
    if (selectionSet.size === 0 || selectionSet.size > 10) {
      return;
    }
    const model = nodeLoader.modelSource.getModel();
    let selectedNodesCount: number = 0;
    // Find corresponding treeNodes from selected elements in view
    for (const treeNode of model.iterateTreeModelNodes()) {
      const nodeKey = props.dataProvider.getNodeKey(treeNode.item);
      if (NodeKey.isInstancesNodeKey(nodeKey)) {
        const mappedInstance = nodeKey.instanceKeys.find((instanceKey) => selectionSet.has(instanceKey.id));
        if (mappedInstance) {
          selectedNodesCount++;
          expandParentNodes(treeNode, model);
        }
      }

      if (selectionSet.size === selectedNodesCount)
        break;
    }
  };

  const expandParentNodes = (treeNode: TreeModelNode, model: TreeModel) => {
    if (treeNode.parentId) {
      const parentNode = model.getNode(treeNode.parentId);
      if (parentNode) {
        if (!parentNode.isExpanded) {
          unifiedSelectionEventHandler.onNodeExpanded({ nodeId: parentNode.id });
        }
        expandParentNodes(parentNode, model);
      }
    }
  };

  const optionHandlerItems = [...props.optionItems];
  const onNewSelectionSetCallback = React.useCallback((newSelection: TreeModelNode[]) => { setSelectedTreeNodes(newSelection) }, []);

  const { nodeLoader } = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    ruleset: props.loadedRuleset.id,
    pagingSize: props.pageSize || 20,
    enableHierarchyAutoUpdate: true
  });

  const model: TreeModel = nodeLoader.modelSource.getModel();
  let overlay: React.ReactNode;
  let filteredNodeLoader: any;
  let nodeHighlightingProps: HighlightableTreeProps | undefined;
  let noFilteredDataRenderer: any;
  let searchBar: React.ReactNode;
  let isFilteringOn = false;
  const functionsToolbar = <TreeNodeFunctionsToolbar treeNodeIconMapper={props.treeNodeIconMapper} selectedNodes={selectedTreeNodes} treeModel={model} />;
  if (props.searchTools) {
    const {
      searchOptions,
      filterString,
      activeMatchIndex,
      onFilterApplied,
    } = useTreeFilteringState();
    noFilteredDataRenderer = React.useCallback(() => {
      return <VisibilityTreeNoFilteredData
        title={BreakdownTrees.translate("searchTool.noData")}
        message={BreakdownTrees.translate("searchTool.noMatchingItem")}
      />;
    }, []);
    const filterInfo = { filter: filterString, activeMatchIndex };
    const treeFiltering = useVisibilityTreeFiltering(nodeLoader, filterInfo, onFilterApplied);
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
  const visibilityHandler = props.enableVisibility ? useVisibilityHandler(filteredNodeLoader.dataProvider.rulesetId, filteredNodeLoader.dataProvider, filteredNodeLoader.modelSource, viewPort) : undefined;
  const unifiedSelectionEventHandler = useSelectionTrackingUnifiedSelectionTreeEventHandler({ nodeLoader: filteredNodeLoader, collapsedChildrenDisposalEnabled: false, onNewSelectionSetCallback, visibilityHandler });

  const toolBarSection = props.searchTools ? searchBar : functionsToolbar;
  const selectionSet = props.iModel.selectionSet.elements;
  React.useEffect(() => {
    if (!isFilteringOn)
      expandTree();
  }, [selectionSet, isFilteringOn]);

  const nodeRenderer = useNodesWithFunctionsRenderer(props.treeNodeIconMapper, visibilityHandler, model, selectedTreeNodes.length, alterNodeLabel);

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

    const handler = createVisibilityHandler(rulesetId, treeDataProvider, modelSource, activeView);
    previous.current = handler;
    return handler;
  }, [rulesetId, treeDataProvider, modelSource, activeView]);
};

const createVisibilityHandler = (rulesetId: string, treeDataProvider: IPresentationTreeDataProvider, modelSource: TreeModelSource, activeView?: Viewport): VisibilityHandler | undefined => {
  return activeView ? new VisibilityHandler({ rulesetId, viewport: activeView, treeDataProvider, modelSource }) : undefined;
};

export function populateMapWithCommonMenuItems(treeName: string, treeFunctionalityMapper: TreeNodeFunctionIconInfoMapper, dataProvider: IPresentationTreeDataProvider, rulesetId: string, eventHandlers?: TreeWithRulesetEventHandlers) {
  treeFunctionalityMapper.registerForNodesOfClasses(["BisCore:GeometricElement3d"], {
    key: ToolbarItemKeys.zoom,
    label: BreakdownTrees.translate("contextMenu.zoomSelectedLabel"),
    functionalityProvider: new ZoomFunctionalityProvider(treeName, dataProvider, eventHandlers?.onZoomToElement!),
    toolbarIcon: "icon-re-center",
  });
  const selectRelatedIcon: FunctionIconInfo = {
    key: ToolbarItemKeys.selectRelated,
    label: BreakdownTrees.translate("contextMenu.selectRelatedLabel"),
    functionalityProvider: new SelectRelatedFunctionalityProvider(treeName, dataProvider, rulesetId, eventHandlers?.onSelectRelated!),
    toolbarIcon: "icon-selection",
  };
  treeFunctionalityMapper.registerGlobal(selectRelatedIcon);
  treeFunctionalityMapper.registerForNodesOfClasses(["BisCore:Element"], selectRelatedIcon);
}
