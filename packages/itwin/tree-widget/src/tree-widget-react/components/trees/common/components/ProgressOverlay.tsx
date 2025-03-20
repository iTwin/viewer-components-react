/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./ProgressOverlay.css";
import { ProgressBar, VisuallyHidden } from "@itwin/itwinui-react/bricks";
import { TreeWidget } from "../../../../TreeWidget.js";

export function ProgressOverlay() {
  return (
    <div className="tw-progress-overlay-container">
      <ProgressBar aria-labelledby={"tw-progress-bar"} />
      <VisuallyHidden id={"tw-progress-bar"}>{TreeWidget.translate("loading.filter")}</VisuallyHidden>
      <div className="tw-progress-overlay-backdrop" />
    </div>
  );
}
