/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useActiveIModelConnection } from "@itwin/appui-react";
import { UnifiedSelectionProvider } from "@itwin/presentation-hierarchies-react";
import { TreeWidget } from "../../../TreeWidget";
import { AutoSizer } from "../../utils/AutoSizer";
import { TelemetryContextProvider } from "../common/UseTelemetryContext";
import { ExternalSourcesTree } from "./ExternalSourcesTree";

import type { ComponentPropsWithoutRef } from "react";
import type { SelectionStorage } from "@itwin/presentation-hierarchies-react";

type ExternalSourcesTreeProps = ComponentPropsWithoutRef<typeof ExternalSourcesTree>;
interface ExternalSourcesTreeComponentProps extends Pick<ExternalSourcesTreeProps, "getSchemaContext" | "density" | "hierarchyLevelConfig" | "selectionMode"> {
  selectionStorage: SelectionStorage;
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

/**
 * A component that renders `ExternalSourcesTree`.
 * @beta
 */
export const ExternalSourcesTreeComponent = ({ onFeatureUsed, onPerformanceMeasured, selectionStorage, ...props }: ExternalSourcesTreeComponentProps) => {
  const imodel = useActiveIModelConnection();

  if (!imodel) {
    return null;
  }

  return (
    <UnifiedSelectionProvider storage={selectionStorage}>
      <TelemetryContextProvider
        componentIdentifier={ExternalSourcesTreeComponent.id}
        onFeatureUsed={onFeatureUsed}
        onPerformanceMeasured={onPerformanceMeasured}
      >
        <AutoSizer>{({ width, height }) => <ExternalSourcesTree {...props} imodel={imodel} width={width} height={height} />}</AutoSizer>
      </TelemetryContextProvider>
    </UnifiedSelectionProvider>
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
