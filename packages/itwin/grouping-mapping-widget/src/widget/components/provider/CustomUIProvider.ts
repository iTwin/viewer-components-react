/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ReactElement } from "react";

export enum CustomUIProviderTypes{
  GROUP = "group",
  CONTEXT = "context"
}

export type CustomUIProvider = GroupUIProvider | ContextUIProvider;

/** Custom UI Provider Definitions  */

export interface ICustomUIProvider {
  /**
   * UI Provider type
   */
  type: CustomUIProviderTypes;
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
export interface ContextUIProvider extends ICustomUIProvider {
  /**
   * UI Provider type.
   */
  type: CustomUIProviderTypes.CONTEXT;
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
export interface GroupUIProvider extends ICustomUIProvider {
  /**
   * UI Provider type.
   */
  type: CustomUIProviderTypes.GROUP;
  /**
   * Custom UI Component to build query interactively. Refer to SearchUIProvider/ManualUIProvider.
   */
  uiComponent: (props: GroupUIComponentProps) => JSX.Element;
}

/** Custom UI Component props definitions  */

/**
 * Group provider UI component props definition.
 */
export interface GroupUIComponentProps {
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
