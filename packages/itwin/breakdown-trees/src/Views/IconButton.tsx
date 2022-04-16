/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import classnames from "classnames";
import type { CommonProps } from "@itwin/core-react";
import "./IconButton.scss";

/** Properties for [[IconButton]] component */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, CommonProps {
  /** Icon name */
  icon: string;
  /** A function to be run when the element is clicked */
  onClick?: ((event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void);
}

/** Generic icon button component */
export class IconButton extends React.PureComponent<IconButtonProps> {
  public render() {
    const { className, icon, onClick, ...props } = this.props;
    return (
      <button {...props} className={classnames("visibility-icon-button", className)} onClick={onClick}>
        <span className={classnames("icon", icon)} />
      </button>
    );
  }
}
