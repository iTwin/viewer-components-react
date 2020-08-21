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
import { TreeWidgetComponent } from "./TreeWidgetComponent";
import { SelectableContentDefinition } from "@bentley/ui-components";

export interface TreeWidgetControlOptions {
  iModelConnection: IModelConnection;
  activeView?: Viewport;
  enablePreloading?: boolean;
  enableElementsClassGrouping?: boolean;
  allViewports?: boolean;
  additionalTrees?: SelectableContentDefinition[];
  additionalProps?: {
    modelsTree?: {};
    categoriesTree?: {};
    spatialTree?: {};
  };
  treeReplacements?: {
    modelsTree?: () => React.ReactNode;
    categoriesTree?: () => React.ReactNode;
    spatialTree?: () => React.ReactNode;
  }
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
    const modelsTreeReplacement = options.treeReplacements?.modelsTree;
    const categoriesTreeReplacement = options.treeReplacements?.categoriesTree;
    const spatialTreeReplacement = options.treeReplacements?.spatialTree;

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

    const trees: SelectableContentDefinition[] = [
      {
        label: UiFramework.translate("visibilityWidget.modeltree"),
        id: "model-tree",
        render: modelsTreeReplacement ? modelsTreeReplacement : () => modelsTreeComponent,
      },
      {
        label: UiFramework.translate("visibilityWidget.categories"),
        id: "categories-tree",
        render: categoriesTreeReplacement ? categoriesTreeReplacement : () => categoriesTreeComponent,
      },
      {
        label: UiFramework.translate("visibilityWidget.containment"),
        id: "spatial-containment-tree",
        render: spatialTreeReplacement ? spatialTreeReplacement : () => spatialContainmentComponent,
      },
    ];

    if (additionalTrees) trees.push(...additionalTrees);

    this.reactNode = <TreeWidgetComponent trees={trees} />;
  }
}
