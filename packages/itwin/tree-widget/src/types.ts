/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { SpatialContainmentTreeProps, StagePanelLocation, StagePanelSection } from "@itwin/appui-react";
import type { SelectableContentDefinition } from "@itwin/components-react";
import type { IModelConnection, ScreenViewport } from "@itwin/core-frontend";
import type { CategoryTreeProps } from "./components/trees/category-tree/CategoriesTree";
import type { ModelsTreeProps } from "./components/trees/models-tree/ModelsTree";
import type { Category, ModelsTreeComponentNamespace } from "./tree-widget-react";

export interface TreeHeaderButtonProps {
  viewport: ScreenViewport;
}

export interface ModelsTreeHeaderButtonProps extends TreeHeaderButtonProps {
  models?: ModelsTreeComponentNamespace.TreeViewModelInfo[];
}

export interface CategoriesTreeHeaderButtonProps extends TreeHeaderButtonProps {
  categories: Category[];
  filteredCategories?: Category[];
}

export interface IModelContentTreeProps
  extends Omit<React.AllHTMLAttributes<HTMLDivElement>, "children"> {
  iModel: IModelConnection;
}

export interface ModelTreeProps extends Omit<ModelsTreeProps,
| "iModel"
| "activeView"
| "width"
| "height"
| "filterInfo"
| "onFilterApplied"
> { treeHeaderButtons?: Array<(props: ModelsTreeHeaderButtonProps) => React.ReactNode> }

export interface CategoriesTreeProps extends Omit<CategoryTreeProps,
| "iModel"
| "activeView"
| "width"
| "height"
| "filterInfo"
| "onFilterApplied"
> { treeHeaderButtons?: Array<(props: CategoriesTreeHeaderButtonProps) => React.ReactNode> }

export type SpatialTreeProps = Omit<
// eslint-disable-next-line deprecation/deprecation
SpatialContainmentTreeProps,
"iModel" | "width" | "height"
>;

export const ModelsTreeId = "models-tree";

export const CategoriesTreeId = "categories-tree";

export const SpatialContainmentTreeId = "spatial-containment-tree";

export interface TreeWidgetOptions {
  defaultPanelLocation?: StagePanelLocation;
  defaultPanelSection?: StagePanelSection;
  defaultTreeWidgetPriority?: number;
  enableElementsClassGrouping?: boolean;
  additionalTrees?: SelectableContentDefinition[];
  modelsTreeProps?: ModelTreeProps;
  categoriesTreeProps?: CategoriesTreeProps;
  spatialTreeProps?: SpatialTreeProps;
  defaultTreeId?: string;
  hideTrees?: {
    modelsTree?: boolean;
    categoriesTree?: boolean;
    spatialTree?: boolean;
  };
}
