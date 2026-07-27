/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./ProgressOverlay.css";

import { LinearProgress } from "@mui/material";
import { useTranslation } from "./LocalizationContext.js";

/** @internal */
export function ProgressOverlay() {
  const translate = useTranslation();
  return (
    <div className="tw-progress-overlay-container">
      <LinearProgress aria-label={translate("loading.search")} color={"primary"} />
      <div className="tw-progress-overlay-backdrop" />
    </div>
  );
}
