/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { SvgStatusSuccess } from "@itwin/itwinui-icons-color-react";
import { ReportsConfigWidget } from "../../../ReportsConfigWidget";
import { ANIMATION_DELAY, ANIMATION_DURATION } from "../Constants";

export const SucceededExtractionState = (animation: string, onAnimationEnd: () => void) => {
  return (
    <div
      title={ReportsConfigWidget.localization.getLocalizedString(
        "ReportsConfigWidget:Success"
      )}
      className="rcw-extraction-status"
    >
      <div
        className={`rcw-status-icon`}
        style={{
          animationName: animation,
          animationDelay: ANIMATION_DELAY,
          animationDuration: ANIMATION_DURATION,
        }}
        onAnimationEnd={onAnimationEnd}
      >
        <SvgStatusSuccess />
      </div>
    </div>
  );
};
