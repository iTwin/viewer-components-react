/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";

import type {
  CalculatedPropertyCreate,
  CalculatedPropertyUpdate,
  CustomCalculationCreate,
  CustomCalculationUpdate,
  GroupCreate,
  GroupPropertyCreate,
  GroupPropertyUpdate,
  GroupUpdate,
  Mapping,
  MappingCollection,
  MappingCopy,
  MappingCreate,
  MappingUpdate,
  ReportCreate,
  ReportMappingCreate,
  ReportUpdate} from "./generated/api";
import {
  ExtractionApi,
} from "./generated/api";
import { MappingsApi, REPORTING_BASE_PATH, ReportsApi } from "./generated/api";

const ACCEPT = "application/vnd.bentley.itwin-platform.v1+json";

const prefixUrl = (baseUrl?: string, prefix?: string) => {
  if (prefix && baseUrl) {
    return baseUrl.replace("api.bentley.com", `${prefix}api.bentley.com`);
  }
  return baseUrl;
};

// To be only used within Viewer
export class ReportingClient {
  private _mappingsApi: MappingsApi;
  private _reportsApi: ReportsApi;
  private _extractionApi: ExtractionApi;
  constructor() {
    const baseUrl = prefixUrl(REPORTING_BASE_PATH, process.env.IMJS_URL_PREFIX);
    this._mappingsApi = new MappingsApi(undefined, baseUrl);
    this._reportsApi = new ReportsApi(undefined, baseUrl);
    this._extractionApi = new ExtractionApi(undefined, baseUrl);
  }

  public async runExtraction(accessToken: AccessToken, iModelId: string) {
    return this._extractionApi.runExtraction(
      iModelId,
      accessToken,
      ACCEPT
    );
  }

  public async getExtractionStatus(accessToken: AccessToken, jobId: string) {
    return this._extractionApi.getExtractionStatus(
      jobId,
      accessToken,
      ACCEPT
    );

  }

  public async getReports(accessToken: AccessToken, projectId: string) {
    return this._reportsApi.getProjectReports(
      projectId,
      accessToken,
      undefined,
      undefined,
      false,
      ACCEPT
    );
  }

  public async createReport(accessToken: AccessToken, report: ReportCreate) {
    return this._reportsApi.createReport(
      accessToken,
      report,
      ACCEPT
    );
  }

  public async updateReport(accessToken: AccessToken, reportId: string, report: ReportUpdate) {
    return this._reportsApi.updateReport(
      reportId,
      accessToken,
      report,
      ACCEPT
    );
  }

  public async deleteReport(accessToken: AccessToken, reportId: string) {
    return this._reportsApi.deleteReport(
      reportId,
      accessToken,
      ACCEPT
    );
  }

  public async getReportMappings(accessToken: AccessToken, reportId: string) {
    return this._reportsApi.getReportMappings(
      reportId,
      accessToken,
      undefined,
      undefined,
      ACCEPT
    );
  }

  public async createReportMapping(accessToken: AccessToken, reportId: string, reportMapping: ReportMappingCreate) {
    return this._reportsApi.createReportMapping(
      reportId,
      accessToken,
      reportMapping,
      ACCEPT
    );
  }

  public async deleteReportMapping(accessToken: AccessToken, reportId: string, reportMappingId: string) {
    return this._reportsApi.deleteReportMapping(
      reportId,
      reportMappingId,
      accessToken,
      ACCEPT
    );
  }

  public async getMappings(accessToken: AccessToken, iModelId: string) {
    const mappings: Array<Mapping> = [];

    let response: MappingCollection;
    let continuationToken: string | undefined;

    do {
      response = await this._mappingsApi.getMappings(
        iModelId,
        accessToken,
        undefined,
        continuationToken,
        ACCEPT
      );
      response.mappings && mappings.push(...response.mappings);
      if (!response._links?.next?.href) {
        continue;
      }
      const url = new URL(response._links?.next?.href);
      continuationToken =
        url.searchParams.get("$continuationToken") ?? undefined;
    } while (response._links?.next?.href);

    return mappings;
  }

  public async getMapping(accessToken: AccessToken, mappingId: string, iModelId: string) {
    return this._mappingsApi.getMapping(iModelId, mappingId, accessToken);
  }

  public async createMapping(
    accessToken: AccessToken,
    iModelId: string,
    mapping: MappingCreate
  ) {
    return this._mappingsApi.createMapping(iModelId, accessToken, mapping);
  }

  public async updateMapping(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    mapping: MappingUpdate
  ) {
    return this._mappingsApi.updateMapping(
      iModelId,
      mappingId,
      accessToken,
      mapping
    );
  }

  public async deleteMapping(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string
  ) {
    return this._mappingsApi.deleteMapping(iModelId, mappingId, accessToken);
  }

