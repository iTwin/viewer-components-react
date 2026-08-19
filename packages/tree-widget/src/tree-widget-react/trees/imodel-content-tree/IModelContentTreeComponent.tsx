/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useActiveIModelConnection } from "@itwin/appui-react";
import { TelemetryContextProvider } from "../../shared/contexts/TelemetryContext.js";
import { SelectableTree } from "../../tree-header/SelectableTree.js";
import { IModelContentTree } from "./IModelContentTree.js";

import type { JSX } from "react";
import type { StandardTreeLabels } from "../../TreeWidgetComponentImpl.js";
import type { IModelContentTreeProps } from "./IModelContentTree.js";

/** @beta */
interface IModelContentTreeComponentProps extends Pick<
  IModelContentTreeProps,
  | "selectionStorage"
  | "hierarchyConfig"
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
interface IModelContentTreeComponentType {
  (props: IModelContentTreeComponentProps): JSX.Element | null;
  /** Id of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`. */
  id: string;
  /** Label of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`. */
  getLabel({ standardLabels }: { standardLabels: StandardTreeLabels }): string;
}

/**
 * A component that renders `IModelContentTree`.
 * @beta
 */
export const IModelContentTreeComponent: IModelContentTreeComponentType = ({ onFeatureUsed, onPerformanceMeasured, treeLabel, ...props }) => {
  const imodel = useActiveIModelConnection();

  if (!imodel) {
    return null;
  }

  return (
    <TelemetryContextProvider componentIdentifier={IModelContentTreeComponent.id} onFeatureUsed={onFeatureUsed} onPerformanceMeasured={onPerformanceMeasured}>
      <SelectableTree>
        <IModelContentTree {...props} imodel={imodel} treeLabel={treeLabel} />
      </SelectableTree>
    </TelemetryContextProvider>
  );
};

IModelContentTreeComponent.id = "imodel-content-tree-v2";

IModelContentTreeComponent.getLabel = ({ standardLabels }: { standardLabels: StandardTreeLabels }) => standardLabels.imodelContent;
