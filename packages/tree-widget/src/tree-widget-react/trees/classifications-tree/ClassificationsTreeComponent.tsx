/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useActiveIModelConnection } from "@itwin/appui-react";
import { SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { TelemetryContextProvider } from "../../shared/contexts/TelemetryContext.js";
import { useActiveTreeWidgetViewport } from "../../shared/internal/hooks/UseActiveTreeWidgetViewport.js";
import { SelectableTree } from "../../tree-header/SelectableTree.js";
import { ClassificationsTree } from "./ClassificationsTree.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { TreeWidgetViewport } from "../../shared/TreeWidgetViewport.js";
import type { StandardTreeLabels } from "../../TreeWidgetComponentImpl.js";
import type { ClassificationsTreeProps } from "./ClassificationsTree.js";

/** @beta */
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
 * @beta
 */
export const ClassificationsTreeComponent = (props: ClassificationsTreeComponentProps) => {
  const iModel = useActiveIModelConnection();
  const viewport = useActiveTreeWidgetViewport({ treeWidgetViewport: props.viewport });

  if (!iModel || !viewport) {
    return null;
  }

  return (
    <TelemetryContextProvider
      componentIdentifier={ClassificationsTreeComponent.id}
      onFeatureUsed={props.onFeatureUsed}
      onPerformanceMeasured={props.onPerformanceMeasured}
    >
      <ClassificationsTreeComponentImpl {...props} iModel={iModel} viewport={viewport} />
    </TelemetryContextProvider>
  );
};

/**
 * Id of the component. May be used when a creating a `TreeDefinition`.
 * @beta
 */
ClassificationsTreeComponent.id = "classifications-tree";

/**
 * Label of the component. May be used when a creating a `TreeDefinition`.
 * @beta
 */
ClassificationsTreeComponent.getLabel = ({ standardLabels }: { standardLabels: StandardTreeLabels }) => standardLabels.classifications;

/** @beta */
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
  searchText,
  treeLabel,
  ...treeProps
}: ClassificationsTreeComponentProps & { iModel: IModelConnection; viewport: TreeWidgetViewport }) {
  return (
    <SelectableTree>
      <ClassificationsTree {...treeProps} imodel={iModel} activeView={viewport} searchText={searchText} treeLabel={treeLabel} />
    </SelectableTree>
  );
}
