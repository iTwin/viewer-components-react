/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { SvgStatusPending } from "@itwin/itwinui-icons-color-react";
import { ReportsConfigWidget } from "../../../ReportsConfigWidget";

export const QueuedExtractionState = () => (
  <div title={ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Queued")} className="rcw-extraction-status">
    <div className="rcw-status-icon">
      <SvgStatusPending />
    </div>
  </div>
);
