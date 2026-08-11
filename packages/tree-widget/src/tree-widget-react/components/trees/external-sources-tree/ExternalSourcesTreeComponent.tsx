/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useActiveIModelConnection } from "@itwin/appui-react";
import { TreeWidget } from "../../../TreeWidget.js";
import { TelemetryContextProvider } from "../common/UseTelemetryContext.js";
import { ExternalSourcesTree } from "./ExternalSourcesTree.js";

import type { JSX } from "react";
import type { ExternalSourcesTreeProps } from "./ExternalSourcesTree.js";

/** @beta */
interface ExternalSourcesTreeComponentProps extends Pick<
  ExternalSourcesTreeProps,
  "getSchemaContext" | "selectionStorage" | "selectionMode" | "density" | "hierarchyLevelConfig" | "selectionMode"
> {
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

/** @beta */
interface ExternalSourcesTreeComponentType {
  (input: ExternalSourcesTreeComponentProps): JSX.Element | null;
  /** Id of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`. */
  id: string;
  /** Label of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`. */
  getLabel(): string;
}

/**
 * A component that renders `ExternalSourcesTree`.
 * @beta
 */
export const ExternalSourcesTreeComponent: ExternalSourcesTreeComponentType = ({ onFeatureUsed, onPerformanceMeasured, ...props }) => {
  const imodel = useActiveIModelConnection();

  if (!imodel) {
    return null;
  }

  return (
    <TelemetryContextProvider componentIdentifier={ExternalSourcesTreeComponent.id} onFeatureUsed={onFeatureUsed} onPerformanceMeasured={onPerformanceMeasured}>
      <ExternalSourcesTree {...props} imodel={imodel} />
    </TelemetryContextProvider>
  );
};

ExternalSourcesTreeComponent.id = "external-sources-tree-v2";

ExternalSourcesTreeComponent.getLabel = () => TreeWidget.translate("externalSourcesTree.label");
