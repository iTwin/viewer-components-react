/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./ProgressOverlay.css";
import { ProgressBar, VisuallyHidden } from "@itwin/itwinui-react/bricks";
import { TreeWidget } from "../../../../TreeWidget.js";

// TODO: replace spinner with ProgressLinear equivalent
export function ProgressOverlay() {
  return (
    <div className="tw-progress-overlay-container">
      <VisuallyHidden aria-label={TreeWidget.translate("loading.search")} id={"tw-progress-bar"} />
      <ProgressBar aria-labelledby={"tw-progress-bar"} />
      <div className="tw-progress-overlay-backdrop" />
    </div>
  );
}
