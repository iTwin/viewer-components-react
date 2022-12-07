/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useState } from "react";
import type { Viewport } from "@itwin/core-frontend";
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { useTreeFilteringState } from "../TreeFilteringState";
import "./ModelsTree.scss";
import type {
  GeometricModel3dProps,
  ModelQueryParams,
} from "@itwin/core-common";
import { TreeHeaderComponent } from "../header/TreeHeader";
import type { ModelTreeProps } from "../../types";
import { AutoSizer } from "../utils/AutoSizer";
import { ModelsTree } from "../core-trees/models-tree/ModelsTree";

interface TreeViewModelInfo {
  id: string;
  isPlanProjection?: boolean;
}

export const ModelsTreeComponent = (props: ModelTreeProps) => {
  const [is2dToggleActive, setIs2dToggleActive] = useState<boolean>(false);
  const [is3dToggleActive, setIs3dToggleActive] = useState<boolean>(false);
  const [icon2dToggle, setIcon2dToggle] = useState<string>("icon-visibility");
  const [icon3dToggle, setIcon3dToggle] = useState<string>("icon-visibility");

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

  return (
    <>
      {iModel && viewport &&
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
