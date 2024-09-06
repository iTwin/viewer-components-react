/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useActiveIModelConnection } from "@itwin/appui-react";
import { TreeWidget } from "../../../TreeWidget";
import { TelemetryContextProvider } from "../common/UseTelemetryContext";
import { IModelContentTree } from "./IModelContentTree";

import type { IModelContentTreeProps } from "./IModelContentTree";

/** @beta */
interface IModelContentTreeComponentProps
  extends Pick<IModelContentTreeProps, "getSchemaContext" | "selectionStorage" | "density" | "hierarchyLevelConfig" | "selectionMode"> {
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

/**
 * A component that renders `IModelContentTree`.
 * @beta
 */
export const IModelContentTreeComponent = ({ onFeatureUsed, onPerformanceMeasured, ...props }: IModelContentTreeComponentProps) => {
  const imodel = useActiveIModelConnection();

  if (!imodel) {
    return null;
  }

  return (
    <TelemetryContextProvider componentIdentifier={IModelContentTreeComponent.id} onFeatureUsed={onFeatureUsed} onPerformanceMeasured={onPerformanceMeasured}>
      <IModelContentTree {...props} imodel={imodel} />
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
