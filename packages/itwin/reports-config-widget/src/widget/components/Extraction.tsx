/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import { Label, SelectOption, StatusMessage } from "@itwin/itwinui-react";
import { ComboBox, ProgressRadial, Text } from "@itwin/itwinui-react";
import * as React from "react";
import { useContext, useEffect, useMemo, useState } from "react";
import { ReportingClient, REPORTING_BASE_PATH } from "@itwin/insights-client";
import { generateUrl, handleError, LoadingOverlay, LoadingSpinner, SkeletonBlock } from "./utils";
import "./Extraction.scss";
import { SvgStatusError, SvgStatusPending, SvgStatusSuccess } from "@itwin/itwinui-icons-color-react";
import { ApiContext, useApi } from "../context/ApiContext";

export enum ExtractionStates {
  None,
  Checking,
  Queued,
  Running,
  Succeeded,
  Failed
}
interface ExtractionStatusProps {
  state: ExtractionStates;
  setExtractionState?: React.Dispatch<React.SetStateAction<ExtractionStates>>;
  children?: React.ReactNode;
}

export const ExtractionStatus = ({ state, children, setExtractionState }: ExtractionStatusProps) => {
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
    case ExtractionStates.Checking:
      return (
        <div title={IModelApp.localization.getLocalizedString("ReportsConfigWidget:Checking")} className="extraction-status">
          <ProgressRadial size="x-small" indeterminate />
        </div>
      );
    case ExtractionStates.Queued:
      return (
        <div title={IModelApp.localization.getLocalizedString("ReportsConfigWidget:Queued")} className="extraction-status">
          <div
            className="status-icon"
          >
            <SvgStatusPending />
          </div>
        </div>
      );
    case ExtractionStates.Running:
      return (
        <div title={IModelApp.localization.getLocalizedString("ReportsConfigWidget:Running")} className="extraction-status">
          <ProgressRadial size="x-small" indeterminate />
        </div>
      );
    case ExtractionStates.Succeeded:
      return (
        <div title={IModelApp.localization.getLocalizedString("ReportsConfigWidget:Success")} className="extraction-status">
          <div
            className={`status-icon`}
            style={{ animationName: fadeOut ? "fade-out" : "", animationDelay: "5s", animationDuration: "1s" }}
            onAnimationEnd={onAnimationEnd}
          >
            <SvgStatusSuccess />
          </div>
        </div >
      );
    case ExtractionStates.Failed:
      return (
        <div title={IModelApp.localization.getLocalizedString("ReportsConfigWidget:Failed")} className="extraction-status">
          <div
            className={`status-icon`}
            style={{ animationName: fadeOut ? "fade-out" : "", animationDelay: "5s", animationDuration: "1s" }}
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

interface ExtractionProps {
  iModels: Map<string, string>;
  setExtractingIModelId: React.Dispatch<React.SetStateAction<string>>;
  extractionState: ExtractionStates;
  setExtractionState: React.Dispatch<React.SetStateAction<ExtractionStates>>;
  isLoading: boolean;
}

export const Extraction = ({ iModels, setExtractingIModelId, extractionState, setExtractionState, isLoading }: ExtractionProps) => {
  const [jobId, setJobId] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [intervalId, setIntervalId] = useState<number>();
  const [currentIModelName, setCurrentIModelName] = useState<string>();
  const apiContext = useApi();

  const runExtraction = async (iModelId: string) => {
    try {
      setExtractionState(ExtractionStates.Checking);
      setExtractingIModelId(iModelId);
      const reportingClientApi = new ReportingClient(generateUrl(REPORTING_BASE_PATH, apiContext.baseUrl))
      const response = await reportingClientApi.runExtraction(apiContext.accessToken, iModelId);
      setJobId(response.run?.id ?? "");
      setIsRunning(true);

    } catch (error: any) {
      handleError(error.status);
      setExtractionState(ExtractionStates.Failed);
    }
  };

  useEffect(() => {
    if (!intervalId && isRunning) {
      const delay = 5000;
      const newIntervalId = window.setInterval(async () => {
        setExtractionState(ExtractionStates.Checking);
        const reportingClientApi = new ReportingClient(generateUrl(REPORTING_BASE_PATH, apiContext.baseUrl))
        const response = await reportingClientApi.getExtractionStatus(apiContext.accessToken, jobId);
        if (response.status?.state === "Queued") {
          setExtractionState(ExtractionStates.Queued);
        } else if (response.status?.state === "Running") {
          setExtractionState(ExtractionStates.Running);
        } else if (response.status?.state === "Succeeded") {
          setExtractionState(ExtractionStates.Succeeded);
          setIsRunning(false);
          setCurrentIModelName(undefined);
        } else if (response.status?.state === "Failed") {
          setExtractionState(ExtractionStates.Failed);
          setIsRunning(false);
          setCurrentIModelName(undefined);
        }
      }, delay);
      setIntervalId(newIntervalId);
    } else if (intervalId && !isRunning) {
      window.clearInterval(intervalId);
      setIntervalId(undefined);
    }
    return () => window.clearInterval(intervalId);
  }, [apiContext, isRunning, intervalId, jobId, setExtractionState]);

  const iModelOptions = useMemo(() => {
    // TODO Report ComboBox bug. Unique key error happens when the options list becomes reduced.
    const newIModelOptions: SelectOption<string>[] = [];

    for (const [iModelId, iModelName] of iModels.entries()) {
      newIModelOptions.push({ label: iModelName, value: iModelId, key: iModelId, disabled: extractionState !== ExtractionStates.None });
    }
    return newIModelOptions;
  }, [iModels, extractionState]);

  return (
    <div className="extraction-container">

      <div className="extraction-combo-box">
        <Label htmlFor='combo-input'>{IModelApp.localization.getLocalizedString("ReportsConfigWidget:UpdateDataset")}</Label>
        {
          isLoading ? <SkeletonBlock /> :
            <ComboBox
              options={iModelOptions}
              value={currentIModelName}
              onChange={async (value) => {
                await runExtraction(value);
                setCurrentIModelName(value)
              }}
              inputProps={{
                id: "combo-input",
                placeholder: IModelApp.localization.getLocalizedString("ReportsConfigWidget:SelectIModel"),
              }}
              message={extractionState !== ExtractionStates.None && <StatusMessage>
                <div className="extraction-status-container">
                  <ExtractionStatus state={extractionState} setExtractionState={setExtractionState} />
                  {IModelApp.localization.getLocalizedString("ReportsConfigWidget:UpdateInProgress")}
                </div>
              </StatusMessage>
              }
            />}
      </div>
    </div >
  );
};
