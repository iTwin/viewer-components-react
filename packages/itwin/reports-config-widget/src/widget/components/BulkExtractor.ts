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
import { toaster } from "@itwin/itwinui-react";
import { FailedExtractionToast, SuccessfulExtractionToast } from "./ExtractionToast";

export type ReportMappingAndMapping = ReportMapping & {
  mappingName: string;
  mappingDescription: string;
  iModelName: string;
};

export default class BulkExtractor {
  private _reportRunIds = new Map<string, string[]>();
  private _reportsClientApi: ReportsClient;
  private _extractionClientApi: ExtractionClient;
  private _accessToken: () => Promise<string>;
  private _reportStates = new Map<string, ExtractionStates>();
  private _iModelStates = new Map<string, ExtractionStates>();
  private _timeFetched = new Date();
  private _reportIds: string[];
  private _iModelRun = new Map<string, string>();
  private _iModelToast = new Map<string, boolean>();

  constructor(apiConfig: ReportsApiConfig, reportIds: string[]) {
    const url = generateUrl(REPORTING_BASE_PATH, apiConfig.baseUrl);
    this._reportsClientApi = new ReportsClient(url);
    this._extractionClientApi = new ExtractionClient(url);
    this._accessToken = apiConfig.getAccessToken;
    this._reportIds = reportIds;
  }

  private async fetchStates() {
    const stateByReportId = new Map<string, ExtractionStates>();
    const stateByIModelId = new Map<string, ExtractionStates>();
    const stateByRunId = new Map<string, ExtractorState>();

    for (const reportId of this._reportIds) {
      const runs = this._reportRunIds.get(reportId);
      if (!runs) {
        stateByReportId.set(reportId, ExtractionStates.None);
        continue;
      }

      const states: ExtractorState[] = [];
      for (const runId of runs) {
        const state = stateByRunId.get(runId);
        if (state) {
          states.push(state);
        } else {
          const runState = await this.getState(runId, await this._accessToken());
          states.push(runState);
          stateByRunId.set(runId, runState);
        }
      }
      const finalState = BulkExtractor.getFinalState(states);
      stateByReportId.set(reportId, finalState);
    }

    for (const iModelRun of this._iModelRun) {
      let state = stateByRunId.get(iModelRun[1]);

      if (!state) {
        state = await this.getState(iModelRun[1], await this._accessToken());
        stateByRunId.set(iModelRun[1], state);
      }

      const finalState = BulkExtractor.getFinalState([state]);
      stateByIModelId.set(iModelRun[0], finalState);
    }

    this._reportStates = stateByReportId;
    this._iModelStates = stateByIModelId;
  }

  public getReportState(reportId: string): ExtractionStates {
    if ((new Date().getTime() - this._timeFetched.getTime()) > STATUS_CHECK_INTERVAL) {
      this._timeFetched = new Date();
      this.fetchStates().catch((e) =>
        /* eslint-disable no-console */
        console.error(e)
      );
    }
    return this._reportStates.get(reportId) ?? ExtractionStates.None;
  }

  public getIModelState(iModelId: string, iModelName: string, odataFeedUrl: string): ExtractionStates {
    const state = this._iModelStates.get(iModelId) ?? ExtractionStates.None;
    if (!(state === ExtractionStates.Succeeded || state === ExtractionStates.Failed)) {
      if ((new Date().getTime() - this._timeFetched.getTime()) > STATUS_CHECK_INTERVAL) {
        this._timeFetched = new Date();
        this.fetchStates().catch((e) =>
          /* eslint-disable no-console */
          console.error(e)
        );
      }
    }
    if (state === ExtractionStates.Succeeded && !this._iModelToast.get(iModelId)) {
      toaster.positive(SuccessfulExtractionToast({ iModelName, odataFeedUrl }));
      this._iModelToast.set(iModelId, true);
    } else if (state === ExtractionStates.Failed && !this._iModelToast.get(iModelId)) {
      toaster.negative(FailedExtractionToast({ iModelName }));
      this._iModelToast.set(iModelId, true);
    }
    return state;
  }

  public clearReportJob(reportId: string) {
    this._reportRunIds.delete(reportId);
    this._iModelStates = new Map<string, ExtractionStates>();
    this._iModelRun = new Map<string, string>();
  }

  public clearIModelJob(iModelId: string) {
    this._iModelRun.delete(iModelId);
    this._iModelStates.delete(iModelId);
    this._iModelToast.delete(iModelId);
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

  private async getState(runId: string, accessToken: string): Promise<ExtractorState> {
    try {
      const response = await this._extractionClientApi.getExtractionStatus(accessToken, runId);
      return response.state;
    } catch (error: any) {
      handleError(error.status);
    }
    return ExtractorState.Failed;
  }

  public async runReportExtractions(reportIds: string[]) {
    const reportIModelIds = new Map<string, string[]>();
    for (const reportId of reportIds) {
      const reportIModels = await this.fetchReportIModels(reportId);
      reportIModelIds.set(reportId, reportIModels);
      this._reportStates.set(reportId, ExtractionStates.Starting);
    }
    const iModels = new Set(Array.from(reportIModelIds.values()).flat());
    const extractionMap =
      Array.from(iModels).map(async (iModel): Promise<[string, string | undefined]> => {
        const run = await this.runExtraction(iModel);
        return [iModel, run];
      });

    const extractionByIModel = new Map<string, string | undefined>(await Promise.all(extractionMap));
    reportIds.forEach((reportId) => {
      const reportIModels = reportIModelIds.get(reportId)!;
      const runs: string[] = [];
      reportIModels.forEach((iModelId) => {
        const runId = extractionByIModel.get(iModelId);
        if (runId) {
          runs.push(runId);
          this._iModelStates.set(iModelId, ExtractionStates.Starting);
          this._iModelRun.set(iModelId, runId);
        }
      });
      this._reportRunIds.set(reportId, runs);
    });
  }

  private async runExtraction(iModelId: string): Promise<string | undefined> {
    try {
      const response = await this._extractionClientApi.runExtraction(
        await this._accessToken(),
        iModelId
      );
      this._iModelToast.set(iModelId, false);
      return response.id;
    } catch (error: any) {
      handleError(error.status);
    }
    return undefined;
  }

  public async runIModelExtraction(iModelId: string) {
    const run = await this.runExtraction(iModelId);
    this._iModelStates.set(iModelId, ExtractionStates.Starting);
    if (run)
      this._iModelRun.set(iModelId, run);
  }

  public async runIModelExtractions(reportMappings: ReportMappingAndMapping[]) {
    const uniqueIModels = new Set(Array.from(reportMappings.map((x) => x.imodelId)));
    for (const iModelId of uniqueIModels) {
      const run = await this.runExtraction(iModelId);
      this._iModelStates.set(iModelId, ExtractionStates.Starting);
      if (run)
        this._iModelRun.set(iModelId, run);
    }
  }

  private async fetchReportIModels(reportId: string) {
    const reportMappings = await this._reportsClientApi.getReportMappings(
      await this._accessToken(),
      reportId
    );
    return reportMappings.map((x) => x.imodelId);
  }
}
