/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "../VisibilityTreeBase.scss";
import React from "react";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { TreeWidget } from "../../../TreeWidget";
import { AutoSizer } from "../../utils/AutoSizer";
import { IModelContentTree, IModelContentTreeProps } from "./IModelContentTree";

export type IModelContentTreeComponentProps = Omit<IModelContentTreeProps, "iModel" | "width" | "height">;

export const IModelContentTreeComponent = (props: IModelContentTreeComponentProps) => {
  const iModel = useActiveIModelConnection();

  if (!iModel)
    return null;

  return (
    <AutoSizer>
      {({ width, height }) => (
        <IModelContentTree
          {...props}
          iModel={iModel}
          width={width}
          height={height}
        />
      )}
    </AutoSizer>
  );
};

IModelContentTreeComponent.id = "imodel-content-tree";
IModelContentTreeComponent.getLabel = () => TreeWidget.translate("imodelContent");
