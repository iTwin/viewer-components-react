/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Field } from "@bentley/presentation-common";
import { IPresentationPropertyDataProvider, PresentationPropertyDataProvider } from "@bentley/presentation-components";
import { PropertyGridContextMenuArgs } from "@bentley/ui-components";
import { ContextMenuItemProps, Orientation } from "@bentley/ui-core";

export const SharedNamespace = "favoriteProperties";
export const SharedName = "sharedProps";
export type ContextMenuItemInfo = ContextMenuItemProps &
  React.Attributes & { label: string };


export interface PropertyGridFeatureTracking {
  trackCopyPropertyText: () => void;
}

export interface OnSelectEventArgs {
  dataProvider: IPresentationPropertyDataProvider;
  field?: Field;
  contextMenuArgs: PropertyGridContextMenuArgs;
}


export interface PropertyGridProps {
  iModelConnection: IModelConnection;
  projectId: string;
  orientation?: Orientation;
  isOrientationFixed?: boolean;
  enableFavoriteProperties?: boolean;
  enableCopyingPropertyText?: boolean;
  enableNullValueToggle?: boolean;
  additionalContextMenuOptions?: ContextMenuItemInfo[];
  debugLog?: (message: string) => void;
  featureTracking?: PropertyGridFeatureTracking;
  rulesetId?: string;
  rootClassName?: string;
  dataProvider?: PresentationPropertyDataProvider;
  onInfoButton?: () => void;
  onBackButton?: () => void;
  disableUnifiedSelection?: boolean;
}
