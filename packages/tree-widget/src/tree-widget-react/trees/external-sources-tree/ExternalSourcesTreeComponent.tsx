/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useActiveIModelConnection } from "@itwin/appui-react";
import { TelemetryContextProvider } from "../../shared/contexts/UseTelemetryContext.js";
import { SelectableTree } from "../../tree-header/SelectableTree.js";
import { ExternalSourcesTree } from "./ExternalSourcesTree.js";

import type { JSX } from "react";
import type { StandardTreeLabels } from "../../TreeWidgetComponentImpl.js";
import type { ExternalSourcesTreeProps } from "./ExternalSourcesTree.js";

/** @beta */
interface ExternalSourcesTreeComponentProps extends Pick<
  ExternalSourcesTreeProps,
  | "selectionStorage"
  | "selectionMode"
  | "hierarchyLevelConfig"
  | "selectionMode"
  | "emptyTreeContent"
  | "getInlineActions"
  | "getMenuActions"
  | "getContextMenuActions"
  | "getTreeItemProps"
  | "treeLabel"
> {
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

/** @beta */
interface ExternalSourcesTreeComponentType {
  (props: ExternalSourcesTreeComponentProps): JSX.Element | null;
  /** Id of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`. */
  id: string;
  /** Label of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`. */
  getLabel({ standardLabels }: { standardLabels: StandardTreeLabels }): string;
}

/**
 * A component that renders `ExternalSourcesTree`.
 * @beta
 */
export const ExternalSourcesTreeComponent: ExternalSourcesTreeComponentType = ({ onFeatureUsed, onPerformanceMeasured, treeLabel, ...props }) => {
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

ExternalSourcesTreeComponent.id = "external-sources-tree-v2";

ExternalSourcesTreeComponent.getLabel = ({ standardLabels }: { standardLabels: StandardTreeLabels }) => standardLabels.externalSources;
