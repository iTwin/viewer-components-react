/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Field } from "@itwin/presentation-common";
import type {
  IPresentationPropertyDataProvider,
  PresentationPropertyDataProvider,
} from "@itwin/presentation-components";
import type {
  ActionButtonRenderer,
  PropertyGridContextMenuArgs,
} from "@itwin/components-react";
import type { ContextMenuItemProps, Orientation } from "@itwin/core-react";
import type { FavoritePropertiesScope } from "@itwin/presentation-frontend";
import type {
  AbstractZoneLocation,
  PropertyRecord,
  StagePanelLocation,
  StagePanelSection,
} from "@itwin/appui-abstract";

export type ContextMenuItemInfo = ContextMenuItemProps & React.Attributes & {
  label: string;
  isValid?: (record: PropertyRecord, field?: Field) => boolean;
};

export interface OnSelectEventArgs {
  dataProvider: IPresentationPropertyDataProvider;
  field?: Field;
  contextMenuArgs: PropertyGridContextMenuArgs;
}

export interface PropertyGridProps {
  orientation?: Orientation;
  isOrientationFixed?: boolean;
  enableFavoriteProperties?: boolean;
  favoritePropertiesScope?: FavoritePropertiesScope;
  customOnDataChanged?: (
    dataProvider: IPresentationPropertyDataProvider
  ) => Promise<void>;
  actionButtonRenderers?: ActionButtonRenderer[];
  enableCopyingPropertyText?: boolean;
  enableNullValueToggle?: boolean;
  defaultPanelLocation?: StagePanelLocation;
  defaultPanelSection?: StagePanelSection;
  /** If true, enables property category group nesting  */
  enablePropertyGroupNesting?: boolean;
  additionalContextMenuOptions?: ContextMenuItemInfo[];
  /** Override some or all attributes of some or all default context menu options **/
  defaultContextMenuOptions?: Map<PropertyGridDefaultContextMenuKey, Partial<ContextMenuItemInfo>>;
  rulesetId?: string;
  rootClassName?: string;
  dataProvider?: PresentationPropertyDataProvider;
  onInfoButton?: () => void;
  onBackButton?: () => void;
  disableUnifiedSelection?: boolean;
  // eslint-disable-next-line deprecation/deprecation
  defaultZoneLocation?: AbstractZoneLocation;
}

export enum PropertyGridDefaultContextMenuKey {
  RemoveFavorite = "remove-favorite",
  AddFavorite = "add-favorite",
  CopyText = "copy-text",
  HideNull = "hide-null",
  ShowNull = "show-null",
}
