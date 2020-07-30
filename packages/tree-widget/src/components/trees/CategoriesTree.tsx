/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  IModelApp,
  IModelConnection,
  Viewport,
} from "@bentley/imodeljs-frontend";
import {
  CategoryTree,
  toggleAllCategories,
  getCategories,
} from "@bentley/ui-framework";
import { useTreeFilteringState } from "../TreeFilteringState";
import "./CategoriesTree.scss";
import { CategoryVisibilityHandler } from "@bentley/ui-framework/lib/ui-framework/imodel-components/category-tree/CategoryVisibilityHandler";
import { TreeHeaderComponent } from "../header/TreeHeader";

export interface CategoriesTreeComponentProps {
  iModel: IModelConnection;
  allViewports?: boolean;
  activeView?: Viewport;
  enablePreloading?: boolean;
}

export function CategoriesTreeComponent(props: CategoriesTreeComponentProps) {
  const {
    searchOptions,
    filterString,
    activeMatchIndex,
    onFilterApplied,
    filteredProvider,
  } = useTreeFilteringState();

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
      <CategoryTree
        {...props}
        enablePreloading={props.enablePreloading}
        filterInfo={{ filter: filterString, activeMatchIndex }}
        onFilterApplied={onFilterApplied}
      />
    </>
  );
}
