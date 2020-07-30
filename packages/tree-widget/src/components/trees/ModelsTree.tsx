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
import { ModelProps, ModelQueryParams } from "@bentley/imodeljs-common";
import { TreeWidget } from "../../TreeWidget";
import { TreeHeaderComponent } from "../header/TreeHeader";

export interface ModelTreeProps {
  iModel: IModelConnection;
  allViewports?: boolean;
  activeView?: Viewport;
  enablePreloading?: boolean;
  enableElementsClassGrouping?: boolean;
}

export const ModelsTreeComponent = (props: ModelTreeProps) => {
  const { iModel } = props;
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

  const queryModels = async (vp: Viewport | undefined): Promise<string[]> => {
    if (vp === undefined) return [];

    const queryParams: ModelQueryParams = {
      from: "BisCore.GeometricModel3d",
      wantPrivate: false,
    };
    const modelProps = await iModel.models.queryProps(queryParams);
    return modelProps.map((mp: ModelProps) => mp.id!);
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
      .then((modelIds: string[]) => {
        setAvailableModels(modelIds);
      })
      .catch((_e) => {
        setAvailableModels([]);
      });
  }, [viewport]);

  if (!(iModel && viewport)) {
    return null;
  }

  const invert = () => {
    if (availableModels.length === 0) return;
    const notViewedModels: string[] = [];
    const models: string[] = [];
    availableModels.forEach((id: string) => {
      if (viewport.viewsModel(id)) models.push(id);
      else notViewedModels.push(id);
    });
    viewport.changeModelDisplay(notViewedModels, true);
    viewport.changeModelDisplay(models, false);
    viewport.invalidateScene();
  };

  const hideAll = () => {
    viewport.changeModelDisplay(availableModels, false);
    viewport.invalidateScene();
  };

  const showAll = () => {
    viewport.changeModelDisplay(availableModels, true);
    viewport.invalidateScene();
  };

  return (
    <>
      <TreeHeaderComponent
        searchOptions={searchOptions}
        showAll={showAll}
        hideAll={hideAll}
        invert={invert}
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
