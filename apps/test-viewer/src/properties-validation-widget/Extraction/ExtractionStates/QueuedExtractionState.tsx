/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { SvgStatusPending } from "@itwin/itwinui-icons-react";

export const QueuedExtractionState = () => (
  <div title="Queued" className="gmw-extraction-status">
    <div className="gmw-status-icon">
      <SvgStatusPending />
    </div>
  </div>
);
