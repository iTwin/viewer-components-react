/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ExtractionClient, ExtractorState, MappingsClient, REPORTING_BASE_PATH, ReportsClient } from "@itwin/insights-client";
import type { ReportMapping } from "@itwin/insights-client";
import { generateUrl, handleError } from "./utils";
import type { CreateTypeFromInterface } from "./utils";
import type {
  GetSingleIModelParams,
} from "@itwin/imodels-client-management";
import { Constants, IModelsClient } from "@itwin/imodels-client-management";
import { AccessTokenAdapter } from "@itwin/imodels-access-frontend";
import type { ReportsApiConfig } from "../context/ReportsApiConfigContext";
import { ExtractionStates } from "./ExtractionStatus";

export type ReportMappingType = CreateTypeFromInterface<ReportMapping>;

export type ReportMappingAndMapping = ReportMappingType & {
  mappingName: string;
  mappingDescription: string;
  iModelName: string;
};

export default class BulkExtractor {
  private _reportRunIds = new Map<string, string[]>();
  private _reportsClientApi: ReportsClient;
  private _mappingsClientApi: MappingsClient;
  private _iModelsClient: IModelsClient;
  private _extractionClientApi: ExtractionClient;
  private _accessToken: Promise<string>;
  private _iModelNames = new Map<string, string>();

  constructor(apiConfig: ReportsApiConfig) {
    const url = generateUrl(REPORTING_BASE_PATH, apiConfig.baseUrl);
    this._reportsClientApi = new ReportsClient(url);
    this._mappingsClientApi = new MappingsClient(url);
    this._extractionClientApi = new ExtractionClient(url);
    this._iModelsClient = new IModelsClient({
      api: { baseUrl: generateUrl(Constants.api.baseUrl, apiConfig.baseUrl) },
    });
    this._accessToken = apiConfig.getAccessToken();
  }

  public async getStates(reportIds: string[]): Promise<Map<string, ExtractionStates>> {
    const stateByReportId = new Map<string, ExtractionStates>();
    const stateByRunId = new Map<string, ExtractorState>();

    for (const reportId of reportIds) {
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
          const runState = await this.getSingleState(runId, await this._accessToken);
          states.push(runState);
          stateByRunId.set(runId, runState);
        }
      }
      const finalState = this.getFinalState(states);
      stateByReportId.set(reportId, finalState);
    }
    return stateByReportId;
  }

  public clearJob(reportId: string) {
    this._reportRunIds.delete(reportId);
  }

  private getFinalState(states: ExtractorState[]) {
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

  private async getSingleState(runId: string, accessToken: string): Promise<ExtractorState> {
    try {
      const response = await this._extractionClientApi.getExtractionStatus(accessToken, runId);
      return response.state;
    } catch (error: any) {
      handleError(error.status);
    }
    return ExtractorState.Failed;
  }

  public async startJobs(reportIds: string[]) {
    const extractionByIModel = new Map<string, string>();
    for (const reportId of reportIds) {
      const iModels = (await this.fetchReportMappings(reportId)).map((m) => m.imodelId);
      const uniqueIModels = new Set(iModels);

      const runs: string[] = [];
      for (const iModelId of uniqueIModels) {
        const extraction = extractionByIModel.get(iModelId);
        if (extraction) {
          runs.push(extraction);
        } else {
          const run = await this.runExtraction(iModelId, await this._accessToken);
          if (run) {
            runs.push(run.id);
            extractionByIModel.set(iModelId, run.id);
          }
        }
      }
      this._reportRunIds.set(reportId, runs);
    }
  }

  private async runExtraction(iModelId: string, accessToken: string) {
    try {
      const response = await this._extractionClientApi.runExtraction(
        accessToken,
        iModelId
      );
      return response;
    } catch (error: any) {
      handleError(error.status);
    }
    return undefined;
  }

  private async fetchReportMappings(
    reportId: string
  ): Promise<ReportMappingAndMapping[]> {
    try {
      const reportMappings = await this._reportsClientApi.getReportMappings(
        await this._accessToken,
        reportId
      );
      const authorization =
        AccessTokenAdapter.toAuthorizationCallback(await this._accessToken);

      const reportMappingsAndMapping = await Promise.all(
        reportMappings.map(async (reportMapping) => {
          const iModelId = reportMapping.imodelId;
          let iModelName = "";
          const mapping = await this._mappingsClientApi.getMapping(
            await this._accessToken,
            iModelId,
            reportMapping.mappingId
          );
          if (this._iModelNames.has(iModelId)) {
            iModelName = this._iModelNames.get(iModelId) ?? "";
          } else {
            const getSingleParams: GetSingleIModelParams = {
              authorization,
              iModelId,
            };
            const iModel = await this._iModelsClient.iModels.getSingle(getSingleParams);
            iModelName = iModel.displayName;
            this._iModelNames.set(iModelId, iModelName);
          }
          const reportMappingAndMapping: ReportMappingAndMapping = {
            ...reportMapping,
            iModelName,
            mappingName: mapping.mappingName,
            mappingDescription: mapping.description ?? "",
          };
          return reportMappingAndMapping;
        }) ?? []
      );

      return reportMappingsAndMapping;
    } catch (error: any) {
      handleError(error.status);
    }
    return [];
  }
}
