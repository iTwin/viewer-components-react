/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ExtractionClient, REPORTING_BASE_PATH, ReportMapping, ReportsClient, MappingsClient, ExtractorState } from "@itwin/insights-client";
import { generateUrl, handleError } from "./utils";
import { useReportsApiConfig } from "../context/ReportsApiConfigContext";
import type { CreateTypeFromInterface } from "./utils";
import type {
  GetSingleIModelParams,
  IModelsClientOptions,
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
  reportStates = new Map<string, ExtractionStates>();
  reportRunIds = new Map<string, string[]>();
  apiConfig = useReportsApiConfig();

  public async getStates(reportIds: string[]): Promise<Map<string, ExtractionStates>> {
    const extractionClientApi = new ExtractionClient(
      generateUrl(REPORTING_BASE_PATH, this.apiConfig.baseUrl)
    );
    const accessToken = await this.apiConfig.getAccessToken();

    const stateByReportId = new Map<string, ExtractionStates>();
    const stateByRunId = new Map<string, ExtractorState>();

    for (const reportId of reportIds) {
      const runs = this.reportRunIds.get(reportId);
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
          const runState = await this.getSingleState(runId, extractionClientApi, accessToken);
          states.push(runState);
          stateByRunId.set(runId, runState);
        }
      }
      const finalState = this.getFinalState(states);
      stateByReportId.set(reportId, finalState);
    }
    return stateByReportId;
  }

  public clearJobs() {
    this.reportRunIds = new Map<string, string[]>();
  }

  private getFinalState(states: ExtractorState[]) {
    const responseState = states.includes(ExtractorState.Failed) ? ExtractionStates.Failed :
      states.includes(ExtractorState.Queued) ? ExtractionStates.Queued :
        states.includes(ExtractorState.Running) ? ExtractionStates.Running :
          states.includes(ExtractorState.Succeeded) ? ExtractionStates.Succeeded : ExtractionStates.Failed;
    return responseState;
  }

  private async getSingleState(runId: string, extractionClientApi: ExtractionClient, accessToken: string): Promise<ExtractorState> {
    try {
      const response = await extractionClientApi.getExtractionStatus(accessToken, runId);
      return response.state;
    } catch (error: any) {
      handleError(error.status);
    }
    return ExtractorState.Failed;
  }

  public async startJobs(reportIds: string[]) {
    const extractionClientApi = new ExtractionClient(
      generateUrl(REPORTING_BASE_PATH, this.apiConfig.baseUrl)
    );
    const accessToken = await this.apiConfig.getAccessToken();

    const extractionByIModel = new Map<string, string>();
    for (const reportId of reportIds) {
      const IModels = (await this.fetchReportMappings(reportId, this.apiConfig)).map(m => m.imodelId);
      const uniqueIModels = Array.from(new Set(IModels));

      const runs: string[] = [];
      for (const iModelId of uniqueIModels) {
        const extraction = extractionByIModel.get(iModelId);
        if (extraction) {
          runs.push(extraction);
        }
        else {
          const run = await this.runExtraction(iModelId, extractionClientApi, accessToken);
          if (run) {
            runs.push(run.id);
            extractionByIModel.set(iModelId, run.id);
          }
        }
      }
      this.reportRunIds.set(reportId, runs);
    }
  }

  private async runExtraction(iModelId: string, extractionClientApi: ExtractionClient, accessToken: string) {
    try {
      const response = await extractionClientApi.runExtraction(
        accessToken,
        iModelId
      );
      return response;
    } catch (error: any) {
      handleError(error.status);
    }
    return undefined;
  };

  private async fetchReportMappings(
    reportId: string,
    apiContext: ReportsApiConfig
  ): Promise<ReportMappingAndMapping[]> {
    try {
      const reportsClientApi = new ReportsClient(
        generateUrl(REPORTING_BASE_PATH, apiContext.baseUrl)
      );
      const mappingsClientApi = new MappingsClient(
        generateUrl(REPORTING_BASE_PATH, apiContext.baseUrl)
      );
      const accessToken = await apiContext.getAccessToken();
      const reportMappings = await reportsClientApi.getReportMappings(
        accessToken,
        reportId
      );
      const iModelClientOptions: IModelsClientOptions = {
        api: { baseUrl: generateUrl(Constants.api.baseUrl, apiContext.baseUrl) },
      };

      const iModelsClient: IModelsClient = new IModelsClient(iModelClientOptions);
      const authorization =
        AccessTokenAdapter.toAuthorizationCallback(accessToken);
      const iModelNames = new Map<string, string>();
      const reportMappingsAndMapping = await Promise.all(
        reportMappings.map(async (reportMapping) => {
          const iModelId = reportMapping.imodelId;
          let iModelName = "";
          const mapping = await mappingsClientApi.getMapping(
            accessToken,
            iModelId,
            reportMapping.mappingId
          );
          if (iModelNames.has(iModelId)) {
            iModelName = iModelNames.get(iModelId) ?? "";
          } else {
            const getSingleParams: GetSingleIModelParams = {
              authorization,
              iModelId,
            };
            const iModel = await iModelsClient.iModels.getSingle(getSingleParams);
            iModelName = iModel.displayName;
            iModelNames.set(iModelId, iModelName);
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
  };
}