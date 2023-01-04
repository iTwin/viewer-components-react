/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ExtractionClient, ExtractorState, REPORTING_BASE_PATH, ReportsClient } from "@itwin/insights-client";
import type { ReportMapping } from "@itwin/insights-client";
import { generateUrl, handleError } from "./utils";
import type { ReportsApiConfig } from "../context/ReportsApiConfigContext";
import { ExtractionStates } from "./ExtractionStatus";
import { STATUS_CHECK_INTERVAL } from "./Constants";

export type ReportMappingAndMapping = ReportMapping & {
  mappingName: string;
  mappingDescription: string;
  iModelName: string;
};

export default class BulkExtractor {
  private _reportsClientApi: ReportsClient;
  private _extractionClientApi: ExtractionClient;
  private _accessToken: () => Promise<string>;

  private _reportIModels = new Map<string, string[]>(); // key: reportId, value: iModels
  private _iModelStates = new Map<string, ExtractorState>(); // key: iModelId, value: state
  private _timeFetched = new Date();
  private _iModelRun = new Map<string, string>(); // key: iModelId, value: runId
  private _iModelToast = new Set<string>();
  private _successfulExtractionToast: (iModelName: string, odataFeedUrl: string) => void;
  private _failedExtractionToast: (iModelName: string) => void;
  private _setJobRunning: React.Dispatch<React.SetStateAction<boolean>> | undefined;
  private _iModels: string[] = [];

  constructor(
    apiConfig: ReportsApiConfig,
    successfulExtractionToast: (iModelName: string, odataFeedUrl: string) => void,
    failedExtractionToast: (iModelName: string) => void,
  ) {
    const url = generateUrl(REPORTING_BASE_PATH, apiConfig.baseUrl);
    this._reportsClientApi = new ReportsClient(url);
    this._extractionClientApi = new ExtractionClient(url);
    this._accessToken = apiConfig.getAccessToken;
    this._successfulExtractionToast = successfulExtractionToast;
    this._failedExtractionToast = failedExtractionToast;
  }

  private async fetchStates(): Promise<void> {
    for (const [iModelId, runId] of this._iModelRun) {
      const state = await this.getState(runId);
      if (state === ExtractorState.Succeeded || state === ExtractorState.Failed) {
        this._iModelRun.delete(iModelId);
      }
      this._iModelStates.set(iModelId, state);
    }
  }

  public async getReportState(reportId: string): Promise<ExtractionStates> {
    if ((new Date().getTime() - this._timeFetched.getTime()) > STATUS_CHECK_INTERVAL) {
      this._timeFetched = new Date();
      await this.fetchStates();
    }

    const iModels = this._reportIModels.get(reportId);
    if (!iModels) return ExtractionStates.None;
    const states: ExtractorState[] = [];
    for (const iModelId of iModels) {
      const state = this._iModelStates.get(iModelId);
      if (!state) continue;
      states.push(state);
    }
    return BulkExtractor.getFinalState(states);
  }

  public async getIModelState(iModelId: string, iModelName: string, odataFeedUrl: string): Promise<ExtractionStates> {
    if ((new Date().getTime() - this._timeFetched.getTime()) > STATUS_CHECK_INTERVAL) {
      this._timeFetched = new Date();
      await this.fetchStates();
    }

    const state = this._iModelStates.get(iModelId);
    if (!state) return ExtractionStates.None;
    if (!this._iModelToast.has(iModelId)) {
      if (state === ExtractorState.Succeeded) {
        this._successfulExtractionToast(iModelName, odataFeedUrl);
        this._iModelToast.add(iModelId);
        this.checkRunning();
      } else if (state === ExtractorState.Failed) {
        this._failedExtractionToast(iModelName);
        this._iModelToast.add(iModelId);
        this.checkRunning();
      }
    }
    return BulkExtractor.getFinalState([state]);
  }

  private static getFinalState(states: ExtractorState[]): ExtractionStates {
    if (states.includes(ExtractorState.Failed))
      return ExtractionStates.Failed;

    if (states.includes(ExtractorState.Queued))
      return ExtractionStates.Queued;

    if (states.includes(ExtractorState.Running))
      return ExtractionStates.Running;

    if (states.includes(ExtractorState.Succeeded))
      return ExtractionStates.Succeeded;

    return ExtractionStates.Failed;
  }

  private async getState(runId: string): Promise<ExtractorState> {
    try {
      const accessToken = await this._accessToken();
      const response = await this._extractionClientApi.getExtractionStatus(accessToken, runId);
      return response.state;
    } catch (error: any) {
      handleError(error.status);
    }
    return ExtractorState.Failed;
  }

  private checkRunning(): void {
    if (this._setJobRunning) {
      let allFinished = true;
      this._iModels.forEach((iModelId) => {
        const state = this._iModelStates.get(iModelId);
        if (state === ExtractorState.Queued || state === ExtractorState.Running) {
          allFinished = false;
        }
      });

      this._setJobRunning(!allFinished);
    }
  }

  public async runReportExtractions(reportIds: string[]): Promise<void> {
    const reportIModelIds = new Map<string, string[]>();
    for (const reportId of reportIds) {
      const reportIModels = await this.fetchReportIModels(reportId);
      reportIModelIds.set(reportId, reportIModels);
      this._reportIModels.set(reportId, reportIModels);
    }
    const iModels = new Set(Array.from(reportIModelIds.values()).flat());

    for (const iModel of iModels) {
      await this.runIModelExtractions([iModel]);
    }
  }

  private async runExtraction(iModelId: string): Promise<string | undefined> {
    try {
      const response = await this._extractionClientApi.runExtraction(
        await this._accessToken(),
        iModelId
      );
      this._iModelToast.delete(iModelId);
      return response.id;
    } catch (error: any) {
      handleError(error.status);
    }
    return undefined;
  }

  public async runIModelExtraction(iModelId: string): Promise<void> {
    return this.runIModelExtractions([iModelId]);
  }

  public setHook(setJobRunning: React.Dispatch<React.SetStateAction<boolean>>, iModels: string[]): void {
    this._setJobRunning = setJobRunning;
    this._iModels = iModels;
    this.checkRunning();
  }

  public async runIModelExtractions(iModels: string[]): Promise<void> {
    for (const iModelId of iModels) {
      const run = await this.runExtraction(iModelId);
      if (run) {
        this._iModelStates.set(iModelId, ExtractorState.Queued);
        this._iModelRun.set(iModelId, run);
      }
      this.checkRunning();
    }
  }

  private async fetchReportIModels(reportId: string): Promise<string[]> {
    const reportMappings = await this._reportsClientApi.getReportMappings(
      await this._accessToken(),
      reportId
    );
    return reportMappings.map((x) => x.imodelId);
  }
}
