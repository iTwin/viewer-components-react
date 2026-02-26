/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Fragment, useEffect } from "react";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { TreeWidget } from "../../../TreeWidget.js";
import { SelectableTree } from "../../tree-header/SelectableTree.js";
import { FocusedInstancesContextProvider, useFocusedInstancesContext } from "../common/FocusedInstancesContext.js";
import { SharedTreeContextProviderInternal } from "../common/internal/SharedTreeWidgetContextProviderInternal.js";
import { useActiveTreeWidgetViewport } from "../common/internal/UseActiveTreeWidgetViewport.js";
import { TelemetryContextProvider } from "../common/UseTelemetryContext.js";
import { ModelsTree } from "./ModelsTree.js";
import {
  HideAllButton,
  InvertButton,
  ShowAllButton,
  ToggleInstancesFocusButton,
  useModelsTreeButtonProps,
  View2DButton,
  View3DButton,
} from "./ModelsTreeButtons.js";

import type { ReactNode } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { TreeWidgetViewport } from "../common/TreeWidgetViewport.js";
import type { ModelsTreeProps } from "./ModelsTree.js";
import type { ModelsTreeHeaderButtonProps, ModelsTreeHeaderButtonType } from "./ModelsTreeButtons.js";

/** @public */
interface ModelsTreeComponentProps extends Pick<
  ModelsTreeProps,
  | "selectionStorage"
  | "hierarchyLevelConfig"
  | "selectionMode"
  | "selectionPredicate"
  | "hierarchyConfig"
  | "visibilityHandlerOverrides"
  | "getSearchPaths"
  | "searchText"
  | "emptyTreeContent"
  | "getInlineActions"
  | "getMenuActions"
  | "getContextMenuActions"
  | "getTreeItemProps"
  | "getSubTreePaths"
  | "treeLabel"
> {
  /**
   * Renderers of header buttons. Defaults to:
   * ```ts
   * [
   *   ModelsTreeComponent.ShowAllButton,
   *   ModelsTreeComponent.HideAllButton,
   *   ModelsTreeComponent.InvertButton,
   *   ModelsTreeComponent.View2DButton,
   *   ModelsTreeComponent.View3DButton,
   *   ModelsTreeComponent.ToggleInstancesFocusButton,
   * ]
   * ```
   */
  headerButtons?: Array<(props: ModelsTreeHeaderButtonProps) => React.ReactNode>;
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
 * A component that renders `ModelsTree` and a header with filtering capabilities
 * and header buttons.
 *
 * **NOTE**: To use this component, wrap your app component with `SharedTreeContextProvider`.
 * @public
 */
export const ModelsTreeComponent = (props: ModelsTreeComponentProps) => {
  const iModel = useActiveIModelConnection();
  const viewport = useActiveTreeWidgetViewport({ treeWidgetViewport: props.viewport });

  if (!iModel || !viewport) {
    return null;
  }

  return (
    <FocusedInstancesContextProvider selectionStorage={props.selectionStorage} imodelKey={iModel.key}>
      <SharedTreeContextProviderInternal showWarning={true}>
        <ModelsTreeComponentImpl {...props} iModel={iModel} viewport={viewport} />
      </SharedTreeContextProviderInternal>
    </FocusedInstancesContextProvider>
  );
};

/**
 * Renders a "Show all" button that enables display of all models.
 * @public
 */
ModelsTreeComponent.ShowAllButton = ShowAllButton as ModelsTreeHeaderButtonType;

/**
 * Renders a "Hide all" button that disables display of all models.
 * @public
 */
ModelsTreeComponent.HideAllButton = HideAllButton as ModelsTreeHeaderButtonType;

/**
 * Renders an "Invert all" button that inverts display of all models.
 * @public
 */
ModelsTreeComponent.InvertButton = InvertButton as ModelsTreeHeaderButtonType;

/**
 * Renders a "View 2D" button that enables display of all plan projection models and disables all others.
 * @public
 */
ModelsTreeComponent.View2DButton = View2DButton as ModelsTreeHeaderButtonType;

/**
 * Renders a "View 3D" button that enables display of all non-plan projection models and disables all plan projection ones.
 * @public
 */
ModelsTreeComponent.View3DButton = View3DButton as ModelsTreeHeaderButtonType;

/**
 * Renders an "Instance focus" toggle button that enables/disables instances focusing mode.
 *
 * Requires instances focus context to be provided using `FocusedInstancesContextProvider`. The context
 * is provided automatically, when using `ModelsTreeComponent`, but needs to be provided by consumers
 * when rendering `ToggleInstancesFocusButton` outside of `ModelsTreeComponent`.
 *
 * @public
 */
ModelsTreeComponent.ToggleInstancesFocusButton = ToggleInstancesFocusButton as ModelsTreeHeaderButtonType;

/**
 * Id of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`.
 * @public
 */
ModelsTreeComponent.id = "models-tree-v2";

/**
 * Label of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`.
 * @public
 */
ModelsTreeComponent.getLabel = () => TreeWidget.translate("modelsTree.label");

function ModelsTreeComponentImpl({
  iModel,
  viewport,
  headerButtons,
  onFeatureUsed,
  onPerformanceMeasured,
  searchText,
  treeLabel,
  ...treeProps
}: ModelsTreeComponentProps & { iModel: IModelConnection; viewport: TreeWidgetViewport }) {
  const { buttonProps, onModelsFiltered } = useModelsTreeButtonProps({ imodel: iModel, viewport });
  const { enabled: instanceFocusEnabled, toggle: toggleInstanceFocus } = useFocusedInstancesContext();

  const buttons: ReactNode = headerButtons
    ? headerButtons.map((btn, index) => <Fragment key={index}>{btn({ ...buttonProps, onFeatureUsed })}</Fragment>)
    : [
        <ShowAllButton {...buttonProps} key="show-all-btn" onFeatureUsed={onFeatureUsed} />,
        <HideAllButton {...buttonProps} key="hide-all-btn" onFeatureUsed={onFeatureUsed} />,
        <InvertButton {...buttonProps} key="invert-all-btn" onFeatureUsed={onFeatureUsed} />,
        <View2DButton {...buttonProps} key="view-2d-btn" onFeatureUsed={onFeatureUsed} />,
        <View3DButton {...buttonProps} key="view-3d-btn" onFeatureUsed={onFeatureUsed} />,
        <ToggleInstancesFocusButton disabled={searchText !== undefined} key="toggle-instances-focus-btn" onFeatureUsed={onFeatureUsed} />,
      ];

  useEffect(() => {
    if (instanceFocusEnabled && searchText !== undefined) {
      toggleInstanceFocus();
    }
  }, [instanceFocusEnabled, searchText, toggleInstanceFocus]);

  return (
    <TelemetryContextProvider componentIdentifier={ModelsTreeComponent.id} onFeatureUsed={onFeatureUsed} onPerformanceMeasured={onPerformanceMeasured}>
      <SelectableTree buttons={buttons}>
        <ModelsTree {...treeProps} imodel={iModel} activeView={viewport} searchText={searchText} treeLabel={treeLabel} onModelsFiltered={onModelsFiltered} />
      </SelectableTree>
    </TelemetryContextProvider>
  );
}
