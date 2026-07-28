/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./ProgressOverlay.css";

import { ProgressBar, VisuallyHidden } from "@stratakit/bricks";
import { useTranslation } from "./LocalizationContext.js";

/** @internal */
export function ProgressOverlay() {
  const translate = useTranslation();
  return (
    <div className="tw-progress-overlay-container">
      <ProgressBar aria-labelledby={"tw-progress-bar"} tone={"accent"} />
      <VisuallyHidden id={"tw-progress-bar"}>{translate("loading.search")}</VisuallyHidden>
      <div className="tw-progress-overlay-backdrop" />
    </div>
  );
}
