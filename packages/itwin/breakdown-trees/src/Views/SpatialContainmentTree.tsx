/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Presentation } from "@itwin/presentation-frontend";
import spatialRulesDefault from "../assets/SpatialBreakdown.json";
import spatialRulesByType from "../assets/SpatialBreakdownByType.json";
import spatialRulesByDiscipline from "../assets/SpatialBreakdownByDiscipline.json";
import spatialRulesByTypeAndDiscipline from "../assets/SpatialBreakdownByTypeAndDiscipline.json";
import type { IModelConnection, SpatialViewState } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import { PresentationTreeDataProvider } from "@itwin/presentation-components";
import type { Ruleset } from "@itwin/presentation-common";
import { ControlledTreeWrapper, populateMapWithCommonMenuItems } from "./TreeWithRuleset";
import { BreakdownTrees } from "../BreakdownTrees";
import { BuildingClipPlanesProvider } from "./FunctionalityProviders/BuildingClipPlanesProvider";
import { ClearSectionsFunctionalityProvider } from "./FunctionalityProviders/ClearSectionsFunctionalityProvider";
import { CombinedTreeNodeFunctionalityProvider } from "./FunctionalityProviders/CombinedTreeNodeFunctionalityProvider";
import { SpaceClipPlanesProvider } from "./FunctionalityProviders/SpaceClipPlanesProvider";
import { StoryClipPlanesProvider } from "./FunctionalityProviders/StoryClipPlanesProvider";
import { TreeNodeFunctionIconInfoMapper } from "./FunctionalityProviders/TreeNodeFunctionIconMapper";
import type { OptionItemHandler } from "./OptionItemHandlers/OptionItemHandler";
import { ClipAtSpacesHandler } from "./OptionItemHandlers/ClipAtSpacesHandler";
import { GenericOptionItemHandler } from "./OptionItemHandlers/GenericOptionItemHandler";
import { LabelHandler } from "./OptionItemHandlers/LabelHandler";
import { TopViewHandler } from "./OptionItemHandlers/TopViewHandler";
import { LoadableRuleSetComponent } from "./LoadableRuleSetComponent";
import { ToolbarItemKeys } from "./TreeNodeFunctionsToolbar";
import type { BeEvent } from "@itwin/core-bentley";

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
  additionalFunctionIconMapper?: TreeNodeFunctionIconInfoMapper;
}

async function updateModelsInRulesetVars() {
  const viewState = IModelApp.viewManager.selectedView?.view as SpatialViewState;
  const modelIds = viewState.modelSelector ? Array.from(viewState.modelSelector.models) : [];
  await Presentation.presentation.vars("ui-framework/SpatialBreakdown").setId64s("displayed_model_ids", modelIds);
}

const _onModelsChanged = async () => {
  await updateModelsInRulesetVars();
};

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
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      updateModelsInRulesetVars();
    }

    return () => {
      if (IModelApp.viewManager.selectedView?.view.isSpatialView()) {
        IModelApp.viewManager.selectedView.onViewedModelsChanged.removeListener(_onModelsChanged);
      }
    };
  });

  const dataProvider = React.useMemo(() => {
    const dataProviderInner = new PresentationTreeDataProvider({ imodel: props.iModel, ruleset: spatialRules.id, appendChildrenCountForGroupingNodes: true });
    dataProviderInner.pagingSize = 20; // paging size is now needed for the controlled tree.
    return dataProviderInner;
  }, [props.iModel, spatialRules.id]);

  const { functionIconMapper, optionItems, displayGuidHandler, groupByTypeHandler, groupByDisciplineHandler } = React.useMemo(() => {
    const functionIconMapperInner = props.additionalFunctionIconMapper ?? new TreeNodeFunctionIconInfoMapper(dataProvider);
    const optionItemsInner: OptionItemHandler[] = [];

    populateContextAndOptionMenuItems(treeName, functionIconMapperInner, optionItemsInner, dataProvider, spatialRules, props.eventHandlers, props.clipHeight, props.clipAtSpaces);

    const displayGuidHandlerInner = new GenericOptionItemHandler("Show Guids", BreakdownTrees.translate("contextMenu.showGuids"), "icon-label", () => props.displayGuids, props.setIsDisplayGuids);
    optionItemsInner.push(displayGuidHandlerInner);
    const groupByTypeHandlerInner = new GenericOptionItemHandler("Group By Type", BreakdownTrees.translate("contextMenu.groupByType"), "icon-hierarchy-tree", () => props.groupByType, props.setGroupByType);
    optionItemsInner.push(groupByTypeHandlerInner);
    const groupByDisciplineHandlerInner = new GenericOptionItemHandler("Group By Discipline", BreakdownTrees.translate("contextMenu.groupByDiscipline"), "icon-hierarchy-tree", () => props.groupByDiscipline, props.setGroupByDiscipline);
    optionItemsInner.push(groupByDisciplineHandlerInner);

    return { functionIconMapper: functionIconMapperInner, optionItems: optionItemsInner, displayGuidHandler: displayGuidHandlerInner, groupByTypeHandler: groupByTypeHandlerInner, groupByDisciplineHandler: groupByDisciplineHandlerInner };
  }, [dataProvider,
    props.eventHandlers,
    props.clipHeight,
    props.clipAtSpaces,
    props.displayGuids,
    props.setIsDisplayGuids,
    props.groupByType,
    props.setGroupByType,
    props.groupByDiscipline,
    props.setGroupByDiscipline,
    props.additionalFunctionIconMapper,
    spatialRules]);

  displayGuidHandler._getItemState = () => props.displayGuids;
  groupByTypeHandler._getItemState = () => props.groupByType;
  groupByDisciplineHandler._getItemState = () => props.groupByDiscipline;
  const containmentTree = React.useMemo(() => {
    return <ControlledTreeWrapper iModel={props.iModel} loadedRuleset={spatialRules} dataProvider={dataProvider}
      treeName={treeName} treeNodeIconMapper={functionIconMapper} optionItems={optionItems} searchTools={true}
      displayGuids={props.displayGuids} setIsDisplayGuids={props.setIsDisplayGuids} enableVisibility={!!props.enableVisibility} />;
  }, [props.iModel, props.displayGuids, props.setIsDisplayGuids, functionIconMapper, dataProvider, optionItems, props.enableVisibility, spatialRules]
  );

  return (<LoadableRuleSetComponent ruleSet={spatialRules}>
    {containmentTree}
  </LoadableRuleSetComponent>);
};

