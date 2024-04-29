/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Group, GroupMinimal, Mapping } from "@itwin/insights-client";
import type { ReactElement } from "react";

export enum GroupingMappingCustomUIType {
  Grouping,
  Context,
}

export type GroupingMappingCustomUI = GroupingCustomUI | ContextCustomUI;

/** Custom UI Definitions. */

export interface IGroupingMappingCustomUI {
  /**
   * See GroupingMappingCustomUIType.
   */
  type: GroupingMappingCustomUIType;
  /**
   * Unique identifier of the custom UI.
   */
  name: string;
  /**
   * Display label in the widget.
   */
  displayLabel: string;
  /**
   * Optional icon, will be shown before display label in widget.
   */
  icon?: ReactElement;
}

/**
 * Context custom UI type definition.
 */
export interface ContextCustomUI extends IGroupingMappingCustomUI {
  /**
   * See GroupingMappingCustomUIType.
   */
  type: GroupingMappingCustomUIType.Context;
  /**
   * User defined component for UI interaction with grouping mapping widget.
   */
  uiComponent?: React.ComponentType<ContextCustomUIProps>;
  /**
   * Callback function for context custom UI menu item click event.
   */
  onClick?: (group: Group | GroupMinimal, mapping: Mapping, iModelId: string) => void;
}

/**
 * Group custom UI type definition.
 */
export interface GroupingCustomUI extends IGroupingMappingCustomUI {
  /**
   * See GroupingMappingCustomUIType.
   */
  type: GroupingMappingCustomUIType.Grouping;
  /**
   * Custom UI Component to build query interactively. Refer to SearchGroupingCustomUI/ManualGroupingCustomUI.
   */
  uiComponent: (props: GroupingCustomUIProps) => JSX.Element;
}

/** Custom UI Component props definitions. */

/**
 * Context custom UI component arguments definition.
 */
export interface ContextCustomUIProps {
  /**
   * IModel Id.
   */
  iModelId: string;
  /**
   * Mapping Id.
   */
  mappingId: string;
  /**
   * Group Id.
   */
  groupId: string;
}

/**
 * Group custom UI component arguments definition.
 */
export interface GroupingCustomUIProps {
  /**
   * To validate and update current query.
   */
  updateQuery: (query: string) => void;
  /**
   * To get the query loading status.
   */
  isUpdating?: boolean;
  /**
   * To reset the viewer.
   */
  resetView?: () => Promise<void>;
  /**
   * The initial query for the Group being edited.
   */
  initialEditModeQuery?: string;

}
