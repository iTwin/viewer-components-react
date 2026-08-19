/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./ProgressOverlay.css";

import { LinearProgress } from "@mui/material";
import { visuallyHidden } from "@mui/utils";
import { useTranslation } from "../contexts/LocalizationContext.js";

/** @internal */
export function ProgressOverlay() {
  const translate = useTranslation();
  return (
    <div className="tw-progress-overlay-container">
      <LinearProgress aria-labelledby={"tw-progress-bar"} color={"primary"} />
      <span id={"tw-progress-bar"} style={visuallyHidden}>
        {translate("loading.search")}
      </span>
      <div className="tw-progress-overlay-backdrop" />
    </div>
  );
}
