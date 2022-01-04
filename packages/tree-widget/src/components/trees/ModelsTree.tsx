/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useState } from "react";
import { IModelConnection, Viewport } from "@itwin/core-frontend";
import { ModelsTree, ClassGroupingOption, useActiveViewport } from "@itwin/appui-react";
import { useTreeFilteringState } from "../TreeFilteringState";
import "./ModelsTree.scss";
import {
  GeometricModel3dProps,
  ModelQueryParams,
} from "@itwin/core-common";
import { TreeHeaderComponent } from "../header/TreeHeader";
import { useResizeObserver } from "@itwin/core-react";

export interface ModelTreeProps {
  iModel: IModelConnection;
  allViewports?: boolean;
  activeView?: Viewport;
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

  const [available2dModels, setAvailable2dModels] = useState<string[]>([]);
  const [available3dModels, setAvailable3dModels] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const viewport = useActiveViewport();

  const { searchOptions, filterString, activeMatchIndex, onFilterApplied } =
    useTreeFilteringState();

  const [height, setHeight] = useState(0);
  const [width, setWidth] = useState(0);
  const handleResize = useCallback((w: number, h: number) => {
    setHeight(h);
    setWidth(w);
  }, []);
  const ref = useResizeObserver<HTMLDivElement>(handleResize);

  const queryModels = useCallback(async (
    vp: Viewport | undefined
  ): Promise<TreeViewModelInfo[]> => {
    if (vp === undefined) return [];

    const queryParams: ModelQueryParams = {
      from: "BisCore.GeometricModel3d",
      wantPrivate: false,
    };
    const modelProps = await iModel.models.queryProps(queryParams);
    return modelProps
      .map(({ id, isPlanProjection }: GeometricModel3dProps) => ({ id, isPlanProjection }))
      .filter(({ id }) => id) as TreeViewModelInfo[];
  }, []);

  useEffect(() => {
    queryModels(viewport)
      .then((modelInfos: TreeViewModelInfo[]) => {
        setAvailableModels(modelInfos.map(({ id }) => id));

        const models3d = modelInfos
          .filter(({ isPlanProjection }) => !isPlanProjection)
          .map(({ id }) => id);
        setAvailable3dModels(models3d);

        const models2d = modelInfos
          .filter(({ isPlanProjection }) => isPlanProjection)
          .map(({ id }) => id);
        setAvailable2dModels(models2d);
      })
      .catch((_e) => {
        setAvailableModels([]);
      });
  }, [queryModels, viewport]);

  const invert = useCallback(async () => {
    if (availableModels.length === 0) return;
    const notViewedModels: string[] = [];
    const models: string[] = [];
    availableModels.forEach((id: string) => {
      if (viewport?.viewsModel(id)) models.push(id);
      else notViewedModels.push(id);
    });
    await viewport?.addViewedModels(notViewedModels);
    viewport?.changeModelDisplay(models, false);
    viewport?.invalidateScene();
  }, [viewport, availableModels]);

  const hideAll = useCallback(() => {
    viewport?.changeModelDisplay(availableModels, false);
    viewport?.invalidateScene();
  }, [viewport, availableModels]);

  const showAll = useCallback(async () => {
    await viewport?.addViewedModels(availableModels);
    viewport?.invalidateScene();
  }, [viewport, availableModels]);

  const viewToggle2D = useCallback(async () => {
    if (is2dToggleActive) {
      viewport?.changeModelDisplay(available2dModels, false);
      setIs2dToggleActive(false);
      setIcon2dToggle("icon-visibility-hide-2");
    } else {
      await viewport?.addViewedModels(available2dModels);
      setIs2dToggleActive(true);
      setIcon2dToggle("icon-visibility");
    }
    viewport?.invalidateScene();
  }, [is2dToggleActive, viewport, available2dModels]);

  const viewToggle3D = useCallback(async () => {
    if (is3dToggleActive) {
      viewport?.changeModelDisplay(available3dModels, false);
      setIs3dToggleActive(false);
      setIcon3dToggle("icon-visibility-hide-2");
    } else {
      await viewport?.addViewedModels(available3dModels);
      setIs3dToggleActive(true);
      setIcon3dToggle("icon-visibility");
    }
    viewport?.invalidateScene();
  }, [is3dToggleActive, viewport, available3dModels]);

  return (!(iModel && viewport) ? null : (
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
        <div ref={ref} style={{ width: "100%", height: "100%" }}>
          {width && height && (
            <ModelsTree
              {...props}
              filterInfo={{ filter: filterString, activeMatchIndex }}
              onFilterApplied={onFilterApplied}
              activeView={viewport}
              enableElementsClassGrouping={
                props.enableElementsClassGrouping
                  ? ClassGroupingOption.YesWithCounts
                  : ClassGroupingOption.No
              }
              width={width}
              height={height}
            />
          )}
        </div>
      </div>
    </>
  ));
};
