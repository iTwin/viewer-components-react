/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./ProgressOverlay.scss";
import { Spinner } from "@itwin/itwinui-react/bricks";

export function ProgressOverlay() {
  return (
    <div className="tw-progress-overlay-container">
      {/* <ProgressLinear indeterminate /> */}
      <Spinner />
      <div className="tw-progress-overlay-backdrop" />
    </div>
  );
}
