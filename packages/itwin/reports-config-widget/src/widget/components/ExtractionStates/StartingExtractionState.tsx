/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { SvgStatusPendingHollow } from "@itwin/itwinui-icons-color-react";
import { ReportsConfigWidget } from "../../../ReportsConfigWidget";

export const StartingExtractionState = () => (
  <div title={ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Starting")} className="rcw-extraction-status">
    <div className="rcw-status-icon">
      <SvgStatusPendingHollow />
    </div>
  </div>
);
