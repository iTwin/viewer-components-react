/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Presentation } from "@bentley/presentation-frontend";
import spatialRulesDefault from "../rulesets/SpatialBreakdown.json";
import spatialRulesByType from "../rulesets/SpatialBreakdownByType.json";
import { IModelApp, IModelConnection, SpatialViewState } from "@bentley/imodeljs-frontend";
import { IPresentationTreeDataProvider, PresentationTreeDataProvider } from "@bentley/presentation-components";
import { Ruleset } from "@bentley/presentation-common";
import { populateMapWithCommonMenuItems, ControlledTreeWrapper } from "./TreeWithRuleset";
import { TreeWidget as BuildingUIComponents } from "../../TreeWidget";
import { BuildingClipPlanesProvider, ClearSectionsFunctionalityProvider, CombinedTreeNodeFunctionalityProvider, SpaceClipPlanesProvider, StoryClipPlanesProvider, TreeNodeFunctionIconInfoMapper, FunctionIconInfo } from "./FunctionalityProviders";
import { ClipAtSpacesHandler, GenericOptionItemHandler, LabelHandler, TopViewHandler, OptionItemHandler } from "./OptionItemHandlers";
import { LoadableRuleSetComponent } from "./LoadableRuleSetComponent";

export interface SpatialContainmentTreeProps {
  iModel: IModelConnection;
  displayGuids: boolean;
  setIsDisplayGuids: (displayGuids: boolean) => void;
  enableVisibility?: boolean;
  clipHeight?: number;
  clipAtSpaces?: boolean;
  displayByType: boolean;
  setDisplayByType: (displayByType: boolean) => void;
}

function updateModelsInRulesetVars() {
  let viewState = IModelApp.viewManager.selectedView ?.view as SpatialViewState;
  let modelIds = Array.from(viewState.modelSelector.models);
  Presentation.presentation.vars("ui-framework/SpatialBreakdown").setId64s("displayed_model_ids", modelIds);
}

const _onModelsChanged = async () => {
  updateModelsInRulesetVars();
}

// <ConnectedSimpleTreeWithRuleset ruleSet={spatialRules as Ruleset}  controller={treeWithRulesetController} />
export const SpatialContainmentTree: React.FC<SpatialContainmentTreeProps> = (props: SpatialContainmentTreeProps) => {
  const treeName = "SpatialContainmentTree";
  let spatialRules: any;
  if (props.displayByType) {
    spatialRules = spatialRulesByType;
  } else {
    spatialRules = spatialRulesDefault;
  }

  React.useEffect(() => {
    if (IModelApp.viewManager.selectedView ?.view.isSpatialView) {
      IModelApp.viewManager.selectedView.onViewedModelsChanged.addListener(_onModelsChanged);
      updateModelsInRulesetVars();
    }
    return () => {
      if (IModelApp.viewManager.selectedView ?.view.isSpatialView) {
        IModelApp.viewManager.selectedView.onViewedModelsChanged.removeListener(_onModelsChanged);
      }
    }
  });

  const dataProvider = React.useMemo(() => {
    const dataProviderInner = new PresentationTreeDataProvider({ imodel: props.iModel, ruleset: spatialRules.id, appendChildrenCountForGroupingNodes: true });
    dataProviderInner.pagingSize = 20; // paging size is now needed for the controlled tree.
    return dataProviderInner;
  }, [props.iModel, props.displayByType]);

  const { functionIconMapper, optionItems, displayGuidHandler, displayByTypeHandler } = React.useMemo(() => {
    const functionIconMapper = new TreeNodeFunctionIconInfoMapper(dataProvider);
    const optionItems: OptionItemHandler[] = [];

    populateContextAndOptionMenuItems(treeName, functionIconMapper, optionItems, dataProvider, spatialRules, props.clipHeight, props.clipAtSpaces);

    const displayGuidHandler = new GenericOptionItemHandler("Show Guids", BuildingUIComponents.translate("contextMenu.showGuids"), "icon-label", () => props.displayGuids, props.setIsDisplayGuids);
    optionItems.push(displayGuidHandler);
    const displayByTypeHandler = new GenericOptionItemHandler("Display By Type", BuildingUIComponents.translate("contextMenu.displayByType"), "icon-hierarchy-tree", () => props.displayByType, props.setDisplayByType);
    optionItems.push(displayByTypeHandler);

    return { functionIconMapper, optionItems, displayGuidHandler, displayByTypeHandler };
  }, [dataProvider]); // the GenericOptionItemHandler uses function to retrieve state - don't need to update

  displayGuidHandler._getItemState = () => props.displayGuids;
  displayByTypeHandler._getItemState = () => props.displayByType;
  const containmentTree = React.useMemo(() => <ControlledTreeWrapper iModel={props.iModel} loadedRuleset={spatialRules as Ruleset} dataProvider={dataProvider}
    treeName={treeName} treeNodeIconMapper={functionIconMapper} optionItems={optionItems} searchTools={true}
    displayGuids={props.displayGuids} setIsDisplayGuids={props.setIsDisplayGuids} enableVisibility={props.enableVisibility ? props.enableVisibility : false} />, [props.iModel, props.displayGuids, props.setIsDisplayGuids, functionIconMapper, props.displayByType]);

  return (<LoadableRuleSetComponent ruleSet={spatialRules as Ruleset}>
    {containmentTree}
  </LoadableRuleSetComponent>);
}

