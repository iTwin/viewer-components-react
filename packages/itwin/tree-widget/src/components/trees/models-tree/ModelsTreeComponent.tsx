/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "../VisibilityTreeBase.scss";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { GeometricModel3dProps, ModelQueryParams } from "@itwin/core-common";
import { IModelConnection, ScreenViewport, Viewport } from "@itwin/core-frontend";
import { SvgVisibilityHalf, SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { Button, IconButton } from "@itwin/itwinui-react";
import { useTreeFilteringState } from "../../TreeFilteringState";
import { AutoSizer } from "../../utils/AutoSizer";
import { ModelsTree, ModelsTreeProps } from "./ModelsTree";
import { TreeWidget } from "../../../TreeWidget";
import { TreeHeader, TreeHeaderButtonProps } from "../../tree-header/TreeHeader";
import { areAllModelsVisible, hideAllModels, invertAllModels, showAllModels, toggleModels } from "./ModelsVisibilityHandler";

export interface ModelInfo {
  id: string;
  isPlanProjection?: boolean;
}

export interface ModelsTreeHeaderButtonProps extends TreeHeaderButtonProps {
  models: ModelInfo[];
}

export interface ModelTreeComponentProps extends Omit<ModelsTreeProps,
| "iModel"
| "activeView"
| "width"
| "height"
| "filterInfo"
| "onFilterApplied"
> {
  headerButtons?: Array<(props: ModelsTreeHeaderButtonProps) => React.ReactNode>;
}

export const ModelsTreeComponent = (props: ModelTreeComponentProps) => {
  const iModel = useActiveIModelConnection();
  const viewport = useActiveViewport();

  if (!iModel || !viewport)
    return null;

  return (
    <ModelsTreeComponentImpl {...props} iModel={iModel} viewport={viewport} />
  );
};

ModelsTreeComponent.ShowAllButton = ShowAllButton;
ModelsTreeComponent.HideAllButton = HideAllButton;
ModelsTreeComponent.InvertButton = InvertButton;
ModelsTreeComponent.View2DButton = View2DButton;
ModelsTreeComponent.View3DButton = View3DButton;
ModelsTreeComponent.id = "models-tree";
ModelsTreeComponent.getLabel = () => TreeWidget.translate("models");

function ModelsTreeComponentImpl(props: ModelTreeComponentProps & { iModel: IModelConnection, viewport: ScreenViewport }) {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);

  const { viewport, iModel } = props;

  const { searchOptions, filterString, onFilterApplied } =
    useTreeFilteringState();

  const queryModels = useCallback(async (
    vp: Viewport | undefined
  ): Promise<ModelInfo[]> => {
    if (vp === undefined) return [];

    const queryParams: ModelQueryParams = {
      from: "BisCore.GeometricModel3d",
      wantPrivate: false,
    };
    const modelProps = await iModel.models.queryProps(queryParams) ?? [];
    return modelProps
      .map(({ id, isPlanProjection }: GeometricModel3dProps) => ({ id, isPlanProjection }))
      .filter(({ id }) => id) as ModelInfo[];
  }, [iModel]);

  useEffect(() => {
    queryModels(viewport)
      .then((modelInfos: ModelInfo[]) => {
        setAvailableModels(modelInfos);
      })
      .catch((_e) => {
        setAvailableModels([]);
      });
  }, [queryModels, viewport]);

  return (
    <>
      <TreeHeader
        onFilterClear={searchOptions.onFilterCancel}
        onFilterStart={searchOptions.onFilterStart}
        onSelectedChanged={searchOptions.onResultSelectedChanged}
        resultCount={searchOptions.matchedResultCount}
        selectedIndex={searchOptions.activeMatchIndex}
      >
        {props.headerButtons
          ? props.headerButtons.map(
            (btn, index) =>
              <React.Fragment key={index}>
                {btn({ viewport, models: availableModels })}
              </React.Fragment>
          )
          : [
            <ShowAllButton viewport={viewport} models={availableModels} key="show-all-btn" />,
            <HideAllButton viewport={viewport} models={availableModels} key="hide-all-btn" />,
            <InvertButton viewport={viewport} models={availableModels} key="invert-all-btn" />,
            <View2DButton viewport={viewport} models={availableModels} key="view-2d-btn" />,
            <View3DButton viewport={viewport} models={availableModels} key="view-3d-btn" />,
          ]
        }
      </TreeHeader>
      <AutoSizer>
        {({ width, height }) => (
          <ModelsTree
            {...props}
            iModel={iModel}
            activeView={viewport}
            width={width}
            height={height}
            filterInfo={{ filter: filterString, activeMatchIndex: searchOptions.activeMatchIndex }}
            onFilterApplied={onFilterApplied}
          />
        )}
      </AutoSizer>
    </>
  );
}

function ShowAllButton(props: ModelsTreeHeaderButtonProps) {
  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      size="small"
      styleType="borderless"
      title={TreeWidget.translate("showAll")}
      onClick={() => void showAllModels(props.models.map((model) => model.id), props.viewport)}
    >
      <SvgVisibilityShow />
    </IconButton>
  );
}

function HideAllButton(props: ModelsTreeHeaderButtonProps) {
  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      size="small"
      styleType="borderless"
      title={TreeWidget.translate("hideAll")}
      onClick={() => void hideAllModels(props.models.map((model) => model.id), props.viewport)}
    >
      <SvgVisibilityHide />
    </IconButton>
  );
}

function InvertButton(props: ModelsTreeHeaderButtonProps) {
  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      size="small"
      styleType="borderless"
      title={TreeWidget.translate("invert")}
      onClick={() => void invertAllModels(props.models.map((model) => model.id), props.viewport)}
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
      className="tree-widget-header-tree-toolbar-icon"
      size="small"
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
      className="tree-widget-header-tree-toolbar-icon"
      size="small"
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
