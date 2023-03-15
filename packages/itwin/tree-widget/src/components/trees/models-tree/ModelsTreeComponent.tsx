/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./ModelsTree.scss";
import React, { useCallback, useEffect, useState } from "react";
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { GeometricModel3dProps, ModelQueryParams } from "@itwin/core-common";
import { IModelApp, Viewport } from "@itwin/core-frontend";
import { ModelsTreeHeaderButtonProps, ModelTreeProps } from "../../../types";
import { TreeHeaderComponent } from "../../header/TreeHeader";
import { useTreeFilteringState } from "../../TreeFilteringState";
import { AutoSizer } from "../../utils/AutoSizer";
import { toggleAllCategories } from "../CategoriesVisibilityUtils";
import { ModelsTree } from "./ModelsTree";
import { IconButton } from "../../IconButton";
import { TreeWidget } from "../../../TreeWidget";

interface TreeViewModelInfo {
  id: string;
  isPlanProjection?: boolean;
}

export const ModelsTreeComponent = (props: ModelTreeProps) => {
  const [available2dModels, setAvailable2dModels] = useState<string[]>([]);
  const [available3dModels, setAvailable3dModels] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const iModel = useActiveIModelConnection();

  const viewport = useActiveViewport();

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
    const modelProps = await iModel?.models.queryProps(queryParams) ?? [];
    return modelProps
      .map(({ id, isPlanProjection }: GeometricModel3dProps) => ({ id, isPlanProjection }))
      .filter(({ id }) => id) as TreeViewModelInfo[];
  }, [iModel]);

  useEffect(() => {
    queryModels(viewport)
      .then((modelInfos: TreeViewModelInfo[]) => {
        setAvailableModels(modelInfos.map(({ id }) => id));

        const { models2d, models3d } = modelInfos.reduce((acc, { id, isPlanProjection }) => {
          isPlanProjection ? acc.models2d.push(id) : acc.models3d.push(id);
          return acc;
        }, { models2d: [] as string[], models3d: [] as string[] });

        setAvailable2dModels(models2d);
        setAvailable3dModels(models3d);
      })
      .catch((_e) => {
        setAvailableModels([]);
      });
  }, [queryModels, viewport]);

  return (
    <>
      {iModel && viewport &&
        <>
          <TreeHeaderComponent
            searchOptions={searchOptions}
            treeHeaderButtons={props.TreeHeaderButtons
              ? props.TreeHeaderButtons.map((btn) => btn({ viewport, iModel, availableModels }))
              : [
                <ShowAllButtonModelsTree viewport={viewport} availableModels={availableModels} iModel={iModel} key="show-all-btn" />,
                <HideAllButtonModelsTree viewport={viewport} availableModels={availableModels} iModel={iModel} key="hide-all-btn" />,
                <InvertButtonModelsTree viewport={viewport} availableModels={availableModels} iModel={iModel} key="invert-all-btn" />,
                <View2DButtonModelsTree viewport={viewport} availableModels={available2dModels} key="view-2d-btn" />,
                <View3DButtonModelsTree viewport={viewport} availableModels={available3dModels} key="view-3d-btn" />,
              ]
            }
          />
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
      }
    </>
  );
};

export function ShowAllButtonModelsTree(props: ModelsTreeHeaderButtonProps) {
  const showAll = useCallback(async () => {
    if (!props.availableModels)
      return;

    await props.viewport?.addViewedModels(props.availableModels);
    props.viewport?.clearNeverDrawn();
    if (props.iModel) {
      await toggleAllCategories(
        IModelApp.viewManager,
        props.iModel,
        true,
        props.viewport,
        false,
        undefined
      );
    }
    props.viewport?.invalidateScene();
  }, [props.viewport, props.availableModels, props.iModel]);

  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      icon="icon-visibility"
      title={TreeWidget.translate("showAll")}
      onClick={showAll}
    />
  );
}

export function HideAllButtonModelsTree(props: ModelsTreeHeaderButtonProps) {
  const hideAll = useCallback(async () => {
    if (!props.availableModels)
      return;

    props.viewport?.changeModelDisplay(props.availableModels, false);
    props.viewport?.clearAlwaysDrawn();
    if (props.iModel) {
      await toggleAllCategories(
        IModelApp.viewManager,
        props.iModel,
        false,
        props.viewport,
        false,
        undefined
      );
    }
    props.viewport?.invalidateScene();
  }, [props.viewport, props.availableModels, props.iModel]);

  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      icon="icon-visibility-hide-2"
      title={TreeWidget.translate("hideAll")}
      onClick={hideAll}
    />
  );
}

export function InvertButtonModelsTree(props: ModelsTreeHeaderButtonProps) {
  const invert = useCallback(async () => {
    if (!props.availableModels)
      return;

    const notViewedModels: string[] = [];
    const models: string[] = [];
    props.availableModels.forEach((id: string) => {
      if (props.viewport?.viewsModel(id)) models.push(id);
      else notViewedModels.push(id);
    });
    await props.viewport?.addViewedModels(notViewedModels);
    props.viewport?.changeModelDisplay(models, false);
    props.viewport?.invalidateScene();
  }, [props.viewport, props.availableModels]);

  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      title={TreeWidget.translate("invert")}
      icon="icon-visibility-invert"
      onClick={invert}
    />
  );
}

export function View2DButtonModelsTree(props: ModelsTreeHeaderButtonProps) {
  const [is2dToggleActive, setIs2dToggleActive] = useState<boolean>(false);
  const [icon2dToggle, setIcon2dToggle] = useState<string>("icon-visibility");

  const viewToggle2D = useCallback(async () => {
    if (!props.availableModels)
      return;

    if (is2dToggleActive) {
      props.viewport?.changeModelDisplay(props.availableModels, false);
      setIs2dToggleActive(false);
      setIcon2dToggle("icon-visibility-hide-2");
    } else {
      await props.viewport?.addViewedModels(props.availableModels);
      setIs2dToggleActive(true);
      setIcon2dToggle("icon-visibility");
    }
    props.viewport?.invalidateScene();
  }, [is2dToggleActive, props.viewport, props.availableModels]);

  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      icon={icon2dToggle}
      title={TreeWidget.translate("toggle2DViews")}
      onClick={viewToggle2D}
      label={TreeWidget.translate("label2D")}
    />
  );
}

export function View3DButtonModelsTree(props: ModelsTreeHeaderButtonProps) {
  const [is3dToggleActive, setIs3dToggleActive] = useState<boolean>(false);
  const [icon3dToggle, setIcon3dToggle] = useState<string>("icon-visibility");

  const viewToggle3D = useCallback(async () => {
    if (!props.availableModels)
      return;

    if (is3dToggleActive) {
      props.viewport?.changeModelDisplay(props.availableModels, false);
      setIs3dToggleActive(false);
      setIcon3dToggle("icon-visibility-hide-2");
    } else {
      await props.viewport?.addViewedModels(props.availableModels);
      setIs3dToggleActive(true);
      setIcon3dToggle("icon-visibility");
    }
    props.viewport?.invalidateScene();
  }, [is3dToggleActive, props.viewport, props.availableModels]);

  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      icon={icon3dToggle}
      title={TreeWidget.translate("toggle3DViews")}
      onClick={viewToggle3D}
      label={TreeWidget.translate("label3D")}
    />
  );
}
