import type { SelectableContentDefinition } from "@itwin/components-react";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";

export interface ModelTreeProps {
  iModel: IModelConnection;
  allViewports?: boolean;
  activeView?: Viewport;
  enableElementsClassGrouping?: boolean;
}

export interface CategoriesTreeComponentProps {
  iModel: IModelConnection;
  allViewports?: boolean;
  activeView?: Viewport;
}

export interface ClassificationsTreeComponentProps {
  iModel: IModelConnection;
}

export interface TreeWidgetControlOptions {
  iModelConnection?: IModelConnection;
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