function populateContextAndOptionMenuItems(treeName: string, mapper: TreeNodeFunctionIconInfoMapper, optionItems: OptionItemHandler[], dataProvider: IPresentationTreeDataProvider, spatialRules: any, eventHandlers?: SpatialContainmentEventHandlers, clipHeight?: number, clipAtSpaces?: boolean) {
  const combinedFunctionalityProvider = new CombinedTreeNodeFunctionalityProvider(treeName, dataProvider);
  const storyClipSectionProvider = new StoryClipPlanesProvider(treeName, dataProvider, false, false, clipHeight);
  const spaceClipSectionProvider = new SpaceClipPlanesProvider(treeName, dataProvider, false, clipHeight);
  const buildingClipSectionProvider = new BuildingClipPlanesProvider(treeName, dataProvider, false);
  combinedFunctionalityProvider.setFunctionalityProviderForClass("BuildingSpatial:Story", storyClipSectionProvider);
  combinedFunctionalityProvider.setFunctionalityProviderForClass("BuildingSpatial:Space", spaceClipSectionProvider);
  combinedFunctionalityProvider.setFunctionalityProviderForClass("BuildingSpatial:Building", buildingClipSectionProvider);
  mapper.registerGlobal({
    key: ToolbarItemKeys.clearSectionPlanes,
    label: BreakdownTrees.translate("contextMenu.clearSectionPlanes"),
    functionalityProvider: new ClearSectionsFunctionalityProvider(treeName, dataProvider),
    toolbarIcon: "icon-section-clear",
  });
  mapper.registerForNodesOfClasses(["BuildingSpatial:Story", "BuildingSpatial:Space", "BuildingSpatial:Building"], {
    key: ToolbarItemKeys.createSectionPlanes,
    label: BreakdownTrees.translate("contextMenu.createSectionPlanes"),
    functionalityProvider: combinedFunctionalityProvider,
    toolbarIcon: "icon-section-tool",
  });

  populateMapWithCommonMenuItems(treeName, mapper, dataProvider, spatialRules.id, eventHandlers);

  const labelHandler = new LabelHandler(storyClipSectionProvider, "Toggle Space Labels", BreakdownTrees.translate("contextMenu.toggleSpaceLabels"), "icon-text");
  optionItems.push(labelHandler);

  const topViewHandler = new TopViewHandler([storyClipSectionProvider, spaceClipSectionProvider, buildingClipSectionProvider], "Top Down View", BreakdownTrees.translate("contextMenu.topDownView"), "icon-cube-faces-top");
  optionItems.push(topViewHandler);

  if (clipAtSpaces !== undefined) {
    const clipAtSpacesHandler = new ClipAtSpacesHandler(storyClipSectionProvider, clipAtSpaces, "Clip At Spaces", BreakdownTrees.translate("contextMenu.clipAtSpaces"), "icon-section-tool");
    optionItems.push(clipAtSpacesHandler);
  }
}
