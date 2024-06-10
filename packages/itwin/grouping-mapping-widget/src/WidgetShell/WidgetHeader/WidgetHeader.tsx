/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { SvgChevronLeft } from "@itwin/itwinui-icons-react";
import { Icon, Text } from "@itwin/itwinui-react";
import "./WidgetHeader.scss";
import React from "react";

export interface WidgetHeaderProps {
  title: string;
  disabled?: boolean;
  returnFn?: () => void;
}

export const WidgetHeader = ({ title, disabled = false, returnFn }: WidgetHeaderProps) => {
  return (
    <div className="gmw-widget-header-container">
      {returnFn && (
        <Icon className={`${disabled ? "gmw-chevron-disabled" : "gmw-chevron"}`} size="large" onClick={disabled ? undefined : returnFn} title="Back">
          <SvgChevronLeft />
        </Icon>
      )}
      <Text className="gmw-title" variant="title">
        {title}
      </Text>
    </div>
  );
};
