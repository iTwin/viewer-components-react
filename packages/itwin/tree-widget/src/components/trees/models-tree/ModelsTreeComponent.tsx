/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "../Tree.scss";
import classNames from "classnames";
import { Fragment } from "react";
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { SvgCursorClick } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { TreeWidget } from "../../../TreeWidget";
import { TreeHeader } from "../../tree-header/TreeHeader";
import { AutoSizer } from "../../utils/AutoSizer";
import { useFocusedInstancesContext } from "../common/FocusedInstancesContext";
import { FocusedInstancesContextProvider } from "../common/FocusedInstancesContextProvider";
import { useFiltering } from "../common/UseFiltering";
import { TelemetryContextProvider } from "../common/UseTelemetryContext";
import { ModelsTree } from "./ModelsTree";
import { HideAllButton, InvertButton, ShowAllButton, useAvailableModels, View2DButton, View3DButton } from "./ModelsTreeButtons";

import type { ComponentPropsWithoutRef } from "react";
import type { IModelConnection, ScreenViewport } from "@itwin/core-frontend";
import type { ModelsTreeHeaderButtonProps } from "./ModelsTreeButtons";

type ModelsTreeProps = ComponentPropsWithoutRef<typeof ModelsTree>;

interface ModelsTreeComponentProps
  extends Pick<
    ModelsTreeProps,
    "getSchemaContext" | "selectionStorage" | "density" | "hierarchyLevelConfig" | "selectionMode" | "hierarchyConfig" | "visibilityHandlerOverrides"
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

  return <ModelsTreeComponentImpl {...props} iModel={iModel} viewport={viewport} />;
};

/**
 * Renders a "Show all" button that enables display of all models.
 * @public
 */
ModelsTreeComponent.ShowAllButton = ShowAllButton;

/**
 * Renders a "Hide all" button that disables display of all models.
 * @public
 */
ModelsTreeComponent.HideAllButton = HideAllButton;

/**
 * Renders an "Invert all" button that inverts display of all models.
 * @public
 */
ModelsTreeComponent.InvertButton = InvertButton;

/**
 * Renders a "View 2D" button that enables display of all plan projection models and disables all others.
 * @public
 */
ModelsTreeComponent.View2DButton = View2DButton;

/**
 * Renders a "View 3D" button that enables display of all non-plan projection models and disables all plan projection ones.
 * @public
 */
ModelsTreeComponent.View3DButton = View3DButton;

/**
 * Renders a "Enable/Disable instances focus" button that enables/disables instances focusing mode.
 * @public
 */
ModelsTreeComponent.ToggleInstancesFocusButton = ToggleInstancesFocusButton;

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
  const availableModels = useAvailableModels(iModel);
  const { filter, applyFilter, clearFilter } = useFiltering();
  const density = treeProps.density;
  return (
    <TelemetryContextProvider componentIdentifier={ModelsTreeComponent.id} onFeatureUsed={onFeatureUsed} onPerformanceMeasured={onPerformanceMeasured}>
      <div className={classNames("tw-tree-with-header", density === "enlarged" && "enlarge")}>
        <FocusedInstancesContextProvider selectionStorage={treeProps.selectionStorage} imodelKey={iModel.key}>
          <TreeHeader onFilterStart={applyFilter} onFilterClear={clearFilter} onSelectedChanged={() => {}} density={density}>
            {headerButtons
              ? headerButtons.map((btn, index) => <Fragment key={index}>{btn({ viewport, models: availableModels, onFeatureUsed })}</Fragment>)
              : [
                  <ShowAllButton viewport={viewport} models={availableModels} key="show-all-btn" density={density} onFeatureUsed={onFeatureUsed} />,
                  <HideAllButton viewport={viewport} models={availableModels} key="hide-all-btn" density={density} onFeatureUsed={onFeatureUsed} />,
                  <InvertButton viewport={viewport} models={availableModels} key="invert-all-btn" density={density} onFeatureUsed={onFeatureUsed} />,
                  <View2DButton viewport={viewport} models={availableModels} key="view-2d-btn" density={density} onFeatureUsed={onFeatureUsed} />,
                  <View3DButton viewport={viewport} models={availableModels} key="view-3d-btn" density={density} onFeatureUsed={onFeatureUsed} />,
                  <ToggleInstancesFocusButton key="toggle-instances-focus-btn" density={density} onFeatureUsed={onFeatureUsed} />,
                ]}
          </TreeHeader>
          <div className="tw-tree-content">
            <AutoSizer>
              {({ width, height }) => <ModelsTree {...treeProps} imodel={iModel} activeView={viewport} width={width} height={height} filter={filter} />}
            </AutoSizer>
          </div>
        </FocusedInstancesContextProvider>
      </div>
    </TelemetryContextProvider>
  );
}

function ToggleInstancesFocusButton({ density, onFeatureUsed }: { density?: "default" | "enlarged"; onFeatureUsed?: (feature: string) => void }) {
  const { enabled, toggle } = useFocusedInstancesContext();
  const title = enabled
    ? TreeWidget.translate("modelsTree.buttons.toggleFocusMode.disable.tooltip")
    : TreeWidget.translate("modelsTree.buttons.toggleFocusMode.enable.tooltip");
  return (
    <IconButton
      styleType="borderless"
      size={density === "enlarged" ? "large" : "small"}
      title={title}
      onClick={() => {
        onFeatureUsed?.("models-tree-instancesfocus");
        toggle();
      }}
      isActive={enabled}
    >
      <SvgCursorClick />
    </IconButton>
  );
}
