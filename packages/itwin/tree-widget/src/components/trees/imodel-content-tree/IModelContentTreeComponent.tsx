/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useActiveIModelConnection } from "@itwin/appui-react";
import { UnifiedSelectionProvider } from "@itwin/presentation-hierarchies-react";
import { TreeWidget } from "../../../TreeWidget";
import { AutoSizer } from "../../utils/AutoSizer";
import { IModelContentTree } from "./IModelContentTree";

import type { ComponentPropsWithoutRef } from "react";
import type { SelectionStorage } from "@itwin/presentation-hierarchies-react";

type IModelContentTreeProps = ComponentPropsWithoutRef<typeof IModelContentTree>;
interface IModelContentTreeComponentProps
  extends Pick<IModelContentTreeProps, "getSchemaContext" | "density" | "hierarchyLevelConfig" | "selectionMode" | "onPerformanceMeasured" | "onFeatureUsed"> {
  selectionStorage: SelectionStorage;
}

/**
 * A component that renders [[IModelContentTree]].
 * @beta
 */
export const IModelContentTreeComponent = (props: IModelContentTreeComponentProps) => {
  const imodel = useActiveIModelConnection();

  if (!imodel) {
    return null;
  }

  return (
    <UnifiedSelectionProvider storage={props.selectionStorage}>
      <AutoSizer>{({ width, height }) => <IModelContentTree {...props} imodel={imodel} width={width} height={height} />}</AutoSizer>
    </UnifiedSelectionProvider>
  );
};

/**
 * Id of the component. May be used when a creating a [[TreeDefinition]] for [[SelectableTree]].
 * @public
 */
IModelContentTreeComponent.id = "imodel-content-tree-v2";

/**
 * Label of the component. May be used when a creating a [[TreeDefinition]] for [[SelectableTree]].
 * @public
 */
IModelContentTreeComponent.getLabel = () => TreeWidget.translate("imodel-content");
