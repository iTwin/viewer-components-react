/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useActiveIModelConnection } from "@itwin/appui-react";
import { TreeWidget } from "../../../TreeWidget.js";
import { TelemetryContextProvider } from "../common/UseTelemetryContext.js";
import { IModelContentTree } from "./IModelContentTree.js";

import type { JSX } from "react";
import type { IModelContentTreeProps } from "./IModelContentTree.js";

/** @beta */
interface IModelContentTreeComponentProps extends Pick<
  IModelContentTreeProps,
  "getSchemaContext" | "selectionStorage" | "density" | "hierarchyConfig" | "hierarchyLevelConfig" | "selectionMode"
> {
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

/** @beta */
interface IModelContentTreeComponentType {
  (input: IModelContentTreeComponentProps): JSX.Element | null;
  /** Id of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`. */
  id: string;
  /** Label of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`. */
  getLabel(): string;
}

/**
 * A component that renders `IModelContentTree`.
 * @beta
 */
export const IModelContentTreeComponent: IModelContentTreeComponentType = ({ onFeatureUsed, onPerformanceMeasured, ...props }) => {
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

IModelContentTreeComponent.id = "imodel-content-tree-v2";

IModelContentTreeComponent.getLabel = () => TreeWidget.translate("imodelContentTree.label");
