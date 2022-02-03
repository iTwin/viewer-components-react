/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import type { Ruleset } from "@itwin/presentation-common";
import { ControlledTreeWrapper, populateMapWithCommonMenuItems } from "./TreeWithRuleset";
import { TreeNodeFunctionIconInfoMapper } from "./FunctionalityProviders/TreeNodeFunctionIconMapper";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import { PresentationTreeDataProvider } from "@itwin/presentation-components";
import type { IModelConnection } from "@itwin/core-frontend";
import componentIndex from "../assets/ComponentIndex.json";
import { BreakdownTrees } from "../BreakdownTrees";
import type { OptionItemHandler } from "./OptionItemHandlers";
import { GenericOptionItemHandler } from "./OptionItemHandlers/GenericOptionItemHandler";
import { LoadableRuleSetComponent } from "./LoadableRuleSetComponent";
import type { BeEvent } from "@itwin/core-bentley";

export interface ComponentIndexEventHandlers {
  onZoomToElement: BeEvent<() => void>;
  onSelectRelated: BeEvent<() => void>;
}

export interface ComponentIndexProps {
  iModel: IModelConnection;
  displayGuids: boolean;
  setIsDisplayGuids: (displayGuids: boolean) => void;
  enableVisibility?: boolean;
  eventHandlers?: ComponentIndexEventHandlers;
  additionalFunctionIconMapper?: TreeNodeFunctionIconInfoMapper;
}
const COMPONENT_INDEX_NAME = "ComponentIndex";

export const ComponentIndex: React.FC<ComponentIndexProps> = (props: ComponentIndexProps) => {
  const treeName = "ComponentIndexTree";
  const dataProvider = React.useMemo(() => {
    const provider = new PresentationTreeDataProvider({
      imodel: props.iModel,
      ruleset: componentIndex.id,
    });
    provider.pagingSize = 20; // paging size is now needed for the controlled tree.
    return provider;
  }, [props.iModel],
  );

  const { functionIconMapper, optionItems, displayGuidHandler } = React.useMemo(() => {
    const functionIconMapperInner = props.additionalFunctionIconMapper ?? new TreeNodeFunctionIconInfoMapper(dataProvider);
    const optionItemsInner: OptionItemHandler[] = [];

    populateContextMenuItems(treeName, functionIconMapperInner, dataProvider, props.eventHandlers);

    const displayGuidHandlerInner = new GenericOptionItemHandler("Show Guids", BreakdownTrees.translate("contextMenu.showGuids"), "icon-label", () => { return props.displayGuids; }, props.setIsDisplayGuids);
    optionItemsInner.push(displayGuidHandlerInner);
    return { functionIconMapper: functionIconMapperInner, optionItems: optionItemsInner, displayGuidHandler: displayGuidHandlerInner };
  }, [dataProvider, props.eventHandlers, props.setIsDisplayGuids, props.displayGuids, props.additionalFunctionIconMapper]);

  displayGuidHandler._getItemState = () => props.displayGuids;

  const componentIndexTree = React.useMemo(() => (<ControlledTreeWrapper
    iModel={props.iModel}
    loadedRuleset={componentIndex as Ruleset}
    dataProvider={dataProvider}
    treeName={COMPONENT_INDEX_NAME} treeNodeIconMapper={functionIconMapper} optionItems={optionItems}
    searchTools={true}
    displayGuids={props.displayGuids}
    setIsDisplayGuids={props.setIsDisplayGuids}
    enableVisibility={props.enableVisibility ? props.enableVisibility : false}
  />), [props.iModel, props.displayGuids, props.setIsDisplayGuids, props.enableVisibility, dataProvider, functionIconMapper, optionItems]);

  return (
    <LoadableRuleSetComponent ruleSet={componentIndex as Ruleset} >
      {componentIndexTree}
    </LoadableRuleSetComponent>
  );
};

function populateContextMenuItems(treeName: string, mapper: TreeNodeFunctionIconInfoMapper, dataProvider: IPresentationTreeDataProvider, eventHandlers?: ComponentIndexEventHandlers) {
  populateMapWithCommonMenuItems(treeName, mapper, dataProvider, componentIndex.id, eventHandlers);
}
