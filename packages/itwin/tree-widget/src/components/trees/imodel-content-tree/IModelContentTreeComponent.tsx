/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "../VisibilityTreeBase.scss";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { TreeWidget } from "../../../TreeWidget";
import { AutoSizer } from "../../utils/AutoSizer";
import { IModelContentTree } from "./IModelContentTree";

import type { IModelContentTreeProps } from "./IModelContentTree";

/**
 * Props for [[IModelContentTreeComponent]].
 * @public
 */
export type IModelContentTreeComponentProps = Omit<IModelContentTreeProps, "iModel" | "width" | "height">;

/**
 * A component that renders [[IModelContentTree]]
 * @public
 */
export const IModelContentTreeComponent = (props: IModelContentTreeComponentProps) => {
  const iModel = useActiveIModelConnection();

  if (!iModel) {
    return null;
  }

  return <AutoSizer>{({ width, height }) => <IModelContentTree {...props} iModel={iModel} width={width} height={height} />}</AutoSizer>;
};

/**
 * Id of the component. May be used when a creating a [[TreeDefinition]] for [[SelectableTree]].
 * @public
 */
IModelContentTreeComponent.id = "imodel-content-tree";

/**
 * Label of the component. May be used when a creating a [[TreeDefinition]] for [[SelectableTree]].
 * @public
 */
IModelContentTreeComponent.getLabel = () => TreeWidget.translate("imodelContent");
