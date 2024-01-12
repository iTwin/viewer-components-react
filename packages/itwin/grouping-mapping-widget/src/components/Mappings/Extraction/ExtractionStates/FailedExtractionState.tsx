/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { SvgStatusError } from "@itwin/itwinui-icons-react";
import { ANIMATION_DELAY, ANIMATION_DURATION } from "../../../Constants";

interface ExtractionStateProps {
  animation: boolean;
  onAnimationEnd: () => void;
}

export const FailedExtractionState = ({ animation, onAnimationEnd }: ExtractionStateProps) => (
  <div
    title="Failed"
    className="gmw-extraction-status">
    <div
      className={`gmw-status-icon`}
      style={{
        animationName: animation ? "gmw-fade-out" : "",
        animationDelay: ANIMATION_DELAY,
        animationDuration: ANIMATION_DURATION,
      }}
      onAnimationEnd={onAnimationEnd}
    >
      <SvgStatusError />
    </div>
  </div>
);
