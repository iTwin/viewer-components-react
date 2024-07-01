/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import classnames from "classnames";
import { SvgFlag, SvgInfoCircular, SvgStatusError, SvgStatusSuccess, SvgStatusWarning } from "@itwin/itwinui-icons-react";
import "./StatusIcon.scss";

const StatusIconMap = {
  success: SvgStatusSuccess,
  error: SvgStatusError,
  warning: SvgStatusWarning,
  informational: SvgInfoCircular,
  trace: SvgFlag,
} as const;

export const StatusIcon = ({ status, className, ...rest }: { status: keyof typeof StatusIconMap; className?: string }) => {
  const Element = StatusIconMap[status];
  return <Element className={classnames("gmw-status-icon", `gmw-status-icon-${status}`, className)} {...rest} />;
};
