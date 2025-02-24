/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Fragment, useEffect } from "react";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { TreeWidget } from "../../../TreeWidget.js";
import { SelectableTree } from "../../tree-header/SelectableTree.js";
import { useFocusedInstancesContext } from "../common/FocusedInstancesContext.js";
import { FocusedInstancesContextProvider } from "../common/FocusedInstancesContextProvider.js";
import { useActiveViewport } from "../common/UseActiveViewport.js";
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

import type { ModelsTreeProps } from "./ModelsTree.js";
import type { ReactNode } from "react";
import type { IModelConnection, ScreenViewport } from "@itwin/core-frontend";
import type { ModelsTreeHeaderButtonProps, ModelsTreeHeaderButtonType } from "./ModelsTreeButtons.js";

/** @public */
interface ModelsTreeComponentProps
  extends Pick<
    ModelsTreeProps,
    | "getSchemaContext"
    | "selectionStorage"
    | "hierarchyLevelConfig"
    | "selectionMode"
    | "selectionPredicate"
    | "hierarchyConfig"
    | "visibilityHandlerOverrides"
    | "getFilteredPaths"
    | "filter"
    | "noDataMessage"
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
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

/**
 * A component that renders `ModelsTree` and a header with filtering capabilities
 * and header buttons.
 *
 * @public
 */
export const ModelsTreeComponent = (props: ModelsTreeComponentProps) => {
  const iModel = useActiveIModelConnection();
  const viewport = useActiveViewport();

  if (!iModel || !viewport) {
    return null;
  }

  return (
    <FocusedInstancesContextProvider selectionStorage={props.selectionStorage} imodelKey={iModel.key}>
      <ModelsTreeComponentImpl {...props} iModel={iModel} viewport={viewport} />
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
 * Renders a "Enable/Disable instances focus" button that enables/disables instances focusing mode.
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
  filter,
  ...treeProps
}: ModelsTreeComponentProps & { iModel: IModelConnection; viewport: ScreenViewport }) {
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
        <ToggleInstancesFocusButton disabled={filter !== undefined} key="toggle-instances-focus-btn" onFeatureUsed={onFeatureUsed} />,
      ];

  useEffect(() => {
    if (instanceFocusEnabled && filter !== undefined) {
      toggleInstanceFocus();
    }
  }, [instanceFocusEnabled, filter, toggleInstanceFocus]);

  return (
    <TelemetryContextProvider componentIdentifier={ModelsTreeComponent.id} onFeatureUsed={onFeatureUsed} onPerformanceMeasured={onPerformanceMeasured}>
      <SelectableTree buttons={buttons}>
        <ModelsTree {...treeProps} imodel={iModel} activeView={viewport} filter={filter} onModelsFiltered={onModelsFiltered} />
      </SelectableTree>
    </TelemetryContextProvider>
  );
}
