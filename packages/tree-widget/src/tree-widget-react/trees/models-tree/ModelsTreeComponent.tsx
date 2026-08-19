/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Fragment, useEffect } from "react";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { Skeleton } from "@mui/material";
import { FocusedInstancesContextProvider, useFocusedInstancesContext } from "../../shared/contexts/FocusedInstancesContext.js";
import { useSharedTreeContext } from "../../shared/contexts/SharedTreeContext.js";
import { TelemetryContextProvider } from "../../shared/contexts/TelemetryContext.js";
import { useActiveTreeWidgetViewport } from "../../shared/internal/hooks/UseActiveTreeWidgetViewport.js";
import { getClassesByView } from "../../shared/internal/Utils.js";
import { SelectableTree } from "../../tree-header/SelectableTree.js";
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

import type { JSX, ReactNode } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { TreeWidgetViewport } from "../../shared/TreeWidgetViewport.js";
import type { StandardTreeLabels } from "../../TreeWidgetComponentImpl.js";
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

/** @public */
interface ModelsTreeComponentType {
  (props: ModelsTreeComponentProps): JSX.Element | null;
  /** Renders a "Show all" button that enables display of all models. */
  ShowAllButton: ModelsTreeHeaderButtonType;
  /** Renders a "Hide all" button that disables display of all models. */
  HideAllButton: ModelsTreeHeaderButtonType;
  /** Renders an "Invert all" button that inverts display of all models. */
  InvertButton: ModelsTreeHeaderButtonType;
  /** Renders a "View 2D" button that enables display of all plan projection models and disables all others. */
  View2DButton: ModelsTreeHeaderButtonType;
  /** Renders a "View 3D" button that enables display of all non-plan projection models and disables all plan projection ones. */
  View3DButton: ModelsTreeHeaderButtonType;
  /**
   * Renders an "Instance focus" toggle button that enables/disables instances focusing mode.
   *
   * Requires instances focus context to be provided using `FocusedInstancesContextProvider`. The context
   * is provided automatically, when using `ModelsTreeComponent`, but needs to be provided by consumers
   * when rendering `ToggleInstancesFocusButton` outside of `ModelsTreeComponent`.
   */
  ToggleInstancesFocusButton: ModelsTreeHeaderButtonType;
  /** Id of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`. */
  id: string;
  /** Label of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`. */
  getLabel({ standardLabels }: { standardLabels: StandardTreeLabels }): string;
}

/**
 * A component that renders `ModelsTree` and a header with filtering capabilities
 * and header buttons.
 *
 * **Note:** Wrap tree components with a single `TreeWidgetContextProvider` to provide shared tree resources.
 * @public
 */
export const ModelsTreeComponent: ModelsTreeComponentType = (props) => {
  const iModel = useActiveIModelConnection();
  const viewport = useActiveTreeWidgetViewport({ treeWidgetViewport: props.viewport });

  if (!iModel || !viewport) {
    return null;
  }

  return (
    <FocusedInstancesContextProvider selectionStorage={props.selectionStorage} imodelKey={iModel.key}>
      <TelemetryContextProvider
        componentIdentifier={ModelsTreeComponent.id}
        onFeatureUsed={props.onFeatureUsed}
        onPerformanceMeasured={props.onPerformanceMeasured}
      >
        <ModelsTreeComponentImpl {...props} iModel={iModel} viewport={viewport} />
      </TelemetryContextProvider>
    </FocusedInstancesContextProvider>
  );
};

ModelsTreeComponent.ShowAllButton = ShowAllButton as ModelsTreeHeaderButtonType;

ModelsTreeComponent.HideAllButton = HideAllButton as ModelsTreeHeaderButtonType;

ModelsTreeComponent.InvertButton = InvertButton as ModelsTreeHeaderButtonType;

ModelsTreeComponent.View2DButton = View2DButton as ModelsTreeHeaderButtonType;

ModelsTreeComponent.View3DButton = View3DButton as ModelsTreeHeaderButtonType;

ModelsTreeComponent.ToggleInstancesFocusButton = ToggleInstancesFocusButton as ModelsTreeHeaderButtonType;

ModelsTreeComponent.id = "models-tree-v2";

ModelsTreeComponent.getLabel = ({ standardLabels }: { standardLabels: StandardTreeLabels }) => standardLabels.models;

function ModelsTreeComponentImpl({
  iModel,
  viewport,
  headerButtons,
  searchText,
  treeLabel,
  ...treeProps
}: ModelsTreeComponentProps & { iModel: IModelConnection; viewport: TreeWidgetViewport }) {
  const { buttonProps, onModelsFiltered } = useModelsTreeButtonProps({ imodel: iModel, viewport });
  const { enabled: instanceFocusEnabled, toggle: toggleInstanceFocus } = useFocusedInstancesContext();
  const { getBaseIdsCache } = useSharedTreeContext();
  const isLoaded =
    buttonProps.models.length > 0 ||
    getBaseIdsCache({ imodel: viewport.iModel, elementClassName: getClassesByView("3d").elementClass, type: "3d" }).elementModelCategoriesLoaded();
  const buttons: ReactNode = isLoaded
    ? headerButtons
      ? headerButtons.map((btn, index) => <Fragment key={index}>{btn(buttonProps)}</Fragment>)
      : [
          <ShowAllButton {...buttonProps} key="show-all-btn" />,
          <HideAllButton {...buttonProps} key="hide-all-btn" />,
          <InvertButton {...buttonProps} key="invert-all-btn" />,
          <View2DButton {...buttonProps} key="view-2d-btn" />,
          <View3DButton {...buttonProps} key="view-3d-btn" />,
          <ToggleInstancesFocusButton disabled={searchText !== undefined} key="toggle-instances-focus-btn" />,
        ]
    : Array.from({ length: headerButtons?.length ?? 6 }, (_, index) => <Skeleton variant={"rounded"} width={24} height={24} key={index} />);

  useEffect(() => {
    if (instanceFocusEnabled && searchText !== undefined) {
      toggleInstanceFocus();
    }
  }, [instanceFocusEnabled, searchText, toggleInstanceFocus]);

  return (
    <SelectableTree buttons={buttons}>
      <ModelsTree {...treeProps} imodel={iModel} activeView={viewport} searchText={searchText} treeLabel={treeLabel} onModelsFiltered={onModelsFiltered} />
    </SelectableTree>
  );
}
