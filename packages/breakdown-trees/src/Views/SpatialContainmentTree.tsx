/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Presentation } from "@bentley/presentation-frontend";
import spatialRulesDefault from "../assets/SpatialBreakdown.json";
import spatialRulesByType from "../assets/SpatialBreakdownByType.json";
import spatialRulesByDiscipline from "../assets/SpatialBreakdownByDiscipline.json";
import spatialRulesByTypeAndDiscipline from "../assets/SpatialBreakdownByTypeAndDiscipline.json";

import { IModelApp, IModelConnection, SpatialViewState } from "@bentley/imodeljs-frontend";
import { IPresentationTreeDataProvider, PresentationTreeDataProvider } from "@bentley/presentation-components";
import { Ruleset } from "@bentley/presentation-common";
import { populateMapWithCommonMenuItems, ControlledTreeWrapper } from "./TreeWithRuleset";
import { BreakdownTrees } from "../BreakdownTrees";
import { BuildingClipPlanesProvider, ClearSectionsFunctionalityProvider, CombinedTreeNodeFunctionalityProvider, SpaceClipPlanesProvider, StoryClipPlanesProvider, TreeNodeFunctionIconInfoMapper } from "./FunctionalityProviders";
import { ClipAtSpacesHandler, GenericOptionItemHandler, LabelHandler, TopViewHandler, OptionItemHandler } from "./OptionItemHandlers";
import { LoadableRuleSetComponent } from "./LoadableRuleSetComponent";
import { ToolbarItemKeys } from "./TreeNodeFunctionsToolbar.js";
import { BeEvent } from "@bentley/bentleyjs-core";

export interface SpatialContainmentEventHandlers {
  onZoomToElement: BeEvent<() => void>;
  onSelectRelated: BeEvent<() => void>;
}

export interface SpatialContainmentTreeProps {
  iModel: IModelConnection;
  displayGuids: boolean;
  setIsDisplayGuids: (displayGuids: boolean) => void;
  enableVisibility?: boolean;
  clipHeight?: number;
  clipAtSpaces?: boolean;
  groupByType: boolean;
  setGroupByType: (groupByType: boolean) => void;
  groupByDiscipline: boolean;
  setGroupByDiscipline: (groupByDiscipline: boolean) => void;
  eventHandlers?: SpatialContainmentEventHandlers;
}

function updateModelsInRulesetVars() {
  const viewState = IModelApp.viewManager.selectedView?.view as SpatialViewState;
  const modelIds = viewState.modelSelector ? Array.from(viewState.modelSelector.models) : [];
  Presentation.presentation.vars("ui-framework/SpatialBreakdown").setId64s("displayed_model_ids", modelIds);
}

const _onModelsChanged = async () => {
  updateModelsInRulesetVars();
}

// <ConnectedSimpleTreeWithRuleset ruleSet={spatialRules as Ruleset}  controller={treeWithRulesetController} />
export const SpatialContainmentTree: React.FC<SpatialContainmentTreeProps> = (props: SpatialContainmentTreeProps) => {
  const treeName = "SpatialContainmentTree";
  let spatialRules = spatialRulesDefault as Ruleset;
  if (props.groupByType && props.groupByDiscipline) {
    spatialRules = spatialRulesByTypeAndDiscipline as Ruleset;
  } else {
    if (props.groupByType) {
      spatialRules = spatialRulesByType as Ruleset;
    }
    if (props.groupByDiscipline) {
      spatialRules = spatialRulesByDiscipline as Ruleset;
    }
  }

  React.useEffect(() => {
    if (IModelApp.viewManager.selectedView?.view.isSpatialView()) {
      IModelApp.viewManager.selectedView.onViewedModelsChanged.addListener(_onModelsChanged);
      updateModelsInRulesetVars();
    }

    return () => {
      if (IModelApp.viewManager.selectedView?.view.isSpatialView()) {
        IModelApp.viewManager.selectedView.onViewedModelsChanged.removeListener(_onModelsChanged);
      }
    }
  });

  const dataProvider = React.useMemo(() => {
    const dataProviderInner = new PresentationTreeDataProvider({ imodel: props.iModel, ruleset: spatialRules.id, appendChildrenCountForGroupingNodes: true });
    dataProviderInner.pagingSize = 20; // paging size is now needed for the controlled tree.
    return dataProviderInner;
  }, [props.iModel.key, props.groupByType, props.groupByDiscipline, spatialRules.id]);

  const { functionIconMapper, optionItems, displayGuidHandler, groupByTypeHandler, groupByDisciplineHandler } = React.useMemo(() => {
    const functionIconMapper = new TreeNodeFunctionIconInfoMapper(dataProvider);
    const optionItems: OptionItemHandler[] = [];

    populateContextAndOptionMenuItems(treeName, functionIconMapper, optionItems, dataProvider, spatialRules, props.eventHandlers, props.clipHeight, props.clipAtSpaces);

    const displayGuidHandler = new GenericOptionItemHandler("Show Guids", BreakdownTrees.translate("contextMenu.showGuids"), "icon-label", () => props.displayGuids, props.setIsDisplayGuids);
    optionItems.push(displayGuidHandler);
    const groupByTypeHandler = new GenericOptionItemHandler("Group By Type", BreakdownTrees.translate("contextMenu.groupByType"), "icon-hierarchy-tree", () => props.groupByType, props.setGroupByType);
    optionItems.push(groupByTypeHandler);
    const groupByDisciplineHandler = new GenericOptionItemHandler("Group By Discipline", BreakdownTrees.translate("contextMenu.groupByDiscipline"), "icon-hierarchy-tree", () => props.groupByDiscipline, props.setGroupByDiscipline);
    optionItems.push(groupByDisciplineHandler);

    return { functionIconMapper, optionItems, displayGuidHandler, groupByTypeHandler, groupByDisciplineHandler };
  }, [dataProvider,
    props.eventHandlers,
    props.clipHeight,
    props.clipAtSpaces,
    props.displayGuids,
    props.setIsDisplayGuids,
    props.groupByType,
    props.setGroupByType,
    props.groupByDiscipline,
    props.setGroupByDiscipline]);

  displayGuidHandler._getItemState = () => props.displayGuids;
  groupByTypeHandler._getItemState = () => props.groupByType;
  groupByDisciplineHandler._getItemState = () => props.groupByDiscipline;
  const containmentTree = React.useMemo(() => <ControlledTreeWrapper iModel={props.iModel} loadedRuleset={spatialRules} dataProvider={dataProvider}
    treeName={treeName} treeNodeIconMapper={functionIconMapper} optionItems={optionItems} searchTools={true}
    displayGuids={props.displayGuids} setIsDisplayGuids={props.setIsDisplayGuids} enableVisibility={props.enableVisibility ? props.enableVisibility : false} />, [props.iModel, props.displayGuids, props.setIsDisplayGuids, functionIconMapper, props.groupByType]);

  return (<LoadableRuleSetComponent ruleSet={spatialRules}>
    {containmentTree}
  </LoadableRuleSetComponent>);
}