function populateContextAndOptionMenuItems(treeName: string, mapper: TreeNodeFunctionIconInfoMapper, optionItems: OptionItemHandler[], dataProvider: IPresentationTreeDataProvider, spatialRules: any, clipHeight?: number, clipAtSpaces?: boolean) {
  populateMapWithCommonMenuItems(treeName, mapper, dataProvider, spatialRules.id);

  const combinedFunctionalityProvider = new CombinedTreeNodeFunctionalityProvider(treeName, dataProvider);
  const storyClipSectionProvider = new StoryClipPlanesProvider(treeName, dataProvider, false, false, clipHeight);
  const spaceClipSectionProvider = new SpaceClipPlanesProvider(treeName, dataProvider, false, clipHeight);
  const buildingClipSectionProvider = new BuildingClipPlanesProvider(treeName, dataProvider, false);
  combinedFunctionalityProvider.setFunctionalityProviderForClass("BuildingSpatial:Story", storyClipSectionProvider);
  combinedFunctionalityProvider.setFunctionalityProviderForClass("BuildingSpatial:Space", spaceClipSectionProvider);
  combinedFunctionalityProvider.setFunctionalityProviderForClass("BuildingSpatial:Building", buildingClipSectionProvider);

  mapper.registerForNodesOfClasses(["BuildingSpatial:Story", "BuildingSpatial:Space", "BuildingSpatial:Building"], {
    key: "Create section planes",
    label: BuildingUIComponents.translate("contextMenu.createSectionPlanes"),
    functionalityProvider: combinedFunctionalityProvider,
    toolbarIcon: "icon-section-tool",
  });
  mapper.registerGlobal({
    key: "Clear section planes",
    label: BuildingUIComponents.translate("contextMenu.clearSectionPlanes"),
    functionalityProvider: new ClearSectionsFunctionalityProvider(treeName, dataProvider),
    toolbarIcon: "icon-section-clear",
  });

  const labelHandler = new LabelHandler(storyClipSectionProvider, "Toggle Space Labels", BuildingUIComponents.translate("contextMenu.toggleSpaceLabels"), "icon-text");
  optionItems.push(labelHandler);

  const topViewHandler = new TopViewHandler([storyClipSectionProvider, spaceClipSectionProvider, buildingClipSectionProvider], "Top Down View", BuildingUIComponents.translate("contextMenu.topDownView"), "icon-cube-faces-top");
  optionItems.push(topViewHandler);

  if (clipAtSpaces !== undefined) {
    const clipAtSpacesHandler = new ClipAtSpacesHandler(storyClipSectionProvider, clipAtSpaces, "Clip At Spaces", BuildingUIComponents.translate("contextMenu.clipAtSpaces"), "icon-section-tool");
    optionItems.push(clipAtSpacesHandler);
  }
}
