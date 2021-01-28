/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IconButton } from "./IconButton";
import * as React from "react";
import { TreeModel, TreeModelNode } from "@bentley/ui-components";
import { TreeNodeFunctionIconInfoMapper, FunctionIconInfo } from "./FunctionalityProviders";


export interface TreeNodeFunctionsToolbarProps {
  treeModel: TreeModel;
  treeNodeIconMapper: TreeNodeFunctionIconInfoMapper;
  selectedNodes: TreeModelNode[];
}

export const TreeNodeFunctionsToolbar: React.FC<TreeNodeFunctionsToolbarProps> = (props: TreeNodeFunctionsToolbarProps) => {
  const [toolBarIcons, setToolbarIcons] = React.useState<React.ReactNode[] | undefined>(undefined);

  React.useEffect( () => {
    getToolbarIcons(props.treeNodeIconMapper, props.selectedNodes, props.treeModel)
      .then((icons) => setToolbarIcons(icons))
  } , [props.selectedNodes]);

  return (<div className="custom-tree-toolbar">
            {toolBarIcons}
          </div>);
};


async function getToolbarIcons(iconMapper: TreeNodeFunctionIconInfoMapper, selectedNodes: TreeModelNode[], treeModel: TreeModel ) {
  const items: React.ReactNode[] = [];
  let functionIconInfos: ReadonlyArray<FunctionIconInfo>;
  if (selectedNodes.length === 1){
    functionIconInfos = await iconMapper.getFunctionIconInfosFor(selectedNodes[0]);
  } else {
    // treat multiple selection same as none selected for now
    functionIconInfos = await iconMapper.getFunctionIconInfosFor();
  }
  functionIconInfos.forEach((info: FunctionIconInfo) => {
    items.push(
      <IconButton
              key= {info.key}
              icon= {info.toolbarIcon}
              className={"toolbar-icon"}
              disabled={info.disabled !== false}
              onClick={() => { info.functionalityProvider.performAction(selectedNodes[0], treeModel); }}
              title={info.label}
            />,
    );
  });
  return items;
}
