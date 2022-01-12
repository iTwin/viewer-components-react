/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  WidgetControl,
  ConfigurableCreateInfo,
  ClassGroupingOption,
} from "@itwin/appui-react";
import React from "react";
import {
  ModelsTreeComponent,
  CategoriesTreeComponent,
  SpatialTreeComponent,
} from "./trees";
import { IModelConnection, Viewport } from "@itwin/core-frontend";
import { TreeWidgetComponent } from "./TreeWidgetComponent";
import { SelectableContentDefinition } from "@itwin/components-react";
import { TreeWidget } from "../TreeWidget";

export interface TreeWidgetControlOptions {
  iModelConnection: IModelConnection;
  activeView?: Viewport;
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
  };
}

export class TreeWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: TreeWidgetControlOptions) {
    super(info, options);

    const { iModelConnection: imodel, activeView } = options;
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
        enableElementsClassGrouping={enableElementsClassGrouping}
        {...modelsTreeProps}
      />
    );

    const categoriesTreeComponent = (
      <CategoriesTreeComponent
        iModel={imodel}
        allViewports={allViewPorts}
        activeView={activeView}
        {...categoriesTreeProps}
      />
    );

    const spatialContainmentComponent = (
      <SpatialTreeComponent
        iModel={imodel}
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
        label: TreeWidget.translate("modeltree"),
        id: "model-tree",
        render: modelsTreeReplacement
          ? modelsTreeReplacement
          : () => modelsTreeComponent,
      },
      {
        label: TreeWidget.translate("categories"),
        id: "categories-tree",
        render: categoriesTreeReplacement
          ? categoriesTreeReplacement
          : () => categoriesTreeComponent,
      },
      {
        label: TreeWidget.translate("containment"),
        id: "spatial-containment-tree",
        render: spatialTreeReplacement
          ? spatialTreeReplacement
          : () => spatialContainmentComponent,
      },
    ];

    if (additionalTrees) trees.push(...additionalTrees);

    this.reactNode = <TreeWidgetComponent trees={trees} />;
  }
}
