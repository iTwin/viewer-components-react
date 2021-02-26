/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import React, { useEffect, useState } from "react";
import {
  IModelApp,
  IModelConnection,
  ScreenViewport,
  SelectedViewportChangedArgs,
  Viewport,
} from "@bentley/imodeljs-frontend";
import { ModelsTree, ClassGroupingOption } from "@bentley/ui-framework";
import { IconButton } from "../IconButton";
import { SearchBar } from "../search-bar/SearchBar";
import { useTreeFilteringState } from "../TreeFilteringState";
import "./ModelsTree.scss";
import {
  GeometricModel3dProps,
  ModelQueryParams,
} from "@bentley/imodeljs-common";
import { TreeWidget } from "../../TreeWidget";
import { TreeHeaderComponent } from "../header/TreeHeader";

export interface ModelTreeProps {
  iModel: IModelConnection;
  allViewports?: boolean;
  activeView?: Viewport;
  enablePreloading?: boolean;
  enableElementsClassGrouping?: boolean;
}

interface TreeViewModelInfo {
  id: string;
  isPlanProjection?: boolean;
}

export const ModelsTreeComponent = (props: ModelTreeProps) => {
  const { iModel } = props;

  const [is2dToggleActive, setIs2dToggleActive] = useState<boolean>(false);
  const [is3dToggleActive, setIs3dToggleActive] = useState<boolean>(false);
  const [icon2dToggle, setIcon2dToggle] = useState<string>("icon-visibility");
  const [icon3dToggle, setIcon3dToggle] = useState<string>("icon-visibility");

  const [available2dModels, setAvailable2dModels] = useState([] as string[]);
  const [available3dModels, setAvailable3dModels] = useState([] as string[]);
  const [availableModels, setAvailableModels] = useState([] as string[]);
  const [viewport, setViewport] = useState<ScreenViewport | undefined>(
    undefined
  );

  const {
    searchOptions,
    filterString,
    activeMatchIndex,
    onFilterApplied,
  } = useTreeFilteringState();

  const queryModels = async (
    vp: Viewport | undefined
  ): Promise<TreeViewModelInfo[]> => {
    if (vp === undefined) return [];

    const queryParams: ModelQueryParams = {
      from: "BisCore.GeometricModel3d",
      wantPrivate: false,
    };
    const modelProps = await iModel.models.queryProps(queryParams);
    return modelProps.map((mp: GeometricModel3dProps) => ({
      id: mp.id!,
      isPlanProjection: mp.isPlanProjection,
    }));
  };

  const _handleSelectedViewportChanged = (
    args: SelectedViewportChangedArgs
  ) => {
    if (args.current) {
      setViewport(args.current);
    }
  };

  useEffect(() => {
    setViewport(IModelApp.viewManager.selectedView);
    IModelApp.viewManager.onSelectedViewportChanged.addListener(
      _handleSelectedViewportChanged
    );
    return () => {
      IModelApp.viewManager.onSelectedViewportChanged.removeListener(
        _handleSelectedViewportChanged
      );
    };
  }, [IModelApp.viewManager.selectedView]);

  useEffect(() => {
    queryModels(viewport)
      .then((modelInfos: TreeViewModelInfo[]) => {
        setAvailableModels(modelInfos.map((m: TreeViewModelInfo) => m.id!));

        const models3d = modelInfos
          .filter((m) => {
            return (
              m.isPlanProjection === false || m.isPlanProjection === undefined
            );
          })
          .map((m) => m.id!);
        setAvailable3dModels(models3d);

        const models2d = modelInfos
          .filter((m) => {
            return m.isPlanProjection === true;
          })
          .map((m) => m.id!);
        setAvailable2dModels(models2d);
      })
      .catch((_e) => {
        setAvailableModels([]);
      });
  }, [viewport]);

  if (!(iModel && viewport)) {
    return null;
  }

  const invert = async () => {
    if (availableModels.length === 0) return;
    const notViewedModels: string[] = [];
    const models: string[] = [];
    availableModels.forEach((id: string) => {
      if (viewport.viewsModel(id)) models.push(id);
      else notViewedModels.push(id);
    });
    await viewport.addViewedModels(notViewedModels);
    viewport.changeModelDisplay(models, false);
    viewport.invalidateScene();
  };

  const hideAll = () => {
    viewport.changeModelDisplay(availableModels, false);
    viewport.invalidateScene();
  };

  const showAll = async () => {
    await viewport.addViewedModels(availableModels);
    viewport.invalidateScene();
  };

  const viewToggle2D = async () => {
    if (is2dToggleActive) {
      viewport.changeModelDisplay(available2dModels, false);
      setIs2dToggleActive(false);
      setIcon2dToggle("icon-visibility-hide-2");
    } else {
      await viewport.addViewedModels(available2dModels);
      setIs2dToggleActive(true);
      setIcon2dToggle("icon-visibility");
    }
    viewport.invalidateScene();
  };

  const viewToggle3D = async () => {
    if (is3dToggleActive) {
      viewport.changeModelDisplay(available3dModels, false);
      setIs3dToggleActive(false);
      setIcon3dToggle("icon-visibility-hide-2");
    } else {
      await viewport.addViewedModels(available3dModels);
      setIs3dToggleActive(true);
      setIcon3dToggle("icon-visibility");
    }
    viewport.invalidateScene();
  };

  return (
    <>
      <TreeHeaderComponent
        searchOptions={searchOptions}
        showAll={showAll}
        hideAll={hideAll}
        invert={invert}
        toggle2D={viewToggle2D}
        toggle2DIcon={icon2dToggle}
        toggle3D={viewToggle3D}
        toggle3DIcon={icon3dToggle}
      />
      <div className="tree-widget-models-tree-container">
        <ModelsTree
          {...props}
          filterInfo={{ filter: filterString, activeMatchIndex }}
          onFilterApplied={onFilterApplied}
          activeView={viewport}
          enablePreloading={props.enablePreloading}
          enableElementsClassGrouping={
            props.enableElementsClassGrouping
              ? ClassGroupingOption.YesWithCounts
              : ClassGroupingOption.No
          }
        />
      </div>
    </>
  );
};
