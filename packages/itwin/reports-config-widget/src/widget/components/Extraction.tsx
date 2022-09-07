/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { SelectOption } from "@itwin/itwinui-react";
import {
  ComboBox,
  Label,
  ProgressRadial,
  StatusMessage,
} from "@itwin/itwinui-react";
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExtractionClient, REPORTING_BASE_PATH } from "@itwin/insights-client";
import { generateUrl, handleError, SkeletonBlock } from "./utils";
import "./Extraction.scss";
import {
  SvgStatusError,
  SvgStatusPending,
  SvgStatusPendingHollow,
  SvgStatusSuccess,
} from "@itwin/itwinui-icons-color-react";
import { useReportsApiConfig } from "../context/ReportsApiConfigContext";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";

export const REFRESH_DELAY = 2000;

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
          className="extraction-status"
        >
          <div className="status-icon">
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
          className="extraction-status"
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
          className="extraction-status"
        >
          <div className="status-icon">
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
          className="extraction-status"
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
          className="extraction-status"
        >
          <div
            className={`status-icon`}
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
          className="extraction-status"
        >
          <div
            className={`status-icon`}
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

interface ExtractionProps {
  iModels: Map<string, string>;
  setExtractingIModelId: React.Dispatch<React.SetStateAction<string>>;
  extractionState: ExtractionStates;
  setExtractionState: React.Dispatch<React.SetStateAction<ExtractionStates>>;
  isLoading: boolean;
}

export const Extraction = ({
  iModels,
  setExtractingIModelId,
  extractionState,
  setExtractionState,
  isLoading,
}: ExtractionProps) => {
  const jobId = useRef<string>("");
  const intervalId = useRef<number>();
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentIModelId, setCurrentIModelId] = useState<string>();
  const apiConfig = useReportsApiConfig();

  const runExtraction = async (iModelId: string) => {
    try {
      setExtractionState(ExtractionStates.Starting);
      setExtractingIModelId(iModelId);
      const extractionClientApi = new ExtractionClient(
        generateUrl(REPORTING_BASE_PATH, apiConfig.baseUrl)
      );
      const accessToken = await apiConfig.getAccessToken();
      const response = await extractionClientApi.runExtraction(
        accessToken,
        iModelId
      );
      jobId.current = response.id;
      setIsRunning(true);
      setExtractionState(ExtractionStates.FetchingUpdate);
    } catch (error: any) {
      handleError(error.status);
      setExtractionState(ExtractionStates.Failed);
      setIsRunning(false);
      setCurrentIModelId(undefined);
    }
  };

  useEffect(() => {
    if (!intervalId.current && isRunning) {
      const newIntervalId = window.setInterval(async () => {
        const extractionClientApi = new ExtractionClient(
          generateUrl(REPORTING_BASE_PATH, apiConfig.baseUrl)
        );
        const accessToken = await apiConfig.getAccessToken();
        const response = await extractionClientApi.getExtractionStatus(
          accessToken,
          jobId.current
        );
        if (response.state === "Queued") {
          setExtractionState(ExtractionStates.Queued);
        } else if (response.state === "Running") {
          setExtractionState(ExtractionStates.Running);
        } else if (response.state === "Succeeded") {
          setExtractionState(ExtractionStates.Succeeded);
          setIsRunning(false);
          setCurrentIModelId(undefined);
        } else if (response.state === "Failed") {
          setExtractionState(ExtractionStates.Failed);
          setIsRunning(false);
          setCurrentIModelId(undefined);
        }
      }, REFRESH_DELAY);
      intervalId.current = newIntervalId;
    } else if (intervalId && !isRunning) {
      window.clearInterval(intervalId.current);
      intervalId.current = undefined;
    }
    return () => window.clearInterval(intervalId.current);
  }, [apiConfig, isRunning, jobId, setExtractionState]);

  const iModelOptions = useMemo(() => {
    const newIModelOptions: SelectOption<string>[] = [];

    for (const [iModelId, iModelName] of iModels.entries()) {
      newIModelOptions.push({
        label: iModelName,
        value: iModelId,
        key: iModelId,
        disabled: extractionState !== ExtractionStates.None,
      });
    }

    return newIModelOptions;
  }, [iModels, extractionState]);

  return (
    <div className="extraction-container">
      <div className="extraction-combo-box" data-testid="extraction-combo-box">
        <Label htmlFor="combo-input">
          {ReportsConfigWidget.localization.getLocalizedString(
            "ReportsConfigWidget:UpdateDataset"
          )}
        </Label>
        {isLoading ? (
          <SkeletonBlock />
        ) : (
          <ComboBox
            options={iModelOptions}
            value={currentIModelId}
            onChange={async (value) => {
              setCurrentIModelId(value);
              value && await runExtraction(value);
            }}
            inputProps={{
              id: "combo-input",
              placeholder: ReportsConfigWidget.localization.getLocalizedString(
                "ReportsConfigWidget:SelectIModel"
              ),
            }}
            message={
              extractionState !== ExtractionStates.None && (
                <StatusMessage>
                  <div className="extraction-status-container">
                    <ExtractionStatus
                      state={extractionState}
                      setExtractionState={setExtractionState}
                    />
                    {(() => {
                      switch (extractionState) {
                        case ExtractionStates.Succeeded: {
                          return ReportsConfigWidget.localization.getLocalizedString(
                            "ReportsConfigWidget:Success"
                          );
                        }
                        case ExtractionStates.Failed: {
                          return ReportsConfigWidget.localization.getLocalizedString(
                            "ReportsConfigWidget:Failed"
                          );
                        }
                        default: {
                          return ReportsConfigWidget.localization.getLocalizedString(
                            "ReportsConfigWidget:UpdateInProgress"
                          );
                        }
                      }
                    })()}
                  </div>
                </StatusMessage>
              )
            }
          />
        )}
      </div>
    </div>
  );
};
