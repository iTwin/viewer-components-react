/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useActiveIModelConnection } from "@itwin/appui-react";
import { TreeWidget } from "../../../TreeWidget.js";
import { SelectableTree } from "../../tree-header/SelectableTree.js";
import { TelemetryContextProvider } from "../common/UseTelemetryContext.js";
import { IModelContentTree } from "./IModelContentTree.js";

import type { IModelContentTreeProps } from "./IModelContentTree.js";

/** @beta */
interface IModelContentTreeComponentProps
  extends Pick<
    IModelContentTreeProps,
    | "selectionStorage"
    | "hierarchyConfig"
    | "hierarchyLevelConfig"
    | "selectionMode"
    | "emptyTreeContent"
    | "getInlineActions"
    | "getMenuActions"
    | "getContextMenuActions"
    | "getDecorations"
    | "treeLabel"
  > {
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

/**
 * A component that renders `IModelContentTree`.
 * @beta
 */
export const IModelContentTreeComponent = ({ onFeatureUsed, onPerformanceMeasured, treeLabel, ...props }: IModelContentTreeComponentProps) => {
  const imodel = useActiveIModelConnection();

  if (!imodel) {
    return null;
  }

  return (
    <TelemetryContextProvider componentIdentifier={IModelContentTreeComponent.id} onFeatureUsed={onFeatureUsed} onPerformanceMeasured={onPerformanceMeasured}>
      <SelectableTree>
        <IModelContentTree {...props} imodel={imodel} treeLabel={treeLabel} />
      </SelectableTree>
    </TelemetryContextProvider>
  );
};

/**
 * Id of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`.
 * @beta
 */
IModelContentTreeComponent.id = "imodel-content-tree-v2";

/**
 * Label of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`.
 * @beta
 */
IModelContentTreeComponent.getLabel = () => TreeWidget.translate("imodelContentTree.label");
