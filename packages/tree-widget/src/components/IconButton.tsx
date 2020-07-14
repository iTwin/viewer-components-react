/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import classnames from "classnames";
import { CommonProps } from "@bentley/ui-core";
import "./IconButton.scss";

/** Properties for [[IconButton]] component */
export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  CommonProps {
  /** Icon name */
  icon: string;
  /** A function to be run when the element is clicked */
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}

/** Generic icon button component */
export function IconButton({
  className,
  icon,
  onClick,
  ...otherProps
}: IconButtonProps) {
  return (
    <button
      {...otherProps}
      className={classnames("tree-widget-icon-button", className)}
      onClick={onClick}
    >
      <span className={classnames("icon", icon)} />
    </button>
  );
}
