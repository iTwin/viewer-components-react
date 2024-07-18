/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { useEffect, useState } from "react";
import * as React from "react";
import { StartingExtractionState } from "./ExtractionStates/StartingExtractionState";
import { QueuedExtractionState } from "./ExtractionStates/QueuedExtractionState";
import { TerminalExtractionState } from "./ExtractionStates/TerminalExtractionState";
import { RunningExtractionState } from "./ExtractionStates/RunningExtractionState";
import { STATUS_CHECK_INTERVAL } from "../PropertyTable/PropertyTable";
import "./ExtractionStatus.scss";

export enum ExtractionStates {
  None,
  Starting,
  Queued,
  Running,
  Succeeded,
  Failed,
}

interface ExtractionStatusProps {
  state: ExtractionStates | undefined;
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
      return <TerminalExtractionState status="Succeeded" animation={fadeOut} onAnimationEnd={() => {}} />;
    case ExtractionStates.Failed:
      return <TerminalExtractionState status="Failed" animation={fadeOut} onAnimationEnd={() => {}} />;
    default:
      return null;
  }
};
