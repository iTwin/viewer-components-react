/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { StagePanelLocation, StagePanelSection } from "@itwin/appui-react";
import type { SelectableContentDefinition } from "@itwin/components-react";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { CategoryTreeProps } from "./components/trees/category-tree/CategoriesTree";
import type { ModelsTreeProps } from "./components/trees/models-tree/ModelsTree";
import type { CategoryInfo, ModelInfo } from "./tree-widget-react";

export interface TreeHeaderButtonProps {
  viewport: Viewport;
}

export interface ModelsTreeHeaderButtonProps extends TreeHeaderButtonProps {
  models: ModelInfo[];
}

export interface CategoriesTreeHeaderButtonProps extends TreeHeaderButtonProps {
  categories: CategoryInfo[];
  filteredCategories?: CategoryInfo[];
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
> { headerButtons?: Array<(props: ModelsTreeHeaderButtonProps) => React.ReactNode> }

export interface CategoriesTreeProps extends Omit<CategoryTreeProps,
| "iModel"
| "activeView"
| "width"
| "height"
| "filterInfo"
| "onFilterApplied"
| "categories"
> { headerButtons?: Array<(props: CategoriesTreeHeaderButtonProps) => React.ReactNode> }

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
  defaultTreeId?: string;
  hideTrees?: {
    modelsTree?: boolean;
    categoriesTree?: boolean;
  };
}
