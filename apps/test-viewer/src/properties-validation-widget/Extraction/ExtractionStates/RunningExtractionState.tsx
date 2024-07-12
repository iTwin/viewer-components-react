/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { ProgressRadial } from "@itwin/itwinui-react";

export const RunningExtractionState = () => (
  <div title="Running" className="gmw-extraction-status-running">
    <ProgressRadial size="x-small" indeterminate />
  </div>
);
