/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ReactElement } from "react";

export enum GroupingMappingCustomUIType {
  GROUP = "group",
  CONTEXT = "context"
}

export type GroupingMappingCustomUI = GroupingCustomUI | ContextCustomUI;

/** Custom UI Definitions */

export interface IGroupingMappingCustomUI {
  /**
   * Custom UI type: grouping or context
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
   * UI type.
   */
  type: GroupingMappingCustomUIType.CONTEXT;
  /**
   * User defined component for UI interaction with grouping mapping widget.
   */
  uiComponent?: () => JSX.Element;
  /**
   * Callback function for non UI interaction with grouping mapping widget.
   */
  callback?: (groupId: string, mappingId: string, iModelId: string) => void;
}

/**
 * Group custom UI type definition.
 */
export interface GroupingCustomUI extends IGroupingMappingCustomUI {
  /**
   * UI type.
   */
  type: GroupingMappingCustomUIType.GROUP;
  /**
   * Custom UI Component to build query interactively. Refer to SearchGroupingCustomUI/ManualGroupingCustomUI.
   */
  uiComponent: (props: GroupingCustomUIProps ) => JSX.Element;
}

/** Custom UI Component props definitions  */

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
}
