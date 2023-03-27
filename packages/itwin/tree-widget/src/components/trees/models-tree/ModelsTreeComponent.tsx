/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./ModelsTree.scss";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { GeometricModel3dProps, ModelQueryParams } from "@itwin/core-common";
import { IModelApp, IModelConnection, ScreenViewport, Viewport } from "@itwin/core-frontend";
import { SvgVisibilityHalf, SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { ModelsTreeHeaderButtonProps, ModelTreeProps } from "../../../types";
import { useTreeFilteringState } from "../../TreeFilteringState";
import { AutoSizer } from "../../utils/AutoSizer";
import { toggleAllCategories } from "../CategoriesVisibilityUtils";
import { ModelsTree } from "./ModelsTree";
import { TreeWidget } from "../../../TreeWidget";
import { SearchBar } from "../../search-bar/SearchBar";

export interface ModelInfo {
  id: string;
  isPlanProjection?: boolean;
}

export const ModelsTreeComponent = (props: ModelTreeProps) => {
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

function ModelsTreeComponentImpl(props: ModelTreeProps & { iModel: IModelConnection, viewport: ScreenViewport }) {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);

  const { viewport, iModel } = props;

  const { searchOptions, filterString, activeMatchIndex, onFilterApplied } =
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
      <SearchBar
        value=""
        valueChangedDelay={500}
        placeholder={TreeWidget.translate("search")}
        title={TreeWidget.translate("searchForSomething")}
        filteringInProgress={searchOptions.isFiltering}
        onFilterCancel={searchOptions.onFilterCancel}
        onFilterClear={searchOptions.onFilterCancel}
        onFilterStart={searchOptions.onFilterStart}
        onSelectedChanged={searchOptions.onResultSelectedChanged}
        resultCount={searchOptions.matchedResultCount ?? 0}
      >
        {props.headerButtons
          ? props.headerButtons.map((btn, index) =>
            <React.Fragment key={index}>
              {btn({ viewport, models: availableModels })}
            </React.Fragment>)
          : [
            <ShowAllButton viewport={viewport} models={availableModels} key="show-all-btn" />,
            <HideAllButton viewport={viewport} models={availableModels} key="hide-all-btn" />,
            <InvertButton viewport={viewport} models={availableModels} key="invert-all-btn" />,
            <View2DButton viewport={viewport} models={availableModels} key="view-2d-btn" />,
            <View3DButton viewport={viewport} models={availableModels} key="view-3d-btn" />,
          ]
        }
      </SearchBar>
      <AutoSizer>
        {({ width, height }) => (
          <ModelsTree
            {...props}
            iModel={iModel}
            activeView={viewport}
            width={width}
            height={height}
            filterInfo={{ filter: filterString, activeMatchIndex }}
            onFilterApplied={onFilterApplied}
          />
        )}
      </AutoSizer>
    </>
  );
}

function ShowAllButton(props: ModelsTreeHeaderButtonProps) {
  const showAll = async () => {
    if (!props.viewport)
      return;

    await props.viewport.addViewedModels(props.models.map((model) => model.id));
    props.viewport.clearNeverDrawn();
    props.viewport.clearAlwaysDrawn();
    if (props.viewport.iModel) {
      await toggleAllCategories(
        IModelApp.viewManager,
        props.viewport.iModel,
        true,
        props.viewport,
        false
      );
    }
    props.viewport.invalidateScene();
  };

  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      size="small"
      styleType="borderless"
      title={TreeWidget.translate("showAll")}
      onClick={showAll}
    >
      <SvgVisibilityShow />
    </IconButton>
  );
}

function HideAllButton(props: ModelsTreeHeaderButtonProps) {
  const hideAll = async () => {
    props.viewport.changeModelDisplay(props.models.map((model) => model.id), false);
    props.viewport.clearAlwaysDrawn();
    if (props.viewport.iModel) {
      await toggleAllCategories(
        IModelApp.viewManager,
        props.viewport.iModel,
        false,
        props.viewport,
        false
      );
    }
    props.viewport.invalidateScene();
  };

  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      size="small"
      styleType="borderless"
      title={TreeWidget.translate("hideAll")}
      onClick={hideAll}
    >
      <SvgVisibilityHide />
    </IconButton>
  );
}

function InvertButton(props: ModelsTreeHeaderButtonProps) {
  const invert = async () => {
    const notViewedModels: string[] = [];
    const models: string[] = [];
    props.models.forEach((model) => {
      if (props.viewport.viewsModel(model.id)) models.push(model.id);
      else notViewedModels.push(model.id);
    });
    await props.viewport.addViewedModels(notViewedModels);
    props.viewport.changeModelDisplay(models, false);
    props.viewport.invalidateScene();
  };

  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      size="small"
      styleType="borderless"
      title={TreeWidget.translate("invert")}
      onClick={invert}
    >
      <SvgVisibilityHalf />
    </IconButton>
  );
}

function View2DButton(props: ModelsTreeHeaderButtonProps) {
  const models2d = useMemo(() => {
    return props.models.filter((model) => model.isPlanProjection).map((model) => model.id);
  }, [props.models]);

  const [is2dToggleActive, setIs2dToggleActive] = useState(() => areAllModelsVisible(props.viewport, models2d));

  useEffect(() => {
    return props.viewport.onViewedModelsChanged.addListener(() => setIs2dToggleActive(areAllModelsVisible(props.viewport, models2d)));
  }, [models2d, props.viewport]);
  const viewToggle2D = async () => {
    if (!models2d)
      return;

    if (is2dToggleActive) {
      props.viewport.changeModelDisplay(models2d, false);
    } else {
      await props.viewport.addViewedModels(models2d);
    }
    props.viewport.invalidateScene();
  };

  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      size="small"
      styleType="borderless"
      title={TreeWidget.translate("toggle2DViews")}
      onClick={viewToggle2D}
      disabled={models2d.length === 0}
    >
      <div className="tree-widget-header-tree-toolbar-icon-label">
        {TreeWidget.translate("label2D")}
      </div>
      {is2dToggleActive ? <SvgVisibilityShow/> : <SvgVisibilityHide />}
    </IconButton>
  );
}

function View3DButton(props: ModelsTreeHeaderButtonProps) {
  const models3d = useMemo(() => {
    return props.models.filter((model) => !model.isPlanProjection).map((model) => model.id);
  }, [props.models]);

  const [is3dToggleActive, setIs3dToggleActive] = useState(() => areAllModelsVisible(props.viewport, models3d));

  useEffect(() => {
    return props.viewport.onViewedModelsChanged.addListener(() => setIs3dToggleActive(areAllModelsVisible(props.viewport, models3d)));
  }, [models3d, props.viewport]);

  const viewToggle3D = async () => {
    if (!models3d)
      return;

    if (is3dToggleActive) {
      props.viewport.changeModelDisplay(models3d, false);
    } else {
      await props.viewport.addViewedModels(models3d);
    }
    props.viewport.invalidateScene();
  };

  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      size="small"
      styleType="borderless"
      title={TreeWidget.translate("toggle3DViews")}
      onClick={viewToggle3D}
      disabled={models3d.length === 0}
    >
      <div className="tree-widget-header-tree-toolbar-icon-label">
        {TreeWidget.translate("label3D")}
      </div>
      {is3dToggleActive ? <SvgVisibilityShow /> : <SvgVisibilityHide />}
    </IconButton>
  );
}

function areAllModelsVisible(viewport: Viewport, models: string[]): boolean {
  return models.length !== 0 ? models.every((id) => viewport.viewsModel(id)) : false;
}
