/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable react/display-name */
import type {
  AbstractWidgetProps,
  UiItemsProvider,
} from "@itwin/appui-abstract";
import {
  StagePanelSection,
} from "@itwin/appui-abstract";
import {
  AbstractZoneLocation,
  StagePanelLocation,
  StageUsage,
} from "@itwin/appui-abstract";
import { ClassGroupingOption, UiFramework } from "@itwin/appui-react";
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
    section?: StagePanelSection,
    // eslint-disable-next-line deprecation/deprecation
    zoneLocation?: AbstractZoneLocation,
  ): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    const preferredLocation = this._treeWidgetOptions?.defaultPanelLocation ?? StagePanelLocation.Right;
    const preferredPanelSection = this._treeWidgetOptions?.defaultPanelSection ?? StagePanelSection.Start;
    if (
      // eslint-disable-next-line deprecation/deprecation
      (!section && stageUsage === StageUsage.General && zoneLocation === AbstractZoneLocation.CenterRight) ||
      (stageUsage === StageUsage.General && location === preferredLocation && section === preferredPanelSection
        && UiFramework.uiVersion !== "1")
    ) {
      const trees: SelectableContentDefinition[] = [];

      if (!this._treeWidgetOptions?.hideTrees?.modelsTree) {
        const modelTree = {
          label: TreeWidget.translate("modelstree"),
          id: "models-tree",
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
        }
        this._treeWidgetOptions?.defaultTree === modelTree.id ? trees.unshift(modelTree) : trees.push(modelTree);
      }

      if (!this._treeWidgetOptions?.hideTrees?.categoriesTree) {
        const categoriesTree = {
          label: TreeWidget.translate("categories"),
          id: "categories-tree",
          render: () => (
            <CategoriesTreeComponent {...this._treeWidgetOptions?.categoriesTreeProps} />
          ),
        }
        this._treeWidgetOptions?.defaultTree === categoriesTree.id  ? trees.unshift(categoriesTree) : trees.push(categoriesTree);
      }

      if (!this._treeWidgetOptions?.hideTrees?.spatialTree) {
        const spatialContainmentTree = {
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
        }
        this._treeWidgetOptions?.defaultTree === spatialContainmentTree.id ? trees.unshift(spatialContainmentTree) : trees.push(spatialContainmentTree);
      }

      if (this._treeWidgetOptions?.additionalTrees) {
        const defaultTreeId = this._treeWidgetOptions.defaultTree
        if(!( defaultTreeId === "models-tree" || defaultTreeId === "categories-tree" || defaultTreeId === "spatial-containment-tree")){
          const additionalTrees = this._treeWidgetOptions.additionalTrees
          for (const tree of additionalTrees){
            tree.id === defaultTreeId ? trees.unshift(tree) : trees.push(tree);
          }
        }else{
          trees.push(...this._treeWidgetOptions.additionalTrees)
        }
      }

      widgets.push({
        id: TreeWidgetId,
        label: TreeWidget.translate("treeview"),
        getWidgetContent: () => <TreeWidgetComponent trees={trees} />,
        icon: "icon-hierarchy-tree",
        restoreTransientState: () => true,
        priority: this._treeWidgetOptions?.defaultTreeWidgetPriority,
      });
    }

    return widgets;
  }
}
