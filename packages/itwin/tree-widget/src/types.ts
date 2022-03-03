import type {
  CategoryTreeProps,
  ModelsTreeProps,
  SpatialContainmentTreeProps,
} from "@itwin/appui-react";
import type { SelectableContentDefinition } from "@itwin/components-react";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";

export interface CategoriesTreeComponentProps {
  iModel: IModelConnection;
  allViewports?: boolean;
  activeView?: Viewport;
}

export interface ClassificationsTreeComponentProps {
  iModel: IModelConnection;
}

export interface IModelContentTreeProps
  extends Omit<React.AllHTMLAttributes<HTMLDivElement>, "children"> {
  iModel: IModelConnection;
}

// export interface ModelTreeProps {
//   iModel: IModelConnection;
//   allViewports?: boolean;
//   activeView?: Viewport;
//   enableElementsClassGrouping?: boolean;
// }

export type ModelTreeProps = Omit<
  ModelsTreeProps,
  "iModel" | "width" | "height"
>;

export type AdditionalSpatialTreeProps = Omit<
  SpatialContainmentTreeProps,
  "iModel" | "width" | "height"
>;

interface CommonTreeProps {
  iModelConnection?: IModelConnection;
}

export interface HiddenTrees {
  modelsTree?: boolean;
  categoriesTree?: boolean;
  spatialTree?: boolean;
}

export interface TreeWidgetOptions extends CommonTreeProps {
  activeView?: Viewport;
  enableElementsClassGrouping?: boolean;
  allViewports?: boolean;
  additionalTrees?: SelectableContentDefinition[];
  additionalProps?: {
    modelsTree?: ModelsTreeProps;
    categoriesTree?: CategoryTreeProps;
    spatialTree?: AdditionalSpatialTreeProps;
  };
  treeReplacements?: {
    modelsTree?: () => React.ReactNode;
    categoriesTree?: () => React.ReactNode;
    spatialTree?: () => React.ReactNode;
  };
  hiddenTrees?: HiddenTrees;
}
