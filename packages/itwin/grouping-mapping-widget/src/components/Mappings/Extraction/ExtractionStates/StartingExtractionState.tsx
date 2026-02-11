/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { SvgStatusPendingHollow } from "@itwin/itwinui-icons-color-react";
import { GroupingMappingWidget } from "../../../../GroupingMappingWidget";

export const StartingExtractionState = () => (
  <div title={GroupingMappingWidget.translate("extraction.starting")} className="gmw-extraction-status">
    <div className="gmw-status-icon">
      <SvgStatusPendingHollow />
    </div>
  </div>
);
