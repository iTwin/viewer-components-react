/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { useResizeDetector } from "react-resize-detector";
import {
  IModelApp,
  IModelConnection,
  Viewport,
} from "@itwin/core-frontend";
import {
  CategoryTree,
  toggleAllCategories,
  getCategories,
} from "@itwin/appui-react";
import { useTreeFilteringState } from "../TreeFilteringState";
import "./CategoriesTree.scss";
import { TreeHeaderComponent } from "../header/TreeHeader";
import { CategoryVisibilityHandler } from "@itwin/appui-react/lib/cjs/appui-react/imodel-components/category-tree/CategoryVisibilityHandler";

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
  const { width, height, ref } = useResizeDetector();

  const showAll = React.useCallback(async () => {
    return toggleAllCategories(
      IModelApp.viewManager,
      props.iModel,
      true,
      undefined,
      true,
      filteredProvider
    );
  }, [props.iModel, filteredProvider]);

  const hideAll = React.useCallback(async () => {
    return toggleAllCategories(
      IModelApp.viewManager,
      props.iModel,
      false,
      undefined,
      true,
      filteredProvider
    );
  }, [props.iModel, filteredProvider]);

  const invert = React.useCallback(async () => {
    const activeView = IModelApp.viewManager.getFirstOpenView();
    if (!activeView) {
      return;
    }

    const ids = await getCategories(props.iModel, activeView, filteredProvider);
    let enabled: string[] = [];
    let disabled: string[] = [];
    for (const id of ids) {
      if (activeView.view.viewsCategory(id)) {
        enabled.push(id);
      } else {
        disabled.push(id);
      }
    }
    // Disabled enabled
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
