/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import type { Ruleset } from "@itwin/presentation-common";
import { ControlledTreeWrapper, populateMapWithCommonMenuItems } from "./TreeWithRuleset";
import { TreeNodeFunctionIconInfoMapper } from "./FunctionalityProviders/TreeNodeFunctionIconMapper";
import type { IModelConnection } from "@itwin/core-frontend";
import { PresentationTreeDataProvider } from "@itwin/presentation-components";
import classificationRules from "../assets/ClassificationSystems.json";
import { BreakdownTrees } from "../BreakdownTrees";
import type { OptionItemHandler } from "./OptionItemHandlers/OptionItemHandler";
import { GenericOptionItemHandler } from "./OptionItemHandlers/GenericOptionItemHandler";
import { LoadableRuleSetComponent } from "./LoadableRuleSetComponent";
import type { BeEvent } from "@itwin/core-bentley";

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
    const functionIconMapperInner = props.additionalFunctionIconMapper ?? new TreeNodeFunctionIconInfoMapper(dataProvider);
    const optionItemsInner: OptionItemHandler[] = [];
    populateMapWithCommonMenuItems(CLASSIFICATIONS_TREE_NAME, functionIconMapperInner, dataProvider, classificationRules.id, props.eventHandlers);
    const displayGuidHandlerInner = new GenericOptionItemHandler("Show Guids", BreakdownTrees.translate("contextMenu.showGuids"), "icon-label", () => { return props.displayGuids; }, props.setIsDisplayGuids);
    optionItemsInner.push(displayGuidHandlerInner);
    return { functionIconMapper: functionIconMapperInner, optionItems: optionItemsInner, displayGuidHandler: displayGuidHandlerInner };
  }, [dataProvider, props.additionalFunctionIconMapper, props.displayGuids, props.eventHandlers, props.setIsDisplayGuids]);

  displayGuidHandler._getItemState = () => props.displayGuids;

  const classificationsTree = React.useMemo(() => (<ControlledTreeWrapper
    iModel={props.iModel}
    loadedRuleset={classificationRules as Ruleset}
    dataProvider={dataProvider}
    treeName={CLASSIFICATIONS_TREE_NAME} treeNodeIconMapper={functionIconMapper} optionItems={optionItems}
    searchTools={true}
    displayGuids={props.displayGuids}
    setIsDisplayGuids={props.setIsDisplayGuids} enableVisibility={props.enableVisibility ? props.enableVisibility : false}
  />), [props.iModel, props.displayGuids, props.setIsDisplayGuids, props.enableVisibility, dataProvider, functionIconMapper, optionItems]);

  return (
    <LoadableRuleSetComponent ruleSet={classificationRules as Ruleset} >
      {classificationsTree}
    </LoadableRuleSetComponent>
  );
};
