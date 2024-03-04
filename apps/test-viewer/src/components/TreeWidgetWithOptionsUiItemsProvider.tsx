/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { StagePanelLocation, StagePanelSection, StageUsage, UiItemsProvider, Widget } from "@itwin/appui-react";
import { SvgHierarchyTree } from "@itwin/itwinui-icons-react";
import {
  CategoriesTreeComponent,
  ModelsTreeComponent,
  SelectableTreeProps,
  TreeDefinition,
  TreeWidget,
  TreeWidgetComponent,
  TreeWidgetId,
  TreeWidgetOptions,
} from "@itwin/tree-widget-react";
import { useViewerOptionsContext } from "./ViewerOptions";

export class TreeWidgetWithOptionsUiItemsProvider implements UiItemsProvider {
  public readonly id = "ViewerTreeWidgetUiItemsProvider";

  constructor(private _treeWidgetOptions?: TreeWidgetOptions) {}

  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection): ReadonlyArray<Widget> {
    const preferredLocation = this._treeWidgetOptions?.defaultPanelLocation ?? StagePanelLocation.Right;
    const preferredPanelSection = this._treeWidgetOptions?.defaultPanelSection ?? StagePanelSection.Start;

    if (location !== preferredLocation || section !== preferredPanelSection || stageUsage !== StageUsage.General) {
      return [];
    }

    const trees: TreeDefinition[] = this._treeWidgetOptions?.trees ?? [
      {
        id: ModelsTreeComponent.id,
        getLabel: ModelsTreeComponent.getLabel,
        render: (density?: "enlarged" | "default") => <ModelsTreeComponent density={density} />,
      },
      {
        id: CategoriesTreeComponent.id,
        getLabel: CategoriesTreeComponent.getLabel,
        render: (density?: "enlarged" | "default") => <CategoriesTreeComponent density={density} />,
      },
    ];

    return [
      {
        id: TreeWidgetId,
        label: TreeWidget.translate("treeview"),
        content: <TreeWidgetWithOptionsComponent trees={trees} />,
        icon: <SvgHierarchyTree />,
        priority: this._treeWidgetOptions?.defaultTreeWidgetPriority,
      },
    ];
  }
}

function TreeWidgetWithOptionsComponent(props: SelectableTreeProps) {
  const { density } = useViewerOptionsContext();

  return <TreeWidgetComponent trees={props.trees} density={density} />;
}
