/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ProgressLinear } from "@itwin/itwinui-react";
import "./ProgressOverlay.scss";

/** @internal */
export function ProgressOverlay() {
  return (
    <div className="tw-progress-overlay-container">
      <ProgressLinear indeterminate />
      <div className="tw-progress-overlay-backdrop" />
    </div>
  );
}
