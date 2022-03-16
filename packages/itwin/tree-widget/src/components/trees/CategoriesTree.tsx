/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useCallback } from "react";
import { IModelApp } from "@itwin/core-frontend";
import { CategoryTree, getCategories, toggleAllCategories, useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { useTreeFilteringState } from "../TreeFilteringState";
import "./CategoriesTree.scss";
import { TreeHeaderComponent } from "../header/TreeHeader";
import { CategoryVisibilityHandler } from "@itwin/appui-react";
import type { CategoriesTreeProps } from "../../types";
import { AutoSizer } from "../utils/AutoSizer";

export function CategoriesTreeComponent(props: CategoriesTreeProps) {
  const iModel = useActiveIModelConnection();
  const viewport = useActiveViewport();

  const {
    searchOptions,
    filterString,
    activeMatchIndex,
    onFilterApplied,
    filteredProvider,
  } = useTreeFilteringState();

  const showAll = useCallback(async () => {
    if (!iModel) return;

    return toggleAllCategories(
      IModelApp.viewManager,
      iModel,
      true,
      undefined,
      true,
      filteredProvider
    );
  }, [iModel, filteredProvider]);

  const hideAll = useCallback(async () => {
    if (!iModel) return;
    return toggleAllCategories(
      IModelApp.viewManager,
      iModel,
      false,
      undefined,
      true,
      filteredProvider
    );
  }, [iModel, filteredProvider]);

  const invert = useCallback(async () => {
    if (!iModel || !viewport) return;

    const ids = await getCategories(iModel, viewport, filteredProvider);
    const enabled: string[] = [];
    const disabled: string[] = [];
    for (const id of ids) {
      if (viewport.view.viewsCategory(id)) {
        enabled.push(id);
      } else {
        disabled.push(id);
      }
    }
    // Disable enabled
    CategoryVisibilityHandler.enableCategory(
      IModelApp.viewManager,
      iModel,
      enabled,
      false,
      true
    );
    // Enable disabled
    CategoryVisibilityHandler.enableCategory(
      IModelApp.viewManager,
      iModel,
      disabled,
      true,
      true
    );
  }, [iModel, viewport, filteredProvider]);

  return (
    <>
      {iModel && viewport &&
        <>
          <TreeHeaderComponent
            searchOptions={searchOptions}
            showAll={showAll}
            hideAll={hideAll}
            invert={invert}
          />
          <AutoSizer>
            {({ width, height }) => (
              <CategoryTree
                {...props}
                iModel={iModel}
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
}
