/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Ruleset } from "@bentley/presentation-common";
import { ControlledTreeWrapper, populateMapWithCommonMenuItems } from "./TreeWithRuleset";
import { FunctionIconInfo, TreeNodeFunctionIconInfoMapper } from "./FunctionalityProviders";
import { IPresentationTreeDataProvider, PresentationTreeDataProvider } from "@bentley/presentation-components";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import componentIndex from "../rulesets/ComponentIndex.json";
import { TreeWidget as BuildingUIComponents } from "../../TreeWidget";
import { GenericOptionItemHandler, OptionItemHandler } from "./OptionItemHandlers";
import { LoadableRuleSetComponent } from "./LoadableRuleSetComponent";

export interface ComponentIndexProps {
  iModel: IModelConnection;
  displayGuids: boolean;
  setIsDisplayGuids: (displayGuids: boolean) => void;
  enableVisibility?: boolean;
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
    const functionIconMapper = new TreeNodeFunctionIconInfoMapper(dataProvider);
    const optionItems: OptionItemHandler[] = [];

    populateContextMenuItems(treeName, functionIconMapper, dataProvider);

    const displayGuidHandler = new GenericOptionItemHandler("Show Guids", BuildingUIComponents.translate("contextMenu.showGuids"), "icon-label", () => { return props.displayGuids; }, props.setIsDisplayGuids);
    optionItems.push(displayGuidHandler);
    return { functionIconMapper, optionItems, displayGuidHandler };
  }, [dataProvider]);

  displayGuidHandler._getItemState = () => props.displayGuids;

  const componentIndexTree = React.useMemo(() => (<ControlledTreeWrapper
    iModel={props.iModel}
    loadedRuleset={componentIndex as Ruleset}
    dataProvider={dataProvider}
    treeName={COMPONENT_INDEX_NAME} treeNodeIconMapper={functionIconMapper} optionItems={optionItems}
    searchTools={false}
    displayGuids={props.displayGuids}
    setIsDisplayGuids={props.setIsDisplayGuids}
    enableVisibility={props.enableVisibility ? props.enableVisibility : false}
  />), [props.iModel, props.displayGuids, props.setIsDisplayGuids]);

  return (
    <LoadableRuleSetComponent ruleSet={componentIndex as Ruleset} >
      {componentIndexTree}
    </LoadableRuleSetComponent>
  );
}

function populateContextMenuItems(treeName: string, mapper: TreeNodeFunctionIconInfoMapper, dataProvider: IPresentationTreeDataProvider) {
  populateMapWithCommonMenuItems(treeName, mapper, dataProvider, componentIndex.id);
}
