/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import React from "react";
import { StagePanelLocation, StagePanelSection, StageUsage, UiItemsProvider, Widget } from "@itwin/appui-react";
import { TreeWidget } from "../TreeWidget";
import { CategoriesTreeComponent } from "./trees/category-tree/CategoriesTreeComponent";
import { ModelsTreeComponent } from "./trees/models-tree/ModelsTreeComponent";
import { TreeDefinition, TreeWidgetComponent } from "./TreeWidgetComponent";

export interface TreeWidgetOptions {
  defaultPanelLocation?: StagePanelLocation;
  defaultPanelSection?: StagePanelSection;
  defaultTreeWidgetPriority?: number;
  trees?: TreeDefinition[];
}

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
    const preferredLocation = this._treeWidgetOptions?.defaultPanelLocation ?? StagePanelLocation.Right;
    const preferredPanelSection = this._treeWidgetOptions?.defaultPanelSection ?? StagePanelSection.Start;

    if (location !== preferredLocation || section !== preferredPanelSection || stageUsage !== StageUsage.General) {
      return [];
    }

    const trees: TreeDefinition[] = this._treeWidgetOptions?.trees ?? [
      {
        id: ModelsTreeComponent.id,
        getLabel: ModelsTreeComponent.getLabel,
        render: () => <ModelsTreeComponent />,
      },
      {
        id: CategoriesTreeComponent.id,
        getLabel: CategoriesTreeComponent.getLabel,
        render: () => <CategoriesTreeComponent />,
      },
    ];

    return [{
      id: TreeWidgetId,
      label: TreeWidget.translate("treeview"),
      content: <TreeWidgetComponent trees={trees} />,
      icon: "icon-hierarchy-tree",
      priority: this._treeWidgetOptions?.defaultTreeWidgetPriority,
    }];
  }
}
