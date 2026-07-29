/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Fragment, useEffect } from "react";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { TreeWidget } from "../../../TreeWidget.js";
import { TreeWithHeader } from "../../tree-header/TreeWithHeader.js";
import { FocusedInstancesContextProvider, useFocusedInstancesContext } from "../common/FocusedInstancesContext.js";
import { useActiveViewport } from "../common/UseActiveViewport.js";
import { useFiltering } from "../common/UseFiltering.js";
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
import type { IModelConnection, ScreenViewport } from "@itwin/core-frontend";
import type { ModelsTreeProps } from "./ModelsTree.js";
import type { ModelsTreeHeaderButtonProps, ModelsTreeHeaderButtonType } from "./ModelsTreeButtons.js";

/** @public */
interface ModelsTreeComponentProps extends Pick<
  ModelsTreeProps,
  | "getSchemaContext"
  | "selectionStorage"
  | "density"
  | "hierarchyLevelConfig"
  | "selectionMode"
  | "selectionPredicate"
  | "hierarchyConfig"
  | "visibilityHandlerOverrides"
  | "getFilteredPaths"
  | "getSubTreePaths"
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
  ...treeProps
}: ModelsTreeComponentProps & { iModel: IModelConnection; viewport: ScreenViewport }) {
  const { buttonProps, onModelsFiltered } = useModelsTreeButtonProps({ imodel: iModel, viewport });
  const { filter, applyFilter, clearFilter } = useFiltering();
  const { enabled: instanceFocusEnabled } = useFocusedInstancesContext();
  const density = treeProps.density;

  const buttons: ReactNode = headerButtons
    ? headerButtons.map((btn, index) => <Fragment key={index}>{btn({ ...buttonProps, onFeatureUsed })}</Fragment>)
    : [
        <ShowAllButton {...buttonProps} key="show-all-btn" density={density} onFeatureUsed={onFeatureUsed} />,
        <HideAllButton {...buttonProps} key="hide-all-btn" density={density} onFeatureUsed={onFeatureUsed} />,
        <InvertButton {...buttonProps} key="invert-all-btn" density={density} onFeatureUsed={onFeatureUsed} />,
        <View2DButton {...buttonProps} key="view-2d-btn" density={density} onFeatureUsed={onFeatureUsed} />,
        <View3DButton {...buttonProps} key="view-3d-btn" density={density} onFeatureUsed={onFeatureUsed} />,
        <ToggleInstancesFocusButton key="toggle-instances-focus-btn" density={density} onFeatureUsed={onFeatureUsed} />,
      ];

  useEffect(() => {
    if (instanceFocusEnabled) {
      clearFilter();
    }
  }, [instanceFocusEnabled, clearFilter]);

  return (
    <TelemetryContextProvider componentIdentifier={ModelsTreeComponent.id} onFeatureUsed={onFeatureUsed} onPerformanceMeasured={onPerformanceMeasured}>
      <TreeWithHeader
        filteringProps={{
          onFilterStart: applyFilter,
          onFilterClear: clearFilter,
          isDisabled: instanceFocusEnabled,
        }}
        buttons={buttons}
        density={density}
      >
        <ModelsTree {...treeProps} imodel={iModel} activeView={viewport} filter={filter} onModelsFiltered={onModelsFiltered} />
      </TreeWithHeader>
    </TelemetryContextProvider>
  );
}
