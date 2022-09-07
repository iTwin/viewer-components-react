/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ReactElement } from "react";

export type CreateTypeFromInterface<Interface> = {
  [Property in keyof Interface]: Interface[Property];
};

export function debounce<F extends (...args: any[]) => void>(
  f: F,
  delay: number,
) {
  let timer: number | undefined;
  return (...args: any[]) => {
    timer && window.clearTimeout(timer);
    timer = window.setTimeout(f, delay, ...args);
  };
}

/**
 * Custom UI provider type definition
 */
export interface CustomUIProvider {
  /**
   * unique identifier of the ui provider
   */
  name: string;
  /**
   * display label in the widget
   */
  displayLabel: string;
  /**
   * UI Component interface
   * User defined UI component MUST BE CAPITALIZED
   */
  uiComponent: (props: CustomUIProviderProps) => JSX.Element;
  /**
   * Optional icon, will be shown before display label in widget
   */
  icon?: ReactElement;
}

/**
 * Custom UI Provider props
 */
export interface CustomUIProviderProps {
  /**
   * to validate and update current query
   */
  updateQuery: (query: string) => void;
  /**
   * to get the query loading status
   */
  isUpdating?: boolean;
  /**
   * to reset the viewer
   */
  resetView?: () => Promise<void>;
}
