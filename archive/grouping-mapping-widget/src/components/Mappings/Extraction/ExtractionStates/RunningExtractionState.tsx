/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { ProgressRadial } from "@itwin/itwinui-react";
import { GroupingMappingWidget } from "../../../../GroupingMappingWidget";

export const RunningExtractionState = () => (
  <div title={GroupingMappingWidget.translate("extraction.running")} className="gmw-extraction-status-running">
    <ProgressRadial size="x-small" indeterminate />
  </div>
);
