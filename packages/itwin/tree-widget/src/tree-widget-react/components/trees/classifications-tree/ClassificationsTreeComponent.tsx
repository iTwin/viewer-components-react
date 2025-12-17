/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useActiveIModelConnection } from "@itwin/appui-react";
import { SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { TreeWidget } from "../../../TreeWidget.js";
import { SelectableTree } from "../../tree-header/SelectableTree.js";
import { useActiveTreeWidgetViewport } from "../common/internal/UseActiveTreeWidgetViewport.js";
import { TelemetryContextProvider } from "../common/UseTelemetryContext.js";
import { ClassificationsTree } from "./ClassificationsTree.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { TreeWidgetViewport } from "../common/TreeWidgetViewport.js";
import type { ClassificationsTreeProps } from "./ClassificationsTree.js";

/** @alpha */
interface ClassificationsTreeComponentProps
  extends Pick<
    ClassificationsTreeProps,
    | "selectionStorage"
    | "hierarchyLevelConfig"
    | "selectionMode"
    | "searchText"
    | "emptyTreeContent"
    | "getInlineActions"
    | "getMenuActions"
    | "getContextMenuActions"
    | "getDecorations"
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
 * @alpha
 */
export const ClassificationsTreeComponent = (props: ClassificationsTreeComponentProps) => {
  const iModel = useActiveIModelConnection();
  const viewport = useActiveTreeWidgetViewport({ treeWidgetViewport: props.viewport });

  if (!iModel || !viewport) {
    return null;
  }

  return <ClassificationsTreeComponentImpl {...props} iModel={iModel} viewport={viewport} />;
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
ClassificationsTreeComponent.getLabel = () => TreeWidget.translate("classificationsTree.label");

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
