/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { SvgChevronLeft } from "@itwin/itwinui-icons-react";
import { Text } from "@itwin/itwinui-react";
import "./utils.scss";
import React from "react";

export interface WidgetHeaderProps {
  title: string;
  disabled?: boolean;
  returnFn?: () => Promise<void>;
}

export const WidgetHeader = ({ title, disabled = false, returnFn }: WidgetHeaderProps) => {
  return (
    <div className="oclca-widget-header-container">
      {returnFn && (
        <div
          className={disabled ? "oclca-chevron-disabled" : "oclca-chevron"}
          onClick={disabled ? undefined : returnFn}
          onKeyUp={disabled ? undefined : returnFn}
        >
          <SvgChevronLeft />
        </div>
      )}
      <Text className="oclca-title" variant="title">
        {title}
      </Text>
    </div>
  );
};
