/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useActiveIModelConnection } from "@itwin/appui-react";
import { TreeWidget } from "../../../TreeWidget.js";
import { SelectableTree } from "../../tree-header/SelectableTree.js";
import { TelemetryContextProvider } from "../common/UseTelemetryContext.js";
import { ExternalSourcesTree } from "./ExternalSourcesTree.js";

import type { ExternalSourcesTreeProps } from "./ExternalSourcesTree.js";

/** @beta */
interface ExternalSourcesTreeComponentProps
  extends Pick<
    ExternalSourcesTreeProps,
    | "selectionStorage"
    | "selectionMode"
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
 * A component that renders `ExternalSourcesTree`.
 * @beta
 */
export const ExternalSourcesTreeComponent = ({ onFeatureUsed, onPerformanceMeasured, treeLabel, ...props }: ExternalSourcesTreeComponentProps) => {
  const imodel = useActiveIModelConnection();

  if (!imodel) {
    return null;
  }

  return (
    <TelemetryContextProvider componentIdentifier={ExternalSourcesTreeComponent.id} onFeatureUsed={onFeatureUsed} onPerformanceMeasured={onPerformanceMeasured}>
      <SelectableTree>
        <ExternalSourcesTree {...props} imodel={imodel} treeLabel={treeLabel} />
      </SelectableTree>
    </TelemetryContextProvider>
  );
};

/**
 * Id of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`.
 * @beta
 */
ExternalSourcesTreeComponent.id = "external-sources-tree-v2";

/**
 * Label of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`.
 * @beta
 */
ExternalSourcesTreeComponent.getLabel = () => TreeWidget.translate("externalSourcesTree.label");
