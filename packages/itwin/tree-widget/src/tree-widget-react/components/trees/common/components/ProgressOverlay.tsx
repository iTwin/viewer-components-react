/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./ProgressOverlay.css";
import { ProgressBar } from "@itwin/itwinui-react/bricks";

// TODO: replace spinner with ProgressLinear equivalent
export function ProgressOverlay() {
  return (
    <div className="tw-progress-overlay-container">
      <ProgressBar aria-labelledby={"tw-search-box-button"} />
      <div className="tw-progress-overlay-backdrop" />
    </div>
  );
}
