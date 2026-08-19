/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useActiveIModelConnection } from "@itwin/appui-react";
import { SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { SharedTreeContextProvider } from "../../shared/contexts/SharedTreeContext.js";
import { TelemetryContextProvider } from "../../shared/contexts/UseTelemetryContext.js";
import { useActiveTreeWidgetViewport } from "../../shared/internal/hooks/UseActiveTreeWidgetViewport.js";
import { SelectableTree } from "../../tree-header/SelectableTree.js";
import { ClassificationsTree } from "./ClassificationsTree.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { TreeWidgetViewport } from "../../shared/TreeWidgetViewport.js";
import type { StandardTreeLabels } from "../../TreeWidgetComponentImpl.js";
import type { ClassificationsTreeProps } from "./ClassificationsTree.js";

/** @alpha */
interface ClassificationsTreeComponentProps extends Pick<
  ClassificationsTreeProps,
  | "selectionStorage"
  | "hierarchyLevelConfig"
  | "visibilityHandlerConfig"
  | "selectionMode"
  | "searchText"
  | "emptyTreeContent"
  | "getInlineActions"
  | "getMenuActions"
  | "getContextMenuActions"
  | "getTreeItemProps"
  | "hierarchyConfig"
  | "getEditingProps"
  | "treeLabel"
> {
  /**
   * Viewport used for visibility controls.
   *
   * When viewport is not provided, `IModelApp.viewManager.selectedView` will be used.
   */
  viewport?: TreeWidgetViewport;
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

/**
 * A component that renders `ClassificationsTree` with active iModel and viewport.
 *
 * **Note:** Wrap tree components with a single `TreeWidgetContextProvider` to provide shared tree resources.
 * @alpha
 */
export const ClassificationsTreeComponent = (props: ClassificationsTreeComponentProps) => {
  const iModel = useActiveIModelConnection();
  const viewport = useActiveTreeWidgetViewport({ treeWidgetViewport: props.viewport });

  if (!iModel || !viewport) {
    return null;
  }

  return (
    <SharedTreeContextProvider showWarning={true}>
      <ClassificationsTreeComponentImpl {...props} iModel={iModel} viewport={viewport} />
    </SharedTreeContextProvider>
  );
};

/**
 * Id of the component. May be used when a creating a `TreeDefinition`.
 * @alpha
 */
ClassificationsTreeComponent.id = "classifications-tree";

/**
 * Label of the component. May be used when a creating a `TreeDefinition`.
 * @alpha
 */
ClassificationsTreeComponent.getLabel = ({ standardLabels }: { standardLabels: StandardTreeLabels }) => standardLabels.classifications;

/** @alpha */
ClassificationsTreeComponent.isSupportedByIModel = async (imodel: IModelConnection) => {
  try {
    return !!(await imodel.schemaContext.getSchemaInfo(new SchemaKey("ClassificationSystems"), SchemaMatchType.Latest));
  } catch {
    return false;
  }
};

function ClassificationsTreeComponentImpl({
  iModel,
  viewport,
  onPerformanceMeasured,
  onFeatureUsed,
  searchText,
  treeLabel,
  ...treeProps
}: ClassificationsTreeComponentProps & { iModel: IModelConnection; viewport: TreeWidgetViewport }) {
  return (
    <TelemetryContextProvider componentIdentifier={ClassificationsTreeComponent.id} onFeatureUsed={onFeatureUsed} onPerformanceMeasured={onPerformanceMeasured}>
      <SelectableTree>
        <ClassificationsTree {...treeProps} imodel={iModel} activeView={viewport} searchText={searchText} treeLabel={treeLabel} />
      </SelectableTree>
    </TelemetryContextProvider>
  );
}
