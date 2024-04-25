/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Group, Mapping } from "@itwin/insights-client";
import type { ReactElement } from "react";

/**
 * @public
 */
export enum GroupingMappingCustomUIType {
  Grouping,
  Context,
}

/**
 * @public
 */
export type GroupingMappingCustomUI = GroupingCustomUI | ContextCustomUI;

/** Custom UI Definitions.
 * @public
 */
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
 * @public
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
  onClick?: (group: Group, mapping: Mapping, iModelId: string) => void;
}

/**
 * Group custom UI type definition.
 * @public
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
 * @public
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
 * @public
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