function populateContextAndOptionMenuItems(treeName: string, mapper: TreeNodeFunctionIconInfoMapper, optionItems: OptionItemHandler[], dataProvider: IPresentationTreeDataProvider, spatialRules: any, eventHandlers?: SpatialContainmentEventHandlers, clipHeight?: number, clipAtSpaces?: boolean) {
  populateMapWithCommonMenuItems(treeName, mapper, dataProvider, spatialRules.id, eventHandlers);

  const combinedFunctionalityProvider = new CombinedTreeNodeFunctionalityProvider(treeName, dataProvider);
  const storyClipSectionProvider = new StoryClipPlanesProvider(treeName, dataProvider, false, false, clipHeight);
  const spaceClipSectionProvider = new SpaceClipPlanesProvider(treeName, dataProvider, false, clipHeight);
  const buildingClipSectionProvider = new BuildingClipPlanesProvider(treeName, dataProvider, false);
  combinedFunctionalityProvider.setFunctionalityProviderForClass("BuildingSpatial:Story", storyClipSectionProvider);
  combinedFunctionalityProvider.setFunctionalityProviderForClass("BuildingSpatial:Space", spaceClipSectionProvider);
  combinedFunctionalityProvider.setFunctionalityProviderForClass("BuildingSpatial:Building", buildingClipSectionProvider);

  mapper.registerForNodesOfClasses(["BuildingSpatial:Story", "BuildingSpatial:Space", "BuildingSpatial:Building"], {
    key: ToolbarItemKeys.createSectionPlanes,
    label: BreakdownTrees.translate("contextMenu.createSectionPlanes"),
    functionalityProvider: combinedFunctionalityProvider,
    toolbarIcon: "icon-section-tool",
  });
  mapper.registerGlobal({
    key: ToolbarItemKeys.clearSectionPlanes,
    label: BreakdownTrees.translate("contextMenu.clearSectionPlanes"),
    functionalityProvider: new ClearSectionsFunctionalityProvider(treeName, dataProvider),
    toolbarIcon: "icon-section-clear",
  });

  const labelHandler = new LabelHandler(storyClipSectionProvider, "Toggle Space Labels", BreakdownTrees.translate("contextMenu.toggleSpaceLabels"), "icon-text");
  optionItems.push(labelHandler);

  const topViewHandler = new TopViewHandler([storyClipSectionProvider, spaceClipSectionProvider, buildingClipSectionProvider], "Top Down View", BreakdownTrees.translate("contextMenu.topDownView"), "icon-cube-faces-top");
  optionItems.push(topViewHandler);

  if (clipAtSpaces !== undefined) {
    const clipAtSpacesHandler = new ClipAtSpacesHandler(storyClipSectionProvider, clipAtSpaces, "Clip At Spaces", BreakdownTrees.translate("contextMenu.clipAtSpaces"), "icon-section-tool");
    optionItems.push(clipAtSpacesHandler);
  }
}
