/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { StagePanelLocation, StagePanelSection } from "@itwin/appui-abstract";
import type {
  CategoryTreeProps,
  ModelsTreeProps,
  SpatialContainmentTreeProps,
} from "@itwin/appui-react";
import type { SelectableContentDefinition } from "@itwin/components-react";
import type { IModelConnection } from "@itwin/core-frontend";

export interface IModelContentTreeProps
  extends Omit<React.AllHTMLAttributes<HTMLDivElement>, "children"> {
  iModel: IModelConnection;
}

export type ModelTreeProps = Omit<
ModelsTreeProps,
| "iModel"
| "activeView"
| "width"
| "height"
| "filterInfo"
| "onFilterApplied"
>;

export type CategoriesTreeProps = Omit<
CategoryTreeProps,
| "iModel"
| "activeView"
| "width"
| "height"
| "filterInfo"
| "onFilterApplied"
>;

export type SpatialTreeProps = Omit<
SpatialContainmentTreeProps,
"iModel" | "width" | "height"
>;

export interface TreeWidgetOptions {
  defaultPanelLocation?: StagePanelLocation;
  defaultPanelSection?: StagePanelSection;
  defaultTreeWidgetPriority?: number;
  enableElementsClassGrouping?: boolean;
  additionalTrees?: SelectableContentDefinition[];
  modelsTreeProps?: ModelTreeProps;
  categoriesTreeProps?: CategoriesTreeProps;
  spatialTreeProps?: SpatialTreeProps;
  hideTrees?: {
    modelsTree?: boolean;
    categoriesTree?: boolean;
    spatialTree?: boolean;
  };
}
