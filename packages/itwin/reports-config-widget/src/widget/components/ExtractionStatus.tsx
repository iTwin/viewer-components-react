/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProgressRadial } from "@itwin/itwinui-react";
import * as React from "react";
import { useEffect, useState } from "react";
import "./ExtractionStatus.scss";
import {
  SvgStatusError,
  SvgStatusPending,
  SvgStatusPendingHollow,
  SvgStatusSuccess,
} from "@itwin/itwinui-icons-color-react";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";

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
  setExtractionState?: React.Dispatch<React.SetStateAction<ExtractionStates>>;
  children?: React.ReactNode;
}

export const ExtractionStatus = ({
  state,
  children,
  setExtractionState,
}: ExtractionStatusProps) => {
  const [fadeOut, setFadeOut] = useState<boolean>(false);

  const onAnimationEnd = () => {
    if (setExtractionState) {
      setExtractionState(ExtractionStates.None);
      setFadeOut(false);
    }
  };

  useEffect(() => {
    let timer: number;
    switch (state) {
      case ExtractionStates.Succeeded:
      case ExtractionStates.Failed:
        timer = window.setTimeout(() => setFadeOut(true), 5000);
    }
    return () => clearTimeout(timer);
  }, [state, setExtractionState]);

  switch (state) {
    case ExtractionStates.Starting:
      return (
        <div
          title={ReportsConfigWidget.localization.getLocalizedString(
            "ReportsConfigWidget:Starting"
          )}
          className="rcw-extraction-status"
        >
          <div className="rcw-status-icon">
            <SvgStatusPendingHollow />
          </div>
        </div>
      );
    case ExtractionStates.FetchingUpdate:
      return (
        <div
          title={ReportsConfigWidget.localization.getLocalizedString(
            "ReportsConfigWidget:Loading"
          )}
          className="rcw-extraction-status"
        >
          <ProgressRadial size="x-small" indeterminate />
        </div>
      );
    case ExtractionStates.Queued:
      return (
        <div
          title={ReportsConfigWidget.localization.getLocalizedString(
            "ReportsConfigWidget:Queued"
          )}
          className="rcw-extraction-status"
        >
          <div className="rcw-status-icon">
            <SvgStatusPending />
          </div>
        </div>
      );
    case ExtractionStates.Running:
      return (
        <div
          title={ReportsConfigWidget.localization.getLocalizedString(
            "ReportsConfigWidget:Running"
          )}
          className="rcw-extraction-status"
        >
          <ProgressRadial size="x-small" indeterminate />
        </div>
      );
    case ExtractionStates.Succeeded:
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
              animationName: fadeOut ? "rcw-fade-out" : "",
              animationDelay: "5s",
              animationDuration: "1s",
            }}
            onAnimationEnd={onAnimationEnd}
          >
            <SvgStatusSuccess />
          </div>
        </div>
      );
    case ExtractionStates.Failed:
      return (
        <div
          title={ReportsConfigWidget.localization.getLocalizedString(
            "ReportsConfigWidget:Failed"
          )}
          className="rcw-extraction-status"
        >
          <div
            className={`rcw-status-icon`}
            style={{
              animationName: fadeOut ? "rcw-fade-out" : "",
              animationDelay: "5s",
              animationDuration: "1s",
            }}
            onAnimationEnd={onAnimationEnd}
          >
            <SvgStatusError />
          </div>
        </div>
      );
    default:
      return <>{children}</>;
  }
};
