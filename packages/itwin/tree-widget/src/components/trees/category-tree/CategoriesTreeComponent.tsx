/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./CategoriesTree.scss";
import React, { useCallback } from "react";
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { CategoryTree } from "./CategoriesTree";
import { CategoryVisibilityHandler } from "./CategoryVisibilityHandler";
import { enableCategory, getCategories, toggleAllCategories } from "../CategoriesVisibilityUtils";
import { TreeHeaderComponent } from "../../header/TreeHeader";
import { useTreeFilteringState } from "../../TreeFilteringState";
import { AutoSizer } from "../../utils/AutoSizer";
import type { CategoriesTreeProps } from "../../../types";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";

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
      filteredProvider ? await getFilteredCategories(filteredProvider) : undefined,
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
      filteredProvider ? await getFilteredCategories(filteredProvider) : undefined,
    );
  }, [iModel, filteredProvider]);

  const invert = useCallback(async () => {
    if (!iModel || !viewport) return;
    const ids = filteredProvider ? await getFilteredCategories(filteredProvider) : await getCategories(iModel, viewport);
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
    enableCategory(
      IModelApp.viewManager,
      iModel,
      enabled,
      false,
      true
    );
    // Enable disabled
    enableCategory(
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

async function getFilteredCategories(filteredProvider: IPresentationTreeDataProvider) {
  const nodes = await filteredProvider.getNodes();
  return nodes.map((node) => CategoryVisibilityHandler.getInstanceIdFromTreeNodeKey(filteredProvider.getNodeKey(node)));
}
