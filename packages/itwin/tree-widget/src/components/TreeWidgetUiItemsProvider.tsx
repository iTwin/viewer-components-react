/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./TreeWidgetUiItemsProvider.scss";
import { StagePanelLocation, StagePanelSection, StageUsage } from "@itwin/appui-react";
import { SvgHierarchyTree } from "@itwin/itwinui-icons-react";
import { TreeWidget } from "../TreeWidget";
import { CategoriesTreeComponent } from "./trees/category-tree/CategoriesTreeComponent";
import { ModelsTreeComponent } from "./trees/models-tree/ModelsTreeComponent";
import { SelectableTree } from "./SelectableTree";
import { useTreeTransientState } from "./utils/UseTreeTransientState";

import type { UiItemsProvider, Widget } from "@itwin/appui-react";
import type { SelectableTreeProps, TreeDefinition } from "./SelectableTree";

/**
 * Parameters for creating a [[TreeWidgetUiItemsProvider]].
 * @public
 */
export interface TreeWidgetOptions {
  /** The stage panel to place the widget in. Defaults to `StagePanelLocation.Right`. */
  defaultPanelLocation?: StagePanelLocation;
  /** The stage panel section to place the widget in. Defaults to `StagePanelSection.Start`. */
  defaultPanelSection?: StagePanelSection;
  /** Widget priority in the stage panel. */
  defaultTreeWidgetPriority?: number;
  /** Trees to show in the widget. Defaults to [[ModelsTreeComponent]] and [[CategoriesTreeComponent]]. */
  trees?: TreeDefinition[];
}

/**
 * Id of the tree widget created by [[TreeWidgetUiItemsProvider]].
 * @public
 */
export const TreeWidgetId = "tree-widget-react:trees";

/**
 * A [[UiItemsProvider]] implementation that provides a [[SelectableTree]] into a stage panel.
 * @public
 */
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
      content: <SelectableTreeWidget trees={trees} />,
      icon: <SvgHierarchyTree />,
      priority: this._treeWidgetOptions?.defaultTreeWidgetPriority,
    }];
  }
}

function SelectableTreeWidget(props: SelectableTreeProps) {
  const ref = useTreeTransientState<HTMLDivElement>();

  return (<div ref={ref} className="tree-widget">
    <SelectableTree {...props} />
  </div>);
}
