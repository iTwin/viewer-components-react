/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { useEffect, useState } from "react";
import "./ExtractionStatus.scss";
import { STATUS_CHECK_INTERVAL } from "./Constants";
import { StartingExtractionState } from "./ExtractionStates/StartingExtractionState";
import { FetchingUpdateExtractionState } from "./ExtractionStates/FetchingUpdateExtractionState";
import { RunningExtractionState } from "./ExtractionStates/RunningExtractionState";
import { FailedExtractionState } from "./ExtractionStates/FailedExtractionState";
import { QueuedExtractionState } from "./ExtractionStates/QueuedExtractionState";
import { SucceededExtractionState } from "./ExtractionStates/SucceededExtractionState";

export enum ExtractionStates {
  None,
  Starting,
  FetchingUpdate,
  Queued,
  Running,
  Succeeded,
  Failed,
}

interface ExtractionStatusProps {
  state: ExtractionStates;
  clearExtractionState: () => void;
  children?: React.ReactNode;
}

export const ExtractionStatus = ({
  state,
  children,
  clearExtractionState,
}: ExtractionStatusProps) => {
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
      return StartingExtractionState();
    case ExtractionStates.FetchingUpdate:
      return FetchingUpdateExtractionState();
    case ExtractionStates.Queued:
      return QueuedExtractionState();
    case ExtractionStates.Running:
      return RunningExtractionState();
    case ExtractionStates.Succeeded:
      return SucceededExtractionState(fadeOut ? "rcw-fade-out" : "", onAnimationEnd);
    case ExtractionStates.Failed:
      return FailedExtractionState(fadeOut ? "rcw-fade-out" : "", onAnimationEnd);
    default:
      return <>{children}</>;
  }
};
