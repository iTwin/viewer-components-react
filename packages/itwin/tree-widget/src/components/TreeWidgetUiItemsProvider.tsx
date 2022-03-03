/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable react/display-name */
import type {
  AbstractWidgetProps,
  StagePanelSection,
  UiItemsProvider,
} from "@itwin/appui-abstract";
import {
  StagePanelLocation,
  StageUsage,
} from "@itwin/appui-abstract";
import { ClassGroupingOption } from "@itwin/appui-react";
import React from "react";
import { TreeWidgetComponent } from "./TreeWidgetComponent";
import { CategoriesTreeComponent } from "./trees/CategoriesTree";
import { ModelsTreeComponent } from "./trees/ModelsTree";
import { SpatialTreeComponent } from "./trees/SpatialTree";
import type { SelectableContentDefinition } from "@itwin/components-react";
import { TreeWidget } from "../TreeWidget";
import type { TreeWidgetOptions } from "../types";

export const TreeWidgetId = "tree-widget-react:trees";
export class TreeWidgetUiItemsProvider implements UiItemsProvider {
  public readonly id = "TreeWidgetUiItemsProvider";

  constructor(private _treeWidgetOptions?: TreeWidgetOptions) { }

  public provideWidgets(
    _stageId: string,
    stageUsage: string,
    location: StagePanelLocation,
    _section: StagePanelSection | undefined
  ): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if (
      stageUsage === StageUsage.General &&
      location === StagePanelLocation.Right
    ) {
      const trees: SelectableContentDefinition[] = [];

      if (!this._treeWidgetOptions?.hiddenTrees?.modelsTree) {
        trees.push({
          label: TreeWidget.translate("modeltree"),
          id: "model-tree",
          render: () => (
            <ModelsTreeComponent
              enableElementsClassGrouping={
                this._treeWidgetOptions?.enableElementsClassGrouping
                  ? ClassGroupingOption.YesWithCounts
                  : ClassGroupingOption.No
              }
              {...this._treeWidgetOptions?.modelsTreeProps}
            />
          ),
        });
      }

      if (!this._treeWidgetOptions?.hiddenTrees?.categoriesTree) {
        trees.push({
          label: TreeWidget.translate("categories"),
          id: "categories-tree",
          render: () => (
            <CategoriesTreeComponent {...this._treeWidgetOptions?.categoriesTreeProps} />
          ),
        });
      }

      if (!this._treeWidgetOptions?.hiddenTrees?.spatialTree) {
        trees.push({
          label: TreeWidget.translate("containment"),
          id: "spatial-containment-tree",
          render: () => (
            <SpatialTreeComponent
              enableElementsClassGrouping={
                this._treeWidgetOptions?.enableElementsClassGrouping
                  ? ClassGroupingOption.YesWithCounts
                  : ClassGroupingOption.No
              }
              {...this._treeWidgetOptions?.spatialTreeProps}
            />
          ),
        });
      }

      if (this._treeWidgetOptions?.additionalTrees) {
        trees.push(...this._treeWidgetOptions.additionalTrees);
      }

      widgets.push({
        id: TreeWidgetId,
        label: TreeWidget.translate("treeview"),
        getWidgetContent: () => <TreeWidgetComponent trees={trees} />,
      });
    }

    return widgets;
  }
}
