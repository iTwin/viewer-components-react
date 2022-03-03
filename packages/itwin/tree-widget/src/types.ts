import type {
  CategoryTreeProps,
  ModelsTreeProps,
  SpatialContainmentTreeProps,
} from "@itwin/appui-react";
import type { SelectableContentDefinition } from "@itwin/components-react";
import type { IModelConnection } from "@itwin/core-frontend";

export interface ClassificationsTreeComponentProps {
  iModel: IModelConnection;
}

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

export interface HiddenTrees {
  modelsTree?: boolean;
  categoriesTree?: boolean;
  spatialTree?: boolean;
}

export interface TreeWidgetOptions {
  enableElementsClassGrouping?: boolean;
  additionalTrees?: SelectableContentDefinition[];
  additionalProps?: {
    modelsTree?: ModelTreeProps;
    categoriesTree?: CategoriesTreeProps;
    spatialTree?: SpatialTreeProps;
  };
  hiddenTrees?: HiddenTrees;
}
