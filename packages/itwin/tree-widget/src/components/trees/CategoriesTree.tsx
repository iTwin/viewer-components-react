/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useCallback, useState } from "react";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import { CategoryTree, getCategories, toggleAllCategories } from "@itwin/appui-react";
import { useTreeFilteringState } from "../TreeFilteringState";
import "./CategoriesTree.scss";
import { TreeHeaderComponent } from "../header/TreeHeader";
import { CategoryVisibilityHandler } from "@itwin/appui-react";
import { useResizeObserver } from "@itwin/core-react";

export interface CategoriesTreeComponentProps {
  iModel: IModelConnection;
  allViewports?: boolean;
  activeView?: Viewport;
}

export function CategoriesTreeComponent(props: CategoriesTreeComponentProps) {
  const {
    searchOptions,
    filterString,
    activeMatchIndex,
    onFilterApplied,
    filteredProvider,
  } = useTreeFilteringState();

  const [height, setHeight] = useState(0);
  const [width, setWidth] = useState(0);
  const handleResize = useCallback((w: number, h: number) => {
    setHeight(h);
    setWidth(w);
  }, []);
  const ref = useResizeObserver<HTMLDivElement>(handleResize);

  const showAll = useCallback(async () => {
    return toggleAllCategories(
      IModelApp.viewManager,
      props.iModel,
      true,
      undefined,
      true,
      filteredProvider
    );
  }, [props.iModel, filteredProvider]);

  const hideAll = useCallback(async () => {
    return toggleAllCategories(
      IModelApp.viewManager,
      props.iModel,
      false,
      undefined,
      true,
      filteredProvider
    );
  }, [props.iModel, filteredProvider]);

  const invert = useCallback(async () => {
    const activeView = IModelApp.viewManager.getFirstOpenView();
    if (!activeView) {
      return;
    }

    const ids = await getCategories(props.iModel, activeView, filteredProvider);
    const enabled: string[] = [];
    const disabled: string[] = [];
    for (const id of ids) {
      if (activeView.view.viewsCategory(id)) {
        enabled.push(id);
      } else {
        disabled.push(id);
      }
    }
    // Disable enabled
    CategoryVisibilityHandler.enableCategory(
      IModelApp.viewManager,
      props.iModel,
      enabled,
      false,
      true
    );
    // Enable disabled
    CategoryVisibilityHandler.enableCategory(
      IModelApp.viewManager,
      props.iModel,
      disabled,
      true,
      true
    );
  }, [props.iModel, filteredProvider]);

  return (
    <>
      <TreeHeaderComponent
        searchOptions={searchOptions}
        showAll={showAll}
        hideAll={hideAll}
        invert={invert}
      />
      <div ref={ref} style={{ width: "100%", height: "100%" }}>
        {width && height && (
          <CategoryTree
            {...props}
            filterInfo={{ filter: filterString, activeMatchIndex }}
            onFilterApplied={onFilterApplied}
            width={width}
            height={height}
          />
        )}
      </div>
    </>
  );
}
