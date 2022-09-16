/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ReactElement } from "react";

/**
 * Customized UI provider type definition for grouping mapping widget.
 */
export interface GroupingMappingCustomUI {
  /**
   * Unique identifier of the UI provider.
   */
  name: string;
  /**
   * Display label in the widget.
   */
  displayLabel: string;
  /**
   * Custom UI Component to build query interactively. Refer to searchGroupingUI/manualGroupingUI.
   */
  uiComponent: (props: GroupingMappingCustomUIProps) => JSX.Element;
  /**
   * Optional icon, will be shown before display label in widget.
   */
  icon?: ReactElement;
}

/**
 * Customized UI component arguments definition.
 */
export interface GroupingMappingCustomUIProps {
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
