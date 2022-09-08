/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ReactElement } from "react";

/**
 * Custom UI provider type definition.
 */
export interface CustomUIProvider {
  /**
   * Unique identifier of the UI provider.
   */
  name: string;
  /**
   * Display label in the widget.
   */
  displayLabel: string;
  /**
   * Custom UI Component to build query interactively. Refer to SearchUIProvider/ManualUIProvider.
   */
  uiComponent: (props: CustomUIComponentProps) => JSX.Element;
  /**
   * Optional icon, will be shown before display label in widget.
   */
  icon?: ReactElement;
}

/**
 * Custom UI component props definition.
 */
export interface CustomUIComponentProps {
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
