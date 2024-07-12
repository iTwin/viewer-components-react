/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { SvgStatusError, SvgStatusSuccess } from "@itwin/itwinui-icons-color-react";

interface ExtractionStateProps {
  status: string;
  animation: boolean;
  onAnimationEnd: () => void;
}

export const ANIMATION_DELAY = "3s";
export const ANIMATION_DURATION = "1s";

export const TerminalExtractionState = ({ status, animation, onAnimationEnd }: ExtractionStateProps) => (
  <div title={status} className="gmw-extraction-status">
    <div
      className={`gmw-status-icon`}
      style={{
        animationName: animation ? "gmw-fade-out" : "",
        animationDelay: ANIMATION_DELAY,
        animationDuration: ANIMATION_DURATION,
      }}
      onAnimationEnd={onAnimationEnd}
    >
      {status === "Succeeded" ? <SvgStatusSuccess /> : <SvgStatusError />}
    </div>
  </div>
);
