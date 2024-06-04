/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ExtractionState } from "@itwin/insights-client";
import { handleError } from "./utils";
import { ExtractionStates } from "./ExtractionStatus";
import { STATUS_CHECK_INTERVAL } from "./Constants";
import type {
  ExtractionClient,
  ExtractionMapping,
  ExtractionRequestDetails,
  ReportMapping,
  ReportsClient,
} from "@itwin/insights-client";
import type { AccessToken } from "@itwin/core-bentley";

export type ReportMappingAndMapping = ReportMapping & {
  mappingName: string;
  mappingDescription: string;
  iModelName: string;
};

/**
 * @public
 */
export class BulkExtractor {
  private _reportsClientApi: ReportsClient;
  private _extractionClientApi: ExtractionClient;
  private _accessToken: () => Promise<string>;

  private _reportIModels = new Map<string, string[]>(); // key: reportId, value: iModels
  private _iModelStates = new Map<string, ExtractionState>(); // key: iModelId, value: state
  private _timeFetched = new Date();
  private _iModelRun = new Map<string, string>(); // key: iModelId, value: runId
  private _iModelToast = new Set<string>();
  private _successfulExtractionToast: (iModelName: string, odataFeedUrl: string) => void;
  private _failedExtractionToast: (iModelName: string) => void;
  private _setJobRunning: React.Dispatch<React.SetStateAction<boolean>> | undefined;
  private _iModels: string[] = [];

  constructor(
    reportsClient: ReportsClient,
    extractionClient: ExtractionClient,
    getAccessToken: () => Promise<AccessToken>,
    successfulExtractionToast: (iModelName: string, odataFeedUrl: string) => void,
    failedExtractionToast: (iModelName: string) => void,
  ) {
    this._reportsClientApi = reportsClient;
    this._extractionClientApi = extractionClient;
    this._accessToken = getAccessToken;
    this._successfulExtractionToast = successfulExtractionToast;
    this._failedExtractionToast = failedExtractionToast;
  }

  private async fetchStates(): Promise<void> {
    for (const [iModelId, runId] of this._iModelRun) {
      const state = await this.getState(runId);
      if (state === ExtractionState.Succeeded || state === ExtractionState.Failed) {
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
    const states: ExtractionState[] = [];
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
      if (state === ExtractionState.Succeeded) {
        this._successfulExtractionToast(iModelName, odataFeedUrl);
        this._iModelToast.add(iModelId);
        this.checkRunning();
      } else if (state === ExtractionState.Failed) {
        this._failedExtractionToast(iModelName);
        this._iModelToast.add(iModelId);
        this.checkRunning();
      }
    }
    return BulkExtractor.getFinalState([state]);
  }

  private static getFinalState(states: ExtractionState[]): ExtractionStates {
    if (states.includes(ExtractionState.Failed))
      return ExtractionStates.Failed;

    if (states.includes(ExtractionState.Queued))
      return ExtractionStates.Queued;

    if (states.includes(ExtractionState.Running))
      return ExtractionStates.Running;

    if (states.includes(ExtractionState.Succeeded))
      return ExtractionStates.Succeeded;

    return ExtractionStates.Failed;
  }

  private async getState(runId: string): Promise<ExtractionState> {
    try {
      const accessToken = await this._accessToken();
      const response = await this._extractionClientApi.getExtractionStatus(accessToken, runId);
      return response.state;
    } catch (error: any) {
      handleError(error.status);
    }
    return ExtractionState.Failed;
  }

  private checkRunning(): void {
    if (this._setJobRunning) {
      let allFinished = true;
      this._iModels.forEach((iModelId) => {
        const state = this._iModelStates.get(iModelId);
        if (state === ExtractionState.Queued || state === ExtractionState.Running) {
          allFinished = false;
        }
      });

      this._setJobRunning(!allFinished);
    }
  }

  public async runReportExtractions(reportIds: string[]): Promise<void> {
    const extractionDetailsIModelIdMap = new Map<string, ExtractionMapping[]>();
    for (const reportId of reportIds) {
      const reportExtractionDetails = await this.fetchReportExtractionRequestDetails(reportId);
      const reportIModels = reportExtractionDetails.map((reportExtractionDetail) => reportExtractionDetail.iModelId);
      this._reportIModels.set(reportId, reportIModels);
      reportExtractionDetails.forEach((extractionDetail) => {
        const existingMappings = extractionDetailsIModelIdMap.get(extractionDetail.iModelId) || [];
        extractionDetailsIModelIdMap.set(extractionDetail.iModelId, [...existingMappings, ...extractionDetail.mappings]);
      });
    }

    const extractionDetails: ExtractionRequestDetails[] = Array.from(
      extractionDetailsIModelIdMap.entries()).map(([iModelId, mappings]) => {
      const mappingSetArray: ExtractionMapping[] = Array.from(new Set(mappings.map((m) => m.id))).map((id) => ({id}));
      return {
        iModelId,
        mappings: mappingSetArray,
      };
    });
    await this.runIModelExtractions(extractionDetails);
  }

  private async runExtraction(extractionRequestDetails: ExtractionRequestDetails): Promise<string | undefined> {
    try {
      const response = await this._extractionClientApi.runExtraction(await this._accessToken(), extractionRequestDetails);
      this._iModelToast.delete(extractionRequestDetails.iModelId);
      return response.id;
    } catch (error: any) {
      handleError(error.status);
    }
    return undefined;
  }

  public async runIModelExtraction(extractionRequestDetails: ExtractionRequestDetails): Promise<void> {
    return this.runIModelExtractions([extractionRequestDetails]);
  }

  public setHook(setJobRunning: React.Dispatch<React.SetStateAction<boolean>>, iModels: string[]): void {
    this._setJobRunning = setJobRunning;
    this._iModels = iModels;
    this.checkRunning();
  }

  public async runIModelExtractions(extractionRequestsDetails: ExtractionRequestDetails[]): Promise<void> {
    await Promise.all(extractionRequestsDetails.map(async (details) => {
      const run = await this.runExtraction(details);
      if (run) {
        this._iModelStates.set(details.iModelId, ExtractionState.Queued);
        this._iModelRun.set(details.iModelId, run);
      }
    }));
    this.checkRunning();
  }

  private async fetchReportExtractionRequestDetails(reportId: string): Promise<ExtractionRequestDetails[]> {
    const reportMappings = await this._reportsClientApi.getReportMappings(
      await this._accessToken(),
      reportId
    );
    const extractionRequestDetails: ExtractionRequestDetails[] = reportMappings.map((reportMapping) => {
      return {
        iModelId: reportMapping.imodelId,
        mappings: [{id: reportMapping.mappingId}],
      };
    });
    return extractionRequestDetails;
  }
}
