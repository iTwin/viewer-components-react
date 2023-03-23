/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable react/display-name */

import React from "react";
import { StagePanelLocation, StagePanelSection, StageUsage, UiItemsProvider, Widget } from "@itwin/appui-react";
import { SelectableContentDefinition } from "@itwin/components-react";
import { TreeWidget } from "../TreeWidget";
import { CategoriesTreeId, ModelsTreeId, TreeWidgetOptions } from "../types";
import { CategoriesTreeComponent } from "./trees/category-tree/CategoriesTreeComponent";
import { ClassGroupingOption } from "./trees/Common";
import { ModelsTreeComponent } from "./trees/models-tree/ModelsTreeComponent";
import { TreeWidgetComponent } from "./TreeWidgetComponent";

export const TreeWidgetId = "tree-widget-react:trees";
export class TreeWidgetUiItemsProvider implements UiItemsProvider {
  public readonly id = "TreeWidgetUiItemsProvider";

  constructor(private _treeWidgetOptions?: TreeWidgetOptions) { }

  public provideWidgets(
    _stageId: string,
    stageUsage: string,
    location: StagePanelLocation,
    section?: StagePanelSection
  ): ReadonlyArray<Widget> {
    const widgets: Widget[] = [];
    if (
      location === StagePanelLocation.Left &&
      section === StagePanelSection.Start &&
      stageUsage === StageUsage.General
    ) {
      const trees: SelectableContentDefinition[] = [];

      if (!this._treeWidgetOptions?.hideTrees?.modelsTree) {
        trees.push({
          label: TreeWidget.translate("models"),
          id: ModelsTreeId,
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

      if (!this._treeWidgetOptions?.hideTrees?.categoriesTree) {
        trees.push({
          label: TreeWidget.translate("categories"),
          id: CategoriesTreeId,
          render: () => (
            <CategoriesTreeComponent {...this._treeWidgetOptions?.categoriesTreeProps} />
          ),
        });
      }

      if (this._treeWidgetOptions?.additionalTrees) {
        trees.push(...this._treeWidgetOptions.additionalTrees);
      }

      if (this._treeWidgetOptions?.defaultTreeId && trees.length !== 0) {
        // Adding the defaultTree to first index
        const { defaultTreeId } = this._treeWidgetOptions;
        const extractedDefaultTree = trees.filter((tree) => tree.id === defaultTreeId)[0];
        const index = trees.indexOf(extractedDefaultTree);
        trees.unshift(trees.splice(index, 1)[0]);
      }

      widgets.push({
        id: TreeWidgetId,
        label: TreeWidget.translate("treeview"),
        content: <TreeWidgetComponent trees={trees} />,
        icon: "icon-hierarchy-tree",
        priority: this._treeWidgetOptions?.defaultTreeWidgetPriority,
      });
    }

    return widgets;
  }
}
