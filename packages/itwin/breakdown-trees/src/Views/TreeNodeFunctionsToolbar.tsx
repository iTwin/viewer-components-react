/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IconButton } from "./IconButton";
import * as React from "react";
import type { TreeModel, TreeModelNode } from "@itwin/components-react";
import type { FunctionIconInfo, TreeNodeFunctionIconInfoMapper } from "./FunctionalityProviders/TreeNodeFunctionIconMapper";

export enum ToolbarItemKeys {
  zoom = "ZoomToSelectedElements",
  selectRelated = "SelectRelated",
  createSectionPlanes = "CreateSectionPlanes",
  clearSectionPlanes = "ClearSectionPlanes"
}
export interface TreeNodeFunctionsToolbarProps {
  treeModel: TreeModel;
  treeNodeIconMapper: TreeNodeFunctionIconInfoMapper;
  selectedNodes: TreeModelNode[];
}

export const TreeNodeFunctionsToolbar: React.FC<TreeNodeFunctionsToolbarProps> = (props: TreeNodeFunctionsToolbarProps) => {
  const [toolBarIcons, setToolbarIcons] = React.useState<React.ReactNode[] | undefined>(undefined);
  const [clickedInfo, setClickedInfo] = React.useState<FunctionIconInfo | undefined>(undefined);

  React.useEffect(() => {
    getToolbarIcons(props.treeNodeIconMapper, props.selectedNodes, setClickedInfo) // eslint-disable-line @typescript-eslint/no-floating-promises
      .then((icons) => setToolbarIcons(icons));
  }, [props.treeNodeIconMapper, props.selectedNodes]);

  void React.useMemo(async () => {
    if (clickedInfo) {
      await clickedInfo.functionalityProvider.performAction(props.selectedNodes, props.treeModel);
      setClickedInfo(undefined);
    }
  }, [clickedInfo, props.selectedNodes, props.treeModel]);

  return (<div className="custom-tree-toolbar">
    {toolBarIcons}
  </div>);
};

async function getToolbarIcons(iconMapper: TreeNodeFunctionIconInfoMapper, selectedNodes: TreeModelNode[], setClickedInfo: (info: FunctionIconInfo) => void) {
  const items: React.ReactNode[] = [];
  let functionIconInfos: Array<FunctionIconInfo> = [];
  if (selectedNodes.length === 1) {
    functionIconInfos = await iconMapper.getFunctionIconInfosFor(selectedNodes[0]);
  } else {
    for (const node of selectedNodes) {
      const functionIconInfosOfNode = await iconMapper.getFunctionIconInfosFor(node);
      const newInfos = functionIconInfosOfNode.filter((i: FunctionIconInfo) => functionIconInfos.findIndex((fi: FunctionIconInfo) => fi.key === i.key) === -1);
      functionIconInfos.push(...newInfos);
    }
  }
  functionIconInfos.forEach((info: FunctionIconInfo) => {
    if (selectedNodes.length > 1 && info.key === ToolbarItemKeys.zoom) {
      info.disabled = true;
    }
    items.push(
      <IconButton
        key={info.key}
        icon={info.toolbarIcon}
        className={"toolbar-icon"}
        disabled={info.disabled !== false}
        onClick={() => { setClickedInfo(info); }}
        title={info.label}
      />,
    );
  });
  return items.reverse();
}
