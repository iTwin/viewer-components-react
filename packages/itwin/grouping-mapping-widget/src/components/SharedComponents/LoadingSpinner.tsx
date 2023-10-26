/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProgressRadial } from "@itwin/itwinui-react";
import React from "react";
import "./LoadingSpinner.scss";

export const LoadingSpinner = () => {
  return (
    <div className="gmw-loading-spinner">
      <ProgressRadial size="small" indeterminate />
    </div>
  );
};
