/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useActiveIModelConnection } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { SvgCaretRight, SvgCopy } from "@itwin/itwinui-icons-react";
import { Button, ExpandableBlock, IconButton, LabeledInput, ProgressRadial, Text, toaster } from "@itwin/itwinui-react";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { ReportingClient } from "../../reporting/reportingClient";
import { handleError, LoadingSpinner } from "./utils";
import "./Extraction.scss";
import { SvgStatusError, SvgStatusPending, SvgStatusRunning, SvgStatusSuccess } from "@itwin/itwinui-icons-color-react";

enum ExtractionStates {
  None,
  Checking,
  Queued,
  Running,
  Succeeded,
  Failed
}

export const Extraction = () => {
  const iModelId = useActiveIModelConnection()?.iModelId as string;
  const [jobId, setJobId] = useState<string>("");
  const [state, setState] = useState<ExtractionStates>(ExtractionStates.None);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout>();

  const runExtraction = async () => {
    try {
      setState(ExtractionStates.Checking);
      const accessToken = (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
      const reportingClientApi = new ReportingClient();
      const response = await reportingClientApi.runExtraction(accessToken, iModelId);
      setJobId(response.run?.id ?? "");
      setIsRunning(true);

    } catch (error: any) {
      handleError(error.status);
      setState(ExtractionStates.Failed);
    }
  };

  useEffect(() => {
    if (!intervalId && isRunning) {
      const newIntervalId = setInterval(async () => {
        setState(ExtractionStates.Checking);
        const accessToken = (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
        const reportingClientApi = new ReportingClient();
        const response = await reportingClientApi.getExtractionStatus(accessToken, jobId);
        if (response.status?.state === "Queued") {
          setState(ExtractionStates.Queued);
        } else if (response.status?.state === "Running") {
          setState(ExtractionStates.Running);
        } else if (response.status?.state === "Succeeded") {
          setState(ExtractionStates.Succeeded);
          setIsRunning(false);
        } else if (response.status?.state === "Failed") {
          setState(ExtractionStates.Failed);
          setIsRunning(false);
        }
      }, 5000);
      setIntervalId(newIntervalId);
    }
    else if (intervalId && !isRunning) {
      clearInterval(intervalId);
      setIntervalId(undefined)
    }
  }, [isRunning, intervalId, jobId]);


  const status = (state: ExtractionStates) => {
    switch (state) {
      case ExtractionStates.Checking:
        return (
          <div className="extraction-status">
            <ProgressRadial size="x-small" indeterminate />
            <Text>{IModelApp.localization.getLocalizedString("ReportsWidget:Checking")}</Text>
          </div>
        )
      case ExtractionStates.Queued:
        return (
          <div className="extraction-status">
            <div
              className="status-icon"
            >
              <SvgStatusPending />
            </div>
            <Text>{IModelApp.localization.getLocalizedString("ReportsWidget:Queued")}</Text>
          </div>
        )
      case ExtractionStates.Running:
        return (
          <div className="extraction-status">
            <div
              className="status-icon"
            >
              <SvgStatusRunning />
            </div>
            <Text>{IModelApp.localization.getLocalizedString("ReportsWidget:Running")}</Text>
          </div>
        )
      case ExtractionStates.Succeeded:
        return (
          <div className="extraction-status">
            <div
              className="status-icon"
            >
              <SvgStatusSuccess />
            </div>
            <Text>{IModelApp.localization.getLocalizedString("ReportsWidget:Success")}</Text>
          </div>
        )
      case ExtractionStates.Failed:
        return (
          <div className="extraction-status">
            <div
              className="status-icon"
            >
              <SvgStatusError />
            </div>
            <Text>{IModelApp.localization.getLocalizedString("ReportsWidget:Failed")}</Text>
          </div>
        )
      default:
        return (
          <div className="extraction-status">
            <Text>{IModelApp.localization.getLocalizedString("ReportsWidget:NotStarted")}</Text>
          </div>
        )
    }
  }

  return (
    <ExpandableBlock
      title={IModelApp.localization.getLocalizedString("ReportsWidget:Extraction")}>
      <div className="extraction-container">
        <span className="extraction-status-container">
          <Text>{IModelApp.localization.getLocalizedString("ReportsWidget:Status")}</Text>{status(state)}
          <IconButton styleType='borderless' onClick={async (_) => {
            await navigator.clipboard.writeText(jobId);
            toaster.positive(IModelApp.localization.getLocalizedString("ReportsWidget:CopiedToClipboard"));
          }}
            disabled={!jobId}
            title={IModelApp.localization.getLocalizedString("ReportsWidget:CopyJobId")}>
            <SvgCopy />
          </IconButton>
        </span>
        <Button onClick={async () => runExtraction()} disabled={isRunning} startIcon={<SvgCaretRight />}>
          {IModelApp.localization.getLocalizedString("ReportsWidget:Run")}
        </Button>
      </div>
    </ExpandableBlock>
  );
};
