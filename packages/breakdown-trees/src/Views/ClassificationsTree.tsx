/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import * as React from "react";
import { Ruleset } from "@bentley/presentation-common";
import { ControlledTreeWrapper, populateMapWithCommonMenuItems } from "./TreeWithRuleset";
import { TreeNodeFunctionIconInfoMapper } from "./FunctionalityProviders"
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { PresentationTreeDataProvider } from "@bentley/presentation-components";
import classificationRules from "../assets/ClassificationSystems.json";
import { BreakdownTrees } from "../BreakdownTrees";
import { GenericOptionItemHandler, OptionItemHandler } from "./OptionItemHandlers";
import { LoadableRuleSetComponent } from "./LoadableRuleSetComponent";
import { BeEvent } from "@bentley/bentleyjs-core";

export interface ClassificationsTreeEventHandlers {
  onZoomToElement: BeEvent<() => void>;
  onSelectRelated: BeEvent<() => void>;
}

export interface ClassificationsTreeProps {
  iModel: IModelConnection;
  displayGuids: boolean;
  setIsDisplayGuids: (displayGuids: boolean) => void;
  enableVisibility?: boolean;
  eventHandlers?: ClassificationsTreeEventHandlers;
  additionalFunctionIconMapper?: TreeNodeFunctionIconInfoMapper;
}
const CLASSIFICATIONS_TREE_NAME = "ClassificationsTree";

export const ClassificationsTree: React.FC<ClassificationsTreeProps> = (props: ClassificationsTreeProps) => {
  const dataProvider = React.useMemo(() => {
    const provider = new PresentationTreeDataProvider({
      imodel: props.iModel,
      ruleset: classificationRules.id,
    });
    provider.pagingSize = 20; // paging size is now needed for the controlled tree.
    return provider;
  }, [props.iModel]
  );

  const { functionIconMapper, optionItems, displayGuidHandler } = React.useMemo(() => {
    const functionIconMapper = props.additionalFunctionIconMapper ?? new TreeNodeFunctionIconInfoMapper(dataProvider);
    const optionItems: OptionItemHandler[] = [];
    populateMapWithCommonMenuItems(CLASSIFICATIONS_TREE_NAME, functionIconMapper, dataProvider, classificationRules.id, props.eventHandlers);
    const displayGuidHandler = new GenericOptionItemHandler("Show Guids", BreakdownTrees.translate("contextMenu.showGuids"), "icon-label", () => { return props.displayGuids; }, props.setIsDisplayGuids);
    optionItems.push(displayGuidHandler);
    return { functionIconMapper, optionItems, displayGuidHandler };
  }, [dataProvider]);

  displayGuidHandler._getItemState = () => props.displayGuids;

  const classificationsTree = React.useMemo(() => (<ControlledTreeWrapper
    iModel={props.iModel}
    loadedRuleset={classificationRules as Ruleset}
    dataProvider={dataProvider}
    treeName={CLASSIFICATIONS_TREE_NAME} treeNodeIconMapper={functionIconMapper} optionItems={optionItems}
    searchTools={true}
    displayGuids={props.displayGuids}
    setIsDisplayGuids={props.setIsDisplayGuids} enableVisibility={props.enableVisibility ? props.enableVisibility : false}
  />), [props.iModel.key, props.displayGuids, props.setIsDisplayGuids, props.enableVisibility]);

  return (
    <LoadableRuleSetComponent ruleSet={classificationRules as Ruleset} >
      {classificationsTree}
    </LoadableRuleSetComponent>
  );
}
