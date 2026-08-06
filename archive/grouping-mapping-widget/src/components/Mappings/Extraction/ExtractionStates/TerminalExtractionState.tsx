/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { SvgStatusError, SvgStatusSuccess } from "@itwin/itwinui-icons-color-react";
import { ANIMATION_DELAY, ANIMATION_DURATION } from "../../../Constants";
import { GroupingMappingWidget } from "../../../../GroupingMappingWidget";

interface ExtractionStateProps {
  status: string;
  animation: boolean;
  onAnimationEnd: () => void;
}

export const TerminalExtractionState = ({ status, animation, onAnimationEnd }: ExtractionStateProps) => (
  <div title={status === "Succeeded" ? GroupingMappingWidget.translate("extraction.succeeded") : GroupingMappingWidget.translate("extraction.failed")} className="gmw-extraction-status">
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
