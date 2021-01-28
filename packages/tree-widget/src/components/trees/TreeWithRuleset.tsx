/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Ruleset, NodeKey } from "@bentley/presentation-common";
import { IPresentationTreeDataProvider, usePresentationTreeNodeLoader } from "@bentley/presentation-components";
import { useVisibleTreeNodes, SelectionMode, ControlledTree, TreeModel, TreeModelNode, HighlightableTreeProps, TreeModelSource } from "@bentley/ui-components";
import "./TreeWithRulesetTree.scss";
import { connectIModelConnection, IVisibilityHandler, useVisibilityTreeFiltering, VisibilityTreeNoFilteredData, VisibilityTreeEventHandler } from "@bentley/ui-framework";
import { IModelApp, IModelConnection, Viewport } from "@bentley/imodeljs-frontend";
import { TreeWidget as BuildingUIComponents } from "../../TreeWidget";
// import { BuildingUIComponentsActions } from "../redux/buildingUIComponents-redux";
import { FunctionIconInfo, SelectRelatedFunctionalityProvider, ZoomFunctionalityProvider, TreeNodeFunctionIconInfoMapper } from "./FunctionalityProviders";
import { SearchBar } from "../search-bar/SearchBar";
import { useTreeFilteringState } from "./visibility/TreeFilteringState";
import { PropertyRecord } from "@bentley/ui-abstract";
import { OptionItemHandler } from "./OptionItemHandlers";
import { useSelectionTrackingUnifiedSelectionTreeEventHandler } from "./EventHandlers/SelectionTrackingUnifiedSelectionTreeEventHandler";
import { useNodesWithFunctionsRenderer } from "./NodeRenderers/FunctionalTreeNodeRenderer";
import { MoreOptionsButton } from "./MoreOptionsButton";
import { TreeNodeFunctionsToolbar } from "./TreeNodeFunctionsToolbar";
import { IDisposable } from "@bentley/bentleyjs-core";
import { useDisposable } from "@bentley/ui-core";
import { VisibilityHandler } from "./EventHandlers/VisibilityHandler";

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
  }, [props.displayGuids]);

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
  const onNewSelectionSetCallback = React.useCallback((newSelection: TreeModelNode[]) => { setSelectedTreeNodes(newSelection) }, [props.treeNodeIconMapper]);

  const nodeLoader = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    ruleset: props.loadedRuleset.id,
    preloadingEnabled: true,
    pagingSize: props.pageSize || 20,
    dataProvider: props.dataProvider,
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
        title={BuildingUIComponents.translate("searchTool.noData")}
        message={BuildingUIComponents.translate("searchTool.noMatchingItem")}
      />;
    }, []);
    const filterInfo = { filter: filterString, activeMatchIndex };
    const treeFiltering = useVisibilityTreeFiltering(nodeLoader, filterInfo, onFilterApplied);
    filteredNodeLoader = treeFiltering.filteredNodeLoader;
    nodeHighlightingProps = treeFiltering.nodeHighlightingProps;
    overlay = treeFiltering.isFiltering ? <div className="filteredTreeOverlay" /> : undefined;
    isFilteringOn = treeFiltering.isFiltering;

    searchBar = <SearchBar
      value={filterString}
      valueChangedDelay={500}
      placeholder={BuildingUIComponents.translate("searchTool.placeHolder")}
      title={BuildingUIComponents.translate("searchTool.title")}
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
  const visibleNodes = useVisibleTreeNodes(filteredNodeLoader.modelSource);
  const viewPort = IModelApp.viewManager.selectedView;
  const visibilityHandler = props.enableVisibility ? useVisibilityHandler(filteredNodeLoader.dataProvider.rulesetId, filteredNodeLoader.dataProvider, filteredNodeLoader.modelSource, viewPort) : undefined;
  const unifiedSelectionEventHandler = useSelectionTrackingUnifiedSelectionTreeEventHandler({ nodeLoader: filteredNodeLoader, collapsedChildrenDisposalEnabled: false, onNewSelectionSetCallback, visibilityHandler });

  const toolBarSection = props.searchTools ? searchBar : functionsToolbar;
  const selectionSet = props.iModel.selectionSet.elements;
  React.useMemo(() => {
    if (!isFilteringOn)
      expandTree();
  }, [selectionSet, isFilteringOn]);

  const nodeRenderer = useNodesWithFunctionsRenderer(props.treeNodeIconMapper, visibilityHandler, model, alterNodeLabel);

  return (
    <div className="custom-tree-content">
      <div className="custom-tree-toolbar">
        {toolBarSection}
        <MoreOptionsButton optionItems={optionHandlerItems} />
      </div>

      <div className="custom-tree-container">
        <ControlledTree
          visibleNodes={visibleNodes}
          nodeLoader={filteredNodeLoader}
          treeEvents={unifiedSelectionEventHandler}
          selectionMode={SelectionMode.Extended}
          nodeHighlightingProps={nodeHighlightingProps}
          noDataRenderer={filterApplied ? noFilteredDataRenderer : undefined}
          // pass custom tree renderer that will render each node
          treeRenderer={nodeRenderer}
        />
        {overlay}
      </div>
    </div>
  );
};

