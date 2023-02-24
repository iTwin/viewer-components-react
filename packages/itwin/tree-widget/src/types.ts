/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { StagePanelLocation, StagePanelSection } from "@itwin/appui-react";
// import type { SpatialContainmentTreeProps } from "@itwin/breakdown-trees-react";
import type { SelectableContentDefinition } from "@itwin/components-react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { CategoryTreeProps } from "./components/trees/category-tree/CategoriesTree";
import type { ModelsTreeProps } from "./components/trees/models-tree/ModelsTree";

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

// export type SpatialTreeProps = SpatialContainmentTreeProps;

export const ModelsTreeId = "models-tree";

export const CategoriesTreeId = "categories-tree";

// export const SpatialContainmentTreeId = "spatial-containment-tree";

export interface TreeWidgetOptions {
  defaultPanelLocation?: StagePanelLocation;
  defaultPanelSection?: StagePanelSection;
  defaultTreeWidgetPriority?: number;
  enableElementsClassGrouping?: boolean;
  additionalTrees?: SelectableContentDefinition[];
  modelsTreeProps?: ModelTreeProps;
  categoriesTreeProps?: CategoriesTreeProps;
  // spatialTreeProps?: SpatialTreeProps;
  defaultTreeId?: string;
  hideTrees?: {
    modelsTree?: boolean;
    categoriesTree?: boolean;
    // spatialTree?: boolean;
  };
}
