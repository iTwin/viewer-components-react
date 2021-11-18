/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelConnection } from "@itwin/core-frontend";
import { Field } from "@itwin/presentation-common";
import {
  IPresentationPropertyDataProvider,
  PresentationPropertyDataProvider,
} from "@itwin/presentation-components";
import { PropertyGridContextMenuArgs } from "@itwin/components-react";
import { ContextMenuItemProps, Orientation } from "@itwin/core-react";

export const SHARED_NAMESPACE = "favoriteProperties";
export const SHARED_NAME = "sharedProps";
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

export interface PropertyGridWidgetBaseProps {
  orientation?: Orientation;
  isOrientationFixed?: boolean;
  enableFavoriteProperties?: boolean;
  enableCopyingPropertyText?: boolean;
  enableNullValueToggle?: boolean;
  additionalContextMenuOptions?: ContextMenuItemInfo[];
  rulesetId?: string;
  rootClassName?: string;
  dataProvider?: PresentationPropertyDataProvider;
  onInfoButton?: () => void;
  onBackButton?: () => void;
  disableUnifiedSelection?: boolean;
}

export interface PropertyGridProps extends PropertyGridWidgetBaseProps {
  /** @deprecated will automatically obtain active iModel Connection */
  iModelConnection: IModelConnection;
  /** @deprecated will automatically obtain project/context id from active iModel Connection */
  projectId: string;
  /** @deprecated will be removed in next major */
  debugLog?: (message: string) => void;
  /** @deprecated will be removed in next major */
  featureTracking?: PropertyGridFeatureTracking;
}

/** Supported Feature Flags for PropertyGrid */
export interface PropertyGridManagerFeatureFlags {
  /** If true, enables property category group nesting  */
  enablePropertyGroupNesting?: boolean;
}
