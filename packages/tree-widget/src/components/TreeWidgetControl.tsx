/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  WidgetControl,
  ConfigurableCreateInfo,
  SpatialContainmentTree,
  ClassGroupingOption,
  UiFramework,
} from "@bentley/ui-framework";
import React from "react";
import { ModelsTreeComponent } from "./trees/ModelsTree";
import { CategoriesTreeComponent } from "./trees/CategoriesTree";
import { IModelConnection, Viewport } from "@bentley/imodeljs-frontend";
import { TreeWidgetTree, TreeWidgetComponent } from "./TreeWidgetComponent";

export interface TreeWidgetControlOptions {
  iModelConnection: IModelConnection;
  activeView?: Viewport;
  enablePreloading?: boolean;
  enableElementsClassGrouping?: boolean;
  allViewports?: boolean;
  additionalTrees?: TreeWidgetTree[];
  additionalProps?: {
    modelsTree?: {};
    categoriesTree?: {};
    spatialTree?: {};
  };
}

export class TreeWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: TreeWidgetControlOptions) {
    super(info, options);

    const { iModelConnection: imodel, activeView, enablePreloading } = options;
    const modelsTreeProps = options.additionalProps?.modelsTree;
    const categoriesTreeProps = options.additionalProps?.categoriesTree;
    const spatialTreeProps = options.additionalProps?.spatialTree;
    const enableElementsClassGrouping = options.enableElementsClassGrouping;
    const allViewPorts = options.allViewports;
    const additionalTrees = options.additionalTrees;

    const modelsTreeComponent = (
      <ModelsTreeComponent
        iModel={imodel}
        allViewports={allViewPorts}
        activeView={activeView}
        enablePreloading={enablePreloading}
        enableElementsClassGrouping={enableElementsClassGrouping}
        {...modelsTreeProps}
      />
    );

    const categoriesTreeComponent = (
      <CategoriesTreeComponent
        iModel={imodel}
        allViewports={allViewPorts}
        activeView={activeView}
        enablePreloading={enablePreloading}
        {...categoriesTreeProps}
      />
    );

    const spatialContainmentComponent = (
      <SpatialContainmentTree
        iModel={imodel}
        enablePreloading={enablePreloading}
        enableElementsClassGrouping={
          enableElementsClassGrouping
            ? ClassGroupingOption.Yes
            : ClassGroupingOption.No
        }
        {...spatialTreeProps}
      />
    );

    const trees: TreeWidgetTree[] = [
      {
        label: UiFramework.translate("visibilityWidget.modeltree"),
        id: "model-tree",
        component: modelsTreeComponent,
      },
      {
        label: UiFramework.translate("visibilityWidget.categories"),
        id: "categories-tree",
        component: categoriesTreeComponent,
      },
      {
        label: UiFramework.translate("visibilityWidget.containment"),
        id: "spatial-containment-tree",
        component: spatialContainmentComponent,
      },
    ];

    if (additionalTrees) trees.push(...additionalTrees);

    this.reactNode = <TreeWidgetComponent trees={trees} />;
  }
}
