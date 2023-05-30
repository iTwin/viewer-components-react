/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SvgChevronLeft } from "@itwin/itwinui-icons-react";
import { Text } from "@itwin/itwinui-react";
import "./WidgetHeader.scss";
import React from "react";

export interface WidgetHeaderProps {
  title: string;
  disabled?: boolean;
  returnFn?: () => void;
}

export const WidgetHeader = ({
  title,
  disabled = false,
  returnFn,
}: WidgetHeaderProps) => {
  return (
    <div className='gmw-widget-header-container'>
      {returnFn && (
        <div
          className={`${disabled ? "gmw-chevron-disabled" : "gmw-chevron"} iui-svg-icon`}
          data-iui-icon-size="l"
          onClick={disabled ? undefined : returnFn}
        >
          <SvgChevronLeft />
        </div>
      )}
      <Text className='gmw-title' variant='title'>
        {title}
      </Text>
    </div>
  );
};
