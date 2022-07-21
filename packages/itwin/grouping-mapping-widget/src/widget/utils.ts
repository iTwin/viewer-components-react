/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
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
 * Group Extension type definition
 */
export type GroupExtension = {
  /**
   * unique identifier of the extension
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
  uiComponent: (props: GroupExtensionProps) => JSX.Element;
  /**
   * Optional icon, will be shown before display label in widget
   */
  icon?: JSX.Element;
};

/**
 * Group extension component props
 */
export type GroupExtensionProps = {
  /**
   * function to validate and update current query
   */
  updateQuery: (query: string) => void;
};