  public async copyMapping(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    mappingCopy: MappingCopy
  ) {
    return this._mappingsApi.copyMapping(
      iModelId,
      mappingId,
      accessToken,
      mappingCopy
    );
  }

  public async getGroups(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string
  ) {
    return this._mappingsApi.getGroups(iModelId, mappingId, accessToken);
  }

  public async createGroup(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    group: GroupCreate
  ) {
    return this._mappingsApi.createGroup(
      iModelId,
      mappingId,
      accessToken,
      group
    );
  }

  public async getGroup(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    groupId: string
  ) {
    return this._mappingsApi.getGroup(
      iModelId,
      mappingId,
      groupId,
      accessToken
    );
  }

  public async updateGroup(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    groupId: string,
    group: GroupUpdate
  ) {
    return this._mappingsApi.updateGroup(
      iModelId,
      mappingId,
      groupId,
      accessToken,
      group
    );
  }

  public async deleteGroup(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    groupId: string
  ) {
    return this._mappingsApi.deleteGroup(
      iModelId,
      mappingId,
      groupId,
      accessToken
    );
  }

  public async getGroupProperties(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    groupId: string
  ) {
    return this._mappingsApi.getGroupproperties(
      iModelId,
      mappingId,
      groupId,
      accessToken
    );
  }

  public async getGroupProperty(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    groupId: string,
    propertyId: string
  ) {
    return this._mappingsApi.getGroupproperty(
      iModelId,
      mappingId,
      groupId,
      propertyId,
      accessToken
    );
  }

  public async createGroupProperty(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    groupId: string,
    groupProperty: GroupPropertyCreate
  ) {
    return this._mappingsApi.createGroupproperty(
      iModelId,
      mappingId,
      groupId,
      accessToken,
      groupProperty
    );
  }

  public async updateGroupProperty(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    groupId: string,
    groupPropertyId: string,
    groupProperty: GroupPropertyUpdate
  ) {
    return this._mappingsApi.updateGroupproperty(
      iModelId,
      mappingId,
      groupId,
      groupPropertyId,
      accessToken,
      groupProperty
    );
  }

  public async deleteGroupProperty(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    groupId: string,
    groupPropertyId: string
  ) {
    return this._mappingsApi.deleteGroupproperty(
      iModelId,
      mappingId,
      groupId,
      groupPropertyId,
      accessToken
    );
  }

  public async getCalculatedProperties(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    groupId: string
  ) {
    return this._mappingsApi.getCalculatedproperties(
      iModelId,
      mappingId,
      groupId,
      accessToken
    );
  }

  public async getCalculatedProperty(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    groupId: string,
    propertyId: string
  ) {
    return this._mappingsApi.getCalculatedproperty(
      iModelId,
      mappingId,
      groupId,
      propertyId,
      accessToken
    );
  }

  public async createCalculatedProperty(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    groupId: string,
    property: CalculatedPropertyCreate
  ) {
    return this._mappingsApi.createCalculatedproperty(
      iModelId,
      mappingId,
      groupId,
      accessToken,
      property
    );
  }

  public async updateCalculatedProperty(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    groupId: string,
    propertyId: string,
    property: CalculatedPropertyUpdate
  ) {
    return this._mappingsApi.updateCalculatedproperty(
      iModelId,
      mappingId,
      groupId,
      propertyId,
      accessToken,
      property
    );
  }

  public async deleteCalculatedProperty(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    groupId: string,
    propertyId: string
  ) {
    return this._mappingsApi.deleteCalculatedproperty(
      iModelId,
      mappingId,
      groupId,
      propertyId,
      accessToken
    );
  }

  public async getCustomCalculations(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    groupId: string
  ) {
    return this._mappingsApi.getCustomcalculations(
      iModelId,
      mappingId,
      groupId,
      accessToken
    );
  }

  public async getCustomCalculation(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    groupId: string,
    propertyId: string
  ) {
    return this._mappingsApi.getCustomcalculation(
      iModelId,
      mappingId,
      groupId,
      propertyId,
      accessToken
    );
  }

  public async createCustomCalculation(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    groupId: string,
    property: CustomCalculationCreate
  ) {
    return this._mappingsApi.createCustomcalculation(
      iModelId,
      mappingId,
      groupId,
      accessToken,
      property
    );
  }

  public async updateCustomCalculation(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    groupId: string,
    propertyId: string,
    property: CustomCalculationUpdate
  ) {
    return this._mappingsApi.updateCustomcalculation(
      iModelId,
      mappingId,
      groupId,
      propertyId,
      accessToken,
      property
    );
  }

  public async deleteCustomCalculation(
    accessToken: AccessToken,
    iModelId: string,
    mappingId: string,
    groupId: string,
    propertyId: string
  ) {
    return this._mappingsApi.deleteCustomcalculation(
      iModelId,
      mappingId,
      groupId,
      propertyId,
      accessToken
    );
  }
}
