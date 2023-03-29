/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import classnames from "classnames";
import SvgStatusSuccess from "@itwin/itwinui-icons-react/esm/icons/StatusSuccess";
import SvgStatusError from "@itwin/itwinui-icons-react/esm/icons/StatusError";
import SvgStatusWarning from "@itwin/itwinui-icons-react/esm/icons/StatusWarning";
import SvgInfoCircular from "@itwin/itwinui-icons-react/esm/icons/InfoCircular";
import "./StatusIcon.scss";

const StatusIconMap = {
  success: SvgStatusSuccess,
  error: SvgStatusError,
  warning: SvgStatusWarning,
  informational: SvgInfoCircular,
} as const;

export const StatusIcon = ({
  status,
  className,
  ...rest
}: {
  status: keyof typeof StatusIconMap;
  className?: string;
}) => {
  const Element = StatusIconMap[status];
  return <Element className={classnames("gmw-status-icon", `gmw-status-icon-${status}`, className)} {...rest} />;
};
