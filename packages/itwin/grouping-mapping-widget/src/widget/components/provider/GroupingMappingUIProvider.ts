/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ReactElement } from "react";

export enum GroupingMappingUIProviderType {
  GROUP = "group",
  CONTEXT = "context"
}

export type GroupingMappingUIProvider = GroupingUIProvider | ContextUIProvider;

/** Custom UI Provider Definitions  */

export interface IGroupingMappingUIProvider {
  /**
   * UI Provider type
   */
  type: GroupingMappingUIProviderType;
  /**
   * Unique identifier of the UI provider.
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
 * Context UI provider type definition.
 */
export interface ContextUIProvider extends IGroupingMappingUIProvider {
  /**
   * UI Provider type.
   */
  type: GroupingMappingUIProviderType.CONTEXT;
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
 * Custom UI provider type definition.
 */
export interface GroupingUIProvider extends IGroupingMappingUIProvider {
  /**
   * UI Provider type.
   */
  type: GroupingMappingUIProviderType.GROUP;
  /**
   * Custom UI Component to build query interactively. Refer to SearchUIProvider/ManualUIProvider.
   */
  uiComponent: (props: GroupingUIProps ) => JSX.Element;
}

/** Custom UI Component props definitions  */

/**
 * Group providerized UI component arguments definition.
 */
export interface GroupingUIProps {
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
