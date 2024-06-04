/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { ProgressRadial } from "@itwin/itwinui-react";
import { ReportsConfigWidget } from "../../../ReportsConfigWidget";

export const RunningExtractionState = () => (
  <div title={ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Running")} className="rcw-extraction-status-running">
    <ProgressRadial size="x-small" indeterminate />
  </div>
);
