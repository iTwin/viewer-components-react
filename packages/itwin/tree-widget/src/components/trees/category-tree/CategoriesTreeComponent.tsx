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
import type { CategoriesTreeHeaderButtonProps, CategoriesTreeProps } from "../../../types";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import { IconButton } from "../../IconButton";
import { TreeWidget } from "../../../TreeWidget";

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

  return (
    <>
      {iModel && viewport &&
        <>
          <TreeHeaderComponent
            searchOptions={searchOptions}
            treeHeaderButtons={props.TreeHeaderButtons
              ? props.TreeHeaderButtons.map((btn) => btn({ iModel, viewport, filteredProvider }))
              : [
                <ShowAllButtonCategoriesTree iModel={iModel} filteredProvider={filteredProvider} key="show-all-btn" />,
                <HideAllButtonCategoriesTree iModel={iModel} filteredProvider={filteredProvider} key="hide-all-btn" />,
                <InvertButtonCategoriesTree iModel={iModel} viewport={viewport} filteredProvider={filteredProvider} key="invert-all-btn" />,
              ]
            }
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

export function ShowAllButtonCategoriesTree(props: CategoriesTreeHeaderButtonProps) {
  const showAll = useCallback(async () => {
    if (!props.iModel) return;

    if (props.filteredProvider) {
      const filteredCategories = await getFilteredCategories(props.filteredProvider);
      enableCategory(
        IModelApp.viewManager,
        props.iModel,
        filteredCategories,
        true,
        true,
      );

      return;
    }

    await toggleAllCategories(
      IModelApp.viewManager,
      props.iModel,
      true,
      undefined,
      true,
    );
  }, [props.iModel, props.filteredProvider]);

  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      icon="icon-visibility"
      title={TreeWidget.translate("showAll")}
      onClick={showAll}
    />
  );
}

export function HideAllButtonCategoriesTree(props: CategoriesTreeHeaderButtonProps) {
  const hideAll = useCallback(async () => {
    if (!props.iModel) return;

    if (props.filteredProvider) {
      const filteredCategories = await getFilteredCategories(props.filteredProvider);
      enableCategory(
        IModelApp.viewManager,
        props.iModel,
        filteredCategories,
        false,
        true,
      );

      return;
    }

    return toggleAllCategories(
      IModelApp.viewManager,
      props.iModel,
      false,
      undefined,
      true,
    );
  }, [props.iModel, props.filteredProvider]);

  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      icon="icon-visibility-hide-2"
      title={TreeWidget.translate("hideAll")}
      onClick={hideAll}
    />
  );
}

export function InvertButtonCategoriesTree(props: CategoriesTreeHeaderButtonProps) {
  const invert = useCallback(async () => {
    if (!props.iModel || !props.viewport) return;
    const ids = props.filteredProvider ? await getFilteredCategories(props.filteredProvider) : await getCategories(props.iModel, props.viewport);
    const enabled: string[] = [];
    const disabled: string[] = [];
    for (const id of ids) {
      if (props.viewport.view.viewsCategory(id)) {
        enabled.push(id);
      } else {
        disabled.push(id);
      }
    }
    // Disable enabled
    enableCategory(
      IModelApp.viewManager,
      props.iModel,
      enabled,
      false,
      true
    );

    // Enable disabled
    enableCategory(
      IModelApp.viewManager,
      props.iModel,
      disabled,
      true,
      true
    );
  }, [props.iModel, props.viewport, props.filteredProvider]);

  return (
    <IconButton
      className="tree-widget-header-tree-toolbar-icon"
      title={TreeWidget.translate("invert")}
      icon="icon-visibility-invert"
      onClick={invert}
    />
  );
}