const useVisibilityHandler = (rulesetId: string, treeDataProvider: IPresentationTreeDataProvider, modelSource: TreeModelSource, activeView?: Viewport) => {
  const previous = React.useRef<IDisposable>();

  React.useEffect(() => () => previous.current ?.dispose(), []);

  return React.useMemo(() => {
    if (previous.current)
      previous.current.dispose();

    const handler = createVisibilityHandler(rulesetId, treeDataProvider, modelSource, activeView);
    previous.current = handler;
    return handler;
  }, [rulesetId, activeView]);
};

const createVisibilityHandler = (rulesetId: string, treeDataProvider: IPresentationTreeDataProvider, modelSource: TreeModelSource, activeView?: Viewport): VisibilityHandler | undefined => {
  return activeView ? new VisibilityHandler({ rulesetId, viewport: activeView, treeDataProvider, modelSource }) : undefined;
};

export function populateMapWithCommonMenuItems(treeName: string, treeFunctionalityMapper: TreeNodeFunctionIconInfoMapper, dataProvider: IPresentationTreeDataProvider, rulesetId: string) {
  const selectRelatedIcon: FunctionIconInfo = {
    key: "Select related",
    label: BuildingUIComponents.translate("contextMenu.selectRelatedLabel"),
    functionalityProvider: new SelectRelatedFunctionalityProvider(treeName, dataProvider, rulesetId),
    toolbarIcon: "icon-selection",
  };
  treeFunctionalityMapper.registerForGroupNodes(selectRelatedIcon);
  treeFunctionalityMapper.registerForNodesOfClasses(["BisCore:Element"], selectRelatedIcon);
  treeFunctionalityMapper.registerForNodesOfClasses(["BisCore:GeometricElement3d"], {
    key: "Zoom to selected elements",
    label: BuildingUIComponents.translate("contextMenu.zoomSelectedLabel"),
    functionalityProvider: new ZoomFunctionalityProvider(treeName, dataProvider),
    toolbarIcon: "icon-re-center",
  });
}

const mapStateToProps = (state: any, ownProps: ControlledTreeProps) => {
  const props = {
    ...ownProps,
    displayGuids: state.BuildingUIComponentsReducer.displayGuids
  };

  return props;
};

// const mapDispatchToProps = {
//   setIsDisplayGuids: (typeof BuildingUIComponentsActions.setIsDisplayGuids)
// };

export const ConnectedControlledTreeWrapper = connectIModelConnection(mapStateToProps, /* mapDispatchToProps */ null)(ControlledTreeWrapper); // tslint:disable-line
