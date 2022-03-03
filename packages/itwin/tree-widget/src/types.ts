import type {
  CategoryTreeProps,
  ModelsTreeProps,
  SpatialContainmentTreeProps,
} from "@itwin/appui-react";
import type { SelectableContentDefinition } from "@itwin/components-react";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";

export interface CategoriesTreeComponentProps {
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
  activeView?: Viewport;
}

export interface HiddenTrees {
  modelsTree?: boolean;
  categoriesTree?: boolean;
  spatialTree?: boolean;
}

export interface TreeWidgetOptions extends CommonTreeProps {
  enableElementsClassGrouping?: boolean;
  allViewports?: boolean;
  additionalTrees?: SelectableContentDefinition[];
  additionalProps?: {
    modelsTree?: ModelsTreeProps;
    categoriesTree?: CategoryTreeProps;
    spatialTree?: AdditionalSpatialTreeProps;
  };
  hiddenTrees?: HiddenTrees;
}
