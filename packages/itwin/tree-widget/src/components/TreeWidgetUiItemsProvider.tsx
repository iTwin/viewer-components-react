/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {
  AbstractWidgetProps,
  StagePanelSection,
  UiItemsProvider,
} from "@itwin/appui-abstract";
import {
  StagePanelLocation,
  StageUsage,
} from "@itwin/appui-abstract";
import { ClassGroupingOption, UiFramework } from "@itwin/appui-react";
import React from "react";
import { TreeWidgetComponent } from "./TreeWidgetComponent";
import { CategoriesTreeComponent } from "./trees/CategoriesTree";
import { ModelsTreeComponent } from "./trees/ModelsTree";
import { SpatialTreeComponent } from "./trees/SpatialTree";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { SelectableContentDefinition } from "@itwin/components-react";
import { TreeWidget } from "../TreeWidget";
import type { TreeWidgetControlOptions } from "../types";

export class TreeWidgetUiItemsProvider implements UiItemsProvider {
  public readonly id = "TreeWidgetUiItemsProvider";

  private _imodel?: IModelConnection;
  private _activeView?: Viewport;
  private _enableElementsClassGrouping?: boolean;
  private _allViewports?: boolean;
  private _additionalTrees?: SelectableContentDefinition[];
  private _modelsTreeProps?: {};
  private _categoriesTreeProps?: {};
  private _spatialTreeProps?: {};
  private _modelsTreeReplacement?: () => React.ReactNode;
  private _categoriesTreeReplacement?: () => React.ReactNode;
  private _spatialTreeReplacement?: () => React.ReactNode;

  constructor(props?: TreeWidgetControlOptions) {
    this._imodel = props?.iModelConnection;
    this._activeView = props?.activeView;
    this._enableElementsClassGrouping = props?.enableElementsClassGrouping;
    this._allViewports = props?.allViewports;
    this._additionalTrees = props?.additionalTrees;
    this._modelsTreeProps = props?.additionalProps?.modelsTree;
    this._categoriesTreeProps = props?.additionalProps?.categoriesTree;
    this._spatialTreeProps = props?.additionalProps?.spatialTree;
    this._modelsTreeReplacement = props?.treeReplacements?.modelsTree;
    this._categoriesTreeReplacement = props?.treeReplacements?.categoriesTree;
    this._spatialTreeReplacement = props?.treeReplacements?.spatialTree;
  }

  public provideWidgets(
    _stageId: string,
    stageUsage: string,
    location: StagePanelLocation,
    _section: StagePanelSection | undefined
  ): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    const imodel = UiFramework.getIModelConnection();
    if (
      stageUsage === StageUsage.General &&
      location === StagePanelLocation.Right &&
      imodel !== undefined
    ) {
      const modelsTreeComponent = (
        <ModelsTreeComponent
          iModel={this._imodel ?? imodel}
          allViewports={this._allViewports}
          activeView={this._activeView}
          enableElementsClassGrouping={this._enableElementsClassGrouping}
          {...this._modelsTreeProps}
        />
      );

      const categoriesTreeComponent = (
        <CategoriesTreeComponent
          iModel={this._imodel ?? imodel}
          allViewports={this._allViewports}
          activeView={this._activeView}
          {...this._categoriesTreeProps}
        />
      );

      const spatialContainmentComponent = (
        <SpatialTreeComponent
          iModel={this._imodel ?? imodel}
          enableElementsClassGrouping={
            this._enableElementsClassGrouping
              ? ClassGroupingOption.Yes
              : ClassGroupingOption.No
          }
          {...this._spatialTreeProps}
        />
      );

      const trees: SelectableContentDefinition[] = [
        {
          label: TreeWidget.translate("modeltree"),
          id: "model-tree",
          render: this._modelsTreeReplacement
            ? this._modelsTreeReplacement
            : () => modelsTreeComponent,
        },
        {
          label: TreeWidget.translate("categories"),
          id: "categories-tree",
          render: this._categoriesTreeReplacement
            ? this._categoriesTreeReplacement
            : () => categoriesTreeComponent,
        },
        {
          label: TreeWidget.translate("containment"),
          id: "spatial-containment-tree",
          render: this._spatialTreeReplacement
            ? this._spatialTreeReplacement
            : () => spatialContainmentComponent,
        },
      ];

      if (this._additionalTrees) {
        trees.push(...this._additionalTrees);
      }

      widgets.push({
        id: "tree",
        label: TreeWidget.translate("treeview"),
        // eslint-disable-next-line react/display-name
        getWidgetContent: () => <TreeWidgetComponent trees={trees} />,
      });
    }

    return widgets;
  }
}
