/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "../VisibilityTreeBase.scss";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { SvgVisibilityHalf, SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { Button, IconButton } from "@itwin/itwinui-react";
import { TreeWidget } from "../../../TreeWidget";
import { TreeHeader } from "../../tree-header/TreeHeader";
import { useTreeFilteringState } from "../../TreeFilteringState";
import { AutoSizer } from "../../utils/AutoSizer";
import { ModelsTree } from "./ModelsTree";
import { areAllModelsVisible, hideAllModels, invertAllModels, showAllModels, toggleModels } from "./ModelsVisibilityHandler";
import { queryModelsForHeaderActions } from "./Utils";

import type { IModelConnection, ScreenViewport, Viewport } from "@itwin/core-frontend";
import type { TreeHeaderButtonProps } from "../../tree-header/TreeHeader";
import type { ModelsTreeProps } from "./ModelsTree";
/**
 * Information about a single Model.
 * @public
 */
export interface ModelInfo {
  id: string;
  isPlanProjection?: boolean;
}

/**
 * Props that get passed to [[ModelsTreeComponent]] header button renderer.
 * @see ModelTreeComponentProps.headerButtons
 * @public
 */
export interface ModelsTreeHeaderButtonProps extends TreeHeaderButtonProps {
  /** A list of models available in the iModel. */
  models: ModelInfo[];
}

/**
 * Props for [[ModelsTreeComponent]].
 * @public
 */
export interface ModelTreeComponentProps extends Omit<ModelsTreeProps, "iModel" | "activeView" | "width" | "height" | "filterInfo" | "onFilterApplied"> {
  /**
   * Renderers of header buttons. Defaults to:
   * ```ts
   * [
   *   ModelsTreeComponent.ShowAllButton,
   *   ModelsTreeComponent.HideAllButton,
   *   ModelsTreeComponent.InvertButton,
   *   ModelsTreeComponent.View2DButton,
   *   ModelsTreeComponent.View3DButton,
   * ]
   * ```
   */
  headerButtons?: Array<(props: ModelsTreeHeaderButtonProps) => React.ReactNode>;
}

/**
 * A component that renders [[ModelsTree]] and a header with filtering capabilities
 * and header buttons.
 * @public
 */
export const ModelsTreeComponent = (props: ModelTreeComponentProps) => {
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
 * Id of the component. May be used when a creating a [[TreeDefinition]] for [[SelectableTree]].
 * @public
 */
ModelsTreeComponent.id = "models-tree";

/**
 * Label of the component. May be used when a creating a [[TreeDefinition]] for [[SelectableTree]].
 * @public
 */
ModelsTreeComponent.getLabel = () => TreeWidget.translate("models");

function ModelsTreeComponentImpl(props: ModelTreeComponentProps & { iModel: IModelConnection; viewport: ScreenViewport }) {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);

  const { viewport, iModel } = props;

  const { searchOptions, filterString, onFilterApplied } = useTreeFilteringState();

  useEffect(() => {
    queryModelsForHeaderActions(iModel)
      .then((modelInfos: ModelInfo[]) => {
        setAvailableModels(modelInfos);
      })
      .catch((_e) => {
        setAvailableModels([]);
      });
  }, [iModel]);

  const filterInfo = useMemo(
    () => ({ filter: filterString, activeMatchIndex: searchOptions.activeMatchIndex }),
    [filterString, searchOptions.activeMatchIndex],
  );

  return (
    <div className="tree-widget-tree-with-header">
      <TreeHeader
        onFilterClear={searchOptions.onFilterCancel}
        onFilterStart={searchOptions.onFilterStart}
        onSelectedChanged={searchOptions.onResultSelectedChanged}
        resultCount={searchOptions.matchedResultCount}
        selectedIndex={searchOptions.activeMatchIndex}
        density={props.density}
      >
        {props.headerButtons
          ? props.headerButtons.map((btn, index) => <Fragment key={index}>{btn({ viewport, models: availableModels })}</Fragment>)
          : [
              <ShowAllButton viewport={viewport} models={availableModels} key="show-all-btn" density={props.density} />,
              <HideAllButton viewport={viewport} models={availableModels} key="hide-all-btn" density={props.density} />,
              <InvertButton viewport={viewport} models={availableModels} key="invert-all-btn" density={props.density} />,
              <View2DButton viewport={viewport} models={availableModels} key="view-2d-btn" density={props.density} />,
              <View3DButton viewport={viewport} models={availableModels} key="view-3d-btn" density={props.density} />,
            ]}
      </TreeHeader>
      <div className="tree-widget-tree-content">
        <AutoSizer>
          {({ width, height }) => (
            <ModelsTree
              {...props}
              iModel={iModel}
              activeView={viewport}
              width={width}
              height={height}
              filterInfo={filterInfo}
              onFilterApplied={onFilterApplied}
            />
          )}
        </AutoSizer>
      </div>
    </div>
  );
}

function ShowAllButton(props: ModelsTreeHeaderButtonProps) {
  return (
    <IconButton
      className="header-button"
      size={props.density === "enlarged" ? undefined : "small"}
      styleType="borderless"
      title={TreeWidget.translate("showAll")}
      onClick={() =>
        void showAllModels(
          props.models.map((model) => model.id),
          props.viewport,
        )
      }
    >
      <SvgVisibilityShow />
    </IconButton>
  );
}

function HideAllButton(props: ModelsTreeHeaderButtonProps) {
  return (
    <IconButton
      className="header-button"
      size={props.density === "enlarged" ? undefined : "small"}
      styleType="borderless"
      title={TreeWidget.translate("hideAll")}
      onClick={() =>
        void hideAllModels(
          props.models.map((model) => model.id),
          props.viewport,
        )
      }
    >
      <SvgVisibilityHide />
    </IconButton>
  );
}

function InvertButton(props: ModelsTreeHeaderButtonProps) {
  return (
    <IconButton
      className="header-button"
      size={props.density === "enlarged" ? undefined : "small"}
      styleType="borderless"
      title={TreeWidget.translate("invert")}
      onClick={() =>
        void invertAllModels(
          props.models.map((model) => model.id),
          props.viewport,
        )
      }
    >
      <SvgVisibilityHalf />
    </IconButton>
  );
}

function View2DButton(props: ModelsTreeHeaderButtonProps) {
  const models2d = useMemo(() => {
    return props.models.filter((model) => model.isPlanProjection).map((model) => model.id);
  }, [props.models]);

  const [is2dToggleActive, setIs2dToggleActive] = useState(false);

  useEffect(() => {
    setIs2dToggleActive(areAllModelsVisible(models2d, props.viewport));
    return props.viewport.onViewedModelsChanged.addListener((vp: Viewport) => setIs2dToggleActive(areAllModelsVisible(models2d, vp)));
  }, [models2d, props.viewport]);

  return (
    <Button
      className="header-button"
      size={props.density === "enlarged" ? undefined : "small"}
      styleType="borderless"
      title={TreeWidget.translate("toggle2DViews")}
      onClick={() => void toggleModels(models2d, is2dToggleActive, props.viewport)}
      disabled={models2d.length === 0}
      endIcon={is2dToggleActive ? <SvgVisibilityShow /> : <SvgVisibilityHide />}
    >
      {TreeWidget.translate("label2D")}
    </Button>
  );
}

function View3DButton(props: ModelsTreeHeaderButtonProps) {
  const models3d = useMemo(() => {
    return props.models.filter((model) => !model.isPlanProjection).map((model) => model.id);
  }, [props.models]);

  const [is3dToggleActive, setIs3dToggleActive] = useState(false);

  useEffect(() => {
    setIs3dToggleActive(areAllModelsVisible(models3d, props.viewport));
    return props.viewport.onViewedModelsChanged.addListener((vp: Viewport) => setIs3dToggleActive(areAllModelsVisible(models3d, vp)));
  }, [models3d, props.viewport]);

  return (
    <Button
      className="header-button"
      size={props.density === "enlarged" ? undefined : "small"}
      styleType="borderless"
      title={TreeWidget.translate("toggle3DViews")}
      onClick={() => void toggleModels(models3d, is3dToggleActive, props.viewport)}
      disabled={models3d.length === 0}
      endIcon={is3dToggleActive ? <SvgVisibilityShow /> : <SvgVisibilityHide />}
    >
      {TreeWidget.translate("label3D")}
    </Button>
  );
}
