/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { useEffect, useState } from "react";
import "./ExtractionStatus.scss";
import { STATUS_CHECK_INTERVAL } from "./Constants";
import { StartingExtractionState } from "./ExtractionStates/StartingExtractionState";
import { RunningExtractionState } from "./ExtractionStates/RunningExtractionState";
import { FailedExtractionState } from "./ExtractionStates/FailedExtractionState";
import { QueuedExtractionState } from "./ExtractionStates/QueuedExtractionState";
import { SucceededExtractionState } from "./ExtractionStates/SucceededExtractionState";

export enum ExtractionStates {
  None,
  Starting,
  Queued,
  Running,
  Succeeded,
  Failed,
}

interface ExtractionStatusProps {
  state: ExtractionStates;
  clearExtractionState: () => void;
}

export const ExtractionStatus = ({ state, clearExtractionState }: ExtractionStatusProps) => {
  const [fadeOut, setFadeOut] = useState<boolean>(false);

  const onAnimationEnd = () => {
    clearExtractionState();
    setFadeOut(false);
  };

  useEffect(() => {
    let timer: number;
    switch (state) {
      case ExtractionStates.Succeeded:
      case ExtractionStates.Failed:
        timer = window.setTimeout(() => setFadeOut(true), STATUS_CHECK_INTERVAL);
    }
    return () => window.clearTimeout(timer);
  }, [state]);

  switch (state) {
    case ExtractionStates.Starting:
      return <StartingExtractionState />;
    case ExtractionStates.Queued:
      return <QueuedExtractionState />;
    case ExtractionStates.Running:
      return <RunningExtractionState />;
    case ExtractionStates.Succeeded:
      return <SucceededExtractionState animation={fadeOut} onAnimationEnd={onAnimationEnd} />;
    case ExtractionStates.Failed:
      return <FailedExtractionState animation={fadeOut} onAnimationEnd={onAnimationEnd} />;
    default:
      return <></>;
  }
};
