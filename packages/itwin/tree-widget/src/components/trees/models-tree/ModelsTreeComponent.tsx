/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./ModelsTree.scss";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { GeometricModel3dProps, ModelQueryParams } from "@itwin/core-common";
import { IModelApp, IModelConnection, ScreenViewport, Viewport } from "@itwin/core-frontend";
import { ModelsTreeHeaderButtonProps, ModelTreeProps } from "../../../types";
import { TreeHeaderComponent } from "../../header/TreeHeader";
import { useTreeFilteringState } from "../../TreeFilteringState";
import { AutoSizer } from "../../utils/AutoSizer";
import { toggleAllCategories } from "../CategoriesVisibilityUtils";
import { ModelsTree } from "./ModelsTree";
import { IconButton } from "../../IconButton";
import { TreeWidget } from "../../../TreeWidget";

export namespace ModelsTreeComponentNamespace {

  export interface TreeViewModelInfo {
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

  function ModelsTreeComponentImpl(props: ModelTreeProps & { iModel: IModelConnection, viewport: ScreenViewport }) {
    const [availableModels, setAvailableModels] = useState<TreeViewModelInfo[]>([]);

    const { viewport, iModel } = props;

    const { searchOptions, filterString, activeMatchIndex, onFilterApplied } =
      useTreeFilteringState();

    const queryModels = useCallback(async (
      vp: Viewport | undefined
    ): Promise<TreeViewModelInfo[]> => {
      if (vp === undefined) return [];

      const queryParams: ModelQueryParams = {
        from: "BisCore.GeometricModel3d",
        wantPrivate: false,
      };
      const modelProps = await iModel.models.queryProps(queryParams) ?? [];
      return modelProps
        .map(({ id, isPlanProjection }: GeometricModel3dProps) => ({ id, isPlanProjection }))
        .filter(({ id }) => id) as TreeViewModelInfo[];
    }, [iModel]);

    useEffect(() => {
      queryModels(viewport)
        .then((modelInfos: TreeViewModelInfo[]) => {
          setAvailableModels(modelInfos);
        })
        .catch((_e) => {
          setAvailableModels([]);
        });
    }, [queryModels, viewport]);

    return (
      <>
        <TreeHeaderComponent searchOptions={searchOptions}>
          {props.treeHeaderButtons
            ? props.treeHeaderButtons.map((btn, index) =>
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
        </TreeHeaderComponent>
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

  export function ShowAllButton(props: ModelsTreeHeaderButtonProps) {
    const showAll = async () => {
      if (!props.models || !props.viewport)
        return;

      await props.viewport.addViewedModels(props.models.map((model) => model.id));
      props.viewport.clearNeverDrawn();
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
        icon="icon-visibility"
        title={TreeWidget.translate("showAll")}
        onClick={showAll}
      />
    );
  }

  export function HideAllButton(props: ModelsTreeHeaderButtonProps) {
    const hideAll = async () => {
      if (!props.models)
        return;

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
        icon="icon-visibility-hide-2"
        title={TreeWidget.translate("hideAll")}
        onClick={hideAll}
      />
    );
  }

  export function InvertButton(props: ModelsTreeHeaderButtonProps) {
    const invert = async () => {
      if (!props.models)
        return;

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
        title={TreeWidget.translate("invert")}
        icon="icon-visibility-invert"
        onClick={invert}
      />
    );
  }

  export function View2DButton(props: ModelsTreeHeaderButtonProps) {
    const models2d = useMemo(() => {
      return props.models?.filter((model) => model.isPlanProjection).map((model) => model.id);
    }, [props.models]);

    const [is2dToggleActive, setIs2dToggleActive] = useState(() => (models2d && models2d.length !== 0) ? models2d.every((id) => props.viewport.viewsModel(id)) : false);

    useEffect(() => {
      return props.viewport.onViewedModelsChanged.addListener(() => setIs2dToggleActive((models2d && models2d.length !== 0) ? models2d.every((id) => props.viewport.viewsModel(id)) : false));
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
        icon={is2dToggleActive ? "icon-visibility" : "icon-visibility-hide-2"}
        title={TreeWidget.translate("toggle2DViews")}
        onClick={viewToggle2D}
        label={TreeWidget.translate("label2D")}
        disabled={models2d?.length === 0}
      />
    );
  }

  export function View3DButton(props: ModelsTreeHeaderButtonProps) {
    const models3d = useMemo(() => {
      return props.models?.filter((model) => !model.isPlanProjection).map((model) => model.id);
    }, [props.models]);

    const [is3dToggleActive, setIs3dToggleActive] = useState(() => (models3d && models3d.length !== 0) ? models3d.every((id) => props.viewport.viewsModel(id)) : false);

    useEffect(() => {
      return props.viewport.onViewedModelsChanged.addListener(() => setIs3dToggleActive((models3d && models3d.length !== 0) ? models3d.every((id) => props.viewport.viewsModel(id)) : false));
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
        icon={is3dToggleActive ? "icon-visibility" : "icon-visibility-hide-2"}
        title={TreeWidget.translate("toggle3DViews")}
        onClick={viewToggle3D}
        label={TreeWidget.translate("label3D")}
        disabled={models3d?.length === 0}
      />
    );
  }
}
