/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useActiveIModelConnection } from "@itwin/appui-react";
import { SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { TreeWidget } from "../../../TreeWidget.js";
import { SelectableTree } from "../../tree-header/SelectableTree.js";
import { useActiveViewport } from "../common/internal/UseActiveViewport.js";
import { TelemetryContextProvider } from "../common/UseTelemetryContext.js";
import { ClassificationsTree } from "./ClassificationsTree.js";

import type { ClassificationsTreeProps } from "./ClassificationsTree.js";
import type { IModelConnection, ScreenViewport } from "@itwin/core-frontend";

/** @alpha */
interface ClassificationsTreeComponentProps
  extends Pick<
    ClassificationsTreeProps,
    "selectionStorage" | "hierarchyLevelConfig" | "selectionMode" | "emptyTreeContent" | "getActions" | "getDecorations" | "hierarchyConfig" | "onLabelChanged"
  > {
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

/**
 * A component that renders `ClassificationsTree` with active iModel and viewport.
 * @alpha
 */
export const ClassificationsTreeComponent = (props: ClassificationsTreeComponentProps) => {
  const iModel = useActiveIModelConnection();
  const viewport = useActiveViewport();

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
  ...treeProps
}: ClassificationsTreeComponentProps & { iModel: IModelConnection; viewport: ScreenViewport }) {
  return (
    <TelemetryContextProvider componentIdentifier={ClassificationsTreeComponent.id} onFeatureUsed={onFeatureUsed} onPerformanceMeasured={onPerformanceMeasured}>
      <SelectableTree>
        <ClassificationsTree {...treeProps} imodel={iModel} activeView={viewport} />
      </SelectableTree>
    </TelemetryContextProvider>
  );
}
