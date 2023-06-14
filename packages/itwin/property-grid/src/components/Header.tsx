/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./Header.scss";
import classnames from "classnames";
import { SvgProgressBackwardCircular } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { PropertyGridManager } from "../PropertyGridManager";

import type { PropsWithChildren } from "react";

/** @internal */
export interface HeaderProps {
  className?: string;
  onBackButtonClick?: () => void;
}

/** @internal */
export function Header({ className, children, onBackButtonClick }: PropsWithChildren<HeaderProps>) {
  return <div className={classnames("property-grid-react-panel-header", className)}>
    {
      onBackButtonClick
        ? <IconButton
          styleType="borderless"
          onClick={onBackButtonClick}
          title={PropertyGridManager.translate("header.back")}
          className="property-grid-react-header-back-button"
        >
          <SvgProgressBackwardCircular />
        </IconButton>
        : null
    }
    {children}
  </div>;
}
